import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MANAGER_STATE_FILE } from './helpers/auth';

/**
 * Accessibility tests using axe-core for WCAG 2 AA compliance.
 *
 * Known existing violations (to be fixed as separate issues):
 * - scrollable-region-focusable: kanban/scroll areas in Dashboard
 * - color-contrast: dark theme muted text in Login page
 *
 * Tests FAIL only on newly introduced violations not in the known list.
 */
const KNOWN_VIOLATIONS = new Set<string>([
]);

/** Run axe scan and assert no NEW violations beyond the known list. */
async function assertNoNewViolations(page: Parameters<typeof AxeBuilder>[0]['page'], label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('[aria-hidden="true"]')
    .analyze();

  const newViolations = results.violations.filter((v) => !KNOWN_VIOLATIONS.has(v.id));

  if (results.violations.length > 0) {
    console.log(
      `${label} a11y: ${results.violations.length} total (${newViolations.length} new, ` +
      `${results.violations.length - newViolations.length} known)`
    );
    results.violations.forEach((v) => {
      const tag = KNOWN_VIOLATIONS.has(v.id) ? '[KNOWN]' : '[NEW]';
      console.log(`  ${tag} ${v.id} (${v.impact}): ${v.description}`);
    });
  }

  expect(
    newViolations.map((v) => `${v.id}: ${v.description}`),
    `Found ${newViolations.length} NEW a11y violations on ${label}`
  ).toHaveLength(0);
}

test.describe('Accessibility 測試', () => {
  test('Dashboard 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Wait for h1 to confirm page is hydrated before axe scan
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Dashboard');

    await context.close();
  });

  test('Login 頁面 axe accessibility 掃描（記錄違規）', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // Wait for login form to be interactive
    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 });

    await assertNoNewViolations(page, 'Login');
  });

  test('Kanban 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Kanban');

    await context.close();
  });

  test('KPI 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'KPI');

    await context.close();
  });

  test('Gantt 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Gantt');

    await context.close();
  });

  test('Knowledge 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Knowledge');

    await context.close();
  });

  test('Plans 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Plans');

    await context.close();
  });

  test('Reports 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Reports');

    await context.close();
  });

  test('Timesheet 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    await assertNoNewViolations(page, 'Timesheet');

    await context.close();
  });
});
