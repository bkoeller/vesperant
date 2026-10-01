import { describe, it, expect } from 'vitest';
import type { AdaptedRecipe } from '@/lib/claude';
import type { RecipeWithIngredients } from '@/features/recipes/recipes.service';
import type { RecipeIngredient } from '@/types/database.types';
import { formatAdaptedRecipeText, formatQuantity, formatRecipeText, recipeUrl } from './recipe-text';

function ing(overrides: Partial<RecipeIngredient>): RecipeIngredient {
  return {
    id: crypto.randomUUID(),
    recipe_id: 'r1',
    ingredient_name: 'Gin',
    ingredient_category: 'gin',
    quantity: 1,
    unit: 'oz',
    role: 'base',
    optional: false,
    sort_order: 0,
    notes: null,
    ...overrides,
  };
}

function recipe(overrides: Partial<RecipeWithIngredients> = {}): RecipeWithIngredients {
  return {
    id: 'r1',
    user_id: null,
    name: 'Negroni',
    aliases: [],
    slug: 'negroni',
    description: 'Equal parts, stirred over ice.',
    history: null,
    method: 'stir',
    glassware: 'Rocks',
    garnish: null,
    tags: [],
    iba_category: null,
    source: 'canonical',
    created_at: '2026-01-01T00:00:00Z',
    recipe_ingredients: [
      ing({ ingredient_name: 'Gin' }),
      ing({ ingredient_name: 'Sweet vermouth', ingredient_category: 'vermouth', role: 'modifier' }),
      ing({ ingredient_name: 'Campari', ingredient_category: 'amaro', role: 'modifier' }),
      ing({ ingredient_name: 'Orange peel', ingredient_category: 'garnish', role: 'garnish', quantity: null, unit: null }),
    ],
    ...overrides,
  };
}

describe('formatQuantity', () => {
  it('renders common fractions as glyphs', () => {
    expect(formatQuantity(0.75, 'oz')).toBe('¾ oz');
    expect(formatQuantity(1.5, 'oz')).toBe('1½ oz');
  });
  it('handles missing quantity or unit', () => {
    expect(formatQuantity(2, 'dashes')).toBe('2 dashes');
    expect(formatQuantity(null, 'splash')).toBe('splash');
    expect(formatQuantity(3, null)).toBe('3');
    expect(formatQuantity(null, null)).toBe('');
  });
});

describe('recipeUrl', () => {
  it('joins origin and slug without doubling slashes', () => {
    expect(recipeUrl('negroni', 'https://vesperant.vercel.app')).toBe('https://vesperant.vercel.app/recipes/negroni');
    expect(recipeUrl('negroni', 'https://vesperant.vercel.app/')).toBe('https://vesperant.vercel.app/recipes/negroni');
  });
});

describe('formatRecipeText', () => {
  it('formats a library recipe as plain-text blocks ending in the link', () => {
    const text = formatRecipeText(recipe(), 'https://vesperant.vercel.app/recipes/negroni');
    expect(text).toBe(
      [
        'NEGRONI',
        'Stirred · Rocks',
        '',
        '1 oz Gin',
        '1 oz Sweet vermouth',
        '1 oz Campari',
        '',
        'Garnish: Orange peel',
        '',
        'Equal parts, stirred over ice.',
        '',
        'https://vesperant.vercel.app/recipes/negroni',
      ].join('\n'),
    );
  });

  it('marks optional ingredients and includes notes', () => {
    const text = formatRecipeText(recipe({
      recipe_ingredients: [
        ing({ ingredient_name: 'Lemon juice', quantity: 0.75, notes: 'fresh' }),
        ing({ ingredient_name: 'Egg white', quantity: 1, unit: null, optional: true }),
      ],
    }));
    expect(text).toContain('¾ oz Lemon juice (fresh)');
    expect(text).toContain('1 Egg white (optional)');
  });

  it('falls back to the recipe garnish field when no garnish ingredients exist', () => {
    const text = formatRecipeText(recipe({
      garnish: 'Lemon twist',
      recipe_ingredients: [ing({ ingredient_name: 'Gin' })],
    }));
    expect(text).toContain('Garnish: Lemon twist');
  });

  it('omits empty sections and never emits blank-line runs or Markdown', () => {
    const text = formatRecipeText(recipe({ description: null, glassware: null }));
    expect(text).not.toMatch(/\n{3,}/);
    expect(text).not.toMatch(/[*#_`]/);
    expect(text.split('\n').slice(0, 2)).toEqual(['NEGRONI', 'Stirred']);
    expect(text).not.toContain('http');
  });
});

describe('formatAdaptedRecipeText', () => {
  const adapted: AdaptedRecipe = {
    ingredients: [
      { ingredient_name: 'Gin', bottle_from_inventory: 'Hendricks', quantity: '1', unit: 'oz', notes: null },
      { ingredient_name: 'Sweet Vermouth', bottle_from_inventory: null, quantity: '1', unit: 'oz', notes: 'any sweet vermouth' },
    ],
    method: 'Stir with ice, strain over a large cube.',
    glassware: 'rocks',
    garnish: 'Orange peel',
    proof_warning: 'Higher proof than usual.',
    value_notes: null,
    variation_notes: null,
  };

  it('uses inventory bottle names and includes method, garnish, warning, and link', () => {
    expect(formatAdaptedRecipeText('Negroni', adapted, 'https://x.test/recipes/negroni')).toBe(
      [
        'NEGRONI',
        'rocks',
        '',
        '1 oz Hendricks',
        '1 oz Sweet Vermouth (any sweet vermouth)',
        '',
        'Stir with ice, strain over a large cube.',
        '',
        'Garnish: Orange peel',
        '',
        'Note: Higher proof than usual.',
        '',
        'https://x.test/recipes/negroni',
      ].join('\n'),
    );
  });

  it('omits the link when the suggestion has no library recipe', () => {
    expect(formatAdaptedRecipeText('House Special', adapted)).not.toContain('http');
  });
});
