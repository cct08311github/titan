import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration — unified for Docker and local environments.
 *
 * Environment variables:
 *   BASE_URL     — app base URL (default: http://localhost:3100)
 *   CI           — set in CI environments; adjusts retries/workers
 *   E2E_TIMEOUT  — per-test timeout in ms (default: 30000)
 *   E2E_WORKERS  — parallel worker count (default: 3, CI: 1)
 */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: parseInt(process.env.E2E_TIMEOUT ?? '30000', 10),
  retries: isCI ? 2 : 1,
  // Limit workers to avoid rate limiter triggering on concurrent logins
  workers: parseInt(process.env.E2E_WORKERS ?? (isCI ? '1' : '3'), 10),
  globalSetup: './e2e/global-setup.ts',
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3100',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],
});
