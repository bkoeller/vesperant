// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

// Runs the real get_makeable_recipes from the latest migration in an
// in-process Postgres (PGlite), against a small bar built per test.

const MIGRATION = path.resolve(__dirname, '../migrations/008_token_makeable_match.sql');
const USER = '11111111-1111-1111-1111-111111111111';

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { unaccent } });
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA extensions;
    CREATE TABLE bottles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text NOT NULL, category text NOT NULL,
      subcategory text, spirit_type text, active boolean DEFAULT true);
    CREATE TABLE recipes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
    CREATE TABLE recipe_ingredients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid REFERENCES recipes(id),
      ingredient_name text NOT NULL, ingredient_category text NOT NULL, optional boolean DEFAULT false);
  `);
  await db.exec(readFileSync(MIGRATION, 'utf8'));
}, 30_000);

beforeEach(async () => {
  await db.exec('TRUNCATE recipe_ingredients, recipes, bottles');
});

type Bottle = { name: string; category: string; subcategory?: string; spirit_type?: string; active?: boolean };
type Ingredient = [name: string, category: string, optional?: boolean];

async function bar(...bottles: Bottle[]) {
  for (const b of bottles) {
    await db.query(
      'INSERT INTO bottles (user_id, name, category, subcategory, spirit_type, active) VALUES ($1, $2, $3, $4, $5, $6)',
      [USER, b.name, b.category, b.subcategory ?? null, b.spirit_type ?? null, b.active ?? true],
    );
  }
}

async function recipe(name: string, ...ingredients: Ingredient[]) {
  const { rows } = await db.query<{ id: string }>('INSERT INTO recipes (name) VALUES ($1) RETURNING id', [name]);
  for (const [ingredient, category, optional] of ingredients) {
    await db.query(
      'INSERT INTO recipe_ingredients (recipe_id, ingredient_name, ingredient_category, optional) VALUES ($1, $2, $3, $4)',
      [rows[0].id, ingredient, category, optional ?? false],
    );
  }
}

async function missing(): Promise<Record<string, string[]>> {
  const { rows } = await db.query<{ recipe_name: string; missing_ingredients: string[] | null }>(
    'SELECT recipe_name, missing_ingredients FROM get_makeable_recipes($1)', [USER],
  );
  // ARRAY_AGG has no ORDER BY, so sort for stable comparisons.
  return Object.fromEntries(rows.map(r => [r.recipe_name, (r.missing_ingredients ?? []).sort()]));
}

describe('match_words', () => {
  it('lowercases, folds accents, splits on punctuation, and drops filler words', async () => {
    const words = async (s: string | null) =>
      (await db.query<{ w: string[] }>('SELECT public.match_words($1) AS w', [s])).rows[0].w.sort();
    expect(await words('Crème de Violette')).toEqual(['creme', 'violette']);
    expect(await words('Mr. Stacks Blue Curaçao')).toEqual(['blue', 'curacao', 'mr', 'stacks']);
    expect(await words('St-Germain')).toEqual(['germain', 'st']);
    expect(await words('')).toEqual([]);
    expect(await words(null)).toEqual([]);
  });
});

describe('get_makeable_recipes — liqueur, amaro, vermouth', () => {
  it('matches despite accents and word order', async () => {
    await bar(
      { name: 'DOM Benedictine', category: 'liqueur' },
      { name: 'Heering Cherry Liqueur', category: 'liqueur' },
      { name: 'Chartreuse Green', category: 'liqueur' },
    );
    await recipe('Bénédictine neat', ['Bénédictine', 'liqueur']);
    await recipe('Heering neat', ['Cherry Heering', 'liqueur']);
    await recipe('Chartreuse neat', ['Green Chartreuse', 'liqueur']);
    expect(await missing()).toEqual({ 'Bénédictine neat': [], 'Heering neat': [], 'Chartreuse neat': [] });
  });

  it('matches on subcategory and spirit_type as well as name', async () => {
    await bar(
      { name: 'Antica Formula Carpano', category: 'vermouth', subcategory: 'Sweet Vermouth' },
      { name: 'Tempus Fugit Crème de Banane', category: 'liqueur', spirit_type: 'Banana Liqueur' },
    );
    await recipe('Sweet', ['Sweet Vermouth', 'vermouth']);
    await recipe('Banana', ['Banana Liqueur', 'liqueur']);
    expect(await missing()).toEqual({ Sweet: [], Banana: [] });
  });

  it('still enforces identity: every ingredient word must be present', async () => {
    await bar(
      { name: 'Dolin Dry Vermouth', category: 'vermouth', subcategory: 'Dry Vermouth' },
      { name: 'Cointreau', category: 'liqueur', subcategory: 'Triple Sec' },
      { name: 'Chartreuse Jaune (Yellow Chartreuse)', category: 'liqueur' },
    );
    await recipe('Manhattan', ['Rye', 'whisky'], ['Sweet Vermouth', 'vermouth']);
    await recipe('Rusty Nail', ['Scotch', 'whisky'], ['Drambuie', 'liqueur']);
    await recipe('Last Word', ['Green Chartreuse', 'liqueur']);
    await recipe('Martini', ['Dry Vermouth', 'vermouth']);
    expect(await missing()).toEqual({
      Martini: [],
      'Last Word': ['Green Chartreuse'],
      Manhattan: ['Rye', 'Sweet Vermouth'],
      'Rusty Nail': ['Drambuie', 'Scotch'],
    });
  });

  it('ignores inactive bottles', async () => {
    await bar({ name: 'Campari', category: 'amaro', active: false });
    await recipe('Negroni-ish', ['Campari', 'amaro']);
    expect(await missing()).toEqual({ 'Negroni-ish': ['Campari'] });
  });
});

describe('get_makeable_recipes — other categories (unchanged)', () => {
  it('treats pantry categories as always available and other spirits by category', async () => {
    await bar({ name: 'Famous Grouse', category: 'whisky' });
    await recipe('Scotch Sour',
      ['Blended Scotch', 'whisky'], ['Lemon juice', 'mixer'], ['Simple syrup', 'syrup'], ['Egg white', 'other'], ['Lemon peel', 'garnish']);
    await recipe('Gimlet', ['Gin', 'gin'], ['Lime juice', 'mixer']);
    expect(await missing()).toEqual({ 'Scotch Sour': [], Gimlet: ['Gin'] });
  });

  it('does not count missing optional ingredients', async () => {
    await bar({ name: 'Famous Grouse', category: 'whisky' });
    await recipe('Scotch & Absinthe rinse', ['Scotch', 'whisky'], ['Absinthe', 'liqueur', true]);
    expect(await missing()).toEqual({ 'Scotch & Absinthe rinse': [] });
  });
});
