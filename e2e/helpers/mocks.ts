import type { Page, Route } from '@playwright/test';

/**
 * Intercept every Supabase REST call and return canned data so E2E
 * tests don't need a real backend. Pass a per-table response map.
 *
 * Example:
 *   await mockSupabaseRest(page, {
 *     bottles: [{ id: 'b1', name: 'Hendricks', ... }],
 *     recipes: [],
 *     allowed_emails: [{ email: 'test@example.com', is_active: true }],
 *   });
 */
export async function mockSupabaseRest(
  page: Page,
  tables: Record<string, unknown>,
): Promise<void> {
  await page.route(/.*\.supabase\.co\/(rest|auth)\/v1\/.*/, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // Auth endpoints — getUser, getSession, etc. Return the user matching
    // the injected session.
    if (path.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: { provider: 'google' },
          user_metadata: {},
        }),
      });
    }

    // REST endpoints — /rest/v1/<table>
    const match = path.match(/\/rest\/v1\/([^/?]+)/);
    if (match) {
      const table = match[1];
      const data = tables[table] ?? [];
      // Supabase returns arrays for select. .maybeSingle() expects a single
      // object; the client unwraps the array. Returning [] for an empty
      // table gives maybeSingle data=null which is what we want for the
      // "user is admin / not admin" branch.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    }

    // Anything we didn't expect — let it through so failures surface.
    return route.continue();
  });
}

/**
 * Stub /api/claude with a canned suggestion response. Avoids burning
 * real Anthropic credits and keeps tests deterministic.
 */
export async function mockClaude(
  page: Page,
  content: string,
): Promise<void> {
  await page.route('**/api/claude', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content }),
    });
  });
}

/** Build a JSON suggestion response in the shape useSuggestions expects. */
export function buildSuggestionsJson(): string {
  return JSON.stringify({
    suggestions: [
      {
        archetype: 'safe',
        recipe_name: 'Negroni',
        recipe_slug: 'negroni',
        reasoning: 'A perfectly balanced bitter aperitif for the moment.',
        adapted_recipe: {
          ingredients: [
            { ingredient_name: 'Gin', bottle_from_inventory: 'Hendricks', quantity: '1', unit: 'oz', notes: null },
            { ingredient_name: 'Sweet Vermouth', bottle_from_inventory: 'Carpano Antica', quantity: '1', unit: 'oz', notes: null },
            { ingredient_name: 'Campari', bottle_from_inventory: 'Campari', quantity: '1', unit: 'oz', notes: null },
          ],
          method: 'Stir with ice, strain over a large cube.',
          glassware: 'rocks',
          garnish: 'Orange peel',
          proof_warning: null,
          value_notes: null,
          variation_notes: null,
        },
        missing_ingredients: [],
      },
      {
        archetype: 'adventurous',
        recipe_name: 'Penicillin',
        recipe_slug: 'penicillin',
        reasoning: 'Smoky and complex — a modern classic worth trying.',
        adapted_recipe: {
          ingredients: [
            { ingredient_name: 'Blended Scotch', bottle_from_inventory: 'Famous Grouse', quantity: '2', unit: 'oz', notes: null },
            { ingredient_name: 'Lemon juice', bottle_from_inventory: null, quantity: '0.75', unit: 'oz', notes: null },
            { ingredient_name: 'Honey-ginger syrup', bottle_from_inventory: null, quantity: '0.75', unit: 'oz', notes: null },
          ],
          method: 'Shake with ice, strain over fresh ice. Float Islay scotch.',
          glassware: 'rocks',
          garnish: 'Candied ginger',
          proof_warning: null,
          value_notes: null,
          variation_notes: null,
        },
        missing_ingredients: ['Honey-ginger syrup'],
      },
      {
        archetype: 'cultural',
        recipe_name: 'Bobby Burns',
        recipe_slug: 'bobby-burns',
        reasoning: 'A nod to Burns Night — Scotch with sweet vermouth and Bénédictine.',
        adapted_recipe: {
          ingredients: [
            { ingredient_name: 'Scotch', bottle_from_inventory: 'Famous Grouse', quantity: '2', unit: 'oz', notes: null },
            { ingredient_name: 'Sweet Vermouth', bottle_from_inventory: 'Carpano Antica', quantity: '0.75', unit: 'oz', notes: null },
          ],
          method: 'Stir with ice, strain into a coupe.',
          glassware: 'coupe',
          garnish: 'Lemon twist',
          proof_warning: null,
          value_notes: null,
          variation_notes: null,
        },
        missing_ingredients: ['Bénédictine'],
      },
    ],
  });
}
