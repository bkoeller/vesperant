# Technical Architecture: Vesperant

**Version:** 1.0 — MVP Architecture
**Date:** 2026-03-14

> ⚠️ **Historical document.** This is the v1.0 single-user / BYOK design. Several sections are superseded by the v2.0 multi-user model — most importantly **§6.3 (per-user encrypted Claude API keys)**, the `claude_api_key_encrypted` profile column, and the `ENCRYPTION_SECRET` env var are no longer in use. The current model has one server-side `ANTHROPIC_API_KEY` env var, an `allowed_emails` allowlist, and an `is_admin` profile flag. See `docs/PRD.md` v2.0 and `docs/MULTI_USER_ROLLOUT.md` for the up-to-date design. Everything else (data model, RLS, suggestion flow, PWA setup, theme system, build order) still applies.

---

## 1. Project Structure

```
vesperant/
├── public/
│   ├── manifest.json
│   ├── sw.js                          # Service worker (generated)
│   ├── icons/                         # PWA icons (192x192, 512x512, maskable)
│   └── favicon.svg
├── src/
│   ├── main.tsx                       # Entry point
│   ├── App.tsx                        # Root component, router mount
│   ├── vite-env.d.ts
│   ├── index.css                      # Tailwind directives, global styles
│   │
│   ├── components/                    # Shared UI components
│   │   ├── ui/                        # Primitives: Button, Card, Input, Modal, Rating, Badge
│   │   ├── layout/                    # Shell, Header, BottomNav, PageContainer
│   │   └── feedback/                  # Toast, LoadingSpinner, EmptyState, ErrorBoundary
│   │
│   ├── features/                      # Feature-sliced modules
│   │   ├── auth/
│   │   │   ├── components/            # LoginScreen, AuthGuard, ApiKeyForm
│   │   │   ├── hooks/                 # useAuth, useSession
│   │   │   └── auth.service.ts
│   │   │
│   │   ├── inventory/
│   │   │   ├── components/            # BottleList, BottleForm, BottleCard, CategoryGroup, BottleSearch
│   │   │   ├── hooks/                 # useBottles, useBottleSearch, useBottleMutations
│   │   │   ├── inventory.service.ts
│   │   │   └── inventory.types.ts
│   │   │
│   │   ├── recipes/
│   │   │   ├── components/            # RecipeDetail, RecipeList, RecipeSearch, AdaptedRecipe
│   │   │   ├── hooks/                 # useRecipes, useRecipeSearch, useAdaptedRecipe
│   │   │   ├── recipes.service.ts
│   │   │   └── recipes.types.ts
│   │   │
│   │   ├── suggestions/
│   │   │   ├── components/            # SuggestionFlow, SuggestionCard, ContextForm, RefinementInput
│   │   │   ├── hooks/                 # useSuggestion, useContextSignals, useSuggestionSession
│   │   │   ├── suggestions.service.ts
│   │   │   └── suggestions.types.ts
│   │   │
│   │   ├── cocktail-log/
│   │   │   ├── components/            # LogButton, LogForm, Timeline, TimelineEntry
│   │   │   ├── hooks/                 # useCocktailLog, useTimeline
│   │   │   ├── log.service.ts
│   │   │   └── log.types.ts
│   │   │
│   │   └── settings/
│   │       ├── components/            # SettingsPage, ApiKeyManager, LocationPicker
│   │       └── hooks/                 # useSettings
│   │
│   ├── lib/                           # Shared infrastructure
│   │   ├── supabase.ts                # Supabase client init
│   │   ├── claude.ts                  # Claude API client (calls serverless proxy)
│   │   ├── weather.ts                 # Weather API client
│   │   ├── holidays.ts                # Holiday/cultural date lookup
│   │   ├── constants.ts               # App-wide constants
│   │   └── utils.ts                   # Shared utilities
│   │
│   ├── hooks/                         # App-wide hooks
│   │   ├── useLocalStorage.ts
│   │   └── useDebounce.ts
│   │
│   ├── types/                         # Shared TypeScript types
│   │   ├── database.types.ts          # Supabase-generated types
│   │   ├── supabase.ts                # Helper types for Supabase
│   │   └── index.ts
│   │
│   └── styles/
│       └── fonts.css                  # Font-face declarations
│
├── supabase/
│   ├── migrations/                    # SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_seed_recipes.sql
│   │   └── 004_indexes.sql
│   ├── seed.sql                       # Development seed data
│   └── config.toml
│
├── api/                               # Vercel serverless functions
│   ├── suggest.ts                     # Claude suggestion proxy
│   ├── adapt-recipe.ts               # Claude recipe adaptation proxy
│   └── _lib/
│       ├── claude-client.ts           # Shared Claude API wrapper
│       ├── prompts.ts                 # System prompt templates
│       └── auth.ts                    # Verify Supabase JWT in serverless
│
├── scripts/
│   ├── seed-recipes.ts                # Script to generate/import canonical recipes
│   └── generate-types.ts              # Supabase type generation
│
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── .env.local                         # (gitignored)
├── package.json
└── README.md
```

---

