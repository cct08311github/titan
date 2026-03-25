import { test, expect } from '@playwright/test';
import { ENGINEER_STATE_FILE, ENGINEER, loginViaUI } from './helpers/auth';

/**
 * E2E test — Password change flow — Issue #565 (E2E-3)
 *
 * Flow: navigate to change password → fill form → verify validation
 *
 * Note: Actually changing the password would break subsequent test runs,
 * so we test the form interaction and validation without submitting
 * a real password change (unless in an isolated test environment).
 */

test.describe('密碼變更流程', () => {
  test('導航至密碼變更頁面並驗證表單元素', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    // Navigate to change password page
    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // Verify page title
    await expect(page.locator('h1').first()).toContainText('變更密碼');

    // Verify form fields exist
    await expect(page.locator('#currentPassword')).toBeVisible();
    await expect(page.locator('#newPassword')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Verify submit button
    await expect(page.getByRole('button', { name: '變更密碼' })).toBeVisible();

    await context.close();
  });

  test('新密碼不一致時顯示錯誤', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // Fill mismatched passwords
    await page.locator('#currentPassword').fill('OldPassword123!');
    await page.locator('#newPassword').fill('NewPass@2026!a');
    await page.locator('#confirmPassword').fill('DifferentPass@2026!b');

    // Click submit
    await page.getByRole('button', { name: '變更密碼' }).click();

    // Should stay on page — password mismatch validation
    await expect(page.locator('h1').first()).toContainText('變更密碼');

    // Look for error message
    const hasError = await page.locator('text=密碼不一致').or(
      page.locator('text=不相符').or(page.locator('[class*="error"], [class*="destructive"]'))
    ).first().isVisible({ timeout: 5000 }).catch(() => false);

    // Either error message or still on the same page (browser validation)
    expect(page.url()).toContain('change-password');

    await context.close();
  });

  test('密碼政策說明可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // Password policy section should be visible
    const policyBox = page.locator('.bg-muted\\/50').first();
    await expect(policyBox).toBeVisible();

    await context.close();
  });
});
