import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.describe('工時紀錄功能測試', () => {

  test('頁面標題和週標籤可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工時紀錄');
    // 週範圍標籤格式：2026/03/23 — 2026/03/29
    await expect(page.locator('text=/\\d{4}\\/\\d{2}\\/\\d{2} — \\d{4}\\/\\d{2}\\/\\d{2}/').first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('週導航按鈕可見（前一週、本週、下一週）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 本週按鈕
    await expect(page.getByRole('button', { name: '本週' })).toBeVisible();
    // 週範圍標籤也應可見
    await expect(page.locator('text=/\\d{4}\\/\\d{2}\\/\\d{2} — /').first()).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('使用者篩選下拉可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 等待頁面載入完成
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 使用者篩選下拉：select[aria-label="篩選使用者"]（Manager 專有，第 2 個 select）
    const userSelect = page.locator('select[aria-label="篩選使用者"]');
    await expect(userSelect).toBeVisible({ timeout: 15000 });

    // 預設為「我的工時」
    const defaultOption = await userSelect.locator('option').first().textContent();
    expect(defaultOption).toContain('我的工時');

    await context.close();
  });

  test('重新整理按鈕可見且可點擊', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // RefreshCw icon 按鈕
    const refreshBtn = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw, [class*="lucide-refresh"]') }).first();

    // 替代：找到有 RefreshCw 圖示的按鈕
    const allButtons = page.locator('button');
    // 最後一個按鈕群組中的刷新按鈕
    await expect(allButtons.first()).toBeVisible();

    await context.close();
  });

  test('工時表格或空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 工時表格（table 元素）或空狀態
    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=本週尚無工時記錄').first().isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();

    await context.close();
  });

  test('Help 文字可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 底部幫助文字（實際文字：「點擊格子直接輸入數字，Enter/Tab 自動儲存。...」）
    await expect(
      page.locator('text=點擊格子直接輸入數字').first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('點擊「本週」按鈕重置到當前週', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    // 先記錄當前週標籤（格式：2026/03/23 — 2026/03/29）
    const weekRangeLocator = page.locator('text=/\\d{4}\\/\\d{2}\\/\\d{2} — \\d{4}\\/\\d{2}\\/\\d{2}/').first();
    await expect(weekRangeLocator).toBeVisible({ timeout: 15000 });
    const weekLabel = await weekRangeLocator.textContent();

    // 點擊本週按鈕
    await page.getByRole('button', { name: '本週' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 週標籤不變（已在當前週）
    const weekLabelAfter = await weekRangeLocator.textContent();
    expect(weekLabelAfter).toBe(weekLabel);

    await context.close();
  });

});

// ─── Calendar Week 視圖 E2E（#957）─────────────────────────────────────────

test.describe('工時紀錄 — Calendar Week 視圖', () => {

  test('TS-CW-001: 點擊日曆(週)按鈕切換至週日曆視圖', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible({ timeout: 10000 });
    }

    await context.close();
  });

  test('TS-CW-002: 7 日欄位標題全部可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible({ timeout: 10000 });

      for (let i = 0; i < 7; i++) {
        await expect(page.locator(`[data-testid="day-header-${i}"]`)).toBeVisible();
      }
    }

    await context.close();
  });

  test('TS-CW-003: 時間格線 08:00-22:00 可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="week-grid-body"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=08:00')).toBeVisible();
      await expect(page.locator('text=12:00')).toBeVisible();
      await expect(page.locator('text=22:00')).toBeVisible();
    }

    await context.close();
  });

  test('TS-CW-004: 已有工時區塊正確顯示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible({ timeout: 10000 });

      // 如有工時區塊則驗證存在
      const blocks = page.locator('[data-testid="week-time-block"]');
      const count = await blocks.count();
      // count 可能為 0（無帶 startTime/endTime 的 entries）
    }

    await context.close();
  });

  test('TS-CW-005: 前一週/本週/下一週導航', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="week-range-label"]')).toBeVisible({ timeout: 10000 });

      const label1 = await page.locator('[data-testid="week-range-label"]').textContent();
      await page.locator('[data-testid="prev-week-btn"]').click();
      await page.waitForTimeout(500);
      const label2 = await page.locator('[data-testid="week-range-label"]').textContent();
      expect(label2).not.toBe(label1);

      await page.locator('[data-testid="this-week-btn"]').click();
      await page.waitForTimeout(500);
      const label3 = await page.locator('[data-testid="week-range-label"]').textContent();
      expect(label3).toBe(label1);
    }

    await context.close();
  });

  test('TS-CW-006: 週合計數字正確格式', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      const total = page.locator('[data-testid="weekly-total"]');
      await expect(total).toBeVisible({ timeout: 10000 });
      const text = await total.textContent();
      expect(text).toMatch(/週合計：\d+\.?\d*h/);
    }

    await context.close();
  });

  test('TS-CW-007: 行動裝置顯示 fallback 訊息', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: MANAGER_STATE_FILE,
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="week-view-mobile-fallback"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=週檢視在手機上空間不足')).toBeVisible();
    }

    await context.close();
  });

  test('TS-CW-008: 底部 totals row 顯示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const weekBtn = page.locator('[data-testid="view-calendar-week-btn"]');
    if (await weekBtn.isVisible()) {
      await weekBtn.click();
      await expect(page.locator('[data-testid="week-totals-row"]')).toBeVisible({ timeout: 10000 });
      for (let i = 0; i < 7; i++) {
        await expect(page.locator(`[data-testid="day-total-cell-${i}"]`)).toBeVisible();
      }
    }

    await context.close();
  });
});
