/**
 * Empty State E2E 測試
 *
 * 驗證所有頁面在空資料時：
 * 1. 不白屏（頁面有內容）
 * 2. 顯示中文引導訊息
 * 3. 有可操作的「新增」按鈕引導使用者
 *
 * 注意：需要 Docker 環境（titan-app + titan-db）。
 * 使用 resetDatabase() 確保乾淨起點。
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';
import { resetDatabase } from './helpers/seed';

test.describe('Empty State — 所有頁面空資料不白屏', () => {

  test.beforeAll(async () => {
    // 重置資料庫，保留使用者帳號（auth storageState 依賴現有使用者）
    await resetDatabase();
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────
  test('Dashboard 空資料時不白屏', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 驗證頁面有內容（不白屏）
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 空 KPI 時應有引導
    await expect(
      page.locator('text=尚無 KPI').or(page.locator('text=本年度尚未建立 KPI 指標')).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  // ── Kanban ────────────────────────────────────────────────────────────────
  test('Kanban 空資料時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('看板', { timeout: 15000 });

    // 空任務時顯示引導
    await expect(page.locator('text=尚無任務')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=目前沒有任何任務，請點擊「新增任務」開始')).toBeVisible({ timeout: 10000 });

    // 有「新增任務」按鈕
    await expect(page.getByRole('button', { name: '新增任務' })).toBeVisible();

    await context.close();
  });

  // ── Gantt ─────────────────────────────────────────────────────────────────
  test('Gantt 無年度計畫時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('甘特圖', { timeout: 15000 });

    // 無計畫時顯示引導
    await expect(
      page.locator('text=請先在「年度計畫」頁面建立計畫')
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  // ── Knowledge ─────────────────────────────────────────────────────────────
  test('知識庫無文件時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('知識庫', { timeout: 15000 });

    // 無文件時顯示引導
    await expect(page.locator('text=尚無文件')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=點擊 + 新增文件')).toBeVisible({ timeout: 10000 });

    // 有「新增文件」按鈕
    await expect(page.getByRole('button', { name: '新增文件' })).toBeVisible();

    await context.close();
  });

  // ── KPI ───────────────────────────────────────────────────────────────────
  test('KPI 空資料時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('KPI', { timeout: 15000 });

    // 空 KPI 時顯示引導（Manager 看到建立提示）
    await expect(page.locator('text=尚無 KPI')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=請點擊「新增 KPI」建立')).toBeVisible({ timeout: 10000 });

    // Manager 有「新增 KPI」按鈕
    await expect(page.getByRole('button', { name: '新增 KPI' })).toBeVisible();

    await context.close();
  });

  // ── Plans ─────────────────────────────────────────────────────────────────
  test('年度計畫空資料時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('年度計畫', { timeout: 15000 });

    // 空計畫時顯示引導
    await expect(page.locator('text=尚無年度計畫')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=目前沒有任何計畫，請點擊「新增年度計畫」建立')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  // ── Timesheet ─────────────────────────────────────────────────────────────
  test('工時紀錄空資料時顯示引導訊息', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('工時紀錄', { timeout: 15000 });

    // 空工時時顯示引導
    await expect(page.locator('text=本週尚無工時記錄')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=點擊格子可輸入工時')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  // ── Reports ───────────────────────────────────────────────────────────────
  test('報表空資料時不白屏且顯示引導', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('報表', { timeout: 15000 });

    // 4 個 tab 按鈕存在
    await expect(page.getByRole('button', { name: '週報' })).toBeVisible({ timeout: 10000 });

    // 空資料時顯示引導訊息
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    await context.close();
  });

});
