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
const KNOWN_VIOLATIONS = new Set([
  'scrollable-region-focusable',
  'color-contrast',
]);

test.describe('Accessibility 測試', () => {
  test('Dashboard 頁面 axe accessibility 掃描（記錄違規）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[aria-hidden="true"]')
      .analyze();

    const newViolations = results.violations.filter((v) => !KNOWN_VIOLATIONS.has(v.id));

    if (results.violations.length > 0) {
      console.log(
        `Dashboard a11y: ${results.violations.length} total (${newViolations.length} new, ` +
        `${results.violations.length - newViolations.length} known)`
      );
      results.violations.forEach((v) => {
        const tag = KNOWN_VIOLATIONS.has(v.id) ? '[KNOWN]' : '[NEW]';
        console.log(`  ${tag} ${v.id} (${v.impact}): ${v.description}`);
      });
    }

    expect(
      newViolations.map((v) => `${v.id}: ${v.description}`),
      `Found ${newViolations.length} NEW a11y violations on Dashboard`
    ).toHaveLength(0);

    await context.close();
  });

  test('Login 頁面 axe accessibility 掃描（記錄違規）', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('[aria-hidden="true"]')
      .analyze();

    const newViolations = results.violations.filter((v) => !KNOWN_VIOLATIONS.has(v.id));

    if (results.violations.length > 0) {
      console.log(
        `Login a11y: ${results.violations.length} total (${newViolations.length} new, ` +
        `${results.violations.length - newViolations.length} known)`
      );
      results.violations.forEach((v) => {
        const tag = KNOWN_VIOLATIONS.has(v.id) ? '[KNOWN]' : '[NEW]';
        console.log(`  ${tag} ${v.id} (${v.impact}): ${v.description}`);
      });
    }

    expect(
      newViolations.map((v) => `${v.id}: ${v.description}`),
      `Found ${newViolations.length} NEW a11y violations on Login`
    ).toHaveLength(0);
  });
});
