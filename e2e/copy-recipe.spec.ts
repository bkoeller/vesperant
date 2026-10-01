import { test, expect, type Page } from '@playwright/test';
import { signInAs } from './helpers/auth';
import { mockSupabaseRest, mockClaude, buildSuggestionsJson, buildAdaptedRecipeJson } from './helpers/mocks';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const negroni = {
  id: 'recipe-negroni',
  user_id: null,
  name: 'Negroni',
  aliases: [],
  slug: 'negroni',
  description: 'Equal parts, stirred over ice.',
  history: null,
  method: 'stir',
  glassware: 'Rocks',
  garnish: null,
  tags: ['classic'],
  iba_category: null,
  source: 'canonical',
  created_at: new Date().toISOString(),
  recipe_ingredients: [
    { id: 'i1', recipe_id: 'recipe-negroni', ingredient_name: 'Gin', ingredient_category: 'gin', quantity: 1, unit: 'oz', role: 'base', optional: false, sort_order: 0, notes: null },
    { id: 'i2', recipe_id: 'recipe-negroni', ingredient_name: 'Sweet vermouth', ingredient_category: 'vermouth', quantity: 1, unit: 'oz', role: 'modifier', optional: false, sort_order: 1, notes: null },
    { id: 'i3', recipe_id: 'recipe-negroni', ingredient_name: 'Campari', ingredient_category: 'amaro', quantity: 1, unit: 'oz', role: 'modifier', optional: false, sort_order: 2, notes: null },
    { id: 'i4', recipe_id: 'recipe-negroni', ingredient_name: 'Orange peel', ingredient_category: 'garnish', quantity: null, unit: null, role: 'garnish', optional: false, sort_order: 3, notes: null },
  ],
};

async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('Copy recipe', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAs(page, { email: 'test@example.com' });
    await mockSupabaseRest(page, {
      profiles: [{ id: USER_ID, is_admin: false, onboarding_completed: true }],
      bottles: [
        { id: 'b1', name: 'Hendricks', category: 'gin', active: true, user_id: USER_ID },
        { id: 'b2', name: 'Carpano Antica', category: 'vermouth', active: true, user_id: USER_ID },
        { id: 'b3', name: 'Campari', category: 'amaro', active: true, user_id: USER_ID },
      ],
      recipes: [negroni],
      recipe_ingredients: [],
      cocktail_logs: [],
      suggestion_sessions: [],
      suggestions: [],
    });
  });

  test('copies a library recipe as plain text with a clickable link', async ({ page, baseURL }) => {
    await page.goto('/recipes/negroni');
    await expect(page.getByRole('heading', { name: 'Negroni', level: 1 })).toBeVisible();

    const copy = page.getByRole('button', { name: 'Copy recipe' });
    await copy.click();
    await expect(copy).toHaveAttribute('title', 'Copied');

    expect(await readClipboard(page)).toBe(
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
        `${baseURL}/recipes/negroni`,
      ].join('\n'),
    );
  });

  test('copies an expanded Tonight suggestion with your bottles', async ({ page, baseURL }) => {
    await mockClaude(page, { suggestions: buildSuggestionsJson(), recipe: buildAdaptedRecipeJson() });
    await page.goto('/tonight');
    await page.getByRole('button', { name: /Suggest something/i }).click();

    const card = page.locator('div.rounded-card', { has: page.getByRole('heading', { name: 'Negroni' }) });
    await expect(card.getByRole('button', { name: 'Copy recipe' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Show recipe' }).click();
    await card.getByRole('button', { name: 'Copy recipe' }).click();
    await expect(card.getByRole('button', { name: 'Copy recipe' })).toHaveText('Copied');

    const text = await readClipboard(page);
    expect(text).toMatch(/^NEGRONI\nrocks\n\n1 oz Hendricks\n1 oz Carpano Antica\n1 oz Campari\n/);
    expect(text).toContain('Garnish: Orange peel');
    // Negroni is in the library, so the copy links to it.
    expect(text.endsWith(`${baseURL}/recipes/negroni`)).toBe(true);
  });
});
