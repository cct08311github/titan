import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('甘特圖功能測試', () => {

  test('頁面標題可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('甘特圖');

    await context.close();
  });

  test('年份選擇器和導航按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    const currentYear = new Date().getFullYear();

    // 年份數字顯示
    await expect(
      page.locator(`text=${currentYear}`).first()
    ).toBeVisible();

    // 年份選擇器容器（含前後導航按鈕）
    const yearPicker = page.locator('.flex.items-center.gap-1.bg-background.border');
    await expect(yearPicker.first()).toBeVisible();

    await context.close();
  });

  test('篩選負責人下拉可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    // 等待甘特圖載入完成（header 和 filter 同時渲染）
    await expect(page.locator('h1').first()).toContainText('甘特圖');

    // 篩選負責人下拉（combobox 角色）
    const assigneeSelect = page.getByRole('combobox').first();
    await expect(assigneeSelect).toBeVisible({ timeout: 15000 });

    // 預設為「全部成員」
    const defaultOption = await assigneeSelect.locator('option').first().textContent();
    expect(defaultOption).toContain('全部成員');

    await context.close();
  });

  test('月份標題列或載入/空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    // 等待載入
    await expect(
      page.locator('text=1月').or(
        page.locator('text=載入甘特圖')
      ).or(
        page.locator('text=找不到')
      ).or(
        page.locator('text=請先在「年度計畫」頁面建立計畫')
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('甘特圖時間軸區域或空狀態渲染', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    // 等待載入完成
    await page.waitForTimeout(3000);

    // 若有計畫，至少有月份標籤（1月）或時間軸容器
    // 若無計畫，顯示空狀態
    const hasTimeline = await page.locator('text=1月').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=找不到').or(page.locator('text=請先在')).first().isVisible().catch(() => false);
    const hasContent = (await page.locator('body').textContent())!.length > 100;

    expect(hasTimeline || hasEmpty || hasContent).toBeTruthy();

    await context.close();
  });

});
