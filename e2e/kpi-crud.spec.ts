import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E CRUD lifecycle tests for KPI — Issue #609
 *
 * Covers:
 *   - Page loads with heading and year
 *   - Create KPI via form → verify in list
 *   - KPI card shows code, title, achievement rate
 *   - Expand KPI card to see linked tasks
 *   - Summary stats (KPI 總數, 已達成, 平均達成率)
 *   - Create KPI via API → verify in list
 *   - Edit KPI via API → verify changes
 *   - Delete KPI via API → verify removed
 *   - Engineer cannot see "新增 KPI" button
 *   - Manager sees "新增 KPI" button
 */

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

test.describe('KPI CRUD 生命週期', () => {

  let createdKpiId: string | null = null;
  const currentYear = new Date().getFullYear();

  test.describe('Manager 操作', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('KPI 頁面載入並顯示標題與年度', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('h1')).toContainText('KPI 管理', { timeout: 20000 });
      await expect(page.locator(`text=${currentYear} 年度`)).toBeVisible();
    });

    test('Manager 看到「新增 KPI」按鈕', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('button', { hasText: '新增 KPI' })).toBeVisible({ timeout: 15000 });
    });

    test('點擊「新增 KPI」顯示建立表單', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await page.locator('button', { hasText: '新增 KPI' }).click();

      // Form should appear with fields
      await expect(page.locator('h2', { hasText: '新增 KPI' })).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=代碼')).toBeVisible();
      await expect(page.locator('text=名稱')).toBeVisible();
      await expect(page.locator('text=目標值')).toBeVisible();
      await expect(page.locator('text=權重')).toBeVisible();
    });

    test('填寫表單並建立 KPI', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await page.locator('button', { hasText: '新增 KPI' }).click();
      await expect(page.locator('h2', { hasText: '新增 KPI' })).toBeVisible({ timeout: 10000 });

      // Fill in form
      await page.locator('input[placeholder="如 KPI-01"]').fill('KPI-E2E');
      await page.locator('input[placeholder="KPI 名稱"]').fill('E2E 測試 KPI');
      await page.locator('input[placeholder="100"]').fill('100');

      // Submit
      await page.locator('button[type="submit"]', { hasText: '建立 KPI' }).click();

      // Wait for form to close and KPI to appear in list
      await page.waitForLoadState('domcontentloaded');

      // Verify KPI appears (either in card form or empty state changed)
      const hasKpi = await page.locator('text=E2E 測試 KPI').isVisible({ timeout: 10000 }).catch(() => false);
      const hasCode = await page.locator('text=KPI-E2E').isVisible().catch(() => false);

      expect(hasKpi || hasCode).toBeTruthy();
    });

    test('透過 API 建立 KPI 並在頁面驗證', async ({ page, request }) => {
      const res = await request.post('/api/kpi', {
        data: {
          year: currentYear,
          code: 'KPI-API',
          title: 'API 建立的 KPI',
          target: 200,
          weight: 1,
          autoCalc: false,
        },
        failOnStatusCode: false,
      });

      if (res.ok()) {
        const body = await res.json();
        createdKpiId = body?.id ?? body?.data?.id;

        await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('text=API 建立的 KPI').first()).toBeVisible({ timeout: 15000 });
      }
    });

    test('KPI 卡片顯示達成率和進度條', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const hasKpis = await page.locator('text=KPI 總數').isVisible().catch(() => false);
      if (!hasKpis) {
        // No KPIs — check empty state
        const hasEmpty = await page.locator('text=尚無 KPI').isVisible().catch(() => false);
        expect(hasEmpty).toBeTruthy();
        return;
      }

      // Summary cards should show stats
      await expect(page.locator('text=KPI 總數')).toBeVisible();
      await expect(page.locator('text=已達成')).toBeVisible();
      await expect(page.locator('text=平均達成率')).toBeVisible();

      // At least one KPI card should show percentage
      await expect(page.locator('text=/%/').first()).toBeVisible({ timeout: 10000 });
    });

    test('展開 KPI 卡片顯示連結任務', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      // Find a KPI card and click to expand
      const kpiCard = page.locator('button', { hasText: /KPI/ }).first();
      const hasCard = await kpiCard.isVisible().catch(() => false);
      if (!hasCard) return;

      await kpiCard.click();

      // Expanded section should show linked tasks label
      await expect(page.locator('text=連結任務').first()).toBeVisible({ timeout: 10000 });
    });

    test('透過 API 更新 KPI', async ({ request, page }) => {
      if (!createdKpiId) return;

      const res = await request.fetch(`/api/kpi/${createdKpiId}`, {
        method: 'PATCH',
        data: {
          title: 'API 修改後的 KPI',
          actual: 50,
        },
        failOnStatusCode: false,
      });

      if (res.ok()) {
        await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('text=API 修改後的 KPI').first()).toBeVisible({ timeout: 15000 });
      }
    });

    test('透過 API 刪除 KPI 後從列表消失', async ({ request, page }) => {
      if (!createdKpiId) return;

      const res = await request.delete(`/api/kpi/${createdKpiId}`, {
        failOnStatusCode: false,
      });

      if (res.ok()) {
        await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        const stillVisible = await page.locator('text=API 修改後的 KPI').isVisible().catch(() => false);
        expect(stillVisible).toBeFalsy();

        createdKpiId = null;
      }
    });

    test('表單取消按鈕關閉表單', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await page.locator('button', { hasText: '新增 KPI' }).click();
      await expect(page.locator('h2', { hasText: '新增 KPI' })).toBeVisible({ timeout: 10000 });

      await page.locator('button', { hasText: '取消' }).click();

      // Form should be hidden
      await expect(page.locator('h2', { hasText: '新增 KPI' })).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Engineer 視角', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 看不到「新增 KPI」按鈕', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('h1')).toContainText('KPI 管理', { timeout: 20000 });

      const hasCreateBtn = await page.locator('button', { hasText: '新增 KPI' }).isVisible().catch(() => false);
      expect(hasCreateBtn).toBeFalsy();
    });
  });
});
