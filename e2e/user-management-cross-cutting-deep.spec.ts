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

    test('Ctrl+K 開啟 Command Palette', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      await page.keyboard.press('Control+k');
      // 搜尋輸入框應出現
      const searchInput = page.locator('[role="dialog"] input, [data-testid="command-palette"] input, [placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test('Escape 關閉 Command Palette', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      await page.keyboard.press('Control+k');
      const searchInput = page.locator('[role="dialog"] input, [data-testid="command-palette"] input, [placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await expect(searchInput).not.toBeVisible({ timeout: 3000 });
    });

    test('輸入搜尋詞顯示結果', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      await page.keyboard.press('Control+k');
      const searchInput = page.locator('[role="dialog"] input, [data-testid="command-palette"] input, [placeholder*="搜尋"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      await searchInput.fill('看板');
      await page.waitForTimeout(500);

      // 應出現搜尋結果項目
      const results = page.locator('[role="dialog"] [role="option"], [role="dialog"] li, [data-testid="command-palette"] li');
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
      await expect(page.locator('h1')).toContainText('活動', { timeout: 15000 });
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
      await page.waitForLoadState('networkidle');

      // 三個 tab：個人資料、通知偏好、安全設定
      const tabs = page.locator('[role="tab"], button[data-state]');
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('個人資料 tab 有姓名欄位', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const nameInput = page.locator('input[name="name"], input[placeholder*="姓名"]');
      await expect(nameInput).toBeVisible({ timeout: 15000 });
    });

    test('Email 欄位為唯讀', async ({ page }) => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      if (await emailInput.isVisible()) {
        const isDisabled = await emailInput.isDisabled();
        const isReadonly = await emailInput.getAttribute('readonly');
        expect(isDisabled || isReadonly !== null).toBeTruthy();
      }
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

    test('401 回應格式一致（未認證）', async ({ browser }) => {
      const ctx = await browser.newContext();
      const req = ctx.request;
      const res = await req.get('/api/tasks');
      expect(res.status()).toBe(401);
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
