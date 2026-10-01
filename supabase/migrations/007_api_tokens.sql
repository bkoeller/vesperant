-- ============================================
-- PERSONAL API TOKENS (agent access via /api/mcp)
-- ============================================
-- Each allowlisted user can mint tokens that let an AI agent (e.g. Claude
-- Code) read *their own* Vesperant data through the read-only MCP endpoint.
--
-- Only a SHA-256 hash of each token is stored. The plaintext is generated
-- in the browser, shown once, and never sent to the database. Tokens are
-- 256-bit random strings, so a fast hash is sufficient (no salt/bcrypt).
--
-- Clients may create, list, and delete their own tokens. Only the service
-- role (the /api/mcp function) looks tokens up by hash and stamps
-- last_used_at, so there is no client UPDATE policy.
-- ============================================

CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- First characters of the token (e.g. "vsp_Ab12Cd") so users can tell
  -- tokens apart in Settings without the secret being recoverable.
  token_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);

-- ============================================
-- RLS — own rows only
-- ============================================
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_tokens_read_own ON api_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY api_tokens_insert_own ON api_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY api_tokens_delete_own ON api_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Grants (see 006_explicit_grants.sql for the pattern)
-- ============================================
-- No UPDATE for authenticated: tokens are immutable from the client.
REVOKE ALL ON public.api_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.api_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_tokens TO service_role;
