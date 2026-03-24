import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('權限控制', () => {
  test('Manager 看到主管視角 Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const subtitle = page.locator('p', { hasText: '主管視角' });
    await expect(subtitle).toBeVisible();

    await context.close();
  });

  test('Engineer 看到工程師視角 Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const subtitle = page.locator('p', { hasText: '工程師視角' });
    await expect(subtitle).toBeVisible();

    await context.close();
  });

  test('未登入訪問 /dashboard → 被拒絕或重定向（非 200）', async ({ browser }) => {
    // Fresh context with NO stored session
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto('/dashboard');

    const url = page.url();
    const status = response?.status() ?? 0;

    // Either a 401 status OR a redirect to /login
    const isBlocked = status === 401 || url.includes('/login');
    expect(
      isBlocked,
      `Expected 401 or redirect to /login, got status=${status} url=${url}`
    ).toBe(true);

    await context.close();
  });
});
