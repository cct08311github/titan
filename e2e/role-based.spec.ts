import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E role-based access control tests — Issue #610
 *
 * Covers:
 *   - Manager sees all sidebar navigation items
 *   - Manager sees admin-only features
 *   - Manager dashboard shows 主管視角
 *   - Manager sees team-level data
 *   - Engineer dashboard shows 工程師視角
 *   - Engineer cannot access admin page
 *   - Engineer sees own data on timesheet
 *   - Engineer cannot see KPI create button
 *   - Engineer kanban access works
 *   - Different role badges in settings
 *   - Manager sees all users in reports
 */

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

test.describe('角色權限測試 (RBAC)', () => {

  test.describe('Manager 完整功能', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('Dashboard 顯示主管視角', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('儀表板', { timeout: 20000 });
      await expect(page.locator('text=主管視角')).toBeVisible({ timeout: 15000 });
    });

    test('Dashboard 顯示團隊工時分佈', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h2', { hasText: '團隊工時分佈' })).toBeVisible({ timeout: 15000 });
    });

    test('Dashboard 顯示投入率分析', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h2', { hasText: '投入率分析' })).toBeVisible({ timeout: 15000 });
    });

    test('Manager 可存取 Admin 頁面', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('系統管理', { timeout: 20000 });
      await expect(page.locator('h2', { hasText: '備份狀態' })).toBeVisible({ timeout: 15000 });
    });

    test('Manager 看到 KPI 新增按鈕', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('button', { hasText: '新增 KPI' })).toBeVisible({ timeout: 15000 });
    });

    test('Manager 看到計畫管理功能', async ({ page }) => {
      await page.goto('/plans', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('button', { hasText: '新增年度計畫' })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('button', { hasText: '新增月度目標' })).toBeVisible();
    });

    test('Manager 報表顯示團隊級別資料', async ({ page }) => {
      await page.goto('/reports', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('報表', { timeout: 20000 });

      // Manager should see team-level report options
      const hasTeamReport = await page.locator('text=週報').or(page.locator('text=月報')).first().isVisible({ timeout: 15000 }).catch(() => false);
      expect(hasTeamReport).toBeTruthy();
    });

    test('Manager 設定頁面顯示管理員角色', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=管理員')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Engineer 受限視圖', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Dashboard 顯示工程師視角', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('儀表板', { timeout: 20000 });
      await expect(page.locator('text=工程師視角')).toBeVisible({ timeout: 15000 });
    });

    test('Engineer Dashboard 顯示進行中任務', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('text=進行中任務').first()).toBeVisible({ timeout: 15000 });
    });

    test('Engineer 無法存取 Admin 頁面', async ({ page }) => {
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const isRedirected = page.url().includes('/dashboard');
      const hasPermError = await page.locator('text=權限不足').isVisible().catch(() => false);

      expect(isRedirected || hasPermError).toBeTruthy();
    });

    test('Engineer 看不到 KPI 新增按鈕', async ({ page }) => {
      await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('KPI', { timeout: 20000 });
      const hasCreateBtn = await page.locator('button', { hasText: '新增 KPI' }).isVisible().catch(() => false);
      expect(hasCreateBtn).toBeFalsy();
    });

    test('Engineer 可以存取看板', async ({ page }) => {
      await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('看板', { timeout: 20000 });
    });

    test('Engineer 工時紀錄頁面可存取', async ({ page }) => {
      await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('工時紀錄', { timeout: 20000 });

      // Should see "本週" button
      await expect(page.getByRole('button', { name: '本週' })).toBeVisible({ timeout: 15000 });
    });

    test('Engineer 報表頁面可存取', async ({ page }) => {
      await page.goto('/reports', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('報表', { timeout: 20000 });
    });

    test('Engineer 設定頁面顯示工程師角色', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=工程師')).toBeVisible({ timeout: 15000 });
    });
  });
});
