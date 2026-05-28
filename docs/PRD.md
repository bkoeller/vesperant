# Product Requirements Document: Vesperant

**Version:** 2.0 — Multi-User
**Date:** 2026-05-09
**Author:** Claude (from interview with project owner)

> **What changed in v2.0:** The app moved from a single-user BYOK model (each user runs their own instance with their own Claude API key) to a single-instance multi-user model (the owner runs one deployment with their own key, and grants access to a curated list of Gmail accounts). The data model gained an email allowlist, an `is_admin` flag, and per-user Claude usage tracking. The onboarding flow lost its API-key step. A testing framework (Vitest unit + Playwright E2E + GitHub Actions CI) was added. See sections 2, 3, 5.7, 6, 8, 10, 13 for the changes.

---

## 1. Vision

**Vesperant** — a personal bar assistant web application that combines structured inventory management, a canonical cocktail recipe database, and LLM-powered contextual intelligence to help the user discover, make, and track cocktails. It is not a chatbot — it's a structured application with an AI brain behind the interface.

**Name origin:** From Latin *vespera* (evening) — the hour when drinks are poured. Evokes ritual, craft, and the twilight moment between day and night.

**Tagline direction:** Classy, knowledgeable, personal. Think "world-class bartender who knows your shelf, your taste, and what day it is."

---

## 2. Target User

### Primary
- The project owner: a serious whisky and cocktail enthusiast with a 70+ bottle bar, deep knowledge of spirits (especially Scotch), who wants structured data and intelligent suggestions — not a chat window.

### Secondary (live as of v2.0)
- A small, curated set of friends and family the owner explicitly grants access to via the in-app allowlist. They share the deployed instance, share the owner's Claude key, but each has their own isolated bar inventory, recipe customizations, cocktail log, and suggestion history (enforced by Postgres RLS).

### Tertiary (still future)
- Other cocktail enthusiasts who self-host via GitHub. The repo remains open-source so a different owner can stand up their own instance and run it the same way. Their friends become *their* allowlist; their key pays for *their* usage.

---

## 3. Distribution Model

- **Open-source, single-instance multi-user.** Published on GitHub.
- One owner runs one deployment. Anyone they grant access to (via the in-app allowlist) shares that deployment.
- The owner provides one Claude API key, stored as a Vercel environment variable. **Never** sent to the client. All Claude calls go through a serverless proxy that verifies the caller's Supabase JWT, re-checks the allowlist, and enforces a per-user daily request cap (default 100/day) before forwarding to Anthropic.
- Google OAuth via Supabase. A Postgres trigger blocks sign-up for any email not in `allowed_emails` — non-allowlisted users never reach `auth.users`.
- Owner pays for their own hosting and Claude usage. No managed multi-tenant SaaS.
- A different owner can fork the repo and run a separate instance with their own key, allowlist, and Supabase project. The code is identical; only the env vars differ.

---

## 4. Core Design Principles

1. **Brilliant bartender, not a chatbot.** Structured UI with persistent data. The LLM powers intelligence behind the scenes — it is not the interface.
2. **No homework.** Every interaction beyond core inventory setup should be optional and low-friction. Logging a drink should take seconds, not minutes.
3. **Respect the bottle.** The app understands bottle value, rarity, and proof. It won't suggest putting Bruichladdich Black Art in a highball. Famous Grouse will do for a Rusty Nail.
4. **Surprising, not random.** Contextual suggestions should delight with cultural depth and relevance, not feel like a random recipe generator.
5. **Data lives in the database, not in prompt context.** Inventory, history, notes, and recipes are structured data the LLM queries — not ephemeral chat history that drifts.

---

## 5. Feature Requirements — MVP

### 5.1 Bar Inventory Management

**Description:** Users maintain a structured inventory of everything that might go into a cocktail.

**Requirements:**
- Track spirits, liqueurs, amari, vermouths, bitters, syrups, mixers, and garnishes
- Each item stored at the specific bottle level (e.g., "Ardbeg Corryvreckan," not just "Scotch")
- The app understands category mapping: Ardbeg Corryvreckan → Scotch → Whisky → Spirit; also tagged as Islay, peated, cask strength
- Items organized by category with user's natural groupings respected
- Proof/ABV tracked where relevant (especially for cask strength vs. standard)
- Add items manually via text input (type-ahead search against a known spirits database if possible)
- Remove/edit items
- **Not tracked:** barware, tools (jiggers, shakers, etc.)
- **Not tracked (MVP):** quantity/fill level — presence/absence only