## 2. Stack Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Build tool** | Vite 6 | Fastest DX, native ESM, excellent PWA plugin ecosystem |
| **Framework** | React 19 + TypeScript 5.5 | PRD specifies React. Largest ecosystem, stable. |
| **Routing** | TanStack Router v1 | Type-safe routes, file-based optional, built-in search params. Better DX than React Router for a typed app. Loaders pair well with Supabase queries. |
| **State management** | TanStack Query v5 (server state) + Zustand v5 (client state) | TanStack Query handles all Supabase data fetching, caching, mutations, optimistic updates. Zustand is minimal for ephemeral UI state (suggestion flow state, form wizards). No Redux overhead. |
| **Styling** | Tailwind CSS v4 | PRD specifies Tailwind. Utility-first, easy dark theme enforcement, no CSS-in-JS runtime cost. |
| **Component primitives** | Radix UI (headless) | Accessible, unstyled primitives (Dialog, Dropdown, Tabs, Toast). Tailwind-friendly. No opinionated design system fighting our aesthetic. |
| **Forms** | React Hook Form v7 + Zod | RHF is lightweight and performant. Zod gives runtime validation + TypeScript inference. Used for bottle forms, log forms, settings. |
| **Icons** | Lucide React | Clean line-art icons. Matches "elegant line art" aesthetic requirement. Tree-shakeable. |
| **PWA** | vite-plugin-pwa (Workbox) | Generates service worker, handles manifest, precaching. Battle-tested. |
| **Supabase client** | @supabase/supabase-js v2 | Official client. Auth, Realtime, Storage, PostgREST. Type-safe with generated types. |
| **Date handling** | date-fns v4 | Lightweight, tree-shakeable. Used for timeline display, holiday calculations, seasonal logic. |
| **Fonts** | `@fontsource/cormorant-garamond` (headings) + `@fontsource/inter` (body) | Cormorant Garamond is an elegant serif for the "cocktail menu" feel. Inter is a refined, highly legible sans-serif for body/UI text. Both self-hosted via fontsource for offline. |
| **Testing** | Vitest + Testing Library | Vitest for unit/integration, Testing Library for component tests. Same Vite config. |
| **Linting** | ESLint 9 (flat config) + Prettier | Standard tooling. Biome is an alternative but ESLint ecosystem is more mature. |

**Packages NOT chosen and why:**
- **React Router**: TanStack Router's type safety and loader pattern are superior for this data-heavy app.
- **Redux/Jotai/Recoil**: TanStack Query handles 90% of state (server state). Zustand covers the remaining UI state without boilerplate.
- **Chakra/MUI**: Opinionated design systems that would fight our custom dark aesthetic. Radix headless primitives give us full control.
- **Next.js**: Overkill for a single-user PWA. We don't need SSR/ISR. Vite + Vercel serverless functions is simpler and lighter. The app is client-rendered with API routes.

---

## 3. Supabase Schema

### 3.1 Core Tables

```sql
-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE spirit_category AS ENUM (
  'whisky', 'gin', 'vodka', 'rum', 'tequila', 'mezcal', 'brandy', 'cognac',
  'liqueur', 'amaro', 'vermouth', 'bitters', 'syrup', 'mixer', 'garnish',
  'wine', 'beer', 'other'
);

CREATE TYPE cocktail_method AS ENUM (
  'stir', 'shake', 'build', 'blend', 'muddle', 'layer', 'other'
);

CREATE TYPE suggestion_archetype AS ENUM (
  'safe', 'adventurous', 'cultural'
);

CREATE TYPE ingredient_role AS ENUM (
  'base', 'modifier', 'accent', 'sweetener', 'sour', 'bitters', 'garnish',
  'topper', 'rinse', 'other'
);

-- ============================================
-- USERS / PROFILES
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lon DOUBLE PRECISION,
  location_name TEXT,                -- e.g., "Austin, TX"
  claude_api_key_encrypted TEXT,     -- AES-256 encrypted, key from env
  weather_api_key TEXT,              -- Optional, app provides default
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BOTTLES (USER INVENTORY)
-- ============================================

CREATE TABLE bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                -- "Ardbeg Corryvreckan"
  brand TEXT,                        -- "Ardbeg"
  category spirit_category NOT NULL,
  subcategory TEXT,                  -- "Scotch Whisky", "London Dry Gin"
  spirit_type TEXT,                  -- "Islay Single Malt Scotch Whisky"
  tags TEXT[] DEFAULT '{}',          -- ["peated", "cask strength", "Islay"]
  abv DECIMAL(5,2),                  -- 57.10 for 57.1%
  proof DECIMAL(5,1),                -- Computed or entered, US proof
  is_premium BOOLEAN DEFAULT FALSE,  -- Informs bottle-value awareness
  price_tier TEXT CHECK (price_tier IN ('budget', 'standard', 'premium', 'luxury')),
  active BOOLEAN DEFAULT TRUE,       -- In current inventory
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CANONICAL RECIPES
-- ============================================

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',       -- ["Negroni Sbagliato", "Sbagliato"]
  slug TEXT UNIQUE NOT NULL,         -- URL-safe name: "negroni", "old-fashioned"
  description TEXT,
  history TEXT,
  method cocktail_method NOT NULL,
  glassware TEXT,                    -- "coupe", "rocks", "highball"
  garnish TEXT,
  tags TEXT[] DEFAULT '{}',          -- ["bitter", "spirit-forward", "classic", "winter"]
  iba_category TEXT,                 -- IBA classification if applicable
  source TEXT,                       -- Where this recipe came from
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,     -- "London Dry Gin"
  ingredient_category spirit_category NOT NULL,
  quantity DECIMAL(6,2),             -- 2.00
  unit TEXT,                         -- "oz", "dash", "barspoon", "rinse"
  role ingredient_role NOT NULL,
  optional BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  notes TEXT                         -- "preferably navy strength"
);

-- ============================================
-- USER RECIPE PREFERENCES
-- ============================================

CREATE TABLE user_recipe_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  custom_ingredients JSONB,          -- [{ingredient_name, quantity, unit, bottle_id?}]
  preferred_bottles JSONB,           -- [{ingredient_role: "base", bottle_id: "..."}]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

-- ============================================
-- COCKTAIL LOG
-- ============================================

CREATE TABLE cocktail_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL,         -- Denormalized for display even if recipe deleted
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  tasting_notes TEXT,
  social_context TEXT,
  bottles_used UUID[] DEFAULT '{}',  -- References bottle IDs used
  suggestion_session_id UUID,        -- If from a suggestion flow
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SUGGESTION SESSIONS
-- ============================================

CREATE TABLE suggestion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_signals JSONB NOT NULL,    -- {weather, temperature, date, holiday, season, mood, occasion, guests}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES suggestion_sessions(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL,
  archetype suggestion_archetype NOT NULL,
  reasoning TEXT NOT NULL,           -- "It's Robert Burns Night..."
  adapted_recipe JSONB,             -- Inventory-adapted version
  sort_order INT DEFAULT 0,
  selected BOOLEAN DEFAULT FALSE,    -- User chose this one
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suggestion_refinements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES suggestion_sessions(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,          -- "something lighter", "more bourbon"
  resulting_suggestions UUID[],      -- References new suggestion IDs
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Indexes

```sql
-- Bottles
CREATE INDEX idx_bottles_user_active ON bottles(user_id) WHERE active = TRUE;
CREATE INDEX idx_bottles_category ON bottles(user_id, category);
CREATE INDEX idx_bottles_tags ON bottles USING GIN(tags);

