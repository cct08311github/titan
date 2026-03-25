import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.describe('報表功能測試', () => {

  test('頁面標題和副標題可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('報表');
    await expect(page.locator('text=週報、月報、KPI、計畫外負荷分析').first()).toBeVisible();

    await context.close();
  });

  test('4 個 Tab 按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: '週報' })).toBeVisible();
    await expect(page.getByRole('button', { name: '月報' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'KPI 報表' })).toBeVisible();
    await expect(page.getByRole('button', { name: '計畫外負荷' })).toBeVisible();

    await context.close();
  });

  test('預設顯示週報 tab 內容', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 週報 tab 預設載入，顯示匯出按鈕或載入中
    await expect(
      page.locator('text=匯出').or(page.locator('text=載入週報')).or(page.locator('text=本週摘要')).or(page.locator('text=無週報資料')).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('切換到月報 tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 先等待週報 tab 載入完成
    await expect(page.locator('text=無週報資料').or(page.locator('text=本週摘要')).or(page.locator('text=匯出')).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '月報' }).click();

    // 月報 tab 有月份選擇 input[type=month] 或載入/空狀態
    await expect(
      page.locator('input[type="month"]').or(page.locator('text=載入月報')).or(page.locator('text=無月報資料')).or(page.locator('text=月摘要')).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('切換到 KPI 報表 tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 先等待頁面穩定
    await expect(page.locator('text=無週報資料').or(page.locator('text=本週摘要')).or(page.locator('text=匯出')).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'KPI 報表' }).click();

    // KPI 報表有年份 input[type=number] 或載入/空狀態
    await expect(
      page.locator('input[type="number"]').or(page.locator('text=載入 KPI')).or(page.locator('text=無 KPI')).or(page.locator('text=KPI 總數')).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('切換到計畫外負荷 tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 先等待頁面穩定
    await expect(page.locator('text=無週報資料').or(page.locator('text=本週摘要')).or(page.locator('text=匯出')).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '計畫外負荷' }).click();

    // 計畫外負荷 tab 有日期選擇 input[type=date] 或載入/空狀態
    await expect(
      page.locator('input[type="date"]').or(page.locator('text=負荷分析')).or(page.locator('text=計畫 vs 計畫外')).or(page.locator('text=載入負荷')).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('各 tab 匯出按鈕（若有資料）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 週報 tab 等待載入完成
    await page.waitForTimeout(3000);

    // 若有資料，匯出按鈕可見
    const exportBtn = page.locator('text=匯出').first();
    const noData = page.locator('text=無週報資料').first();
    const loading = page.locator('text=載入週報').first();

    // 至少有一個狀態
    const hasExport = await exportBtn.isVisible().catch(() => false);
    const hasNoData = await noData.isVisible().catch(() => false);
    const isLoading = await loading.isVisible().catch(() => false);

    expect(hasExport || hasNoData || isLoading).toBeTruthy();

    await context.close();
  });

});
