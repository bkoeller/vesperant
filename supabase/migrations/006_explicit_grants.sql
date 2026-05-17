-- ============================================
-- EXPLICIT DATA API GRANTS
-- ============================================
-- Adopts Supabase's modern access pattern in advance of the Oct 30, 2026
-- enforcement: every public table that should be reachable via the Data API
-- (supabase-js / PostgREST / GraphQL) gets an explicit GRANT per role.
--
-- This migration is purely additive for the eleven tables that already exist
-- (their current grants would have continued to work indefinitely). The value
-- is forward-looking: any future migration that creates a table in public
-- must include grants of its own — and now that pattern is visible in code.
--
-- Role policy:
--   anon          — no access. Vesperant is allowlist-only; unauthenticated
--                   reads are never appropriate.
--   authenticated — full CRUD on every table. Row-level access is enforced
--                   by the RLS policies established in 001/003/004.
--   service_role  — full CRUD on every table. Used by /api/claude.ts and the
--                   recipe promotion job to bypass RLS for server logic.
--
-- Also revokes any lingering schema-level USAGE from anon so that even if a
-- future table forgets its explicit GRANT, anon still cannot reach it.
-- ============================================

-- Schema-level usage. authenticated and service_role need it to address any
-- relation in public; anon explicitly does not.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE USAGE ON SCHEMA public FROM anon;

-- ============================================
-- Per-table grants
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles                 TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bottles                  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes                  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_recipe_preferences  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_logs            TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestion_sessions      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions              TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestion_refinements   TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claude_usage             TO authenticated, service_role;

-- ============================================
-- Sequences
-- ============================================
-- Every table here uses gen_random_uuid() rather than sequences, so no
-- sequence grants are needed today. If a future table uses BIGSERIAL or
-- SERIAL, add:
--   GRANT USAGE, SELECT ON SEQUENCE public.<seq_name> TO authenticated, service_role;

-- ============================================
-- Default privileges for FUTURE tables
-- ============================================
-- If a future migration omits an explicit GRANT block (forgetful day), these
-- defaults catch it. They only apply to objects created by the current role
-- (postgres), which is what every Supabase migration runs as.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ============================================
-- Functions (RPC endpoints)
-- ============================================
-- get_makeable_recipes is called from the client via supabase.rpc(); needs
-- explicit EXECUTE for the authenticated role.
GRANT EXECUTE ON FUNCTION public.get_makeable_recipes(UUID) TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