-- Recipes
CREATE INDEX idx_recipes_slug ON recipes(slug);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_name_trgm ON recipes USING GIN(name gin_trgm_ops);
  -- Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Recipe ingredients
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_category ON recipe_ingredients(ingredient_category);

-- Cocktail logs
CREATE INDEX idx_cocktail_logs_user_date ON cocktail_logs(user_id, logged_at DESC);
CREATE INDEX idx_cocktail_logs_recipe ON cocktail_logs(user_id, recipe_id);

-- Suggestions
CREATE INDEX idx_suggestions_session ON suggestions(session_id);
CREATE INDEX idx_suggestion_sessions_user ON suggestion_sessions(user_id, created_at DESC);
```

### 3.3 Row-Level Security Policies

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cocktail_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_refinements ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY profiles_own ON profiles
  FOR ALL USING (auth.uid() = id);

-- Bottles: users can only CRUD their own bottles
CREATE POLICY bottles_own ON bottles
  FOR ALL USING (auth.uid() = user_id);

-- Recipes: readable by everyone (canonical data)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipes_read ON recipes
  FOR SELECT USING (TRUE);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipe_ingredients_read ON recipe_ingredients
  FOR SELECT USING (TRUE);

-- User recipe preferences: own data only
CREATE POLICY user_recipe_prefs_own ON user_recipe_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Cocktail logs: own data only
CREATE POLICY cocktail_logs_own ON cocktail_logs
  FOR ALL USING (auth.uid() = user_id);

-- Suggestion sessions: own data only
CREATE POLICY suggestion_sessions_own ON suggestion_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Suggestions: accessible if user owns the session
CREATE POLICY suggestions_own ON suggestions
  FOR ALL USING (
    session_id IN (SELECT id FROM suggestion_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY refinements_own ON suggestion_refinements
  FOR ALL USING (
    session_id IN (SELECT id FROM suggestion_sessions WHERE user_id = auth.uid())
  );
```

### 3.4 Database Functions

```sql
-- Get recipes the user CAN make with current inventory
CREATE OR REPLACE FUNCTION get_makeable_recipes(p_user_id UUID)
RETURNS TABLE(recipe_id UUID, recipe_name TEXT, missing_count INT, missing_ingredients TEXT[])
LANGUAGE sql STABLE
AS $$
  WITH user_categories AS (
    SELECT DISTINCT category FROM bottles WHERE user_id = p_user_id AND active = TRUE
  ),
  recipe_coverage AS (
    SELECT
      r.id AS recipe_id,
      r.name AS recipe_name,
      COUNT(*) FILTER (WHERE ri.ingredient_category NOT IN (SELECT category FROM user_categories) AND NOT ri.optional) AS missing_count,
      ARRAY_AGG(ri.ingredient_name) FILTER (WHERE ri.ingredient_category NOT IN (SELECT category FROM user_categories) AND NOT ri.optional) AS missing_ingredients
    FROM recipes r
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    GROUP BY r.id, r.name
  )
  SELECT * FROM recipe_coverage
  ORDER BY missing_count ASC, recipe_name ASC;
$$;

-- Get user's cocktail history summary for LLM context
CREATE OR REPLACE FUNCTION get_history_summary(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_agg(entry) FROM (
    SELECT jsonb_build_object(
      'recipe', cl.recipe_name,
      'date', cl.logged_at::date,
      'rating', cl.rating,
      'notes', LEFT(cl.tasting_notes, 100)
    ) AS entry
    FROM cocktail_logs cl
    WHERE cl.user_id = p_user_id
    ORDER BY cl.logged_at DESC
    LIMIT p_limit
  ) sub;
$$;
```

---

## 4. API Layer Design

### 4.1 Frontend-to-Supabase: Direct Client

For all CRUD operations, the frontend uses the Supabase JS client directly via PostgREST. RLS policies ensure data isolation.

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Service layer pattern (each feature has a `.service.ts`):

```typescript
// src/features/inventory/inventory.service.ts
export const bottleService = {
  async getActive() {
    const { data, error } = await supabase
      .from('bottles')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true });
    if (error) throw error;
    return data;
  },
  // ... create, update, deactivate
};
```

TanStack Query hooks wrap services:

