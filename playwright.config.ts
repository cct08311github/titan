import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration — unified for Docker and local environments.
 *
 * Environment variables:
 *   BASE_URL                — app base URL (default: http://localhost:3100)
 *   CI                      — set in CI environments; adjusts retries/workers
 *   E2E_TIMEOUT             — per-test timeout in ms (default: 30000)
 *   E2E_WORKERS             — parallel worker count (default: 3)
 *   E2E_GLOBAL_TIMEOUT_MS   — full-run cap in ms (default: 15 min)
 */

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: parseInt(process.env.E2E_TIMEOUT ?? '30000', 10),
  // Issue #1480: cap total run time so one hung test cannot eat 6h runner
  // budget. 15 min covers the 920-test suite at 3 workers with margin.
  globalTimeout: parseInt(process.env.E2E_GLOBAL_TIMEOUT_MS ?? String(15 * 60_000), 10),
  retries: isCI ? 2 : 1,
  // Issue #1484: bumped CI workers from 1 to 3. Saved auth state files
  // (manager.json / engineer.json, populated in global-setup) mean most
  // tests do not re-login, so the per-IP login rate limiter is not a
  // concern at this concurrency. Tests that do explicit login should use
  // test.describe.configure({ mode: 'serial' }) in their own file.
  workers: parseInt(process.env.E2E_WORKERS ?? '3', 10),
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
