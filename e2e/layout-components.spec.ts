import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('Layout 元件測試', () => {

  // ── Sidebar ───────────────────────────────────────────────────────────

  test('Sidebar：8 個導航連結可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Sidebar 有 8 個導航項目
    const navLabels = ['儀表板', '看板', '甘特圖', '年度計畫', 'KPI', '知識庫', '工時紀錄', '報表'];
    for (const label of navLabels) {
      await expect(
        page.getByRole('link', { name: label }).first()
      ).toBeVisible({ timeout: 5000 });
    }

    await context.close();
  });

  test('Sidebar：TITAN logo 可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // TITAN 文字
    await expect(
      page.locator('text=TITAN').first()
    ).toBeVisible();

    await context.close();
  });

  test('Sidebar：點擊導航連結跳轉', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 點擊「看板」連結
    await page.getByRole('link', { name: '看板' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證跳轉到看板頁面
    expect(page.url()).toContain('/kanban');
    await expect(page.locator('h1').first()).toContainText('看板');

    await context.close();
  });

  test('Sidebar：當前頁面 active 狀態', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 「儀表板」連結應有 aria-current="page"
    const dashboardLink = page.getByRole('link', { name: '儀表板' }).first();
    await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

    await context.close();
  });

  // ── Topbar ────────────────────────────────────────────────────────────

  test('Topbar：使用者名稱和角色標籤可見（Manager）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Topbar header 區域
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // 使用者角色：「主管」
    await expect(
      page.locator('text=主管').first()
    ).toBeVisible();

    await context.close();
  });

  test('Topbar：Engineer 顯示「工程師」角色', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('text=工程師').first()
    ).toBeVisible();

    await context.close();
  });

  test('Topbar：登出按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 登出按鈕有 aria-label="登出"
    await expect(
      page.locator('button[aria-label="登出"]')
    ).toBeVisible();

    await context.close();
  });

  // ── NotificationBell ──────────────────────────────────────────────────

  test('NotificationBell：鈴鐺圖示可見且可點擊展開下拉', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 鈴鐺按鈕有 aria-label="通知"
    const bellBtn = page.locator('button[aria-label="通知"]');
    await expect(bellBtn).toBeVisible();

    // 點擊展開下拉
    await bellBtn.click();

    // 下拉面板出現：包含「目前沒有通知」空狀態或「載入中」或通知項目
    await expect(
      page.locator('text=目前沒有通知').or(page.locator('text=載入中')).or(page.locator('text=未讀')).first()
    ).toBeVisible({ timeout: 5000 });

    await context.close();
  });

});