```typescript
// src/features/inventory/hooks/useBottles.ts
export function useBottles() {
  return useQuery({
    queryKey: ['bottles', 'active'],
    queryFn: bottleService.getActive,
  });
}
```

### 4.2 Frontend-to-Claude: Serverless Proxy

The Claude API key is stored encrypted in the user's profile. The frontend NEVER calls Claude directly. Instead, it calls Vercel serverless functions that:

1. Verify the Supabase JWT from the `Authorization` header
2. Retrieve the user's encrypted Claude API key from the database
3. Fetch the relevant structured context (inventory, history, recipes)
4. Construct the prompt with context
5. Call Claude and return the structured response

```
Browser  -->  POST /api/suggest  -->  Vercel Serverless Function
                                        |
                                        ├── Verify JWT (Supabase auth)
                                        ├── Decrypt Claude API key
                                        ├── Query Supabase for context:
                                        │     - Active bottles
                                        │     - Makeable recipes
                                        │     - Recent history (last 50 logs)
                                        │     - Date/holiday/weather signals
                                        ├── Build prompt with structured data
                                        ├── Call Claude API
                                        └── Parse + return structured JSON
```

### 4.3 Serverless Function Pattern

```
api/
├── suggest.ts           POST - Get 3 archetype suggestions
├── adapt-recipe.ts      POST - Adapt a specific recipe to user's inventory
├── refine.ts            POST - Refine suggestions based on user input
└── _lib/
    ├── claude-client.ts     Shared Anthropic SDK wrapper
    ├── prompts.ts           System prompt templates
    ├── context-builder.ts   Assembles structured context for LLM
    └── auth.ts              JWT verification + key decryption
```

Each serverless function:
- Is a standard Vercel edge/serverless function
- Uses streaming for Claude responses (Server-Sent Events) to show typing indicators
- Returns structured JSON, not raw LLM text
- Has a timeout of 30s (Vercel Hobby) or 60s (Pro)

### 4.4 Structured Data to LLM

Context is passed as a structured JSON block within the system prompt, not as freeform text. Example context payload assembled by `context-builder.ts`:

```json
{
  "inventory": {
    "whisky": [
      {"name": "Ardbeg Corryvreckan", "subcategory": "Islay Single Malt", "abv": 57.1, "premium": true, "tags": ["peated", "cask strength"]},
      {"name": "Famous Grouse", "subcategory": "Blended Scotch", "abv": 40, "premium": false, "tags": []}
    ],
    "vermouth": [...],
    "bitters": [...]
  },
  "makeable_recipes": ["Negroni", "Old Fashioned", "Whisky Sour", ...],
  "recent_history": [
    {"recipe": "Negroni", "date": "2026-03-12", "rating": 4},
    {"recipe": "Old Fashioned", "date": "2026-03-10", "rating": 5}
  ],
  "context_signals": {
    "date": "2026-03-14",
    "day_of_week": "Saturday",
    "season": "early_spring",
    "time": "19:30",
    "weather": {"condition": "clear", "temp_f": 68, "humidity": 45},
    "holidays_near": ["Pi Day (today)", "Ides of March (tomorrow)"],
    "user_mood": null,
    "occasion": null
  },
  "never_suggested_recipes": ["Bobby Burns", "Penicillin", "Blood and Sand", ...]
}
```

---

## 5. Claude Integration Pattern

### 5.1 System Prompt Design

The system prompt is modular, assembled from parts:

```typescript
// api/_lib/prompts.ts

export function buildSuggestionSystemPrompt(): string {
  return `You are the intelligence behind Vesperant, a personal bar assistant. You are a world-class bartender with encyclopedic cocktail knowledge, cultural awareness, and deep respect for spirits.

## Your Role
You power a structured UI — you are NOT a chatbot. Your responses must be valid JSON matching the specified schema. Never include conversational text outside the JSON structure.

## Core Principles
1. BOTTLE VALUE AWARENESS: Never suggest premium/rare spirits in mixed drinks where quality is masked. Use budget/standard bottles for cocktails with strong mixers. Flag when the user's only option for a category is premium.
   - Budget/Standard bottles: use freely in any cocktail
   - Premium bottles: prefer in spirit-forward cocktails (Old Fashioned, Manhattan) or neat/rocks
   - Luxury bottles: only suggest neat, on rocks, or in very spirit-forward preparations
2. PROOF AWARENESS: When a cask-strength bottle (>50% ABV) is the only option, note the impact and suggest ratio adjustments (typically reduce base spirit by 15-25%).
3. INVENTORY CONSTRAINED: Only suggest cocktails the user can make with their current inventory. You may suggest cocktails missing exactly one non-core ingredient if you flag the missing item.
4. HISTORY AWARE: Avoid suggesting cocktails the user has made in the last 7 days unless specifically requested. Favor recipes the user has never tried.
5. CULTURALLY GROUNDED: For the "cultural" archetype, cite the specific historical connection. Do not fabricate cultural connections — if nothing notable applies to the date, pivot to seasonal or regional relevance.

## Response Format
Respond ONLY with valid JSON matching the requested schema. No markdown, no explanation outside the JSON.`;
}

export function buildSuggestionUserPrompt(context: SuggestionContext): string {
  return `## User's Bar Inventory
${JSON.stringify(context.inventory, null, 2)}

## Recipes User Can Make
${context.makeable_recipes.join(', ')}

## Recent Cocktail History (last 50)
${JSON.stringify(context.recent_history, null, 2)}

## Today's Context
${JSON.stringify(context.context_signals, null, 2)}

## Recipes Never Tried
${context.never_suggested_recipes.join(', ')}

