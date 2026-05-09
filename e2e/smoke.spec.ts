import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('login screen renders for an unauthenticated visitor', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Vesperant' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });

  test('app does not throw on a clean page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
