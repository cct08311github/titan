import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ─── Journey Test Suite ────────────────────────────────────────────────────
// 所有導航均透過 sidebar 連結點擊，模擬真實使用者操作
// 不使用 page.goto() 進行頁面跳轉（僅用於初始進入 app）

test.describe('Journey 測試', () => {

  // ── Test 1: 經辦日常流程 ─────────────────────────────────────────────────
  test('經辦日常流程：看板 → 工時 → 儀表板', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    // 從 dashboard 出發（初始進入）
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 點擊 sidebar「看板」連結，真實導航
    await page.getByRole('link', { name: '看板' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證看板頁面
    await expect(page.locator('h1').first()).toContainText('看板');

    // 驗證看板內有欄位（不管是否有任務卡片都要有欄位標題）
    await expect(
      page.locator('text=待辦清單').or(page.locator('text=尚無任務')).first()
    ).toBeVisible();

    // 點擊 sidebar「工時紀錄」連結
    await page.getByRole('link', { name: '工時紀錄' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證工時頁面
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 驗證工時頁面關鍵元素（週導航按鈕）
    await expect(page.getByRole('button', { name: '本週' })).toBeVisible();

    // 點擊 sidebar「儀表板」回到 Dashboard
    await page.getByRole('link', { name: '儀表板' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證 Dashboard 載入完成
    await expect(page.locator('h1').first()).toContainText('儀表板');
    // Engineer 視角
    await expect(
      page.locator('p', { hasText: '工程師視角' }).or(
        page.locator('[class*="muted"]', { hasText: '工程師視角' })
      ).first()
    ).toBeVisible();

    await context.close();
  });

  // ── Test 2: 管理者巡查流程 ──────────────────────────────────────────────
  test('管理者巡查流程：儀表板 → KPI → 報表', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    // 從 dashboard 出發
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 點擊 sidebar「儀表板」（確保 active state）
    await page.getByRole('link', { name: '儀表板' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證管理者相關 UI（主管視角或統計卡片）
    await expect(page.locator('h1').first()).toContainText('儀表板');
    await expect(
      page.locator('text=主管視角').or(page.locator('text=團隊工時分佈')).first()
    ).toBeVisible();

    // 點擊 sidebar「KPI」連結
    await page.getByRole('link', { name: 'KPI' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證 KPI 頁面載入
    await expect(page.locator('h1').first()).toContainText('KPI');
    // 驗證 KPI 頁面關鍵元素（新增按鈕對 manager 可見）
    await expect(
      page.getByRole('button', { name: '新增 KPI' }).or(
        page.locator('text=KPI 管理')
      ).first()
    ).toBeVisible();

    // 點擊 sidebar「報表」連結
    await page.getByRole('link', { name: '報表' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證 Reports 頁面載入
    await expect(page.locator('h1').first()).toContainText('報表');
    // 驗證頁面 tab 存在
    await expect(page.getByRole('button', { name: '週報' })).toBeVisible();

    await context.close();
  });

  // ── Test 3: 跨頁資料一致性 ──────────────────────────────────────────────
  test('跨頁資料一致性：Dashboard 統計 → 看板 → 回 Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    // Manager 登入，到 Dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 等待 Dashboard 資料載入，記錄「本週完成任務」統計值
    // 使用 StatCard 的結構：找到含「本週完成任務」標籤旁的數值
    const completedCardLocator = page.locator('[class*="card"]').filter({ hasText: '本週完成任務' }).first();
    await expect(completedCardLocator).toBeVisible();

    // 擷取統計值文字
    const statText = await completedCardLocator.locator('p.text-2xl, p[class*="text-2xl"]').first().textContent();

    // 點擊 sidebar「看板」連結 — 真實導航
    await page.getByRole('link', { name: '看板' }).click();
    await page.waitForLoadState('domcontentloaded');

    // 驗證看板有對應資料（有欄位即代表頁面正常運作）
    await expect(page.locator('h1').first()).toContainText('看板');
    await expect(
      page.locator('text=待辦清單').or(page.locator('text=待處理')).first()
    ).toBeVisible();

    // 點擊 sidebar「儀表板」回到 Dashboard
    await page.getByRole('link', { name: '儀表板' }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 再次等待統計卡片載入
    await expect(completedCardLocator).toBeVisible();

    // 驗證統計值不變（資料一致性）
    const statTextAfter = await completedCardLocator.locator('p.text-2xl, p[class*="text-2xl"]').first().textContent();
    expect(statTextAfter).toBe(statText);

    await context.close();
  });

});
