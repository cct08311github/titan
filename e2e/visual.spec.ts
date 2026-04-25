import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

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
    await page.waitForLoadState('domcontentloaded');
    // Ensure main content is rendered before screenshot
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Login visual regression', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
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
    await page.waitForLoadState('domcontentloaded');
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
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('kpi.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Gantt visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('gantt.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Knowledge visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('knowledge.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Plans visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('plans.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Reports visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('reports.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Timesheet visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await expect(page).toHaveScreenshot('timesheet.png', {
      maxDiffPixelRatio: 0.02,
    });

    await context.close();
  });

  test('Dashboard Engineer 視角 visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });
    await expect(page).toHaveScreenshot('dashboard-engineer.png', { maxDiffPixelRatio: 0.02 });
    await context.close();
  });

  test('Kanban Engineer 視角 visual regression', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/kanban');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });
    await expect(page).toHaveScreenshot('kanban-engineer.png', { maxDiffPixelRatio: 0.02 });
    await context.close();
  });
});
