# Testing

How Vesperant's automated tests are organized, what they cover, and how to extend them.

## TL;DR

```bash
npm test               # Run all unit tests once
npm run test:watch     # Vitest watch mode (re-run on save)
npm run test:coverage  # Coverage report (HTML in coverage/)
npm run test:e2e       # Run Playwright E2E tests (auto-spawns dev server)
npm run test:e2e:ui    # Playwright in UI mode (interactive debugger)
```

CI runs `npm test` and `npm run build` on every push/PR via `.github/workflows/test.yml`, and Playwright smoke tests via `.github/workflows/e2e.yml`.

## Test pyramid

```
                    ┌─────────────────┐
                    │   E2E (smoke)   │  ← Playwright, real browser
                    └─────────────────┘
              ┌───────────────────────────┐
              │   Component (jsdom)       │  ← Testing Library
              └───────────────────────────┘
        ┌─────────────────────────────────────┐
        │   Unit + integration (pure logic)   │  ← Vitest
        └─────────────────────────────────────┘
```

Wider tiers run more, faster. Top tier catches what the lower tiers can't see.

## Layer 1 — Vitest (unit + integration)

**Location:** `src/**/*.{test,spec}.{ts,tsx}`, `api/**/*.{test,spec}.ts`, and `supabase/**/*.test.ts` (SQL functions, via PGlite)
**Runner:** `vitest run` (jsdom environment)
**Setup:** `src/test/setup.ts` — registers `@testing-library/jest-dom` matchers and runs `cleanup()` after each test.

### What's covered

| Target | File | Tests | What it asserts |
|---|---|---|---|
| `src/lib/holidays.ts` | `holidays.test.ts` | 14 | `getEventsForDate`, `getEventsNearDate` annotations, `getSeason` boundaries, `getTimeOfDay` thresholds |
| `src/lib/weather.ts` | `weather.test.ts` | 5 | Rounding, weather-code → condition mapping, error propagation, query-string shape |
| `src/lib/csv.ts` (data export) | `csv.test.ts` | 14 | `escapeCell` for null/empty, plain strings, commas, embedded quotes (doubled per RFC 4180), CR/LF, string arrays joined with `"; "`, numbers, booleans; `toCsv` for header-only / header+body / column selection / column ordering / missing fields; `csvFilename` zero-padding |
| `DataExportPanel` | `DataExportPanel.test.tsx` | 5 | All three Export buttons render; each button calls the right service and writes a CSV with the right header + dated filename; recipe export joins ingredients into one cell; history export is scoped to the current user id; service failures surface as inline error text and the download is not triggered |
| `src/lib/prompts.ts` (phase-2 adapt-by-name) | `prompts.test.ts` | 9 | System prompt declares Required Ingredients as binding and forbids canonical-recipe overrides; user prompt renders the BINDING ingredient block, preserves order, omits it on back-compat, and includes the Promised Build (reasoning) |
| `useSuggestions` prompt + normalizer | `useSuggestions.test.ts` | 12 | Existing bottle-inventory shape and non-substitution rules; plus phase-1 schema asks for `key_ingredients`, name/recipe coherence rule is present, `normalizeSuggestion` preserves and defensively filters the binding list |
| `api/claude.ts` (auth gate) | `api/claude.test.ts` | 9 | Every gate path: 405 wrong method, 500 missing env, 401 no token, 401 bad JWT, 403 not allowlisted, 403 no email, 429 over cap, 200 happy path with usage logging, error propagation without leaking the API key |
| `api/mcp.ts` + `api/_lib/mcp-tools.ts` (agent access) | `api/mcp.test.ts` | 15 | Real handler + real MCP client over HTTP against a fake PostgREST holding two users' data. Auth gate: 405, missing/malformed/unknown token 401, de-allowlisted owner 403, success stamps `last_used_at`. Tools: exactly six, all `readOnlyHint`; each returns only the token owner's rows (bottles, custom recipes, history, sessions); `get_recipe` prefers the user's custom slug; `whats_makeable` passes the owner's id and drops other users' recipes |
| `api/_lib/api-token.ts` | `api-token.test.ts` | 3 | Accepts tokens minted by the browser helper, rejects malformed ones, and hashes identically to WebCrypto |
| `src/lib/api-tokens.ts` | `api-tokens.test.ts` | 4 | Token shape and uniqueness, known SHA-256 vector, 10-char display prefix, `claude mcp add` command |
| `get_makeable_recipes` (SQL, migration 008) | `supabase/tests/get_makeable_recipes.test.ts` | 7 | Runs the real function in PGlite (in-process Postgres with `unaccent`). `match_words` normalization; liqueur/amaro/vermouth match across accents and word order and via subcategory/spirit_type; identity still enforced (sweet ≠ dry, Drambuie ≠ Cointreau, yellow ≠ green Chartreuse); inactive bottles ignored; pantry categories always available; category match for other spirits; optional ingredients don't count |
| `AuthGuard` | `AuthGuard.test.tsx` | 3 | Loading splash, LoginScreen render, children render |
| `src/lib/recipe-text.ts` (copy recipe) | `recipe-text.test.ts` | 9 | Fraction glyphs and missing quantity/unit; URL joining; exact library and adapted layouts; optional/notes markers; garnish fallback; empty sections omitted with no blank-line runs or Markdown; link omitted when absent |
| `CopyButton` | `CopyButton.test.tsx` | 5 | Writes `getText()` to the clipboard and confirms; text built only on click; text-variant label swap; reverts after 2s; clipboard rejection shows "Couldn't copy" |
| `RecipeFormPage` | `RecipeFormPage.test.tsx` | 11 | New mode: empty start, Create gating on name + ingredient, trimmed/merged-tag payload with blank rows dropped, save error surfaced. Edit mode: loading state, every field hydrated (known vs custom tags, ingredient order), late-arriving data hydrates, background refetch doesn't clobber edits, update by id + navigate, non-owner and canonical recipes blocked |
| `SuggestionCard` | `SuggestionCard.test.tsx` | 12 | Three archetype variants, expand/collapse, missing-ingredient warnings, proof warnings, `bottle_from_inventory` substitution, `onMakeThis` callback, and the phase-1→phase-2 wiring that forwards `key_ingredients` to `useAdaptByName.load()` |

