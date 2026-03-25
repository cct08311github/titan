/**
 * Negative Scenario E2E 測試 — Issue #289
 *
 * 補充 auth-negative.spec.ts 以外的 negative test cases：
 * 1. 不存在的頁面 → 404
 * 2. 不存在的 API 資源 → 404
 * 3. 空資料庫 — 更多頁面的 empty state 驗證
 * 4. 並行操作與 edge cases
 *
 * 注意：需要 Docker 環境（titan-app + titan-db）。
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════
// 404 — 不存在的頁面
// ═══════════════════════════════════════════════════════════

test.describe('404 — 不存在的頁面', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('存取不存在的頁面 → 404 或錯誤頁', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-12345');
    const status = response?.status() ?? 0;

    // Should be 404 or a custom error page (not 500)
    expect(status).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════
// 404 — 不存在的 API 資源
// ═══════════════════════════════════════════════════════════

test.describe('API — 不存在的資源 → 404', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('GET /api/tasks/nonexistent-id → 404', async ({ request }) => {
    const res = await request.get('/api/tasks/nonexistent-id-12345');
    expect(res.status()).toBe(404);
  });

  test('GET /api/users/nonexistent-id → 404', async ({ request }) => {
    const res = await request.get('/api/users/nonexistent-id-12345');
    expect(res.status()).toBe(404);
  });

  test('GET /api/plans/nonexistent-id → 404', async ({ request }) => {
    const res = await request.get('/api/plans/nonexistent-id-12345');
    expect(res.status()).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════
// Empty State — 更多頁面驗證（補充 empty-state.spec.ts）
// ═══════════════════════════════════════════════════════════

test.describe('Empty State — 額外頁面引導', () => {
  test('Reports 頁面空資料時不白屏', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });

    // Page should load without crash
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // Should show some content (not blank white screen)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);

    await context.close();
  });

  test('Gantt 頁面空資料時不白屏', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);

    await context.close();
  });

  test('KPI 頁面空資料時顯示引導', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });

    // Should show KPI heading
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // Should have some guidance text or empty state indicator
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════
// Edge Cases — 重複操作與邊界輸入
// ═══════════════════════════════════════════════════════════

test.describe('Edge Cases — API 邊界輸入', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('GET /api/tasks?limit=-1 → 不崩潰', async ({ request }) => {
    const res = await request.get('/api/tasks?limit=-1');
    // Should not return 500
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/tasks?limit=99999 → 不崩潰', async ({ request }) => {
    const res = await request.get('/api/tasks?limit=99999');
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/notifications?limit=0 → 不崩潰', async ({ request }) => {
    const res = await request.get('/api/notifications?limit=0');
    expect(res.status()).toBeLessThan(500);
  });

  test('PUT /api/tasks/nonexistent with valid body → 404', async ({ request }) => {
    const res = await request.put('/api/tasks/nonexistent-id', {
      data: { title: 'Updated title' },
    });
    expect(res.status()).toBe(404);
  });
});
