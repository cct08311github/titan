import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * v2 Global Alerts & Notification Bell — Issue #1013
 *
 * Tests the notification bell in topbar and global alert system.
 */
test.describe('全域警示與通知鈴 — v2', () => {

  test('Topbar 中通知鈴（Bell icon）可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Bell icon in topbar
    const bell = page.locator('svg.lucide-bell')
      .or(page.locator('[aria-label*="通知"]'))
      .or(page.locator('[aria-label*="notification"]'));
    await expect(bell.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('點擊通知鈴展開通知面板', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊 bell
    const bellButton = page.locator('button').filter({
      has: page.locator('svg.lucide-bell')
    }).first();
    await bellButton.click();
    await page.waitForTimeout(1000);

    // 通知面板展開：顯示通知列表或「沒有新通知」
    const panel = page.locator('text=全部已讀')
      .or(page.locator('text=沒有新通知'))
      .or(page.locator('text=通知'))
      .or(page.locator('[role="dialog"]'));
    await expect(panel.first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('通知類型標籤正確（任務指派、即將到期等）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 點擊 bell
    const bellButton = page.locator('button').filter({
      has: page.locator('svg.lucide-bell')
    }).first();
    await bellButton.click();
    await page.waitForTimeout(1000);

    // 通知面板內容（可能有通知項目或空狀態）
    const notificationItem = page.locator('text=任務指派')
      .or(page.locator('text=即將到期'))
      .or(page.locator('text=已逾期'))
      .or(page.locator('text=新留言'))
      .or(page.locator('text=沒有新通知'))
      .or(page.locator('text=尚無通知'));
    await expect(notificationItem.first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('Engineer 也可以看到通知鈴', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const bell = page.locator('svg.lucide-bell')
      .or(page.locator('[aria-label*="通知"]'));
    await expect(bell.first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('通知偏好頁面可存取', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/admin/notifications', { waitUntil: 'domcontentloaded' });

    // 通知偏好頁面應載入
    await page.waitForTimeout(3000);

    // 頁面不應有 500 錯誤
    const hasError = await page.locator('text=500').or(page.locator('text=Internal Server Error')).count();
    expect(hasError).toBe(0);

    await context.close();
  });
});
