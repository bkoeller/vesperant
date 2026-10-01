import { test, expect, type Page } from '@playwright/test';
import { signInAs } from './helpers/auth';
import { mockSupabaseRest, mockClaude, buildSuggestionsJson, buildAdaptedRecipeJson, type ClaudeRequest } from './helpers/mocks';

test.describe('Authenticated flow', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass Google OAuth by injecting a session before any app code runs.
    await signInAs(page, { email: 'test@example.com' });

    // Stub Supabase REST so the app can render without a real backend.
    // Each table returns a sensible default; specs override per-test if
    // they need different data.
    await mockSupabaseRest(page, {
      profiles: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          display_name: 'Test User',
          location_lat: null,
          location_lon: null,
          location_name: null,
          is_admin: false,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      bottles: [
        {
          id: 'bottle-1',
          user_id: '00000000-0000-0000-0000-000000000001',
          name: 'Hendricks',
          brand: 'Hendricks',
          category: 'gin',
          subcategory: 'London Dry',
          spirit_type: null,
          tags: ['floral'],
          abv: 41.4,
          proof: 82.8,
          is_premium: false,
          price_tier: 'standard',
          active: true,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      recipes: [],
      recipe_ingredients: [],
      cocktail_logs: [],
      suggestion_sessions: [],
      suggestions: [],
      allowed_emails: [],
    });
  });

  test('lands on Tonight after sign-in', async ({ page }) => {
    await page.goto('/tonight');
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Suggest something/i })).toBeVisible();
  });

  test('navigates between tabs via the bottom nav', async ({ page }) => {
    await page.goto('/tonight');
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();

    // Bottom-nav has icon-only buttons; navigate via URL since the icons
    // don't have visible text labels.
    await page.goto('/inventory');
    await expect(page.getByRole('button', { name: /Add bottle/i })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('Settings hides the Allowed Users panel for non-admin users', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Allowed Users')).not.toBeVisible();
    // Account card always shows
    await expect(page.getByText('test@example.com')).toBeVisible();
  });
});

test.describe('Admin user', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, { email: 'admin@example.com', isAdmin: true });
    await mockSupabaseRest(page, {
      profiles: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          display_name: 'Admin',
          location_lat: null,
          location_lon: null,
          location_name: null,
          is_admin: true, // <- the bit that matters
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      bottles: [],
      recipes: [],
      recipe_ingredients: [],
      cocktail_logs: [],
      suggestion_sessions: [],
      suggestions: [],
      allowed_emails: [
        { email: 'admin@example.com', granted_at: new Date().toISOString(), granted_by: null, notes: 'Owner', is_active: true },
        { email: 'friend@example.com', granted_at: new Date().toISOString(), granted_by: null, notes: 'Test buddy', is_active: true },
      ],
    });
  });

  test('Settings reveals the Allowed Users panel and lists granted emails', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Allowed Users' })).toBeVisible();
    await expect(page.getByText('admin@example.com').first()).toBeVisible();
    await expect(page.getByText('friend@example.com')).toBeVisible();
  });
});

// "Suggest something" is clickable before the bottles query resolves, and
// clicking early reports an empty inventory. Wait for the bottles fetch.
async function gotoTonightWithBottles(page: Page) {
  const bottlesLoaded = page.waitForResponse(/\/rest\/v1\/bottles/);
  await page.goto('/tonight');
  await bottlesLoaded;
}

test.describe('Suggestion flow', () => {
  let claudeRequests: ClaudeRequest[];

  test.beforeEach(async ({ page }) => {
    await signInAs(page, { email: 'test@example.com' });
    await mockSupabaseRest(page, {
      profiles: [
        { id: '00000000-0000-0000-0000-000000000001', is_admin: false, onboarding_completed: true },
      ],
      bottles: [
        { id: 'b1', name: 'Hendricks', category: 'gin', active: true, user_id: '00000000-0000-0000-0000-000000000001' },
        { id: 'b2', name: 'Carpano Antica', category: 'vermouth', active: true, user_id: '00000000-0000-0000-0000-000000000001' },
        { id: 'b3', name: 'Campari', category: 'amaro', active: true, user_id: '00000000-0000-0000-0000-000000000001' },
      ],
      recipes: [],
      recipe_ingredients: [],
      cocktail_logs: [],
      suggestion_sessions: [],
      suggestions: [],
      allowed_emails: [],
    });
    claudeRequests = await mockClaude(page, {
      suggestions: buildSuggestionsJson(),
      recipe: buildAdaptedRecipeJson(),
    });
  });

  test('renders three suggestion cards after clicking Suggest something', async ({ page }) => {
    await gotoTonightWithBottles(page);
    await page.getByRole('button', { name: /Suggest something/i }).click();

    // Three cards with the expected names + archetype badges.
    await expect(page.getByRole('heading', { name: 'Negroni' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Penicillin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bobby Burns' })).toBeVisible();

    await expect(page.getByText('Safe Choice').first()).toBeVisible();
    await expect(page.getByText('Adventurous')).toBeVisible();
    await expect(page.getByText('Cultural')).toBeVisible();

    // Missing-ingredient warnings render where applicable.
    await expect(page.getByText(/Missing: Honey-ginger syrup/)).toBeVisible();
    await expect(page.getByText(/Missing: Bénédictine/)).toBeVisible();
  });

  test('expanding a card builds the recipe from the phase-1 key_ingredients', async ({ page }) => {
    await gotoTonightWithBottles(page);
    await page.getByRole('button', { name: /Suggest something/i }).click();
    await expect(page.getByRole('heading', { name: 'Negroni' })).toBeVisible();

    // Phase 1 streamed; no recipe has been requested yet.
    expect(claudeRequests).toHaveLength(1);
    expect(claudeRequests[0].stream).toBe(true);

    await page.getByRole('button', { name: 'Show recipe' }).first().click();
    await expect(page.getByText('Stir with ice, strain over a large cube.')).toBeVisible();
    await expect(page.getByText('Carpano Antica')).toBeVisible();

    // Phase 2 is a non-stream call that carries the binding ingredient list.
    expect(claudeRequests).toHaveLength(2);
    const phase2 = claudeRequests[1];
    expect(phase2.stream).toBeFalsy();
    expect(phase2.userPrompt).toContain('Negroni');
    expect(phase2.userPrompt).toMatch(/Required Ingredients \(BINDING/);
    for (const ing of ['Hendricks', 'Carpano Antica', 'Campari']) {
      expect(phase2.userPrompt).toContain(`- ${ing}`);
    }
  });
});