${context.user_input ? `## User's Request\n${context.user_input}` : ''}

## Task
Suggest exactly 3 cocktails as JSON with this schema:
{
  "suggestions": [
    {
      "archetype": "safe" | "adventurous" | "cultural",
      "recipe_slug": string,
      "recipe_name": string,
      "reasoning": string (2-3 sentences, why this cocktail for this moment),
      "adapted_recipe": {
        "ingredients": [{"name": string, "bottle_from_inventory": string|null, "quantity": string, "unit": string, "notes": string|null}],
        "method": string,
        "glassware": string,
        "garnish": string,
        "proof_warning": string|null,
        "value_notes": string|null
      },
      "missing_ingredients": string[]
    }
  ]
}`;
}
```

### 5.2 Three-Archetype Suggestion Model

Each suggestion call requests exactly three cocktails:

1. **Safe** - Algorithm factors: user's highest-rated cocktails in history, seasonal comfort classics, popular recipes matching inventory. The system prompt instructs Claude to pick something the user will reliably enjoy.

2. **Adventurous** - Algorithm factors: recipes the user has NEVER made (from `never_suggested_recipes`), cocktails from underused spirit categories in inventory, techniques the user hasn't tried. Push beyond comfort zone.

3. **Cultural** - Algorithm factors: `holidays_near` from context signals, historical events on this date, famous birthdays, cultural moments. Claude's training data provides this knowledge. The prompt requires a cited connection.

### 5.3 Bottle-Value Awareness Implementation

The `is_premium` boolean and `price_tier` field on bottles drive this. The context builder categorizes bottles:

```typescript
function categorizeByValue(bottles: Bottle[]): Record<string, Bottle[]> {
  return {
    budget: bottles.filter(b => b.price_tier === 'budget'),
    standard: bottles.filter(b => b.price_tier === 'standard'),
    premium: bottles.filter(b => b.price_tier === 'premium'),
    luxury: bottles.filter(b => b.price_tier === 'luxury'),
  };
}
```

This categorization is included in the inventory context. The system prompt instructions enforce the value rules. Claude selects which specific bottle to use for each ingredient role.

### 5.4 Progressive Refinement

Refinement is a follow-up call within the same suggestion session. The serverless function sends:
- Original context
- Previous suggestions
- User's refinement text ("something lighter", "more bourbon")

Claude returns 3 new suggestions respecting the refinement. The session stores all rounds.

---

## 6. Authentication Flow

### 6.1 Google OAuth via Supabase

```
User clicks "Sign in with Google"
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Redirect to Google consent screen
  → Google redirects back to app with code
  → Supabase exchanges code for session
  → Supabase creates/updates auth.users row
  → App receives session with JWT
  → AuthGuard component checks session, renders app or login
```

Configuration:
- Supabase Dashboard: Enable Google provider, configure OAuth credentials
- Google Cloud Console: Create OAuth 2.0 client, set redirect URI to Supabase callback
- Allowed email: For MVP single-user, restrict in RLS or Supabase auth settings

### 6.2 Session Management

```typescript
// src/features/auth/hooks/useAuth.ts
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading, user: session?.user };
}
```

The JWT is automatically attached to Supabase client requests. For serverless functions, the frontend passes the JWT in the `Authorization` header.

### 6.3 Claude API Key Storage

The user's Claude API key is:
1. Entered in the settings/onboarding UI
2. Sent to a serverless function `/api/save-key`
3. Encrypted with AES-256-GCM using a server-side encryption key (from `ENCRYPTION_SECRET` env var on Vercel)
4. Stored in `profiles.claude_api_key_encrypted`
5. Decrypted server-side only, in serverless functions, never returned to the client

```typescript
// api/_lib/auth.ts
import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET!; // 32-byte hex string

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const [ivHex, authTagHex, content] = encrypted.split(':');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## 7. PWA Configuration

### 7.1 Vite PWA Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Vesperant',
        short_name: 'Vesperant',
        description: 'Your personal bar assistant',
        theme_color: '#1a1a1a',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/recipes/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'recipes-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 * 7 }
            }
          },
          {
            urlPattern: /^https:\/\/api\.openweathermap\.org/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 1800 }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': '/src' }
  }
});
```

### 7.2 Offline Strategy

- **Precache**: All app shell assets (HTML, JS, CSS, fonts, icons)
- **StaleWhileRevalidate**: Recipe database (canonical data changes rarely)
- **NetworkFirst**: Weather data, suggestion results
- **Network-only**: Claude API calls (require connectivity by nature)

Offline capability for MVP is limited: the user can browse cached inventory and history, but cannot generate suggestions or adapt recipes without network. This matches the PRD which defers full offline to post-MVP.

---

## 8. Component Architecture

### 8.1 Routing Structure

```typescript
// src/App.tsx — TanStack Router route tree
const routeTree = rootRoute.addChildren([
  indexRoute,          // "/" → redirects to /tonight
  tonightRoute,        // "/tonight" — main suggestion flow
  inventoryRoute,      // "/inventory" — bottle list + management
  recipesRoute,        // "/recipes" — recipe browser
  recipeDetailRoute,   // "/recipes/$slug" — single recipe detail
  historyRoute,        // "/history" — cocktail log timeline
  settingsRoute,       // "/settings" — API keys, location, profile
  onboardingRoute,     // "/onboarding" — first-run flow
  loginRoute,          // "/login" — login page (unauthenticated)
]);
```

### 8.2 Key Pages