**Deferred to post-MVP:**
- Photo-based inventory capture (AI image recognition → text list)
- Document/list import (paste or upload a text list)

### 5.2 Recipe Database

**Description:** A canonical cocktail recipe library ships with the app, augmented by user customizations.

**Requirements:**
- Pre-loaded database of canonical/classic cocktail recipes (target: 200-500 well-known cocktails)
- Each recipe includes: name, ingredients (with quantities/ratios), method (stir/shake/build), glassware, garnish, brief description/history
- Recipes are the canonical/standard version
- User can save personal ratio preferences per recipe (e.g., Rusty Nail: 2 oz scotch, 0.75 oz Drambuie instead of canonical 1.5:1.5)
- User customizations are layered on top of canonical — both versions visible

**Deferred to post-MVP:**
- Web search for obscure/cultural recipes ("What was MLK's favorite cocktail?")
- User-created fully original recipes

### 5.3 Directed Recipe Lookup ("Make Me a Negroni")

**Description:** User asks for a specific cocktail and gets a recipe adapted to their bar.

**Requirements:**
- User requests a cocktail by name
- App returns the recipe **adapted to their specific inventory** (e.g., "Use your Botanist gin and Antica Formula vermouth")
- If the user's bottles differ from canonical, annotate the deviation: "Classic calls for sweet vermouth; Antica Formula is a great match but richer than standard"
- If a better bottle choice exists that the user doesn't own, mention it as a suggestion
- **Bottle value awareness:** prefer affordable/common bottles for mixed drinks; never suggest rare/expensive bottles where quality would be masked by mixers. Flag if the user's only option for a spirit category is a premium bottle.
- **Proof awareness:** note when cask strength bottles would meaningfully change the drink's balance and suggest ratio adjustments

### 5.4 Contextual Cocktail Suggestions

**Description:** The signature feature. AI-powered suggestions based on real-world context.

**Requirements:**
- User initiates a suggestion request (e.g., "What should I make tonight?")
- App gathers contextual signals:
  - **Always available:** date/time, day of week, season, upcoming holidays
  - **If available:** local weather (via API or user location)
  - **User-provided (optional, progressive):** mood, occasion, guests, food pairing
- Initial suggestion returns **three archetypes:**
  1. **Safe choice** — a crowd-pleaser or comfort cocktail suited to the context
  2. **Adventurous choice** — something the user hasn't tried, pushes boundaries
  3. **Culturally significant choice** — tied to a historical event, famous birthday, cultural moment relevant to the date
