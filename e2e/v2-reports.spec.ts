import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

/**
 * v2 Reports — Issue #1013
 *
 * Tests /reports page: left-nav categories, report switching,
 * date range picker, CSV export button.
 */
test.describe('報表 v2 /reports', () => {

  test('左側導覽列（reports-left-nav）可見，含分類', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 標題
    await expect(page.locator('h1').first()).toContainText('報表', { timeout: 15000 });

    // 左側導覽列 data-testid
    const leftNav = page.locator('[data-testid="reports-left-nav"]');
    await expect(leftNav).toBeVisible({ timeout: 10000 });

    // 分類標籤
    await expect(leftNav.locator('text=組織績效')).toBeVisible();
    await expect(leftNav.locator('text=項目管理')).toBeVisible();
    await expect(leftNav.locator('text=KPI')).toBeVisible();

    await context.close();
  });

  test('預設顯示「團隊利用率」報表', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 利用率報表標題或載入中
    const utilContent = page.locator('text=團隊利用率 Heatmap')
      .or(page.locator('text=載入團隊利用率'))
      .or(page.locator('text=此期間無工時資料'));
    await expect(utilContent.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('切換至「任務速率」報表', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊左側導覽中的「任務速率」
    await page.locator('[data-testid="reports-left-nav"]').locator('text=任務速率').click();
    await page.waitForTimeout(2000);

    // 任務速率報表標題
    const velocityContent = page.locator('text=任務速率趨勢')
      .or(page.locator('text=載入任務速率'))
      .or(page.locator('text=此期間無完成任務'));
    await expect(velocityContent.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('切換至「KPI 達成率趨勢」報表', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊「KPI 達成率趨勢」
    await page.locator('[data-testid="reports-left-nav"]').locator('text=KPI 達成率趨勢').click();
    await page.waitForTimeout(2000);

    const kpiContent = page.locator('h2:has-text("KPI 達成率趨勢")')
      .or(page.locator('text=載入 KPI 趨勢'))
      .or(page.locator('text=此期間無 KPI 資料'));
    await expect(kpiContent.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('日期範圍選擇器可見且可操作', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // 開始日期與結束日期 input
    const startDate = page.locator('input[aria-label="開始日期"]');
    const endDate = page.locator('input[aria-label="結束日期"]');

    await expect(startDate).toBeVisible({ timeout: 10000 });
    await expect(endDate).toBeVisible();

    // 日期值不為空
    const startVal = await startDate.inputValue();
    const endVal = await endDate.inputValue();
    expect(startVal).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(endVal).toMatch(/\d{4}-\d{2}-\d{2}/);

    await context.close();
  });

  test('CSV 匯出按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // CSV 按鈕
    const csvBtn = page.locator('button:has-text("CSV")');
    await expect(csvBtn.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });
});
