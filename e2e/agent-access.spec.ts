import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { signInAs } from './helpers/auth';
import { mockSupabaseRest } from './helpers/mocks';

const USER_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Agent access', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAs(page, { email: 'test@example.com' });
    await mockSupabaseRest(page, {
      profiles: [{ id: USER_ID, is_admin: false, onboarding_completed: true }],
      api_tokens: [
        { id: 'tok-1', user_id: USER_ID, name: 'Old laptop', token_prefix: 'vsp_AbCdEf',
          created_at: '2026-09-01T00:00:00Z', last_used_at: null },
      ],
    });
  });

  test('lists existing tokens by name and prefix only', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Agent access' })).toBeVisible();
    await expect(page.getByText('Old laptop')).toBeVisible();
    await expect(page.getByText('vsp_AbCdEf…')).toBeVisible();
    await expect(page.getByText(/Never used/)).toBeVisible();
  });

  test('creates a token, shows it once, and stores only its hash', async ({ page, baseURL }) => {
    await page.goto('/settings');
    await page.getByPlaceholder(/Token name/).fill('Claude Code on laptop');

    const insert = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/rest/v1/api_tokens'));
    await page.getByRole('button', { name: 'Create token' }).click();
    const body = (await insert).postDataJSON();

    const token = (await page.locator('code').first().textContent())!.trim();
    expect(token).toMatch(/^vsp_[A-Za-z0-9_-]{43}$/);

    // The database receives the hash and a short prefix, never the token.
    expect(body).toEqual({
      user_id: USER_ID,
      name: 'Claude Code on laptop',
      token_hash: createHash('sha256').update(token).digest('hex'),
      token_prefix: token.slice(0, 10),
    });
    expect(JSON.stringify(body)).not.toContain(token);

    await page.getByRole('button', { name: 'Copy command' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `claude mcp add --transport http vesperant ${baseURL}/api/mcp --header "Authorization: Bearer ${token}"`,
    );

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(token)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create token' })).toBeVisible();
  });

  test('revokes a token after confirmation', async ({ page }) => {
    await page.goto('/settings');
    page.once('dialog', d => d.accept());
    const del = page.waitForRequest(r => r.method() === 'DELETE' && r.url().includes('/rest/v1/api_tokens'));
    await page.getByRole('button', { name: 'Revoke Old laptop' }).click();
    expect((await del).url()).toContain('id=eq.tok-1');
  });
});
