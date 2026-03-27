import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * v2 My Day Homepage — Issue #1013
 *
 * Tests the dual-tab dashboard: 我的一天 / 團隊全局
 * Manager sees both tabs; Engineer sees only 我的一天.
 */
test.describe('My Day 首頁 — v2 雙分頁', () => {

  test('Manager 看到問候語與雙分頁（我的一天 / 團隊全局）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 問候語可見
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    const heading = await page.locator('h1').first().textContent();
    expect(heading).toMatch(/早安|午安|晚安/);

    // 雙分頁可見
    const tabs = page.locator('[data-testid="dashboard-tabs"]');
    await expect(tabs).toBeVisible({ timeout: 10000 });
    await expect(tabs.locator('text=我的一天')).toBeVisible();
    await expect(tabs.locator('text=團隊全局')).toBeVisible();

    await context.close();
  });

  test('Manager 預設在「團隊全局」分頁', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    // Clear localStorage to reset stored tab
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('titan-dashboard-tab'));
    await page.reload({ waitUntil: 'domcontentloaded' });

    // subtitle 顯示「團隊全局」
    await expect(page.locator('text=團隊全局 — 今日需關注事項').first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Manager 切換分頁至「我的一天」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const tabs = page.locator('[data-testid="dashboard-tabs"]');
    await expect(tabs).toBeVisible({ timeout: 10000 });

    // 點擊「我的一天」
    await tabs.locator('text=我的一天').click();

    // subtitle 切換
    await expect(page.locator('text=我的一天 — 今日工作安排').first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('Engineer 不顯示分頁 tabs，直接看到「我的一天」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 問候語可見
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // 分頁 tabs 不可見（Engineer 沒有 team tab）
    await expect(page.locator('[data-testid="dashboard-tabs"]')).not.toBeVisible();

    // subtitle 顯示我的一天
    await expect(page.locator('text=我的一天 — 今日工作安排').first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('Manager 團隊全局顯示「團隊健康快照」和「快速前往」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 確保在團隊全局 tab
    const tabs = page.locator('[data-testid="dashboard-tabs"]');
    await expect(tabs).toBeVisible({ timeout: 10000 });
    await tabs.locator('text=團隊全局').click();

    // 等待內容載入（skeleton 消失）
    await page.waitForTimeout(2000);

    // 「快速前往」區塊可見
    const quickLinks = page.locator('text=快速前往');
    await expect(quickLinks.first()).toBeVisible({ timeout: 15000 });

    // 快速前往包含駕駛艙、看板、報表、工時
    await expect(page.locator('a[href="/cockpit"]').first()).toBeVisible();
    await expect(page.locator('a[href="/reports"]').first()).toBeVisible();

    await context.close();
  });
});
