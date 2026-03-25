import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E deep tests for /settings page — Issue #608
 *
 * Covers:
 *   - Page load with heading
 *   - Three tabs visible (個人資料, 通知偏好, 安全設定)
 *   - Profile tab: name input, email disabled, role badge, save button
 *   - Notification tab: toggle switches for each type
 *   - Security tab: change password link, account security info
 *   - RBAC: Manager sees 管理員 badge, Engineer sees 工程師
 *   - Console error free
 */

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
        errors.push(text);
      }
    }
  });
  return errors;
}

test.describe('設定頁面 — 深度測試 (/settings)', () => {

  // ── Manager tests ──────────────────────────────────────────────────────

  test.describe('Manager 視角', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('頁面載入無 console error，顯示標題', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      const response = await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      await expect(page.locator('h1')).toContainText('個人設定', { timeout: 20000 });
      await expect(page.locator('text=管理你的個人資料、通知偏好與安全設定')).toBeVisible();

      expect(errors, `Console errors: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('顯示三個分頁標籤', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Three tabs: 個人資料, 通知偏好, 安全設定
      await expect(page.locator('button', { hasText: '個人資料' })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('button', { hasText: '通知偏好' })).toBeVisible();
      await expect(page.locator('button', { hasText: '安全設定' })).toBeVisible();
    });

    test('個人資料分頁：名稱欄位有值', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Profile tab should be active by default
      const nameInput = page.locator('input[type="text"]').first();
      await expect(nameInput).toBeVisible({ timeout: 15000 });

      const value = await nameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    });

    test('個人資料分頁：電子信箱欄位不可編輯', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible({ timeout: 15000 });
      await expect(emailInput).toBeDisabled();

      // Shows helper text
      await expect(page.locator('text=電子信箱由管理員設定，無法自行修改')).toBeVisible();
    });

    test('個人資料分頁：Manager 看到管理員角色標籤', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=管理員')).toBeVisible({ timeout: 15000 });
    });

    test('個人資料分頁：儲存按鈕可見', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('button', { hasText: '儲存變更' })).toBeVisible({ timeout: 15000 });
    });

    test('通知偏好分頁：顯示所有通知類型與切換開關', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Click notifications tab
      await page.locator('button', { hasText: '通知偏好' }).click();
      await page.waitForLoadState('networkidle');

      // Verify description text
      await expect(page.locator('text=選擇要接收的通知類型')).toBeVisible({ timeout: 15000 });

      // All 8 notification types should be visible
      const notifTypes = [
        '任務指派',
        '任務即將到期',
        '任務逾期',
        '任務留言',
        '里程碑到期',
        'B 角啟動',
        '任務變更',
        '工時填報提醒',
      ];

      for (const label of notifTypes) {
        await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 10000 });
      }

      // Verify toggle switches exist (role="switch")
      const switches = page.locator('[role="switch"]');
      const switchCount = await switches.count();
      expect(switchCount).toBeGreaterThanOrEqual(8);
    });

    test('通知偏好分頁：切換開關可操作', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await page.locator('button', { hasText: '通知偏好' }).click();
      await page.waitForLoadState('networkidle');

      // Get first switch and toggle it
      const firstSwitch = page.locator('[role="switch"]').first();
      await expect(firstSwitch).toBeVisible({ timeout: 15000 });

      const initialState = await firstSwitch.getAttribute('aria-checked');
      await firstSwitch.click();

      // State should change
      await page.waitForTimeout(500);
      const newState = await firstSwitch.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);

      // Toggle back to restore original state
      await firstSwitch.click();
    });

    test('安全設定分頁：變更密碼連結存在', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Click security tab
      await page.locator('button', { hasText: '安全設定' }).click();

      // Verify change password section
      await expect(page.locator('h3', { hasText: '變更密碼' })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=密碼需定期更換')).toBeVisible();

      // Link to change password page
      const link = page.locator('a[href="/change-password"]');
      await expect(link).toBeVisible();
      await expect(link).toContainText('前往變更密碼');
    });

    test('安全設定分頁：帳號安全資訊區塊', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await page.locator('button', { hasText: '安全設定' }).click();

      await expect(page.locator('h3', { hasText: '帳號安全' })).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=如有帳號安全疑慮')).toBeVisible();
    });

    test('分頁切換不會產生錯誤', async ({ page }) => {
      const errors = collectConsoleErrors(page);

      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Cycle through all tabs
      await page.locator('button', { hasText: '通知偏好' }).click();
      await page.waitForTimeout(500);

      await page.locator('button', { hasText: '安全設定' }).click();
      await page.waitForTimeout(500);

      await page.locator('button', { hasText: '個人資料' }).click();
      await page.waitForTimeout(500);

      expect(errors).toHaveLength(0);
    });
  });

  // ── Engineer tests ─────────────────────────────────────────────────────

  test.describe('Engineer 視角', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 看到工程師角色標籤', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1')).toContainText('個人設定', { timeout: 20000 });
      await expect(page.locator('text=工程師')).toBeVisible({ timeout: 15000 });
    });

    test('Engineer 同樣可以切換分頁', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      await page.locator('button', { hasText: '通知偏好' }).click();
      await expect(page.locator('text=選擇要接收的通知類型')).toBeVisible({ timeout: 15000 });

      await page.locator('button', { hasText: '安全設定' }).click();
      await expect(page.locator('h3', { hasText: '變更密碼' })).toBeVisible({ timeout: 15000 });
    });
  });
});
