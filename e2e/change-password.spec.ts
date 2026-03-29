import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('變更密碼頁面', () => {

  test('頁面渲染：標題、表單欄位、送出按鈕', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // h1 標題
    await expect(page.locator('h1').first()).toContainText('變更密碼');

    // 三個密碼欄位
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // 送出按鈕
    await expect(page.getByRole('button', { name: '變更密碼' })).toBeVisible();

    await context.close();
  });

  test('密碼政策說明區塊可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // 密碼政策說明區塊（bg-muted/50 的 div 包含 policy description）
    const policyBox = page.locator('.bg-muted\\/50').first();
    await expect(policyBox).toBeVisible();

    await context.close();
  });

  test('空白送出不會離開頁面（瀏覽器驗證）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // 點擊送出（欄位有 required，瀏覽器會阻擋）
    await page.getByRole('button', { name: '變更密碼' }).click();

    // 頁面仍在 change-password
    expect(page.url()).toContain('/change-password');

    await context.close();
  });

  test('新密碼與確認密碼不一致顯示錯誤', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'networkidle' });

    // 等待 React 水合完成
    await expect(page.getByRole('button', { name: '變更密碼' })).toBeEnabled();

    // 使用 click + type 模式確保 React controlled input 正確更新
    await page.locator('#currentPassword').click();
    await page.locator('#currentPassword').fill('OldPassword123!x');
    await page.locator('#newPassword').click();
    await page.locator('#newPassword').fill('NewPassword123!abc');
    await page.locator('#confirmPassword').click();
    await page.locator('#confirmPassword').fill('DifferentPassword!xyz');

    await page.getByRole('button', { name: '變更密碼' }).click();

    // 錯誤訊息：新密碼與確認密碼不一致
    await expect(page.locator('text=新密碼與確認密碼不一致')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('新密碼過短觸發瀏覽器 minLength 驗證', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    await page.fill('#currentPassword', 'OldPassword123!');
    await page.fill('#newPassword', 'short');
    await page.fill('#confirmPassword', 'short');

    await page.getByRole('button', { name: '變更密碼' }).click();

    // minLength=12，瀏覽器會阻擋送出，頁面仍在 change-password
    expect(page.url()).toContain('/change-password');

    await context.close();
  });

  test('送出時顯示載入狀態', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'networkidle' });

    // 等待 React 水合完成
    await expect(page.getByRole('button', { name: '變更密碼' })).toBeEnabled();

    await page.locator('#currentPassword').click();
    await page.locator('#currentPassword').fill('1234');
    await page.locator('#newPassword').click();
    await page.locator('#newPassword').fill('ValidNewPass123!abc');
    await page.locator('#confirmPassword').click();
    await page.locator('#confirmPassword').fill('ValidNewPass123!abc');

    // 攔截 API 以延遲回應，讓 loading 狀態可見
    await page.route('/api/auth/change-password', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: '測試用' }) });
    });

    await page.getByRole('button', { name: '變更密碼' }).click();

    // 按鈕顯示「變更中...」
    await expect(page.locator('text=變更中...')).toBeVisible({ timeout: 3000 });

    await context.close();
  });

  test('Manager 和 Engineer 都可存取變更密碼頁', async ({ browser }) => {
    // Manager
    const ctx1 = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page1 = await ctx1.newPage();
    await page1.goto('/change-password', { waitUntil: 'domcontentloaded' });
    await expect(page1.locator('h1').first()).toContainText('變更密碼');
    await ctx1.close();

    // Engineer
    const ctx2 = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page2 = await ctx2.newPage();
    await page2.goto('/change-password', { waitUntil: 'domcontentloaded' });
    await expect(page2.locator('h1').first()).toContainText('變更密碼');
    await ctx2.close();
  });

});