- Each suggestion includes a brief explanation of *why* it was chosen ("It's Robert Burns Night — a Bobby Burns cocktail uses your Scotch and Benedictine")
- **Progressive refinement:** after initial suggestions, user can steer ("something lighter," "more citrus-forward," "I'm in the mood for bourbon," "never tried that before")
- All suggestions are **constrained to the user's current inventory** (or flag if one ingredient is missing)
- Suggestions should factor in the user's history to avoid over-repetition and highlight untried recipes
- **Two-phase generation with a binding ingredient contract.** Phase 1 streams three suggestion cards (name + reasoning + `key_ingredients` array). Phase 2 lazily loads the adapted recipe when the user expands a card. Phase 1's `key_ingredients` is passed to phase 2 as the binding ingredient list — phase 2's job is to assign quantities, units, method, glassware, and garnish, NOT to choose ingredients. This prevents Claude from drifting into canonical-recipe recall by name (e.g. so naming an invented build "Smoking Bishop" doesn't return the canonical Victorian mulled-wine punch). The system prompt also forbids attaching a famous cocktail name to an invented build in the first place.
- **Library cross-link.** When a suggestion's name (or alias) matches a recipe in the canonical library, the title is rendered as a link to the recipe detail page; browser back returns to the originating Tonight/History page. Same wiring applies in the History tab for both logged cocktails and past suggestion sessions.

### 5.5 Cocktail Log & Feedback

**Description:** Track what the user has made, with optional lightweight feedback.

**Requirements:**
- When a user makes a cocktail (either from a suggestion or a directed lookup), they can log it with one tap
- **Optional feedback form** (all fields optional):
  - Rating: 1-5 stars
  - Tasting notes: free text
  - Social context: free text (e.g., "Dinner with the Smiths")
- Logging should be as frictionless as possible — one tap to log "I made this," then optionally expand to add notes
- Timestamp automatically captured

### 5.8 Data Export

**Description:** Users can download their data as CSV for backup, analysis in spreadsheets, or portability if they ever move off the app.

**Requirements:**
- Accessible from the Settings page (single "Data export" panel, not per-page buttons — keeps the bottle/recipe/history pages uncluttered).
- Three independent exports, one button each:
  - **Bottle inventory** — one row per bottle with name, brand, category, subcategory, spirit_type, tags, ABV, proof, price tier, is_premium, active, notes, created_at.
  - **Recipe library** — canonical + the user's custom recipes, with ingredients joined into a single cell (`"2 oz Gin; 1 oz Sweet Vermouth; 1 oz Campari"`) so the file stays flat (one row per recipe).
  - **Cocktail history** — one row per logged cocktail: logged_at, recipe_name, rating, tasting_notes, social_context, bottles_used.
- Files are date-stamped: `vesperant-<dataset>-YYYY-MM-DD.csv`.
- RFC 4180 quoting (commas, embedded quotes, newlines in tasting notes all handled correctly).
- UTF-8 BOM prepended so Excel opens non-ASCII bottle names without mojibake.
- Per-user isolation enforced by Postgres RLS — exports only return rows the caller owns. Canonical recipes (`user_id IS NULL`) are included in the recipe export since they're library content readable by every user.
- A spinner replaces the icon on the active export's button while the query runs; errors surface in-place inside the panel.

**Out of scope (current):**
- Import from CSV (round-trip). The user's stated workflow is export-for-backup / export-for-analysis, not migrate-between-apps.
- JSON export or selective field picking.
- Compression / multi-file ZIP. Each dataset is its own CSV.

### 5.7 Multi-User Access Management *(new in v2.0)*

**Description:** The owner curates who can use the deployed instance.

**Requirements:**
- One or more users carry an `is_admin` flag (the deployment owner is the seed admin)
- Admins see an **Allowed Users** panel in Settings; non-admins do not
- Admins can grant access by typing a Gmail address (with optional notes like "Friend, March 2026")
- Admins can revoke access by removing an entry from the list
- The allowlist is enforced at three layers:
  1. **Database trigger:** `handle_new_user()` rejects sign-ups whose email isn't in `allowed_emails` — non-allowlisted users never reach `auth.users`
  2. **Serverless function:** `/api/claude` re-verifies the caller's email against the allowlist on every request (defense in depth in case the trigger is ever bypassed)
  3. **Row-level security:** the `allowed_emails` table itself is RLS-locked so only admins can read or modify it
- A soft daily request cap (default 100/user/day, env-configurable) protects the owner's Claude budget. Logged in `claude_usage` per user.
- A new user added to the allowlist gets an empty bar on first sign-in. They go through the onboarding flow (no API key step) and start adding bottles. None of their data is visible to any other user (RLS-enforced).

**Out of scope (current):**
- Email-based invitations (the user simply signs in with the allowlisted Gmail and it works)
- Tiered roles beyond admin/non-admin (no read-only mode, no "trusted curator")
- Automatic revocation on inactivity

### 5.6 History Timeline

**Description:** A chronological record of cocktails made, browsable and searchable.

**Requirements:**
- Default view: reverse-chronological timeline of logged cocktails
- Each entry shows: cocktail name, date/time, rating (if given), truncated notes (expandable)
- Basic search/filter within the timeline (by cocktail name, by rating)

**Deferred to post-MVP:**
- Multi-dimensional querying ("What do I make when the Smiths visit?", "Show me everything with Campari", "What did I drink last NYE?")
- Analytics/stats (most-made cocktail, average rating trends, spirit usage distribution)

---

## 6. Feature Requirements — Post-MVP Roadmap

Listed roughly in priority order based on interview:

1. ~~**Suggestion deduplication / variety tracking**~~ *(done)* — track what has been recommended recently and ensure the daily suggestions rotate, avoiding repeat recommendations.
2. ~~**Mobile font size increase**~~ *(done)* — increase base font sizes across the mobile UI for better readability.
3. ~~**Suggestion history tab**~~ *(done)* — browsable sub-tab in History page showing past suggestion sessions with archetype badges and reasoning.
4. ~~**Photo-based inventory import**~~ *(done)* — take a photo of a shelf, AI identifies bottles and adds to inventory
5. ~~**Document/list import**~~ *(done)* — paste or upload a text inventory list, AI parses into structured items
6. ~~**Multi-user with shared Claude key**~~ *(done in v2.0)* — server-side key, email allowlist, admin-managed access, RLS-isolated per-user data, per-user daily request cap.
7. ~~**Automated test suite**~~ *(in progress)* — Vitest covers pure helpers, the auth gate, and key React components; Playwright covers smoke E2E. CI runs both on every push to main. Authenticated E2E flows still WIP.
8. **Public the GitHub repo** — sanitize secrets from git history, add LICENSE, polish README, flip visibility.
9. **Smart inventory deduplication** — fuzzy matching for bottle names to catch variants like "Benedictine DOM" vs "DOM Benedictine", word-order permutations, abbreviations, and common misspellings. Possibly LLM-assisted matching at import time.
10. **Multi-dimensional history queries** — natural language queries against cocktail log ("What do I usually make for the Smiths?")
11. **Web search for recipes** — LLM searches the web for cultural/historical cocktail info, stores results as new recipes
12. **Ratio customization UI** — dedicated interface for tweaking and saving personal recipe ratios
13. **Offline caching** — browse inventory, saved recipes, and history without connectivity (no LLM calls)
14. **Quantity/level tracking** — track how full each bottle is
15. **Analytics dashboard** — spirit usage stats, rating trends, most-made cocktails, seasonal patterns
16. **Per-user usage visibility** — let users see their daily Claude usage / remaining cap in Settings
17. **Email invitations** — send the invited Gmail an actual invite link instead of just relying on them to know they've been added
18. ~~**CSV data export**~~ *(done)* — one-click export of bottle inventory, recipe library (with ingredients joined), and cocktail history from the Settings page. UTF-8 BOM so Excel opens non-ASCII bottle names cleanly.

---

## 7. Technical Architecture — High Level

### Platform
- **Progressive Web App (PWA)** — single codebase, installable on mobile and desktop
- Mobile-first responsive design (primary use: standing at the bar with phone)

### Frontend
- **React** (most common framework, largest ecosystem, best hiring pool if project grows)
- TypeScript
- Tailwind CSS (utility-first, easy to enforce dark theme and consistent design)

### Backend / Data
- **Supabase** (recommended):
  - PostgreSQL database for structured data (inventory, recipes, logs, notes)
  - Built-in Google OAuth authentication
  - Row-level security for multi-user self-hosted scenarios
  - Generous free tier, simple self-hosting option
  - Real-time subscriptions (useful for future features)
- Alternative: Firebase, PlanetScale, or direct PostgreSQL

### AI / LLM Layer
- **Claude API** (Anthropic) — BYOK model, user provides their own API key
- LLM used for:
  - Contextual cocktail suggestions (the "bartender brain")
  - Adapting recipes to user's inventory
  - Bottle value/proof-aware recommendations
  - Natural language history queries (post-MVP)
  - Photo/document inventory parsing (post-MVP)
- LLM receives structured data from the database as context — does not rely on conversation history for state

### External APIs (MVP)
- **Weather API** (e.g., OpenWeatherMap free tier) — for weather-aware suggestions
- **Date/holiday data** — can be a static dataset or lightweight API

### Hosting
- **Vercel** (recommended for React PWA):
  - Free tier covers personal use easily
  - Serverless functions for API routes (Claude API proxy, auth callbacks)
  - Edge network for fast global delivery
  - Simple GitHub integration for CI/CD
- Alternative: Netlify (comparable), Cloudflare Pages

---

## 8. Data Model — Key Entities

```
Bottle
├── id, name, brand, category, subcategory
├── spirit_type (e.g., "Scotch Whisky")
├── tags[] (e.g., ["Islay", "peated", "cask strength"])
├── abv_percent
├── is_premium (boolean — informs bottle-value-aware suggestions)
├── active (boolean — in current inventory)
└── added_date

Recipe (Canonical)
├── id, name, aliases[]
├── description, history
├── ingredients[] { ingredient_type, quantity, unit, role }
├── method (stir/shake/build/blend)
├── glassware, garnish
├── tags[] (e.g., ["bitter", "spirit-forward", "tiki", "winter"])
└── source

UserRecipePreference
├── recipe_id
├── custom_ratios[] (overrides canonical quantities)
├── preferred_bottle_ids[] (e.g., "use Botanist for gin")
└── notes

CocktailLog
├── id, recipe_id, timestamp
├── rating (1-5, nullable)
├── tasting_notes (text, nullable)
├── social_context (text, nullable)
├── bottles_used[] (specific bottles from inventory)
└── suggestion_context (what prompted this — weather, holiday, etc.)

SuggestionSession
├── id, timestamp
├── context_signals { weather, date, holiday, mood, etc. }
├── suggestions[] { recipe_id, archetype, reasoning }
└── refinements[] (user steering inputs)

Profile (v2.0 additions)
├── is_admin (boolean — gates the Allowed Users panel)
└── (the old claude_api_key_encrypted column was dropped)

AllowedEmail (new in v2.0)
├── email (PK)
├── granted_at, granted_by (which admin), notes
└── is_active (soft-revoke flag)

ClaudeUsage (new in v2.0)
├── user_id, called_at
├── endpoint ('text' or 'vision')
└── input_tokens, output_tokens
   (used for the daily request cap and future per-user usage UI)
```

All per-user tables (`bottles`, `cocktail_logs`, `suggestion_sessions`, user-created `recipes`, `user_recipe_preferences`, `claude_usage`) are isolated by Postgres row-level security on `user_id = auth.uid()`. Canonical `recipes` (where `user_id IS NULL`) are readable by everyone. The `allowed_emails` table is admin-only via RLS.

---

## 9. UX & Aesthetic Direction

- **Dark mode only (MVP).** Light mode is a post-MVP consideration.
- **Classy, minimal, typographically serious.** Think upscale cocktail bar menu, not a party app.
- Serif or refined sans-serif typography. No playful fonts.
- Muted color palette — dark backgrounds, warm amber/gold accents, subtle cream text.
- Inspiration: the aesthetic of a well-designed whisky label or a leather-bound cocktail book.
- **No emojis in the UI.** Icons should be simple, elegant line art.
- Animations should be subtle and purposeful (fade-ins, smooth transitions), never bouncy or playful.

---

## 10. First-Run Experience

1. Welcome screen — brief value proposition, "Set up your bar" CTA
2. **Inventory setup** — guided flow to add bottles. One-tap "Import sample bar" populates ~70 bottles you can edit; otherwise skip and add via photo/list import on the Inventory tab.
3. Straight to the main screen — "What should I make tonight?"

The Claude API key step from v1.0 is gone — the key lives server-side and isn't a per-user concern.

---

## 11. Competitive Landscape Summary

| App | Inventory | Recipes | AI/Context | History/Journal | Web | Self-host |
|-----|-----------|---------|------------|-----------------|-----|-----------|
| Mixel | Yes | 900+ | No | Favorites only | No | No |
| Cocktail Flow | Yes | 600+ | No | No | No | No |
| Bartender's Choice | Yes | Curated | No | No | No | No |
| Difford's Guide | Yes (web) | 3000+ | No | No | Yes | No |
| Highball | No | User-created | No | Yes (best) | No | No |
| **Vesperant** | **Yes** | **200-500 + AI** | **Yes (core feature)** | **Yes + queryable** | **Yes (PWA)** | **Yes** |

**Key differentiator:** No existing app combines inventory management + contextual AI suggestions + cocktail journaling. This app's "bartender brain" that knows your bar, respects bottle value, and ties suggestions to cultural/temporal context is unique in the market.

---

## 12. Open Questions

1. **App name** — TBD (owner wants suggestions once development begins)
2. **Canonical recipe data source** — TheCocktailDB API (free/Patreon tier) vs. curating our own dataset vs. LLM-generated baseline
3. **Spirit metadata database** — where to source ABV, category mappings, premium/value classifications for bottles
4. **Weather API selection** — OpenWeatherMap vs. alternatives (cost, accuracy, free tier limits)
5. **Holiday/cultural date database** — static dataset vs. API vs. LLM knowledge
6. **PWA install prompt strategy** — when/how to prompt mobile users to add to home screen

---

## 13. Success Criteria

### MVP (v1.0) — owner solo
1. Load their full bar inventory into the app
2. Ask "Make me a Negroni" and get a recipe using their specific bottles with value-aware notes
3. Ask "What should I make tonight?" and get three contextually relevant suggestions with progressive refinement
4. Log a cocktail with optional rating, notes, and social context in under 10 seconds
5. Browse a timeline of everything they've made and search by cocktail name
6. Do all of the above from their phone at the bar

### Multi-user (v2.0) additions
7. Add a Gmail address to the allowlist via the Settings UI in under 30 seconds
8. The added user signs in with Google, sees an empty bar, and goes through the slimmer (no-API-key) onboarding flow
9. The added user requests a suggestion and gets a Claude-powered response without ever knowing the API key exists
10. The added user's bottles, recipes, logs, and suggestions are invisible to every other user (verified by Postgres RLS, not by app code)
11. A non-allowlisted Gmail attempting to sign in gets blocked at the Supabase auth layer — the user is never created in `auth.users`
12. The owner can revoke access by removing an entry from the allowlist; the revoked user's existing data stays intact (so re-granting access restores them) but they can no longer call `/api/claude`