**Total: 149 tests, ~1.8s wall time.**

### The phase-1 → phase-2 contract is the highest-value regression coverage

The "suggestion description and recipe disagree" bug class is a recurring failure mode of the LLM layer. The current defense is structural — phase 1 emits a `key_ingredients` array, and phase 2 builds the recipe verbatim from it — and the tests pin every link in the chain:

- **`useSuggestions.test.ts`** — phase-1 schema asks for `key_ingredients`; `normalizeSuggestion` preserves it.
- **`SuggestionCard.test.tsx`** — the expand handler forwards `key_ingredients` to `load()`. If anyone refactors and drops the argument, this fails.
- **`prompts.test.ts`** — phase-2 system prompt declares the list binding and forbids canonical overrides; user prompt renders the BINDING block in order; back-compat path omits the block cleanly.

If a future change weakens any of these, the regression surfaces before it reaches the user. We deliberately do *not* try to verify Claude's compliance with the prompt at unit-test time — that's an LLM eval, not a unit test, and the structural contract is the lever we actually control.

### Mocking patterns

- **Supabase client mock**: `vi.mock('@supabase/supabase-js', ...)` returns a stub `createClient` whose `auth.getUser` and chainable `from()` builders are exposed as test-controlled `vi.fn()`s. See `api/claude.test.ts` for the chain-builder pattern.
- **Hook mock**: `vi.mock('../hooks/useAuth', ...)` lets components be tested without a real Supabase client. See `AuthGuard.test.tsx`.
- **Global fetch**: `vi.stubGlobal('fetch', vi.fn())` for the Anthropic and weather APIs.
- **Env vars**: `vi.stubEnv('NAME', 'value')` + `vi.resetModules()` lets each test load `api/claude.ts` with its own env state.

### Adding a new test

1. Co-locate `*.test.ts` or `*.test.tsx` next to the file under test.
2. For a pure function: import + assert. No setup needed.
3. For a serverless function or anything that imports Supabase: pattern off `api/claude.test.ts`.
4. For a React component: pattern off `SuggestionCard.test.tsx`. Use `@testing-library/user-event` for interactions, not raw events.
5. Run `npm test`. CI picks it up automatically.

## Layer 2 — Playwright (browser E2E)

**Location:** `e2e/*.spec.ts`
**Runner:** `playwright test` (auto-spawns Vite dev server)
**Config:** `playwright.config.ts`

### What's covered

