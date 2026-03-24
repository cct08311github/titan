import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  // Limit workers to avoid rate limiter triggering on concurrent logins
  workers: 3,
  globalSetup: './e2e/global-setup.ts',
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:3100',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
