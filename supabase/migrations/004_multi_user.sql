-- ============================================
-- MULTI-USER: ALLOWLIST + ADMIN FLAG + SIGNUP GATE
-- ============================================
-- Restricts sign-ups to a server-managed allowlist of email addresses.
-- Adds an is_admin flag so the owner can manage the allowlist from the app.
-- The Claude API key is now centralized server-side (Vercel env var), so
-- per-user key storage is removed.
-- ============================================

-- ============================================
-- ADMIN FLAG
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- The encrypted-key column is no longer used. Drop it.
-- (No data loss in practice — feature was never wired up; key lived in localStorage.)
ALTER TABLE profiles
  DROP COLUMN IF EXISTS claude_api_key_encrypted;

-- ============================================
-- ALLOWED EMAILS
-- ============================================
CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_allowed_emails_active ON allowed_emails(email) WHERE is_active = TRUE;

-- ============================================
-- IS-EMAIL-ALLOWED HELPER
-- ============================================
CREATE OR REPLACE FUNCTION is_email_allowed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(p_email)
      AND is_active = TRUE
  );
$$;

-- ============================================
-- SIGNUP GATE
-- Replace handle_new_user trigger to reject non-allowlisted emails.
-- Raising in an AFTER INSERT trigger on auth.users rolls back the transaction,
-- preventing the auth user from being created.
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email TEXT := NEW.email;
BEGIN
  IF v_email IS NULL OR NOT public.is_email_allowed(v_email) THEN
    RAISE EXCEPTION 'Sign-up not permitted for this email address. Contact the owner for access.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Trigger from 001 (on_auth_user_created) calls handle_new_user — no need to recreate it.

-- ============================================
-- USAGE LOG (per-user soft cap)
-- ============================================
CREATE TABLE claude_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint TEXT,
  input_tokens INT,
  output_tokens INT
);

CREATE INDEX idx_claude_usage_user_day ON claude_usage(user_id, called_at DESC);

ALTER TABLE claude_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage; only the service role inserts (via the API).
CREATE POLICY claude_usage_read_own ON claude_usage
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- RLS — allowed_emails
-- Only admins can read or modify. Non-admins have zero visibility.
-- ============================================
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY allowed_emails_admin_read ON allowed_emails
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY allowed_emails_admin_insert ON allowed_emails
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY allowed_emails_admin_update ON allowed_emails
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY allowed_emails_admin_delete ON allowed_emails
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- RLS — profiles is_admin self-protection
-- The existing profiles_own policy lets users update their own row,
-- which would let them grant themselves admin. Replace with a stricter pair
-- that forbids changing is_admin via the client.
-- ============================================
DROP POLICY profiles_own ON profiles;

CREATE POLICY profiles_read_own ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow updating own row only when is_admin is left unchanged.
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_delete_own ON profiles
  FOR DELETE USING (auth.uid() = id);

-- ============================================
-- BOOTSTRAP: SEED YOUR OWNER EMAIL
-- ============================================
-- The signup trigger above blocks every Google sign-in until the email is in
-- allowed_emails. To bootstrap your deployment, after applying this migration
-- run something like the SQL below in the Supabase SQL editor with your own
-- email substituted in. This is intentionally not part of the migration so
-- forks of this repo don't inherit anyone else's owner identity.
--
--   INSERT INTO allowed_emails (email, notes)
--   VALUES ('YOU@example.com', 'Owner')
--   ON CONFLICT (email) DO NOTHING;
--
--   -- Sign in with that account once via the app to create your profile,
--   -- then promote yourself to admin:
--   UPDATE profiles
--   SET is_admin = TRUE
--   WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = 'you@example.com');
-- ============================================
