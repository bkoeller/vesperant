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
      const rows = applyEqFilters((tables[table] ?? []) as Record<string, unknown>[], url.searchParams);

      // .single() asks PostgREST for one object via the Accept header; it
      // 406s when nothing matches. Everything else (including .maybeSingle()
      // on GET, which the client unwraps itself) gets the array.
      const wantsObject = route.request().headers()['accept']?.includes('vnd.pgrst.object');
      if (wantsObject) {
        return rows.length > 0
          ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0]) })
          : route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'No rows' }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    }

    // Anything we didn't expect — let it through so failures surface.
    return route.continue();
  });
}

/**
 * Apply PostgREST `col=eq.value` filters; other operators are ignored. Rows
 * that lack the column are kept, so minimal fixtures still match.
 */
function applyEqFilters(rows: Record<string, unknown>[], params: URLSearchParams) {
  let out = rows;
  for (const [col, expr] of params) {
    if (!expr.startsWith('eq.')) continue;
    const value = expr.slice(3);
    out = out.filter(r => !(col in r) || String(r[col]) === value);
  }
  return out;
}

export interface ClaudeRequest {
  systemPrompt?: string;
  userPrompt?: string;
  stream?: boolean;
  model?: string;
}

/**
 * Stub /api/claude for both Tonight phases. Avoids burning real Anthropic
 * credits and keeps tests deterministic.
 *
 * - Phase 1 (`stream: true`) gets `suggestions` replayed as Anthropic SSE
 *   text deltas, split into chunks so the client's incremental parser runs.
 * - Phase 2 and every other non-stream call gets `{ content: recipe }`.
 *
 * Returns the captured request bodies so specs can assert on prompts.
 */
export async function mockClaude(
  page: Page,
  responses: { suggestions: string; recipe?: string },
): Promise<ClaudeRequest[]> {
  const requests: ClaudeRequest[] = [];
  await page.route('**/api/claude', async (route: Route) => {
    const body = (route.request().postDataJSON() ?? {}) as ClaudeRequest;
    requests.push(body);

    if (body.stream) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: toAnthropicSse(responses.suggestions),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: responses.recipe ?? '' }),
    });
  });
  return requests;
}

function toAnthropicSse(text: string, chunkSize = 80): string {
  const events: object[] = [
    { type: 'message_start', message: { usage: { input_tokens: 100 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  ];
  for (let i = 0; i < text.length; i += chunkSize) {
    events.push({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: text.slice(i, i + chunkSize) },
    });
  }
  events.push(
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 200 } },
    { type: 'message_stop' },
  );
  return events.map(e => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

/** Phase-1 response: names, reasoning, and the binding key_ingredients. */
export function buildSuggestionsJson(): string {
  return JSON.stringify({
    suggestions: [
      {
        archetype: 'safe',
        recipe_name: 'Negroni',
        recipe_slug: 'negroni',
        reasoning: 'A perfectly balanced bitter aperitif for the moment.',
        key_ingredients: ['Hendricks', 'Carpano Antica', 'Campari'],
        missing_ingredients: [],
      },
      {
        archetype: 'adventurous',
        recipe_name: 'Penicillin',
        recipe_slug: 'penicillin',
        reasoning: 'Smoky and complex — a modern classic worth trying.',
        key_ingredients: ['Blended Scotch', 'Lemon juice', 'Honey-ginger syrup'],
        missing_ingredients: ['Honey-ginger syrup'],
      },
      {
        archetype: 'cultural',
        recipe_name: 'Bobby Burns',
        recipe_slug: 'bobby-burns',
        reasoning: 'A nod to Burns Night — Scotch with sweet vermouth and Bénédictine.',
        key_ingredients: ['Scotch', 'Carpano Antica', 'Bénédictine'],
        missing_ingredients: ['Bénédictine'],
      },
    ],
  });
}

/** Phase-2 response: the adapted recipe for one expanded card. */
export function buildAdaptedRecipeJson(): string {
  return JSON.stringify({
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
  });
}
