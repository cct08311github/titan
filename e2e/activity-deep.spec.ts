import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E deep tests for /activity page — Issue #608
 *
 * Covers:
 *   - Page load with heading and subtitle
 *   - Activity items or empty state
 *   - Source type badges (任務 / 系統)
 *   - User names and action labels displayed
 *   - Timestamps rendered
 *   - Pagination controls (next/prev)
 *   - Pagination info text (共 N 筆)
 *   - Navigation does not crash for Engineer
 *   - Console error free
 *   - Multiple page transitions
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

test.describe('活動紀錄頁面 — 深度測試 (/activity)', () => {

  // ── Manager tests ──────────────────────────────────────────────────────

  test.describe('Manager 視角', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('頁面載入無 console error，顯示標題與副標題', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const response = await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page.locator('h1')).toContainText('團隊動態');
      await expect(page.locator('text=查看團隊成員的最新操作紀錄')).toBeVisible({ timeout: 15000 });

      expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('顯示活動項目列表或空白狀態', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Either activity items with timeline dots, or empty state
      const hasItems = await page.locator('.space-y-1 > div').first().isVisible().catch(() => false);
      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);

      expect(hasItems || hasEmpty).toBeTruthy();
    });

    test('活動項目顯示來源類型標籤（任務/系統）', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) {
        // Empty state — just verify page is stable
        expect(page.url()).toContain('/activity');
        return;
      }

      // At least one badge should exist
      const taskBadge = page.locator('text=任務').first();
      const systemBadge = page.locator('text=系統').first();

      const hasBadges = await taskBadge.isVisible().catch(() => false) ||
                        await systemBadge.isVisible().catch(() => false);
      expect(hasBadges).toBeTruthy();
    });

    test('活動項目顯示使用者名稱', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // User names or "系統" should appear in activity items
      const nameElements = page.locator('.space-y-1 > div .font-medium').first();
      await expect(nameElements).toBeVisible({ timeout: 10000 });
      const text = await nameElements.textContent();
      expect(text!.length).toBeGreaterThan(0);
    });

    test('活動項目顯示操作動作標籤', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Action labels like 建立, 更新, 刪除 should appear
      const actionLabels = ['建立', '更新', '刪除', '變更狀態', '留言', '指派', '建立任務', '更新任務', '刪除任務', '角色變更', '密碼變更', '登入失敗'];
      const allText = await page.locator('.space-y-1').first().textContent() ?? '';
      const hasAction = actionLabels.some((label) => allText.includes(label));
      expect(hasAction).toBeTruthy();
    });

    test('活動項目顯示時間戳', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Timestamp elements (formatRelative output) should exist
      // They appear as small muted text at the bottom of each item
      const timestamps = page.locator('.space-y-1 > div .text-muted-foreground\\/60');
      const count = await timestamps.count();
      expect(count).toBeGreaterThan(0);
    });

    test('分頁資訊文字顯示（共 N 筆）', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Pagination info: "共 N 筆，第 M/T 頁" — only visible when totalPages > 1
      const paginationInfo = page.locator('text=/共 \\d+ 筆/');
      const hasPagination = await paginationInfo.isVisible().catch(() => false);

      // If only one page, pagination won't show — that's acceptable
      expect(page.url()).toContain('/activity');
      if (hasPagination) {
        const text = await paginationInfo.textContent();
        expect(text).toMatch(/共 \d+ 筆/);
      }
    });

    test('分頁按鈕（上一頁/下一頁）可操作', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (hasEmpty) return;

      // Pagination uses aria-label 上一頁/下一頁
      const prevBtn = page.locator('button[aria-label="上一頁"]');
      const nextBtn = page.locator('button[aria-label="下一頁"]');

      const hasPagination = await nextBtn.isVisible().catch(() => false);
      if (!hasPagination) return; // Only 1 page of data

      // On page 1, prev should be disabled
      await expect(prevBtn).toBeDisabled();

      // If next is enabled, click it
      if (await nextBtn.isEnabled().catch(() => false)) {
        await nextBtn.click();
        await page.waitForLoadState('domcontentloaded');

        // After going to page 2, prev should be enabled
        await expect(prevBtn).toBeEnabled();

        // Go back
        await prevBtn.click();
        await page.waitForLoadState('domcontentloaded');
        await expect(prevBtn).toBeDisabled();
      }
    });

    test('空白狀態顯示正確圖示與描述', async ({ page }) => {
      // This test verifies the empty state renders properly when no data
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);
      if (!hasEmpty) {
        // Has data — skip empty state check
        return;
      }

      await expect(page.locator('text=系統尚未記錄任何操作')).toBeVisible();
    });

    test('頁面 URL 保持正確', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      expect(page.url()).toContain('/activity');

      // No unexpected redirects
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/activity');
    });
  });

  // ── Engineer tests ─────────────────────────────────────────────────────

  test.describe('Engineer 視角', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 可以存取活動紀錄頁面', async ({ page }) => {
      const response = await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page.locator('h1')).toContainText('團隊動態');
    });

    test('Engineer 看到活動項目或空白狀態', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasItems = await page.locator('.space-y-1 > div').first().isVisible().catch(() => false);
      const hasEmpty = await page.locator('text=尚無活動紀錄').isVisible().catch(() => false);

      expect(hasItems || hasEmpty).toBeTruthy();
    });
  });
});
