import type { Page } from '@playwright/test';

/**
 * Inject a fake Supabase session into localStorage so the app boots
 * past AuthGuard without going through Google OAuth (which we can't
 * automate against Google's UI). The supabase-js client reads the
 * session from this exact key on init.
 */
export async function signInAs(
  page: Page,
  opts: { id?: string; email: string; isAdmin?: boolean } = { email: 'test@example.com' },
): Promise<void> {
  const userId = opts.id ?? '00000000-0000-0000-0000-000000000001';
  const supabaseUrl = 'https://e2e-stub.supabase.co';
  // Storage key matches @supabase/supabase-js v2's default:
  // sb-<project-ref>-auth-token, where the ref is the subdomain.
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  // Synthetic but JWT-shaped — the client never validates it; the auth
  // gate (api/claude.ts) is bypassed because we stub /api/claude too.
  const fakeAccessToken = 'fake.jwt.token';
  const session = {
    access_token: fakeAccessToken,
    refresh_token: 'fake-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      email: opts.email,
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: opts.email.split('@')[0] },
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  // Pre-navigation init script — runs before any app code on every page.
  await page.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey, session },
  );
}
