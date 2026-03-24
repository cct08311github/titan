import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

// Use pre-saved Manager session
test.use({ storageState: MANAGER_STATE_FILE });

const ALL_PAGES = [
  '/dashboard',
  '/kanban',
  '/gantt',
  '/knowledge',
  '/kpi',
  '/plans',
  '/reports',
  '/timesheet',
];

/** Errors to ignore — framework / runtime noise */
const IGNORE_PATTERNS = [
  'Warning:',
  'hydrat',
  'Expected server HTML',
  'next-auth',
  'CLIENT_FETCH_ERROR',
  'favicon',
  'net::ERR',
  'ResizeObserver',
  'Non-Error promise rejection',
];

function isNoise(text: string): boolean {
  return IGNORE_PATTERNS.some((p) => text.includes(p));
}

test.describe('Defensive 測試', () => {
  test('所有頁面在登入後不白屏（body 有內容）', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Give React time to hydrate
      await page.waitForTimeout(1000);

      // Check body is not empty/blank
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length, `${path} body should not be empty`).toBeGreaterThan(5);

      // Check no white screen: body should have visible children
      const visibleChildren = await page.locator('body > *').count();
      expect(visibleChildren, `${path} should have visible elements`).toBeGreaterThan(0);
    }
  });

  test('登入後巡覽所有頁面不出現非預期的 console error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isNoise(text)) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });

    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
    }

    expect(
      consoleErrors,
      `Unexpected console errors: ${consoleErrors.join('\n')}`
    ).toHaveLength(0);
  });
});