| Test | Status | What it asserts |
|---|---|---|
| `smoke.spec.ts` — login screen renders | ✅ | Vesperant heading + Sign in with Google button visible |
| `smoke.spec.ts` — no JS errors on load | ✅ | `pageerror` listener captures zero errors after `networkidle` |
| `authenticated.spec.ts` — Tonight render | ✅ | Injected session lands on Tonight with the Suggest button |
| `authenticated.spec.ts` — tab navigation | ✅ | Inventory and Settings render for a signed-in user |
| `authenticated.spec.ts` — non-admin Settings | ✅ | Allowed Users panel hidden; account email shown |
| `authenticated.spec.ts` — admin AllowedUsers panel | ✅ | Panel visible and lists granted emails |
| `authenticated.spec.ts` — Suggest waits for inventory | ✅ | With the bottles response held back, the button reads "Loading your bar..." and is disabled; it enables once bottles arrive |
| `authenticated.spec.ts` — suggestion flow | ✅ | Phase-1 SSE stream renders three cards with archetype badges and missing-ingredient warnings |
| `authenticated.spec.ts` — phase-2 recipe on expand | ✅ | Expanding a card makes one non-stream call whose prompt carries the BINDING `key_ingredients`, and renders the recipe |
| `copy-recipe.spec.ts` — library recipe | ✅ | Header copy icon writes the exact plain-text recipe, ending in the full recipe URL, to the real clipboard |
| `copy-recipe.spec.ts` — Tonight card | ✅ | Copy appears only after expanding; copied text uses inventory bottle names and links to the library recipe |
| `agent-access.spec.ts` — token list | ✅ | Existing tokens show name, display prefix, and "Never used" |
| `agent-access.spec.ts` — create token | ✅ | New token shown once; the insert carries only the SHA-256 hash and prefix (never the token); Copy command yields the exact `claude mcp add` line; Done hides the token |
| `agent-access.spec.ts` — revoke | ✅ | Confirm, then DELETE scoped to `id=eq.<token>` |

### How authenticated specs work

Google OAuth can't be scripted, so `signInAs` pre-injects a fake Supabase session into `localStorage` (`sb-{ref}-auth-token`) via `page.addInitScript()`; supabase-js picks it up on init. It also sets `vesperant_onboarding_complete`, because `Shell` gates onboarding on that flag rather than the profile row. (These specs were previously skipped on the belief that session injection didn't work. It did; the missing onboarding flag was the real blocker.)

All Supabase and Claude traffic is intercepted, so these specs exercise the UI against canned data. They don't cover RLS or the real auth gate; see "Real-stack E2E" below.

### Helpers

- **`e2e/helpers/auth.ts`**: `signInAs(page, { email, isAdmin, onboarded })` — pre-injects a session into `localStorage` and marks onboarding complete (pass `onboarded: false` to test onboarding).
- **`e2e/helpers/mocks.ts`**: `mockSupabaseRest(page, tablesByName)` and `mockClaude(page, { suggestions, recipe })` — Playwright route interception. `mockClaude` replays `suggestions` as Anthropic SSE for streaming calls, returns `recipe` for non-stream calls, and returns the captured request bodies. `buildSuggestionsJson()` (phase 1) and `buildAdaptedRecipeJson()` (phase 2) supply canned responses.

### Adding a new E2E test

1. Create `e2e/<feature>.spec.ts`.
2. Use `signInAs` + `mockSupabaseRest` + `mockClaude` from helpers.
3. Prefer `getByRole`, `getByText` over CSS selectors — they're more resilient to refactors.
4. Run `npm run test:e2e`. CI picks it up.

## CI

Two GitHub Actions workflows in `.github/workflows/`:

- **`test.yml`** — runs `npm run lint`, `tsc -b`, `npm test`, `npm run build` on Ubuntu 20+. Concurrency-cancelled per ref.
- **`e2e.yml`** — runs `npx playwright test` with chromium installed. Uploads the `playwright-report/` as a build artifact on failure.

Both run on every push to `main` and every PR. Build a green check before merging.

## What we deliberately don't do (yet)

- **Visual regression testing** (Percy / Chromatic) — overkill for one developer; flaky on transient pixel diffs.
- **100% coverage** — chase value, not a number. Coverage report is available via `npm run test:coverage` but isn't a CI gate.
- **Mutation testing** — even more premature.
- **Real-stack E2E** — authenticated specs run against mocks. Covering RLS and the real auth gate would need a test Supabase project with a global-setup sign-in and saved `storageState`.
- **RLS tests** — SQL functions are tested in PGlite (`supabase/tests/`), but RLS policies aren't yet: PGlite lacks Supabase's `auth` schema and roles. Worth adding when an RLS regression slips past code review.

## Phase 3 follow-up (when motivated)

- Real-stack E2E against a test Supabase project (RLS + auth gate).
- Add pgTAP tests for the RLS policies introduced in `004_multi_user.sql` (allowed_emails admin-only, claude_usage own-row read).
- Coverage CI step (informational, not a gate).
