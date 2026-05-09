# Vesperant

Your personal bar assistant — intelligent cocktail suggestions adapted to your bar, grounded in the moment.

Vesperant combines structured inventory management, a canonical cocktail recipe database, and Claude-powered contextual intelligence to help you discover, make, and track cocktails.

## Features

- **Bar Inventory** — Catalog your bottles with category, ABV, price tier, and tags
- **201 Canonical Recipes** — Searchable cocktail database with "Can I make this?" filtering
- **Adapt to My Bar** — Claude adapts any recipe to your specific bottles with value and proof awareness
- **Tonight Suggestions** — Three contextual suggestions (safe, adventurous, cultural) based on weather, date, holidays, and mood
- **Progressive Refinement** — Steer suggestions naturally ("something tropical", "more bourbon")
- **Cocktail Journal** — Log what you make with optional ratings, tasting notes, and social context
- **History Timeline** — Searchable, filterable record of everything you've poured

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, TanStack Router/Query
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Claude API (BYOK — bring your own key)
- **PWA**: Installable on any device via vite-plugin-pwa
- **Hosting**: Vercel (or any static host with serverless functions)

## Self-Hosting

Vesperant is designed to be self-hosted. Each user deploys their own instance with their own Claude API key.

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Claude API key](https://console.anthropic.com/settings/keys) ($5 in credits lasts months)
- A [Vercel](https://vercel.com) account (free tier works)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/vesperant.git
   cd vesperant
   npm install
   ```

2. **Create a Supabase project**
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
   - Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
   - Add these RLS policies for recipe seeding:
     ```sql
     CREATE POLICY recipes_insert ON recipes FOR INSERT TO authenticated WITH CHECK (TRUE);
     CREATE POLICY recipe_ingredients_insert ON recipe_ingredients FOR INSERT TO authenticated WITH CHECK (TRUE);
     CREATE POLICY recipe_ingredients_delete ON recipe_ingredients FOR DELETE TO authenticated USING (TRUE);
     ```
   - Enable Google OAuth under Authentication > Providers

3. **Configure Google OAuth**
   - Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com)
   - Set redirect URI to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Add Client ID and Secret to Supabase Google provider settings

4. **Set up environment**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL and anon key.

5. **Run locally**
   ```bash
   npm run dev
   ```

6. **Deploy to Vercel**
   ```bash
   npx vercel
   ```
   Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### First Run

On first launch, the onboarding flow will guide you through:
1. Importing your bar inventory
2. Setting your Claude API key
3. Getting your first cocktail suggestion

## Documentation

- [`docs/PRD.md`](./docs/PRD.md) — product requirements, feature definitions, success criteria
- [`docs/TECHNICAL_ARCHITECTURE.md`](./docs/TECHNICAL_ARCHITECTURE.md) — stack, schema, API design
- [`docs/MULTI_USER_ROLLOUT.md`](./docs/MULTI_USER_ROLLOUT.md) — how multi-user (server-side Claude key + email allowlist) was rolled out and how to verify it
- [`docs/TESTING.md`](./docs/TESTING.md) — Vitest + Playwright + CI pyramid; how to add tests

## Design

Dark, minimal, typographically serious. Cormorant Garamond for headings, Inter for body text. Warm amber/gold accents on near-black backgrounds. Think speakeasy menu, not party app.

## Name

From Latin *vespera* (evening) — the hour when drinks are poured.

## License

MIT
