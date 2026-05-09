# Multi-User Rollout

How to flip Vesperant from single-user (BYOK) to multi-user (server-side key + email allowlist).

## What changed

- **Claude API key** moved from per-user `localStorage` to a single Vercel env var (`ANTHROPIC_API_KEY`). Clients never see or send the key.
- **Sign-ups gated** by an `allowed_emails` table — only allowlisted Gmail addresses can create an account. Enforced both at the Supabase auth layer (DB trigger) and at the API layer (JWT check + re-verify).
- **Admin flag** (`profiles.is_admin`) lets the owner manage the allowlist from inside the app.
- **Soft cap** of 100 Claude requests / user / 24h (override via `CLAUDE_DAILY_LIMIT` env var).
- **Per-user data** unchanged — RLS already isolates bottles, recipes, logs, suggestions per `user_id`.

## Rollout steps

### 1 · Apply the migration

Run `supabase/migrations/004_multi_user.sql` in the Supabase SQL editor.

It adds: `is_admin` flag, `allowed_emails` table, `claude_usage` table, RLS, a stricter signup trigger, and seeds `bkoeller@gmail.com` as the first allowed user + admin.

> **If your existing profile predates this migration**, the seed `UPDATE` at the bottom flips your `is_admin` to true. Verify with `select email, is_admin from profiles join auth.users using (id) where email = 'bkoeller@gmail.com';`.

### 2 · Set Vercel environment variables

In the Vercel project → Settings → Environment Variables, add three keys for **Production** (and Preview if you want PRs to work):

| Key | Where to find it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API Keys → **Legacy API Keys** panel → service_role secret |
| `CLAUDE_DAILY_LIMIT` *(optional)* | Number — defaults to 100 |

The serverless function reads `VITE_SUPABASE_URL` (already configured for the client) so server and client always agree on the project. `SUPABASE_URL` works as a fallback if you'd rather keep them split.

> **Heads-up on the service_role key**: Supabase is rolling out a new key format and the classic `service_role` JWT now lives in the **Legacy API Keys** panel (not the top-level "API Keys" card). It's still the right key — you want the long JWT labelled `service_role`, not the new publishable/secret key pair. Grabbing the wrong one shows up as `{"error":"Invalid session"}` 401s on every authenticated `/api/claude` call.

> The service-role key is **highly sensitive** — never commit it, never expose it to the client. It only ever lives in Vercel env + the serverless function.

### 3 · Deploy

```bash
git add -A
git commit -m "Multi-user: server-side Claude key + email allowlist"
git push
```

Vercel auto-deploys from main.

### 4 · Smoke test (your account)

1. Open the deployed app, sign in with bkoeller@gmail.com — should land on Tonight as before.
2. Tap a suggestion → confirm Claude responds (uses server-side key, no localStorage interaction).
3. Open Settings → confirm "Allowed Users" panel appears (admin-only).
4. Open DevTools → Application → Local Storage → confirm no `vesperant_claude_api_key` is being written.

### 5 · Invite a test account

1. Settings → Allowed Users → add a Gmail address (e.g. a personal alt).
2. Sign out, sign in with that account.
3. Should land in OnboardingFlow (now without the API key step).
4. Add a bottle, request a suggestion — Claude works without ever seeing a per-user key.
5. Confirm RLS: that account sees only its own bottle, not yours.

### 6 · Block test (optional but worth it)

1. Sign in with a Gmail that is **not** in the allowlist.
2. Should fail at the Supabase auth step with an "insufficient privilege" error from the trigger. The user is never created in `auth.users`.

## Rollback

If anything goes sideways:

- The migration is reversible — `DROP TABLE allowed_emails`, `DROP TABLE claude_usage`, restore the old `handle_new_user()` from migration 001, and re-add `claude_api_key_encrypted TEXT` to `profiles` if needed.
- Reverting the code restores the BYOK flow; the env vars in Vercel are harmless if unused.

## Cost ceiling math

Default cap: 100 requests/user/day. With Sonnet 4.6 averaging ~$0.01–0.03 per suggestion turn (input + output ~2–4k tokens), that's ~$1–3/user/day worst case. For a handful of friends, monthly bill should stay well under $50 even with heavy use. Bump or lower `CLAUDE_DAILY_LIMIT` to taste.

## Known follow-ups

- **Onboarding for non-owners** says "Tap Skip" on the bar setup — could replace with a friendlier "open photo import" CTA.
- **Usage visibility for users**: the `claude_usage` table has an RLS read policy, so a "my usage today" widget is a small follow-up if rate-limit confusion comes up.
- **Display name**: profiles default to email; could ask for a friendly name during onboarding.
