import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

/**
 * Visual regression tests using Playwright's built-in toHaveScreenshot().
 *
 * First run: generates baseline snapshots in e2e/visual.spec.ts-snapshots/
 * Subsequent runs: compare against baseline (maxDiffPixelRatio: 0.02 = 2%)
 *
 * To update baselines after intentional UI changes:
 *   npx playwright test visual.spec.ts --update-snapshots
 */

test.describe('Visual Regression', () => {
  test('Dashboard visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Ensure main content is rendered before screenshot
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Login visual regression', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Ensure login form is rendered
    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 });

    await expect(page).toHaveScreenshot('login.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  test('Kanban visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('kanban.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('KPI visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('kpi.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });
});
