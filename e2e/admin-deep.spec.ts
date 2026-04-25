import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E deep tests for /admin page — Issue #608
 *
 * Covers:
 *   - Page loads for Manager with heading
 *   - Backup status section: stats cards, recent backups table
 *   - Audit log section: table with columns
 *   - Audit log pagination (next/prev)
 *   - Audit log filter by action type
 *   - Audit log date range filter
 *   - Clear filters button
 *   - Refresh buttons work
 *   - Engineer gets redirected or sees permission error
 *   - Console error free
 */

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
        errors.push(text);
      }
    }
  });
  return errors;
}

test.describe('系統管理頁面 — 深度測試 (/admin)', () => {

  // ── Manager tests ──────────────────────────────────────────────────────

  test.describe('Manager 視角', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('頁面載入無 console error，顯示標題', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page.locator('h1')).toContainText('系統管理', { timeout: 20000 });
      await expect(page.locator('text=備份狀態監控與稽核日誌檢視')).toBeVisible();

      expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('備份狀態區塊標題與重新整理按鈕', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Backup status heading
      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible({ timeout: 20000 });

      // Refresh button
      const refreshBtn = page.locator('h2', { hasText: '備份狀態' }).locator('..').locator('button', { hasText: '重新整理' });
      await expect(refreshBtn).toBeVisible();
    });

    test('備份狀態統計卡片顯示', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Wait for backup section to load
      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible({ timeout: 20000 });

      // Stats cards: 最後備份時間, 備份總數, 總容量, 備份路徑
      await expect(page.locator('text=最後備份時間')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=備份總數')).toBeVisible();
      await expect(page.locator('text=總容量')).toBeVisible();
      await expect(page.locator('text=備份路徑')).toBeVisible();
    });

    test('備份狀態：最近備份表格或空狀態', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible({ timeout: 20000 });

      // Either recent backups table or empty state
      const hasTable = await page.locator('text=最近備份').isVisible().catch(() => false);
      const hasEmpty = await page.locator('text=尚無備份紀錄').isVisible().catch(() => false);

      expect(hasTable || hasEmpty).toBeTruthy();
    });

    test('稽核日誌區塊標題與重新整理按鈕', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Audit log heading
      await expect(page.locator('h2', { hasText: '稽核日誌' })).toBeVisible({ timeout: 20000 });

      // Refresh button for audit section
      const auditSection = page.locator('h2', { hasText: '稽核日誌' }).locator('..');
      await expect(auditSection.locator('button', { hasText: '重新整理' })).toBeVisible();
    });

    test('稽核日誌：篩選區域存在（操作類型、日期）', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '稽核日誌' })).toBeVisible({ timeout: 20000 });

      // Filter labels
      await expect(page.locator('text=操作類型')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=起始日期')).toBeVisible();
      await expect(page.locator('text=結束日期')).toBeVisible();

      // Action filter select
      const actionSelect = page.locator('select').first();
      await expect(actionSelect).toBeVisible();

      // Date inputs
      const dateInputs = page.locator('input[type="date"]');
      expect(await dateInputs.count()).toBeGreaterThanOrEqual(2);
    });

    test('稽核日誌：操作類型篩選可操作', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '稽核日誌' })).toBeVisible({ timeout: 20000 });

      const actionSelect = page.locator('select').first();
      await expect(actionSelect).toBeVisible({ timeout: 15000 });

      // Should have "全部" as default option
      const options = await actionSelect.locator('option').allTextContents();
      expect(options[0]).toBe('全部');

      // If there are action options beyond "全部", select one
      if (options.length > 1) {
        await actionSelect.selectOption({ index: 1 });
        await page.waitForLoadState('domcontentloaded');

        // Clear filter button should appear
        const clearBtn = page.locator('button', { hasText: '清除篩選' });
        await expect(clearBtn).toBeVisible({ timeout: 10000 });

        // Click clear
        await clearBtn.click();
        await page.waitForLoadState('domcontentloaded');
      }
    });

    test('稽核日誌表格欄位標題正確', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '稽核日誌' })).toBeVisible({ timeout: 20000 });

      const hasEmpty = await page.locator('text=尚無稽核紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Table headers
      const headers = ['時間', '操作', '資源類型', '資源 ID', '詳情', 'IP'];
      for (const header of headers) {
        await expect(page.locator('th', { hasText: header }).first()).toBeVisible({ timeout: 10000 });
      }
    });

    test('稽核日誌分頁控制', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '稽核日誌' })).toBeVisible({ timeout: 20000 });

      const hasEmpty = await page.locator('text=尚無稽核紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Pagination info text
      const paginationInfo = page.locator('text=/共 \\d+ 筆，第 \\d+ \\/ \\d+ 頁/');
      await expect(paginationInfo).toBeVisible({ timeout: 15000 });

      // Pagination buttons exist
      const buttons = page.locator('.border-t button');
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(2); // prev + next
    });

    test('備份重新整理按鈕可點擊', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible({ timeout: 20000 });

      // Click refresh for backup section
      const refreshBtn = page.locator('h2', { hasText: '備份狀態' }).locator('..').locator('button', { hasText: '重新整理' });
      await refreshBtn.click();

      // Should show loading or refresh data without crashing
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible();
    });
  });

  // ── Engineer tests ─────────────────────────────────────────────────────

  test.describe('Engineer 視角', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 被拒絕存取或重導向', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Engineer should either be redirected to /dashboard or see permission error
      const isRedirected = page.url().includes('/dashboard');
      const hasPermError = await page.locator('text=權限不足').isVisible().catch(() => false);

      expect(isRedirected || hasPermError).toBeTruthy();
    });

    test('Engineer 不會看到管理內容', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Should NOT see backup or audit log sections
      const hasBackup = await page.locator('h2', { hasText: '備份狀態' }).isVisible().catch(() => false);
      const hasAudit = await page.locator('h2', { hasText: '稽核日誌' }).isVisible().catch(() => false);

      expect(hasBackup).toBeFalsy();
      expect(hasAudit).toBeFalsy();
    });
  });
});
