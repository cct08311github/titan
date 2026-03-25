import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('KPI 功能測試', () => {

  test('頁面標題可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('KPI');
    await expect(page.locator('text=KPI 管理').first()).toBeVisible();

    await context.close();
  });

  test('Manager 看到「新增 KPI」按鈕', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('button', { name: '新增 KPI' })
    ).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('Engineer 看不到「新增 KPI」按鈕', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    // 等待頁面載入完成
    await expect(page.locator('h1').first()).toContainText('KPI');
    await page.waitForTimeout(2000);

    // Engineer 不應看到新增按鈕
    await expect(
      page.getByRole('button', { name: '新增 KPI' })
    ).not.toBeVisible();

    await context.close();
  });

  test('KPI 摘要卡片或空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    // 等載入完成：摘要卡片（KPI 總數/已達成/平均達成率）或空狀態
    await expect(
      page.locator('text=KPI 總數').or(
        page.locator('text=尚無 KPI')
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Manager 點擊「新增 KPI」展開表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: '新增 KPI' }).click();

    // 表單標題 h2「新增 KPI」
    await expect(page.locator('h2', { hasText: '新增 KPI' })).toBeVisible();
    // 表單欄位
    await expect(page.locator('input[placeholder="如 KPI-01"]')).toBeVisible();
    await expect(page.locator('input[placeholder="KPI 名稱"]')).toBeVisible();

    await context.close();
  });

  test('年度副標題顯示當前年份', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    const currentYear = new Date().getFullYear();
    await expect(
      page.locator(`text=${currentYear} 年度關鍵績效指標`).first()
    ).toBeVisible();

    await context.close();
  });

});
