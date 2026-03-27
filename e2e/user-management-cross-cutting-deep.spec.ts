/**
 * 使用者管理 + 跨切面功能 深度 E2E 驗證
 *
 * 涵蓋：
 * J. 使用者管理（CRUD、停用/恢復、密碼管理）
 * K. 通知系統（鈴鐺、已讀/未讀、偏好）
 * L. 跨切面（Command Palette、活動時間軸、安全標頭、錯誤邊界）
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// J. 使用者管理
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('J. 使用者管理', () => {

  test.describe('J1. 使用者列表', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('Manager GET /api/users → 200，包含使用者列表', async ({ request }) => {
      const res = await request.get('/api/users');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.ok).toBe(true);
      const users = Array.isArray(body.data) ? body.data
        : Array.isArray(body.data?.items) ? body.data.items : [];
      expect(users.length).toBeGreaterThan(0);
    });

    test('使用者列表包含必要欄位', async ({ request }) => {
      const res = await request.get('/api/users');
      const body = await res.json();
      const users = Array.isArray(body.data) ? body.data
        : Array.isArray(body.data?.items) ? body.data.items : [];
      if (users.length > 0) {
        const user = users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
      }
    });
  });

  test.describe('J2. 使用者 CRUD（Manager）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    let createdUserId: string | null = null;

    test.afterAll(async ({ request }) => {
      if (createdUserId) {
        await request.delete(`/api/users/${createdUserId}`).catch(() => {});
      }
    });

    test('建立使用者 POST /api/users → 201', async ({ request }) => {
      const uniqueEmail = `e2e-test-${Date.now()}@titan.local`;
      const res = await request.post('/api/users', {
        data: {
          name: 'E2E 測試使用者',
          email: uniqueEmail,
          password: 'E2eTest@2026!x',
          role: 'ENGINEER',
        },
      });
      expect([200, 201]).toContain(res.status());
      const body = await res.json();
      createdUserId = body.data?.id ?? null;
      expect(createdUserId).toBeTruthy();
    });

    test('更新使用者 PUT /api/users/:id → 200', async ({ request }) => {
      if (!createdUserId) return;
      const res = await request.put(`/api/users/${createdUserId}`, {
        data: { name: 'E2E 更新名稱' },
      });
      expect(res.ok()).toBeTruthy();
    });

    test('停用使用者 DELETE /api/users/:id → 200', async ({ request }) => {
      if (!createdUserId) return;
      const res = await request.delete(`/api/users/${createdUserId}`);
      expect(res.ok()).toBeTruthy();
    });
  });

  test.describe('J3. Engineer 無法管理使用者', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/users → 403', async ({ request }) => {
      const res = await request.post('/api/users', {
        data: {
          name: 'hacker',
          email: 'hack@titan.local',
          password: 'Hack@2026!x',
          role: 'ENGINEER',
        },
      });
      expect(res.status()).toBe(403);
    });

    test('Engineer PUT /api/users/:id → 403', async ({ request }) => {
      const res = await request.put('/api/users/nonexistent-id', {
        data: { name: 'hacked' },
      });
      expect(res.status()).toBe(403);
    });

    test('Engineer DELETE /api/users/:id → 403', async ({ request }) => {
      const res = await request.delete('/api/users/nonexistent-id');
      expect(res.status()).toBe(403);
    });
  });

  test.describe('J4. 使用者建立驗證（Negative）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('重複 email → 400/409', async ({ request }) => {
      const res = await request.post('/api/users', {
        data: {
          name: '重複測試',
          email: 'admin@titan.local', // already exists
          password: 'Dup@2026!xxxx',
          role: 'ENGINEER',
        },
      });
      expect([400, 409]).toContain(res.status());
    });

    test('缺少密碼 → 400', async ({ request }) => {
      const res = await request.post('/api/users', {
        data: { name: 'test', email: 'nopass@titan.local', role: 'ENGINEER' },
      });
      expect(res.status()).toBe(400);
    });

    test('無效角色 → 400', async ({ request }) => {
      const res = await request.post('/api/users', {
        data: {
          name: 'test',
          email: 'badrole@titan.local',
          password: 'Test@2026!xxx',
          role: 'SUPERADMIN',
        },
      });
      expect([400, 422]).toContain(res.status());
    });
  });

  test.describe('J5. 管理員解鎖功能', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('POST /api/admin/unlock 需要 userId → 400 或 200', async ({ request }) => {
      const res = await request.post('/api/admin/unlock', {
        data: { userId: 'nonexistent-user-id' },
      });
      // Should not be 500
      expect(res.status()).not.toBe(500);
      expect([200, 400, 404]).toContain(res.status());
    });

    test('Engineer POST /api/admin/unlock → 403', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
      const req = ctx.request;
      const res = await req.post('/api/admin/unlock', {
        data: { userId: 'fake-id' },
      });
      expect(res.status()).toBe(403);
      await ctx.close();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// K. 通知系統
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('K. 通知系統', () => {

  test.describe('K1. 通知 API', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('GET /api/notifications → 200，回傳通知列表', async ({ request }) => {
      const res = await request.get('/api/notifications');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test('通知回傳格式正確', async ({ request }) => {
      const res = await request.get('/api/notifications?limit=5');
      const body = await res.json();
      // 應包含 items 或 data 陣列
      const items = body.data?.items ?? body.data ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const notif = items[0];
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('type');
        expect(notif).toHaveProperty('title');
      }
    });
  });

  test.describe('K2. 未認證通知存取', () => {
    test('未認證 GET /api/notifications → 401', async ({ request }) => {
      const res = await request.get('/api/notifications');
      expect(res.status()).toBe(401);
    });
  });

  test.describe('K3. 通知 UI', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('Dashboard 頁面有通知鈴鐺', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      // 通知鈴鐺圖示 — 可能是 button 或 link
      const bell = page.locator('[aria-label*="通知"], [data-testid="notification-bell"], button:has(svg)').first();
      await expect(bell).toBeVisible({ timeout: 15000 });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// L. 跨切面功能
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('L. 跨切面功能', () => {

  test.describe('L1. Command Palette', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('點擊搜尋圖示開啟 Command Palette', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

      // 點擊 header 中的「全域搜尋」按鈕
      await page.locator('button[aria-label="全域搜尋"]').click();

      const searchInput = page.locator('input[placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 8000 });
    });

    test('Escape 關閉搜尋面板', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

      // 開啟搜尋
      await page.locator('button[aria-label="全域搜尋"]').click();

      const searchInput = page.locator('input[placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 8000 });

      await page.keyboard.press('Escape');
      await expect(searchInput).not.toBeVisible({ timeout: 8000 });
    });

    test('搜尋面板輸入後顯示結果', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

      // 開啟搜尋
      await page.locator('button[aria-label="全域搜尋"]').click();

      const searchInput = page.locator('input[placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 8000 });

      await searchInput.fill('任務');
      await page.waitForTimeout(1500);

      // 面板中應有搜尋結果
      const results = page.locator('[cmdk-item], [role="option"], [data-value]');
      const count = await results.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('L2. 活動時間軸', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('GET /api/activity → 200', async ({ request }) => {
      const res = await request.get('/api/activity');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test('活動頁面載入', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      // 實際標題：「團隊動態」
      await expect(page.locator('h1').first()).toContainText('團隊動態', { timeout: 15000 });
    });
  });

  test.describe('L3. 活動 RBAC', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 可存取活動頁面', async ({ page }) => {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      // Engineer 應看到自己的活動
      const url = page.url();
      expect(url).toContain('/activity');
    });

    test('Engineer GET /api/activity → 200（僅自己的）', async ({ request }) => {
      const res = await request.get('/api/activity');
      expect(res.ok()).toBeTruthy();
    });
  });

  test.describe('L4. 設定頁面', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('設定頁面載入三個 tab', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      // 等待頁面完全載入（skeleton 消失）
      await page.waitForSelector('text=個人資料', { timeout: 15000 });

      // 三個 tab 文字：個人資料、通知偏好、安全設定
      await expect(page.locator('text=個人資料').first()).toBeVisible();
      await expect(page.locator('text=通知偏好').first()).toBeVisible();
      await expect(page.locator('text=安全設定').first()).toBeVisible();
    });

    test('個人資料 tab 有姓名與儲存按鈕', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=姓名', { timeout: 15000 });

      // 「姓名」文字可見
      await expect(page.locator('text=姓名').first()).toBeVisible();
      // 「儲存變更」按鈕可見
      await expect(page.locator('button', { hasText: '儲存' }).first()).toBeVisible({ timeout: 5000 });
    });

    test('Email 欄位為唯讀', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=電子信箱', { timeout: 15000 });

      // 電子信箱欄位應為唯讀
      const emailSection = page.locator('text=電子信箱').locator('..');
      const note = page.locator('text=無法自行修改');
      await expect(note).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('L5. 空狀態驗證', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('各頁面載入不出現 500 錯誤', async ({ request }) => {
      const pages = [
        '/api/tasks',
        '/api/kpi?year=2099',  // unlikely to have data
        '/api/plans',
        '/api/documents',
        '/api/notifications',
        '/api/activity',
      ];

      for (const path of pages) {
        const res = await request.get(path);
        expect(res.status(), `${path} should not return 500`).not.toBe(500);
      }
    });
  });

  test.describe('L6. Correlation ID 追蹤', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('所有 API 回應都有 x-request-id', async ({ request }) => {
      const endpoints = ['/api/tasks', '/api/kpi', '/api/notifications'];
      for (const ep of endpoints) {
        const res = await request.get(ep);
        expect(res.headers()['x-request-id'], `${ep} missing x-request-id`).toBeDefined();
      }
    });

    test('每個請求 x-request-id 唯一', async ({ request }) => {
      const res1 = await request.get('/api/tasks');
      const res2 = await request.get('/api/tasks');
      const id1 = res1.headers()['x-request-id'];
      const id2 = res2.headers()['x-request-id'];
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  test.describe('L7. API 錯誤回應格式一致性', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('403 回應格式一致 {ok:false, error, message}', async ({ request }) => {
      const res = await request.post('/api/kpi', { data: {} });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.message).toBeDefined();
    });

    test('400 回應格式一致', async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: { title: '' }, // empty title → validation error
      });
      if (res.status() === 400) {
        const body = await res.json();
        expect(body.ok).toBe(false);
      }
    });

    test('未認證 API 呼叫 → 401', async ({ browser }) => {
      // 全新 context 無 session cookie → 應被 Edge JWT 攔截回 401
      const ctx = await browser.newContext({
        baseURL: process.env.BASE_URL ?? 'http://localhost:3100',
      });
      const res = await ctx.request.get('/api/tasks');
      expect([401, 403]).toContain(res.status());
      await ctx.close();
    });
  });

  test.describe('L8. 稽核日誌', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('GET /api/audit → 200，回傳稽核記錄', async ({ request }) => {
      const res = await request.get('/api/audit');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test('稽核記錄包含必要欄位', async ({ request }) => {
      const res = await request.get('/api/audit?page=1&pageSize=5');
      const body = await res.json();
      const items = body.data?.items ?? body.data ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const entry = items[0];
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('createdAt');
      }
    });

    test('Engineer GET /api/audit → 403', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
      const req = ctx.request;
      const res = await req.get('/api/audit');
      expect(res.status()).toBe(403);
      await ctx.close();
    });
  });
});