**Tonight (Main View) — `/tonight`**
- Primary CTA: "What should I make tonight?"
- Optional context inputs (mood, occasion, guests) — collapsible form
- Displays 3 suggestion cards (safe / adventurous / cultural)
- Each card: cocktail name, archetype badge, reasoning text, expandable adapted recipe
- Refinement input at bottom: "Steer me differently..."
- "Make this" button on each card → opens log flow

**Inventory — `/inventory`**
- Grouped by category (collapsible sections)
- Each bottle: name, subcategory, ABV badge, premium badge
- FAB (floating action button) to add new bottle
- Slide-to-deactivate or tap for edit/delete
- Search bar at top with type-ahead

**Recipes — `/recipes`**
- Searchable list of canonical recipes
- Filter by: tag, method, spirit category, "can make with my bar"
- Each card: name, method icon, brief description, ingredient count

**Recipe Detail — `/recipes/$slug`**
- Canonical recipe display
- "Adapt to my bar" button → calls Claude, shows adapted version with bottle-value notes
- User preference overlay if saved
- "Make this" → log flow

**History — `/history`**
- Reverse-chronological timeline
- Each entry: cocktail name, date, rating stars, truncated notes
- Tap to expand full details
- Search/filter bar

**Settings — `/settings`**
- Claude API key management (enter/update, masked display)
- Location for weather
- Account info
- About/version

**Onboarding — `/onboarding`**
- Step 1: Welcome
- Step 2: Add bottles (guided by category)
- Step 3: Enter Claude API key
- Step 4: Set location (optional)
- Step 5: "What should I make tonight?" — first suggestion

### 8.3 Shared Components

```
components/ui/
  Button.tsx          — Primary, secondary, ghost variants. Sizes: sm, md, lg.
  Card.tsx            — Base card with dark glass-morphism effect
  Input.tsx           — Text input with label, error state
  SearchInput.tsx     — Input with search icon, debounced onChange
  Modal.tsx           — Radix Dialog, centered, backdrop blur
  Rating.tsx          — 1-5 star interactive rating (tap or click)
  Badge.tsx           — Small pill: archetype labels, category tags
  Select.tsx          — Radix Select, styled
  Tabs.tsx            — Radix Tabs
  Toggle.tsx          — Boolean toggle switch

components/layout/
  Shell.tsx           — App shell with header + bottom nav + main content area
  Header.tsx          — App title, optional back button, optional action
  BottomNav.tsx       — 4 tabs: Tonight, Inventory, Recipes, History
  PageContainer.tsx   — Max-width wrapper, padding, scroll

components/feedback/
  Toast.tsx           — Radix Toast, bottom-positioned, auto-dismiss
  LoadingSpinner.tsx  — Subtle animated spinner
  EmptyState.tsx      — Illustration + message for empty lists
  ErrorBoundary.tsx   — Catches render errors, shows recovery UI
  Skeleton.tsx        — Loading placeholder shapes
```

### 8.4 Bottom Navigation

Four primary tabs reflecting the core user flows:
1. **Tonight** (home/star icon) — Suggestions
2. **Inventory** (bottle/cabinet icon) — Bottle management
3. **Recipes** (book icon) — Recipe browser
4. **History** (clock icon) — Cocktail log timeline

Settings accessible from a gear icon in the header.

---

## 9. Dark Theme System

### 9.1 Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core background layers (darkest to lightest)
        bg: {
          base: '#0a0a0a',       // Deepest background
          surface: '#141414',     // Cards, panels
          elevated: '#1e1e1e',    // Modals, dropdowns
          hover: '#262626',       // Interactive hover states
        },
        // Text hierarchy
        text: {
          primary: '#e8e0d4',     // Warm cream — primary text
          secondary: '#9a9084',   // Muted warm gray — secondary
          tertiary: '#6b6560',    // Subtle — tertiary/disabled
        },
        // Accent palette
        accent: {
          gold: '#c9a84c',        // Primary accent — amber/gold
          'gold-dim': '#a38838',  // Muted gold for borders/subtle use
          copper: '#b87333',      // Secondary warm accent
          amber: '#d4a24e',       // Highlights, active states
        },
        // Semantic
        success: '#4a7c59',
        warning: '#c9a84c',       // Reuses gold
        error: '#8b3a3a',
        info: '#4a6a7c',
        // Archetype colors
        archetype: {
          safe: '#4a7c59',        // Muted green
          adventurous: '#7c4a6a', // Muted plum
          cultural: '#4a6a7c',    // Muted teal
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Typography scale
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'subheading': ['1.125rem', { lineHeight: '1.3', fontWeight: '500' }],
        'body': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400' }],
        'micro': ['0.6875rem', { lineHeight: '1.3', fontWeight: '500' }],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'pill': '999px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        'card': '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 9.2 Global Styles

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply bg-bg-base text-text-primary antialiased;
    color-scheme: dark;
  }

  body {
    @apply font-sans text-body min-h-screen;
  }

  h1, h2, h3 {
    @apply font-serif;
  }

  /* Scrollbar styling for dark theme */
  ::-webkit-scrollbar { @apply w-1.5; }
  ::-webkit-scrollbar-track { @apply bg-bg-base; }
  ::-webkit-scrollbar-thumb { @apply bg-bg-hover rounded-full; }

  /* Selection color */
  ::selection {
    @apply bg-accent-gold/20 text-text-primary;
  }
}
```

### 9.3 Typography Usage

- **Display (serif)**: App name "Vesperant", onboarding headlines
- **Heading (serif)**: Page titles, cocktail names on suggestion cards
- **Subheading (sans)**: Section headers, card titles
- **Body (sans)**: All body text, descriptions, reasoning text
- **Caption (sans)**: Timestamps, secondary labels, badge text
- **Micro (sans)**: Very small labels, ABV badges

---

## 10. External APIs

### 10.1 Weather: Open-Meteo (recommended over OpenWeatherMap)

**Why Open-Meteo**: Completely free, no API key required for non-commercial use, generous rate limits, high quality data. Eliminates one more secret the user needs to manage.

```typescript
// src/lib/weather.ts
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherContext> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`);
  const data = await res.json();

  return {
    temp_f: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    condition: weatherCodeToCondition(data.current.weather_code),
    wind_mph: data.current.wind_speed_10m,
  };
}
```

