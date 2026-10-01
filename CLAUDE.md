# CLAUDE.md

Working notes for Claude Code. Product and architecture live in `docs/` — read
`docs/PRD.md`, `docs/TECHNICAL_ARCHITECTURE.md`, and `docs/TESTING.md` as needed.

## Deploy

- Push to `main` = production deploy (Vercel GitHub integration). Direct
  commits to `main` are the norm; there is no PR process.
- Vercel project: `bkoellers-projects/vesperant`. Use the `vercel` CLI for env
  vars (`vercel env ls production`), logs, and rollbacks.
- `vercel.json` also defines a weekly cron: `/api/promote-recipes`, Mondays 12:00 UTC.

## Database (Supabase)

- The Supabase CLI is **not** linked. For schema changes, add the next numbered
  file in `supabase/migrations/` and hand the user the SQL to run in the
  Supabase SQL Editor.
- Per-user data isolation is enforced by Postgres RLS. New tables need RLS
  policies plus explicit grants (see `006_explicit_grants.sql`).

## Before committing

```bash
npm run lint && npx tsc -b && npm test && npm run build
```

CI (`.github/workflows/`) runs the same plus Playwright smoke tests.

## Local dev

- `npm run dev` serves `/api/claude` by running the real `api/claude.ts`
  handler in-process (`server/claude-proxy.ts`). It needs `ANTHROPIC_API_KEY`
  and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; they're sensitive in Vercel,
  so `vercel env pull` won't fetch them.
- Local dev talks to the production Supabase project and logs to `claude_usage`.
- Playwright's browser download is unreliable on this machine; run E2E against
  the system browser: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.

## Gotchas

- **Model IDs are set in two places:** `api/claude.ts` (default) and
  `src/lib/claude.ts` (vision). Change them together.
- **Phase-1 → phase-2 suggestion contract:** phase 1's `key_ingredients` is
  binding on the phase-2 recipe, and tests pin it (see `docs/TESTING.md`).
  Don't loosen it — it prevents the "description and recipe disagree" bug.
- **Repo came from Windows via OneDrive.** `core.autocrlf=input` is set; watch
  for CRLF-only diffs. If `node_modules` has `win32` binaries, reinstall with `npm ci`.

## Conventions

- Commit messages: short, imperative, sentence case (match `git log`).
- Update `docs/PRD.md` and `docs/TESTING.md` alongside feature and test changes.
