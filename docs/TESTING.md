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

**Location:** `src/**/*.{test,spec}.{ts,tsx}` and `api/**/*.{test,spec}.ts`
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
| `AuthGuard` | `AuthGuard.test.tsx` | 3 | Loading splash, LoginScreen render, children render |
| `SuggestionCard` | `SuggestionCard.test.tsx` | 12 | Three archetype variants, expand/collapse, missing-ingredient warnings, proof warnings, `bottle_from_inventory` substitution, `onMakeThis` callback, and the phase-1→phase-2 wiring that forwards `key_ingredients` to `useAdaptByName.load()` |

**Total: 95 tests, ~1.8s wall time.**

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
| `authenticated.spec.ts` — Tonight render | ⏭ skipped | (see below) |
| `authenticated.spec.ts` — tab navigation | ⏭ skipped | |
| `authenticated.spec.ts` — non-admin Settings | ⏭ skipped | |
| `authenticated.spec.ts` — admin AllowedUsers panel | ⏭ skipped | |
| `authenticated.spec.ts` — suggestion flow | ⏭ skipped | |

### Why authenticated specs are skipped

The plan was to bypass Google OAuth (which Playwright can't script through Google's bot-detection) by pre-injecting a fake Supabase session into `localStorage` via `page.addInitScript()`. The session storage key matches what `@supabase/supabase-js` v2 expects (`sb-{ref}-auth-token`) and the session shape passes `_isValidSession`. Despite that, the running app's `useAuth` doesn't pick the session up — `AuthGuard` still renders `LoginScreen`. Likely cause: a refresh-token round-trip or `userStorage`-related check we haven't pinpointed.

The specs are kept under `test.describe.skip` (rather than deleted) so the test logic, mock helpers, and table-of-contents document the intent for the next iteration.

**Two viable unblock paths:**

1. **Use a real test Supabase project.** Sign in once via the admin API in a global setup, save `storageState` to a JSON file, reuse across tests via Playwright's `storageState` config. Catches RLS bugs as a bonus. Cost: a second Supabase project in CI secrets, periodic cleanup.
2. **Add a dev-only test hatch.** A `?__test_session=...` query-param the app reads in non-prod builds to mint a session locally. Smaller blast radius (no infrastructure), but requires app-side code that has to be carefully gated.

Recommend #1 when the regression risk on authenticated flows justifies the operational cost — until then, the layer-1 component tests cover most of the same ground.

### Helpers

- **`e2e/helpers/auth.ts`**: `signInAs(page, { email, isAdmin })` — pre-injects a session into `localStorage` (currently doesn't work; see above).
- **`e2e/helpers/mocks.ts`**: `mockSupabaseRest(page, tablesByName)` and `mockClaude(page, content)` — Playwright route interception. `buildSuggestionsJson()` returns a 3-archetype canned response.

### Adding a new E2E test

1. Create `e2e/<feature>.spec.ts`.
2. Use `signInAs` + `mockSupabaseRest` + `mockClaude` from helpers (once auth injection is unblocked).
3. Prefer `getByRole`, `getByText` over CSS selectors — they're more resilient to refactors.
4. Run `npm run test:e2e`. CI picks it up.

## CI

Two GitHub Actions workflows in `.github/workflows/`:

- **`test.yml`** — runs `tsc -b`, `npm test`, `npm run build` on Ubuntu 20+. Concurrency-cancelled per ref.
- **`e2e.yml`** — runs `npx playwright test` with chromium installed. Uploads the `playwright-report/` as a build artifact on failure.

Both run on every push to `main` and every PR. Build a green check before merging.

## What we deliberately don't do (yet)

- **Visual regression testing** (Percy / Chromatic) — overkill for one developer; flaky on transient pixel diffs.
- **100% coverage** — chase value, not a number. Coverage report is available via `npm run test:coverage` but isn't a CI gate.
- **Mutation testing** — even more premature.
- **Real-stack E2E** — see the "Why authenticated specs are skipped" section above.
- **pgTAP / SQL tests** — RLS is enforced by Postgres regardless of client behavior, so SQL-level tests are the right home for that. Worth adding when an RLS regression slips past code review.

## Phase 3 follow-up (when motivated)

- Unblock authenticated E2E via real test Supabase project, then unskip the WIP specs.
- Add pgTAP tests for the RLS policies introduced in `004_multi_user.sql` (allowed_emails admin-only, claude_usage own-row read).
- Coverage CI step (informational, not a gate).
