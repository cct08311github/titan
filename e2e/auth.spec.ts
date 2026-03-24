import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

/**
 * Auth tests verify login/logout flows using the real NextAuth UI.
 *
 * Note: The app enforces a rate limit of 5 attempts/60s per IP+username.
 * globalSetup consumes 2 attempts (manager + engineer login).
 * These tests use storageState where possible and only test auth-specific behaviors
 * that require a fresh context or explicit login.
 */

test.describe('認證流程', () => {
  test('已登入 Session → 可直接訪問 Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('儀表板');

    await context.close();
  });

  test('錯誤帳密 → 留在 login 頁並顯示錯誤', async ({ browser }) => {
    // Use fresh context (no stored session)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');

    // Wait for React to hydrate and input to be interactive
    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 });

    // Use a non-existent email to avoid triggering rate limit on real accounts
    await page.locator('#username').fill('nonexistent-test-user@titan.local');
    await page.locator('#password').fill('wrongpassword123');

    // Verify fields are filled before submitting
    await expect(page.locator('#username')).toHaveValue('nonexistent-test-user@titan.local');

    // Submit and wait for API response
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/auth/'), { timeout: 10000 }),
      page.locator('button[type="submit"]').click(),
    ]);

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Error message should appear
    const errorMsg = page.locator('p', { hasText: '帳號或密碼錯誤' });
    await expect(errorMsg).toBeVisible({ timeout: 8000 });

    await context.close();
  });

  test('無 Session → 訪問 /dashboard 被拒絕（401 或重導向 /login）', async ({ browser }) => {
    // Fresh context with NO session cookies
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto('/dashboard');
    const url = page.url();
    const status = response?.status() ?? 0;

    const isBlocked = status === 401 || url.includes('/login');
    expect(
      isBlocked,
      `Expected 401 or /login redirect for unauthenticated request, got status=${status} url=${url}`
    ).toBe(true);

    await context.close();
  });
});