### 10.2 Holiday / Cultural Date Data

Use a **static TypeScript dataset** bundled with the app, supplemented by Claude's knowledge.

```typescript
// src/lib/holidays.ts
// Static dataset of notable dates — covers major holidays, cultural events, famous birthdays
// ~365 entries, one per day, with multiple events per day

interface DateEvent {
  date: string;        // "MM-DD"
  name: string;
  category: 'holiday' | 'cultural' | 'birthday' | 'historical';
  cocktail_relevance?: string;  // Optional hint for Claude
}

const NOTABLE_DATES: DateEvent[] = [
  { date: '01-25', name: 'Burns Night', category: 'cultural', cocktail_relevance: 'Bobby Burns, Scotch cocktails' },
  { date: '03-17', name: "St. Patrick's Day", category: 'holiday', cocktail_relevance: 'Irish whiskey cocktails' },
  { date: '05-13', name: "World Cocktail Day", category: 'cultural' },
  { date: '07-04', name: "US Independence Day", category: 'holiday', cocktail_relevance: 'American whiskey, bourbon cocktails' },
  { date: '11-01', name: "Dia de los Muertos", category: 'cultural', cocktail_relevance: 'Mezcal, tequila cocktails' },
  // ... ~300-400 entries
];

export function getEventsForDate(date: Date): DateEvent[] {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return NOTABLE_DATES.filter(e => e.date === mmdd);
}

export function getSeasonForDate(date: Date, lat: number): string {
  // Hemisphere-aware season calculation
}
```

This approach:
- Works offline
- No API key needed
- Supplemented by Claude's training knowledge for deeper cultural connections
- Easy to maintain and expand via PRs

---

## 11. Canonical Recipe Database

### 11.1 Source Strategy

**Primary: LLM-generated, human-curated baseline.**

TheCocktailDB has data quality issues (inconsistent measurements, missing history, limited coverage of classics). Instead:

1. **Generate**: Use Claude to produce a JSON dataset of 300 canonical cocktails with consistent structure, proper measurements, accurate history, and appropriate tags.
2. **Curate**: The project owner reviews and corrects the dataset (especially for whisky-forward cocktails where domain expertise matters).
3. **Seed**: Import via a migration script into the `recipes` and `recipe_ingredients` tables.
4. **Supplement**: Post-MVP, recipes can be added via the app or web search.

### 11.2 Recipe Seed Format

```json
{
  "name": "Negroni",
  "slug": "negroni",
  "aliases": [],
  "description": "A perfectly balanced bitter Italian aperitif cocktail.",
  "history": "Created in 1919 at Caffè Casoni in Florence, when Count Camillo Negroni asked his bartender to strengthen his Americano by replacing soda water with gin.",
  "method": "stir",
  "glassware": "rocks",
  "garnish": "Orange peel",
  "tags": ["bitter", "spirit-forward", "classic", "italian", "aperitif", "iba"],
  "iba_category": "Unforgettables",
  "ingredients": [
    { "name": "London Dry Gin", "category": "gin", "quantity": 1, "unit": "oz", "role": "base" },
    { "name": "Sweet Vermouth", "category": "vermouth", "quantity": 1, "unit": "oz", "role": "modifier" },
    { "name": "Campari", "category": "amaro", "quantity": 1, "unit": "oz", "role": "modifier" }
  ]
}
```

### 11.3 Seed Script

```typescript
// scripts/seed-recipes.ts
// Reads recipes from a JSON file and inserts into Supabase
// Run via: npx tsx scripts/seed-recipes.ts
// Idempotent: uses upsert on slug
```

### 11.4 Spirit Metadata for Bottle Type-Ahead

For the bottle-add type-ahead, maintain a static dataset of known spirits:

```json
{
  "name": "Ardbeg Corryvreckan",
  "brand": "Ardbeg",
  "category": "whisky",
  "subcategory": "Scotch Whisky",
  "spirit_type": "Islay Single Malt Scotch Whisky",
  "default_tags": ["Islay", "peated", "cask strength"],
  "abv": 57.1,
  "default_price_tier": "premium"
}
```

Start with ~500 common spirits. This is a static JSON file in the app bundle, used for autocomplete. User can always type a custom name if their bottle isn't in the list.

---

## 12. MVP Build Order

### Phase 1: Foundation (Week 1-2)

**Dependencies: None**

1. **Project scaffolding**
   - `npm create vite@latest vesperant -- --template react-ts`
   - Install and configure: Tailwind v4, TanStack Router, TanStack Query, Zustand, Radix UI, React Hook Form, Zod, Lucide React
   - Set up path aliases (`@/`), ESLint, Prettier
   - Set up Tailwind config with full dark theme palette and typography
   - Create font loading (Cormorant Garamond + Inter)

2. **Supabase project setup**
   - Create Supabase project
   - Run initial migration (all tables, enums, indexes, RLS policies, functions)
   - Configure Google OAuth provider
   - Generate TypeScript types from schema

3. **App shell + layout components**
   - Shell, Header, BottomNav, PageContainer
   - Basic routing structure (all routes, placeholder pages)
   - PWA manifest and vite-plugin-pwa configuration

