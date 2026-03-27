import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * v2 Unified Workspace — Issue #1013
 *
 * Tests /work page: kanban/gantt/list view switcher,
 * shared filters, task creation.
 */
test.describe('統一工作空間 /work — v2', () => {

  test('頁面標題「工作空間」和 view switcher 可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工作空間', { timeout: 15000 });

    // View switcher buttons: 看板、甘特、列表
    await expect(page.locator('text=看板').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=甘特').first()).toBeVisible();
    await expect(page.locator('text=列表').first()).toBeVisible();

    await context.close();
  });

  test('預設顯示看板視圖（Kanban columns）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 看板欄位或空狀態
    const hasColumns = await page.locator('text=待辦清單').or(page.locator('text=尚無任務')).first().isVisible().catch(() => false);
    expect(hasColumns).toBeTruthy();

    await context.close();
  });

  test('切換至甘特圖視圖', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊「甘特」按鈕
    await page.locator('button').filter({ hasText: '甘特' }).first().click();
    await page.waitForTimeout(1000);

    // 甘特圖容器出現（月份標題 or 無日期提示）
    const ganttContent = page.locator('text=1月').or(page.locator('text=所有任務都沒有設定日期'));
    await expect(ganttContent.first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('切換至列表視圖', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊「列表」按鈕
    await page.locator('button').filter({ hasText: '列表' }).first().click();
    await page.waitForTimeout(1000);

    // 列表視圖應包含表格結構或空狀態
    const listContent = page.locator('table').or(page.locator('[role="table"]')).or(page.locator('text=尚無任務'));
    await expect(listContent.first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('「新增任務」按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=新增任務').first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Engineer 也可以存取工作空間', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/work', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工作空間', { timeout: 15000 });

    await context.close();
  });
});
