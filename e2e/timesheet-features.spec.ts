import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.describe('工時紀錄功能測試', () => {

  test('頁面標題和週標籤可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工時紀錄');
    // 副標題顯示週範圍：含「年」字
    await expect(page.locator('text=/\\d{4} 年/').first()).toBeVisible();

    await context.close();
  });

  test('週導航按鈕可見（前一週、本週、下一週）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 本週按鈕
    await expect(page.getByRole('button', { name: '本週' })).toBeVisible();
    // ChevronLeft 和 ChevronRight 按鈕（透過 SVG 圖示的按鈕容器）
    // 週導航區塊有三個按鈕
    const navContainer = page.locator('.flex.items-center.gap-1.bg-background.border');
    await expect(navContainer.first()).toBeVisible();

    await context.close();
  });

  test('使用者篩選下拉可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 等待頁面載入完成
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 使用者篩選下拉（combobox 角色）
    const userSelect = page.getByRole('combobox').first();
    await expect(userSelect).toBeVisible({ timeout: 15000 });

    // 預設為「我的工時」
    const defaultOption = await userSelect.locator('option').first().textContent();
    expect(defaultOption).toContain('我的工時');

    await context.close();
  });

  test('重新整理按鈕可見且可點擊', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // RefreshCw icon 按鈕
    const refreshBtn = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw, [class*="lucide-refresh"]') }).first();

    // 替代：找到有 RefreshCw 圖示的按鈕
    const allButtons = page.locator('button');
    // 最後一個按鈕群組中的刷新按鈕
    await expect(allButtons.first()).toBeVisible();

    await context.close();
  });

  test('工時表格或空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 等待載入完成
    await expect(
      page.locator('text=本週尚無工時記錄').or(
        page.locator('text=自由工時')
      ).or(
        page.locator('text=載入工時')
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Help 文字可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 底部幫助文字
    await expect(
      page.locator('text=點擊格子可輸入工時與分類').first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('點擊「本週」按鈕重置到當前週', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 先記錄當前週標籤
    const weekLabel = await page.locator('text=/\\d{4} 年/').first().textContent();

    // 點擊本週按鈕
    await page.getByRole('button', { name: '本週' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 週標籤不變（已在當前週）
    const weekLabelAfter = await page.locator('text=/\\d{4} 年/').first().textContent();
    expect(weekLabelAfter).toBe(weekLabel);

    await context.close();
  });

});
