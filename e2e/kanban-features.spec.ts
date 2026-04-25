import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('看板功能測試', () => {

  test('頁面標題和「新增任務」按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('看板');
    await expect(page.locator('text=新增任務').first()).toBeVisible();

    await context.close();
  });

  test('5 個欄位標題可見（或顯示「尚無任務」空狀態）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 等待看板內容或空狀態出現
    await expect(
      page.locator('text=待辦清單').or(page.locator('text=尚無任務')).or(page.locator('text=載入看板')).first()
    ).toBeVisible({ timeout: 15000 });

    // 若有任務，5 欄標題可見；若無任務，顯示空狀態
    const hasColumns = await page.locator('text=待辦清單').first().isVisible().catch(() => false);

    if (hasColumns) {
      await expect(page.locator('text=待辦清單').first()).toBeVisible();
      await expect(page.locator('text=待處理').first()).toBeVisible();
      await expect(page.locator('text=進行中').first()).toBeVisible();
      await expect(page.locator('text=審核中').first()).toBeVisible();
      await expect(page.locator('text=已完成').first()).toBeVisible();
    } else {
      // 空狀態也是合法的
      const bodyLen = (await page.locator('body').textContent())?.length ?? 0;
      expect(bodyLen).toBeGreaterThan(50);
    }

    await context.close();
  });

  test('篩選區塊可見（負責人、優先度、分類）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 等待看板載入完成（filters 只在非 loading 狀態渲染）
    await expect(page.locator('h1').first()).toContainText('看板');
    await expect(page.locator('text=/共 \\d+ 項任務/').or(page.locator('text=尚無任務')).or(page.locator('text=載入看板')).first()).toBeVisible({ timeout: 15000 });

    // TaskFilters 使用原生 select（combobox 角色）
    const comboboxes = page.getByRole('combobox');
    await expect(comboboxes.first()).toBeVisible({ timeout: 15000 });

    // 驗證三個 combobox 存在（負責人、優先度、分類）
    const count = await comboboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await context.close();
  });

  test('篩選下拉可以展開（負責人）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 等待載入完成
    await expect(page.locator('text=/共 \\d+ 項任務/').or(page.locator('text=尚無任務')).first()).toBeVisible({ timeout: 15000 });

    // 第一個 combobox 是負責人篩選
    const assigneeSelect = page.getByRole('combobox').first();
    await expect(assigneeSelect).toBeVisible({ timeout: 15000 });

    // 驗證 select 有預設選項「所有成員」
    const defaultOption = await assigneeSelect.locator('option').first().textContent();
    expect(defaultOption).toContain('所有成員');

    await context.close();
  });

  test('篩選下拉可以展開（優先度）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 等待載入完成
    await expect(page.locator('text=/共 \\d+ 項任務/').or(page.locator('text=尚無任務')).first()).toBeVisible({ timeout: 15000 });

    // 第二個 combobox 是優先度篩選
    const prioritySelect = page.getByRole('combobox').nth(1);
    await expect(prioritySelect).toBeVisible({ timeout: 15000 });

    // 驗證包含 P0 緊急選項
    const options = await prioritySelect.locator('option').allTextContents();
    expect(options.some((o) => o.includes('所有優先度'))).toBeTruthy();
    expect(options.some((o) => o.includes('P0'))).toBeTruthy();

    await context.close();
  });

  test('篩選下拉可以展開（分類）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 等待載入完成
    await expect(page.locator('text=/共 \\d+ 項任務/').or(page.locator('text=尚無任務')).first()).toBeVisible({ timeout: 15000 });

    // 第三個 combobox 是分類篩選
    const categorySelect = page.getByRole('combobox').nth(2);
    await expect(categorySelect).toBeVisible({ timeout: 15000 });

    const options = await categorySelect.locator('option').allTextContents();
    expect(options.some((o) => o.includes('所有分類'))).toBeTruthy();
    expect(options.some((o) => o.includes('原始規劃'))).toBeTruthy();

    await context.close();
  });

  test('任務計數顯示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 副標題顯示任務總數：「共 N 項任務」
    await expect(
      page.locator('text=/共 \\d+ 項任務/').first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Engineer 也可存取看板', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('看板');

    await context.close();
  });

});
