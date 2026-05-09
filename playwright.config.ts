import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 1 worker locally for cleaner output / shared dev server; CI parallelizes.
  workers: process.env.CI ? undefined : 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Stub env vars for the dev server. Real values not needed since
    // every Supabase + Claude call in these tests is intercepted via
    // page.route() in the spec helpers.
    env: {
      VITE_SUPABASE_URL: 'https://e2e-stub.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-stub-anon-key',
    },
  },
});
