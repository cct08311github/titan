import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.describe('年度計畫功能測試', () => {

  test('頁面標題與操作按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('年度計畫');
    await expect(page.locator('text=管理年度計畫與月度目標').first()).toBeVisible();

    // 三個操作按鈕
    await expect(page.locator('text=新增月度目標').first()).toBeVisible();
    await expect(page.locator('text=從上年複製').first()).toBeVisible();
    await expect(page.locator('text=新增年度計畫').first()).toBeVisible();

    await context.close();
  });

  test('點擊「新增年度計畫」展開表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'networkidle' });

    // 等待頁面完全載入（含 React 水合）
    await expect(page.locator('h1').first()).toContainText('年度計畫');
    await expect(page.locator('text=尚無年度計畫').or(page.locator('text=管理年度計畫與月度目標')).first()).toBeVisible({ timeout: 15000 });

    // 點擊按鈕
    await page.getByRole('button', { name: '新增年度計畫' }).click();

    // 表單出現：含計畫標題 input
    await expect(page.locator('input[placeholder="計畫標題"]')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('點擊「新增月度目標」展開表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toContainText('年度計畫');
    await expect(page.locator('text=尚無年度計畫').or(page.locator('text=管理年度計畫與月度目標')).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '新增月度目標' }).click();

    // 表單出現：含目標標題 input
    await expect(page.locator('input[placeholder="目標標題"]')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('點擊「從上年複製」展開複製表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'networkidle' });

    await expect(page.locator('h1').first()).toContainText('年度計畫');
    await expect(page.locator('text=尚無年度計畫').or(page.locator('text=管理年度計畫與月度目標')).first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '從上年複製' }).click();

    // 複製表單出現
    await expect(page.getByRole('heading', { name: '從上年複製計畫' })).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('PlanTree 或空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });

    // 等待載入：PlanTree 渲染 or 空狀態
    await expect(
      page.locator('text=尚無年度計畫').or(
        page.locator('[class*="rounded-xl"]').first()
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Breadcrumb 導航列可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });

    // Breadcrumb 初始狀態顯示「年度計畫」
    await expect(page.locator('nav').locator('text=年度計畫').first()).toBeVisible();

    await context.close();
  });

});