4. **Authentication**
   - Google OAuth login flow
   - AuthGuard component
   - Profile creation on first login
   - Session persistence

**Deliverable**: App boots, authenticates, shows empty shell with navigation.

### Phase 2: Inventory (Week 2-3)

**Dependencies: Phase 1 (auth, schema, shell)**

5. **Bottle CRUD**
   - `inventory.service.ts` — Supabase queries
   - `useBottles` / `useBottleMutations` hooks (TanStack Query)
   - BottleForm component (React Hook Form + Zod validation)
   - BottleList with category grouping
   - BottleCard with edit/deactivate
   - Type-ahead search against static spirit database

6. **Static spirit database**
   - Compile initial ~500 spirit entries as JSON
   - SearchInput with fuzzy matching (simple `includes` or Fuse.js)

**Deliverable**: User can add, edit, deactivate bottles. Inventory page is functional.

### Phase 3: Recipe Database (Week 3-4)

**Dependencies: Phase 1 (schema)**

7. **Seed canonical recipes**
   - Generate 200-300 recipes via Claude into JSON
   - Write and run seed script
   - Verify data quality

8. **Recipe browsing UI**
   - RecipeList with search and filters
   - RecipeDetail page (canonical view)
   - "Can I make this?" indicator using `get_makeable_recipes` DB function

**Deliverable**: User can browse and search recipes, see which ones they can make.

### Phase 4: Claude Integration (Week 4-5)

**Dependencies: Phase 2 (inventory data exists), Phase 3 (recipes exist)**

9. **API key management**
   - Settings page with encrypted key storage
   - Serverless function for save/encrypt
   - Onboarding step for key entry

10. **Serverless functions**
    - `/api/suggest` — suggestion flow
    - `/api/adapt-recipe` — recipe adaptation
    - `/api/refine` — suggestion refinement
    - Shared: auth verification, key decryption, context builder, prompt templates

11. **Directed recipe lookup**
    - "Make me a [cocktail]" → adapt to user's bar
    - Bottle-value and proof awareness displayed in adapted recipe
    - UI on recipe detail page

**Deliverable**: User can ask for a specific recipe adapted to their bar with intelligent bottle selection.

### Phase 5: Suggestions (Week 5-6)

**Dependencies: Phase 4 (Claude integration working)**

12. **Context signal gathering**
    - Weather API integration (Open-Meteo)
    - Holiday/cultural date lookup (static dataset)
    - Season/time-of-day derivation
    - Optional user inputs (mood, occasion, guests)

13. **Suggestion flow UI**
    - Tonight page: CTA → context form → 3 suggestion cards
    - SuggestionCard with archetype badge, reasoning, expandable adapted recipe
    - Refinement input → new suggestions
    - "Make this" button → transitions to log flow

14. **Suggestion session storage**
    - Save sessions, suggestions, refinements to Supabase
    - Link suggestion sessions to cocktail logs

**Deliverable**: Core feature works — user gets 3 contextual suggestions and can refine.

### Phase 6: Cocktail Log + History (Week 6-7)

**Dependencies: Phase 3 (recipes), Phase 5 (suggestion flow for "make this" trigger)**

15. **Cocktail logging**
    - One-tap log from suggestion cards or recipe detail
    - Optional expansion: rating, tasting notes, social context
    - Bottle selection (which bottles did you use)

16. **History timeline**
    - Reverse-chronological list
    - Search by name, filter by rating
    - Expandable entries

**Deliverable**: Full cocktail journaling loop. User can log drinks and browse history.

### Phase 7: Polish + Deploy (Week 7-8)

17. **Onboarding flow**
    - Welcome → Inventory setup → API key → Location → First suggestion

18. **PWA refinement**
    - Service worker caching strategy verified
    - Install prompt handling
    - Offline fallback page

19. **Deployment**
    - Vercel project setup
    - Environment variables configured
    - Supabase production project
    - Custom domain (optional)
    - README with self-hosting instructions

20. **Testing + bug fixes**
    - Core flow testing (suggestion → log → history)
    - Mobile viewport testing
    - Accessibility pass

**Deliverable**: MVP deployed and usable.

---

### Dependency Graph

```
Phase 1 (Foundation)
  ├──→ Phase 2 (Inventory)
  │       └──→ Phase 4 (Claude Integration)
  │               ├──→ Phase 5 (Suggestions)
  │               │       └──→ Phase 6 (Logging + History)
  │               │               └──→ Phase 7 (Polish)
  │               └──→ Phase 5 also needs Phase 3
  └──→ Phase 3 (Recipes) — can run parallel with Phase 2
```

Phases 2 and 3 can be developed in parallel. Everything else is sequential.

---

### Environment Variables

```env
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Vercel serverless only (not in VITE_ prefix, not exposed to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_SECRET=<64-char-hex-string>
```

---

### Critical Files for Implementation

- `C:\Users\mrkoe\OneDrive\Coding Projects\cocktailApp\docs\PRD.md` - Source of truth for all requirements, feature definitions, and design principles
- `supabase/migrations/001_initial_schema.sql` - Must be created first; the entire data model (tables, enums, indexes, RLS, functions) that everything else depends on
- `api/_lib/prompts.ts` - System prompt engineering for Claude; the bottle-value awareness rules and 3-archetype model defined here drive the core differentiating feature
- `src/lib/supabase.ts` + `src/types/database.types.ts` - Supabase client initialization and auto-generated types; every feature module depends on these
- `tailwind.config.ts` - Dark theme color palette, typography scale, and design tokens that enforce the "classy cocktail bar" aesthetic across all components