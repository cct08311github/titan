import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * v2 Cockpit 管理駕駛艙 — Issue #1013
 *
 * Tests /cockpit page: health cards, BSC quadrants, drill-down, RBAC.
 */
test.describe('管理駕駛艙 /cockpit — v2', () => {

  test('Manager 可存取駕駛艙，標題與年份導覽可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });

    // 頁面標題
    await expect(page.locator('[data-testid="cockpit-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1').first()).toContainText('管理駕駛艙');

    // 年份導覽按鈕
    await expect(page.locator('button[aria-label="前一年"]')).toBeVisible();
    await expect(page.locator('button[aria-label="後一年"]')).toBeVisible();

    // 年份數字
    const yearText = await page.locator('[data-testid="cockpit-page"]').locator('text=/\\d{4}/').first().textContent();
    expect(Number(yearText)).toBeGreaterThanOrEqual(2024);

    await context.close();
  });

  test('Engineer 無權限存取駕駛艙，顯示權限不足', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });

    // 應顯示權限不足訊息
    await expect(page.locator('text=權限不足').first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('駕駛艙顯示快速導航連結（報表、My Day）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="cockpit-page"]')).toBeVisible({ timeout: 15000 });

    // 報表連結
    await expect(page.locator('a[href="/reports"]').first()).toBeVisible();
    // My Day 連結
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();

    await context.close();
  });

  test('BSC 四象限區塊結構正確（若有計畫資料）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="cockpit-page"]')).toBeVisible({ timeout: 15000 });

    // 等待內容載入
    await page.waitForTimeout(2000);

    // 判斷是否有計畫（若無計畫顯示「尚無...年度計畫」）
    const emptyState = page.locator('text=/尚無.*年度計畫/');
    const bscGrid = page.locator('[data-testid="bsc-quadrant-grid"]');

    const hasPlans = await bscGrid.count() > 0;
    if (hasPlans) {
      // 四象限 data-testid 存在
      await expect(page.locator('[data-testid="bsc-q1-delivery"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="bsc-q2-quality"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="bsc-q3-efficiency"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="bsc-q4-growth"]').first()).toBeVisible();
    } else {
      // 無計畫時應顯示空狀態
      await expect(emptyState.first()).toBeVisible();
    }

    await context.close();
  });

  test('年份切換可正常運作', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/cockpit', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="cockpit-page"]')).toBeVisible({ timeout: 15000 });

    // 取得目前年份
    const currentYear = new Date().getFullYear();

    // 點前一年
    await page.locator('button[aria-label="前一年"]').click();
    await page.waitForTimeout(1000);

    // 驗證年份已更新
    await expect(page.locator(`text="${currentYear - 1}"`).first()).toBeVisible({ timeout: 5000 });

    // 點後一年兩次回到下一年
    await page.locator('button[aria-label="後一年"]').click();
    await page.waitForTimeout(500);
    await page.locator('button[aria-label="後一年"]').click();
    await page.waitForTimeout(1000);

    await expect(page.locator(`text="${currentYear + 1}"`).first()).toBeVisible({ timeout: 5000 });

    await context.close();
  });
});
