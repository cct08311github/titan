import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('Journey 測試', () => {
  test('工程師日常：登入 → Dashboard → 看到工程師視角', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('儀表板');

    // Engineer dashboard shows "工程師視角" subtitle
    const subtitle = page.locator('p', { hasText: '工程師視角' });
    await expect(subtitle).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('管理者巡查：登入 Manager → Dashboard 有主管視角', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('儀表板');

    // Manager dashboard shows "主管視角" subtitle
    const subtitle = page.locator('p', { hasText: '主管視角' });
    await expect(subtitle).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('跨頁導航：Dashboard → Kanban → Timesheet → 回 Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    // Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // Navigate to Kanban
    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1').first()).toContainText('看板');

    // Navigate to Timesheet
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // Back to Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    await context.close();
  });
});
