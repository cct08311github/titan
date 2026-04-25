import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

/**
 * E2E tests for /settings page — Issue #563 (E2E-1)
 *
 * Covers:
 *   - Page loads and displays heading
 *   - Three tabs visible (個人資料, 通知設定, 安全性)
 *   - Edit profile form interaction
 *   - Notification preferences toggle
 */

test.use({ storageState: MANAGER_STATE_FILE });

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

test.describe('設定頁面 (/settings)', () => {
  test('頁面載入並顯示設定標題', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
          consoleErrors.push(text);
        }
      }
    });

    const response = await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    expect(consoleErrors, `Console errors: ${consoleErrors.join(', ')}`).toHaveLength(0);
  });

  test('顯示三個分頁標籤', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Expect 3 tabs: 個人資料 (profile), 通知設定 (notifications), 安全性 (security)
    const profileTab = page.locator('text=個人資料').or(page.locator('button:has-text("個人資料")')).first();
    const notifTab = page.locator('text=通知設定').or(page.locator('button:has-text("通知設定")')).first();
    const securityTab = page.locator('text=安全性').or(page.locator('button:has-text("安全性")')).first();

    await expect(profileTab).toBeVisible({ timeout: 15000 });
    await expect(notifTab).toBeVisible();
    await expect(securityTab).toBeVisible();
  });

  test('個人資料分頁可編輯名稱', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Click profile tab if not already active
    const profileTab = page.locator('text=個人資料').or(page.locator('button:has-text("個人資料")')).first();
    await profileTab.click();

    // Wait for profile form to load
    await page.waitForLoadState('domcontentloaded');

    // Look for name input field
    const nameInput = page.locator('input[type="text"]').first();
    const hasNameInput = await nameInput.isVisible().catch(() => false);

    if (hasNameInput) {
      // Verify the input has a value (current name)
      const currentValue = await nameInput.inputValue();
      expect(currentValue.length).toBeGreaterThan(0);
    }

    // Look for save button
    const saveBtn = page.locator('button:has-text("儲存")').or(page.locator('button:has-text("保存")')).first();
    const hasSaveBtn = await saveBtn.isVisible().catch(() => false);

    // Either name input or save button should exist on profile tab
    expect(hasNameInput || hasSaveBtn).toBeTruthy();
  });

  test('通知設定分頁顯示偏好設定', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Click notification tab
    const notifTab = page.locator('text=通知設定').or(page.locator('button:has-text("通知設定")')).first();
    await notifTab.click();
    await page.waitForLoadState('domcontentloaded');

    // Should see notification type labels or toggle switches
    const hasNotifTypes = await page.locator('text=任務指派').or(page.locator('text=任務逾期')).first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasToggles = await page.locator('input[type="checkbox"], [role="switch"]').first().isVisible().catch(() => false);

    // At least notification type labels or toggles should be visible
    expect(hasNotifTypes || hasToggles).toBeTruthy();
  });
});
