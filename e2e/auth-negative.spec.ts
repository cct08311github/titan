/**
 * Auth Negative E2E 測試 — Issue #289
 *
 * 驗證認證與授權的 negative paths：
 * 1. 未登入存取受保護頁面 → redirect /login
 * 2. 未登入呼叫 API → 401
 * 3. Engineer 存取 Manager-only 功能 → 403
 * 4. 無效 session cookie → redirect /login
 *
 * 注意：需要 Docker 環境（titan-app + titan-db）。
 */

import { test, expect } from '@playwright/test';
import { ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════
// 未認證存取 — 受保護頁面
// ═══════════════════════════════════════════════════════════

test.describe('未認證存取 — 頁面 redirect', () => {
  const protectedPages = [
    '/dashboard',
    '/kanban',
    '/plans',
    '/timesheet',
    '/kpi',
    '/reports',
    '/admin',
  ];

  for (const path of protectedPages) {
    test(`未登入訪問 ${path} → redirect to /login`, async ({ browser }) => {
      // Fresh context with NO stored session
      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(path);
      const url = page.url();
      const status = response?.status() ?? 0;

      // Either redirected to /login or received 401
      const isBlocked = status === 401 || url.includes('/login');
      expect(isBlocked).toBe(true);

      await context.close();
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 未認證存取 — API endpoints → 401
// ═══════════════════════════════════════════════════════════

test.describe('未認證存取 — API 401', () => {
  const apiEndpoints = [
    { method: 'GET', path: '/api/tasks' },
    { method: 'GET', path: '/api/users' },
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/kpi' },
    { method: 'GET', path: '/api/plans' },
  ];

  for (const endpoint of apiEndpoints) {
    test(`未登入 ${endpoint.method} ${endpoint.path} → 401`, async ({ request }) => {
      const res = await request.get(endpoint.path);
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.ok).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════
// RBAC — Engineer 存取 Manager-only 功能 → 403
// ═══════════════════════════════════════════════════════════

test.describe('RBAC — Engineer 禁止存取 Manager-only API', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  test('Engineer POST /api/users → 403', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: {
        name: 'test-rbac-user',
        email: 'rbac-test@titan.local',
        password: 'TestPassword123!',
        role: 'ENGINEER',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/users/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/users/nonexistent-id');
    // Should get 403 (forbidden) not 404 (not found) — RBAC check first
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/admin/generate-reset-token → 403', async ({ request }) => {
    const res = await request.post('/api/admin/generate-reset-token', {
      data: { userId: 'some-user-id' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer 存取 /admin 頁面 → 受限', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // Admin page should either redirect or show access denied
    const url = page.url();
    const hasAccessDenied = await page.locator('text=權限不足').or(page.locator('text=無權限')).count();
    const isRedirected = url.includes('/dashboard') || url.includes('/login');

    expect(hasAccessDenied > 0 || isRedirected).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 無效 Session — 偽造或過期的 cookie
// ═══════════════════════════════════════════════════════════

test.describe('無效 Session cookie', () => {
  test('偽造 session cookie → redirect to /login', async ({ browser }) => {
    const context = await browser.newContext();

    // Set a fake session cookie
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'fake-invalid-session-token-12345',
        domain: 'localhost',
        path: '/',
      },
    ]);

    const page = await context.newPage();
    const response = await page.goto('/dashboard');
    const url = page.url();
    const status = response?.status() ?? 0;

    const isBlocked = status === 401 || url.includes('/login');
    expect(isBlocked).toBe(true);

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════
// 無效輸入 — API validation
// ═══════════════════════════════════════════════════════════

test.describe('API 輸入驗證', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  test('GET /api/tasks?status=INVALID → 回傳空或錯誤', async ({ request }) => {
    const res = await request.get('/api/tasks?status=INVALID_STATUS');
    // Should either return empty results or 400, not crash
    expect([200, 400]).toContain(res.status());
  });

  test('POST /api/auth/reset-password 空 body → 400', async ({ request }) => {
    const res = await request.post('/api/auth/reset-password', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/auth/reset-password 錯誤 OTP → 400', async ({ request }) => {
    const res = await request.post('/api/auth/reset-password', {
      data: {
        email: 'admin@titan.local',
        token: '000000',
        newPassword: 'NewPassword123!',
      },
    });
    expect(res.status()).toBe(400);
  });
});
