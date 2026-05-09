# Vesperant

Your personal bar assistant — intelligent cocktail suggestions adapted to your bar, grounded in the moment.

Vesperant combines structured inventory management, a canonical cocktail recipe database, and Claude-powered contextual intelligence to help you discover, make, and track cocktails.

## Features

- **Bar Inventory** — Catalog your bottles with category, ABV, price tier, and tags. Photo-import from a shelf, paste-import from a list, or add manually.
- **200+ Canonical Recipes** — Searchable cocktail database with a "Can I make this?" filter that respects identity-sensitive ingredients (Drambuie ≠ Cointreau, Sweet ≠ Dry vermouth).
- **Adapt to My Bar** — Claude adapts any recipe to your specific bottles with value and proof awareness.
- **Tonight Suggestions** — Three contextual archetypes (safe, adventurous, cultural) based on weather, date, holidays, and mood. With progressive refinement ("something lighter", "more bourbon").
- **Cocktail Journal** — Log what you make with optional ratings, tasting notes, and social context.
- **Multi-user with shared Claude key** — One owner deploys, grants access to a curated allowlist of Gmail accounts, and pays the bill. Each user has their own isolated bar inventory, recipes, and history (Postgres RLS-enforced).

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, TanStack Router + Query, Radix primitives
- **Backend**: Supabase (PostgreSQL + Auth + Row-Level Security)
- **AI**: Claude API via a Vercel serverless proxy (server-side key, never exposed to the client)
- **PWA**: Installable on any device via vite-plugin-pwa
- **Hosting**: Vercel
- **Tests**: Vitest (unit + auth-gate) and Playwright (smoke E2E), wired to GitHub Actions CI

## Self-Hosting

You run one deployment. Anyone whose Gmail you add to the in-app allowlist can use it. Your Claude API key lives server-side as a Vercel env var — users never see it.

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Claude API key](https://console.anthropic.com/settings/keys) (a few dollars covers casual use for months)
- A [Vercel](https://vercel.com) account (free tier works)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/bkoeller/vesperant.git
   cd vesperant
   npm install
   ```

2. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).

3. **Apply the migrations** in order via the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_deduplicate_bottles.sql`
   - `supabase/migrations/003_user_recipes.sql`
   - `supabase/migrations/004_multi_user.sql`
   - `supabase/migrations/005_strict_makeable.sql`

   Plus these one-shot policies for recipe seeding (the canonical-recipe import script needs them):
   ```sql
   CREATE POLICY recipes_insert ON recipes FOR INSERT TO authenticated WITH CHECK (TRUE);
   CREATE POLICY recipe_ingredients_insert ON recipe_ingredients FOR INSERT TO authenticated WITH CHECK (TRUE);
   CREATE POLICY recipe_ingredients_delete ON recipe_ingredients FOR DELETE TO authenticated USING (TRUE);
   ```

4. **Configure Google OAuth**
   - Enable the Google provider under Supabase → Authentication → Providers
   - Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com)
   - Set the redirect URI to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Paste the Client ID + Secret into Supabase

5. **Bootstrap your owner account.** The signup trigger blocks every Google sign-in until the email is on the allowlist. With your own Gmail substituted in, run in the SQL Editor:
   ```sql
   INSERT INTO allowed_emails (email, notes)
   VALUES ('you@example.com', 'Owner')
   ON CONFLICT (email) DO NOTHING;
   ```
   Sign in once via the deployed app to create your `profiles` row, then promote yourself:
   ```sql
   UPDATE profiles
   SET is_admin = TRUE
   WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = 'you@example.com');
   ```
   See [`docs/MULTI_USER_ROLLOUT.md`](./docs/MULTI_USER_ROLLOUT.md) for the full bootstrap walkthrough.

6. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for local dev.

7. **Run locally**
   ```bash
   npm run dev
   ```

8. **Deploy to Vercel**
   ```bash
   npx vercel
   ```
   Set the production environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL` — Supabase project URL (also used at runtime by the serverless function)
   - `VITE_SUPABASE_ANON_KEY` — Supabase anon key
   - `ANTHROPIC_API_KEY` — your Claude API key (used server-side only)
   - `SUPABASE_SERVICE_ROLE_KEY` — the long JWT from Supabase → Settings → API Keys → **Legacy API Keys** → `service_role`
   - `CLAUDE_DAILY_LIMIT` *(optional)* — per-user daily Claude request cap, defaults to 100

### Adding more users

Once you're admin, the **Settings → Allowed Users** panel in the app lets you grant access by typing a Gmail address. The added user signs in with Google, gets a clean onboarding flow, and starts with an empty bar. Their data is isolated from yours by Row-Level Security.

### First-run onboarding

When you (or a granted user) sign in for the first time, you'll see a three-step onboarding: welcome → bar setup (one-tap import of a sample bar with ~70 bottles you can edit, or skip and add via photo/list import) → straight to "What should I make tonight?".

## Tests

```bash
npm test               # Vitest unit + integration tests
npm run test:e2e       # Playwright smoke E2E
npm run test:coverage  # Coverage report
```

CI runs both on every push to `main` and every PR. See [`docs/TESTING.md`](./docs/TESTING.md) for the structure and how to add tests.

## Documentation

- [`docs/PRD.md`](./docs/PRD.md) — product requirements, feature definitions, success criteria
- [`docs/TECHNICAL_ARCHITECTURE.md`](./docs/TECHNICAL_ARCHITECTURE.md) — stack, schema, API design (note: §6.3 BYOK is superseded by the multi-user model)
- [`docs/MULTI_USER_ROLLOUT.md`](./docs/MULTI_USER_ROLLOUT.md) — server-side Claude key + email allowlist rollout and verification
- [`docs/TESTING.md`](./docs/TESTING.md) — Vitest + Playwright + CI pyramid; how to add tests

## Design

Dark, minimal, typographically serious. Cormorant Garamond for headings, Inter for body text. Warm amber/gold accents on near-black backgrounds. Think speakeasy menu, not party app.

## Name

From Latin *vespera* (evening) — the hour when drinks are poured.

## License

[MIT](./LICENSE).
