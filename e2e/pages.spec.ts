import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

// Use pre-saved Manager session — avoids repeated login and rate limiter issues
test.use({ storageState: MANAGER_STATE_FILE });

const PAGES = [
  { path: '/dashboard', h1: '儀表板' },
  { path: '/kanban',    h1: '看板' },
  { path: '/gantt',     h1: '甘特圖' },
  { path: '/knowledge', h1: '知識庫' },
  { path: '/kpi',       h1: null },    // KPI h1 contains icon + text node
  { path: '/plans',     h1: '年度計畫' },
  { path: '/reports',   h1: '報表' },
  { path: '/timesheet', h1: '工時紀錄' },
];

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

test.describe('頁面巡覽（Manager 帳號）', () => {
  for (const { path, h1 } of PAGES) {
    test(`${path} — 頁面可訪問且顯示 h1 標題`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
            consoleErrors.push(text);
          }
        }
      });

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      // HTTP 200
      expect(response?.status()).toBe(200);

      // h1 must be visible (allow time for Next.js hydration + API data)
      const heading = page.locator('h1');
      await expect(heading.first()).toBeVisible({ timeout: 20000 });

      // If we know the exact heading text, verify it
      if (h1) {
        await expect(heading.first()).toContainText(h1);
      }

      // No unexpected console errors
      expect(consoleErrors, `Console errors on ${path}: ${consoleErrors.join(', ')}`).toHaveLength(0);
    });
  }

  test('/dashboard — 顯示儀表板標題', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');
  });

  test('/kpi — 頁面有實質內容', async ({ page }) => {
    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    const text = await page.locator('body').innerText();
    expect(text.trim().length).toBeGreaterThan(10);
  });
});
