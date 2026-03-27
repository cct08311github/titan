import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * v2 Timesheet Calendar Views — Issue #1013
 *
 * Tests the weekly and monthly timesheet views.
 */
test.describe('工時日曆視圖 — v2', () => {

  test('週視圖：標題、週範圍標籤、導覽按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工時紀錄', { timeout: 15000 });

    // 週範圍標籤格式：YYYY/MM/DD — YYYY/MM/DD
    await expect(
      page.locator('text=/\\d{4}\\/\\d{2}\\/\\d{2} — \\d{4}\\/\\d{2}\\/\\d{2}/').first()
    ).toBeVisible({ timeout: 15000 });

    // 本週按鈕
    await expect(page.getByRole('button', { name: '本週' })).toBeVisible();

    await context.close();
  });

  test('週導覽：點擊「前一週」切換週範圍', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('工時紀錄', { timeout: 15000 });

    // 記錄目前週範圍
    const weekLabel = page.locator('text=/\\d{4}\\/\\d{2}\\/\\d{2} — \\d{4}\\/\\d{2}\\/\\d{2}/').first();
    await expect(weekLabel).toBeVisible({ timeout: 15000 });
    const originalWeek = await weekLabel.textContent();

    // 點前一週按鈕（ChevronLeft）
    const prevBtn = page.locator('button[aria-label="前一週"]').or(
      page.locator('button').filter({ has: page.locator('svg.lucide-chevron-left') }).first()
    );
    await prevBtn.first().click();
    await page.waitForTimeout(2000);

    // 週範圍應改變
    const newWeek = await weekLabel.textContent();
    expect(newWeek).not.toBe(originalWeek);

    await context.close();
  });

  test('月報視圖：Manager 可導覽至 /timesheet/monthly', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet/monthly', { waitUntil: 'domcontentloaded' });

    // 月報審核標題
    await expect(page.locator('h1').first()).toContainText('月報審核', { timeout: 15000 });

    // 月份導覽（上個月、本月、下個月）
    await expect(page.locator('button[aria-label="上個月"]')).toBeVisible();
    await expect(page.locator('button[aria-label="下個月"]')).toBeVisible();

    await context.close();
  });

  test('月報視圖：月份切換正常', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet/monthly', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('月報審核', { timeout: 15000 });

    // 等待載入完成
    await page.waitForTimeout(2000);

    // 記錄目前月份顯示
    const monthLabel = page.locator('text=/\\d{4} 年 \\d{1,2} 月/').first();
    await expect(monthLabel).toBeVisible({ timeout: 10000 });
    const originalMonth = await monthLabel.textContent();

    // 點前一月
    await page.locator('button[aria-label="上個月"]').click();
    await page.waitForTimeout(2000);

    const newMonth = await page.locator('text=/\\d{4} 年 \\d{1,2} 月/').first().textContent();
    expect(newMonth).not.toBe(originalMonth);

    await context.close();
  });

  test('Engineer 被導向回 /timesheet（無月報審核權限）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet/monthly', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Engineer 應被 redirect 回 /timesheet 或看不到月報審核
    const url = page.url();
    const isRedirected = url.includes('/timesheet') && !url.includes('/monthly');
    const noAccess = await page.locator('text=月報審核').count() === 0;

    expect(isRedirected || noAccess).toBeTruthy();

    await context.close();
  });
});
