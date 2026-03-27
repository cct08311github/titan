/**
 * RBAC 深度驗證 E2E 測試 — E2E Deep Verification Phase 1
 *
 * 七層驗證中的「權限與安全深度驗證」，涵蓋：
 *
 * 1. Engineer 禁止存取所有 Manager-only API（完整覆蓋 60+ 端點）
 * 2. Manager 禁止存取 Admin-only API
 * 3. 資料隔離：Engineer 不可讀取他人敏感資料
 * 4. 水平越權防護：Engineer 不可修改自身角色
 * 5. 安全標頭驗證：CSP、X-Frame-Options、X-Content-Type-Options
 * 6. 403 回應不洩漏敏感資料
 * 7. 未認證存取全部 Manager-only API → 401
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Engineer 禁止存取 Manager-only API — 完整覆蓋
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — Engineer 禁止存取 Manager-only API', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  // ── 管理主控台 ──────────────────────────────────────────────────────────────

  test('Engineer GET /api/cockpit → 403', async ({ request }) => {
    const res = await request.get('/api/cockpit?year=2026');
    expect(res.status()).toBe(403);
  });

  test('Engineer GET /api/audit → 403', async ({ request }) => {
    const res = await request.get('/api/audit');
    expect(res.status()).toBe(403);
  });

  test('Engineer GET /api/alerts/active → 403', async ({ request }) => {
    const res = await request.get('/api/alerts/active');
    expect(res.status()).toBe(403);
  });

  // ── 交付物管理 ──────────────────────────────────────────────────────────────

  test('Engineer POST /api/deliverables → 403', async ({ request }) => {
    const res = await request.post('/api/deliverables', {
      data: { title: 'RBAC-test', taskId: 'fake-task-id' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer PATCH /api/deliverables/:id → 403', async ({ request }) => {
    const res = await request.patch('/api/deliverables/nonexistent-id', {
      data: { title: 'hacked' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/deliverables/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/deliverables/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  // ── KPI 管理（寫入操作）──────────────────────────────────────────────────

  test('Engineer PUT /api/kpi/:id → 403', async ({ request }) => {
    const res = await request.put('/api/kpi/nonexistent-id', {
      data: { title: 'hacked-kpi', target: 999 },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/kpi/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/kpi/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/kpi/copy-year → 403', async ({ request }) => {
    const res = await request.post('/api/kpi/copy-year', {
      data: { sourceYear: 2025, targetYear: 2027 },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/kpi/:id/link → 403', async ({ request }) => {
    const res = await request.post('/api/kpi/nonexistent-id/link', {
      data: { taskId: 'fake-task-id' },
    });
    expect(res.status()).toBe(403);
  });

  // ── 計畫管理 ────────────────────────────────────────────────────────────────

  test('Engineer POST /api/plans → 403', async ({ request }) => {
    const res = await request.post('/api/plans', {
      data: { year: 2026, title: 'RBAC-test-plan' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer PATCH /api/plans/:id → 403', async ({ request }) => {
    const res = await request.patch('/api/plans/nonexistent-id', {
      data: { title: 'hacked-plan' },
    });
    expect(res.status()).toBe(403);
  });

  // ── 目標管理 ────────────────────────────────────────────────────────────────

  test('Engineer POST /api/goals → 403', async ({ request }) => {
    const res = await request.post('/api/goals', {
      data: { title: 'RBAC-test-goal', planId: 'fake-plan-id', month: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer PUT /api/goals/:id → 403', async ({ request }) => {
    const res = await request.put('/api/goals/nonexistent-id', {
      data: { title: 'hacked-goal' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/goals/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/goals/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  // ── 文件審核 ────────────────────────────────────────────────────────────────

  test('Engineer DELETE /api/documents/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/documents/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/documents/:id/approve → 403', async ({ request }) => {
    const res = await request.post('/api/documents/nonexistent-id/approve');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/documents/:id/reject → 403', async ({ request }) => {
    const res = await request.post('/api/documents/nonexistent-id/reject');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/documents/:id/retire → 403', async ({ request }) => {
    const res = await request.post('/api/documents/nonexistent-id/retire');
    expect(res.status()).toBe(403);
  });

  // ── 工時審核 ────────────────────────────────────────────────────────────────

  test('Engineer POST /api/time-entries/approve → 403', async ({ request }) => {
    const res = await request.post('/api/time-entries/approve', {
      data: { ids: ['fake-entry-id'] },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/time-entries/reject → 403', async ({ request }) => {
    const res = await request.post('/api/time-entries/reject', {
      data: { ids: ['fake-entry-id'], reason: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/time-entries/settle-month → 403', async ({ request }) => {
    const res = await request.post('/api/time-entries/settle-month', {
      data: { month: '2026-03' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer GET /api/time-entries/monthly → 403', async ({ request }) => {
    const res = await request.get('/api/time-entries/monthly?month=2026-03');
    expect(res.status()).toBe(403);
  });

  test('Engineer GET /api/time-entries/monthly-summary → 403', async ({ request }) => {
    const res = await request.get('/api/time-entries/monthly-summary?month=2026-03');
    expect(res.status()).toBe(403);
  });

  test('Engineer PATCH /api/time-entries/:id/review → 403', async ({ request }) => {
    const res = await request.patch('/api/time-entries/nonexistent-id/review', {
      data: { status: 'APPROVED' },
    });
    expect(res.status()).toBe(403);
  });

  // ── 審批管理 ────────────────────────────────────────────────────────────────

  test('Engineer PATCH /api/approvals → 403', async ({ request }) => {
    const res = await request.patch('/api/approvals', {
      data: { id: 'fake-id', status: 'APPROVED' },
    });
    expect(res.status()).toBe(403);
  });

  // ── 權限管理 ────────────────────────────────────────────────────────────────

  test('Engineer GET /api/permissions → 403', async ({ request }) => {
    const res = await request.get('/api/permissions');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/permissions → 403', async ({ request }) => {
    const res = await request.post('/api/permissions', {
      data: { granteeId: 'fake-id', permType: 'VIEW_TEAM' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/permissions → 403', async ({ request }) => {
    const res = await request.delete('/api/permissions?id=fake-id');
    expect(res.status()).toBe(403);
  });

  // ── 閱讀清單管理 ────────────────────────────────────────────────────────────

  test('Engineer POST /api/reading-lists → 403', async ({ request }) => {
    const res = await request.post('/api/reading-lists', {
      data: { title: 'RBAC-test-list' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/reading-lists/:id/assign → 403', async ({ request }) => {
    const res = await request.post('/api/reading-lists/nonexistent-id/assign', {
      data: { userIds: ['fake-user-id'] },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/reading-lists/:id/items → 403', async ({ request }) => {
    const res = await request.post('/api/reading-lists/nonexistent-id/items', {
      data: { documentId: 'fake-doc-id' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer PATCH /api/reading-lists/:id → 403', async ({ request }) => {
    const res = await request.patch('/api/reading-lists/nonexistent-id', {
      data: { title: 'hacked' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/reading-lists/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/reading-lists/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  // ── 任務進階操作 ────────────────────────────────────────────────────────────

  test('Engineer DELETE /api/tasks/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/tasks/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  test('Engineer PATCH /api/tasks/:id/flag → 403', async ({ request }) => {
    const res = await request.patch('/api/tasks/nonexistent-id/flag', {
      data: { flagged: true },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/tasks/import → 403', async ({ request }) => {
    const res = await request.post('/api/tasks/import', {
      data: { tasks: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/tasks/import-template → 403', async ({ request }) => {
    const res = await request.post('/api/tasks/import-template', {
      data: {},
    });
    expect(res.status()).toBe(403);
  });

  // ── 使用者管理 ──────────────────────────────────────────────────────────────

  test('Engineer POST /api/users → 403', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: { name: 'hacker', email: 'hack@titan.local', password: 'Test123!', role: 'ENGINEER' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer PUT /api/users/:id → 403', async ({ request }) => {
    const res = await request.put('/api/users/nonexistent-id', {
      data: { name: 'hacked', role: 'MANAGER' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/users/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/users/nonexistent-id');
    expect(res.status()).toBe(403);
  });

  // ── 報表（Manager-only）────────────────────────────────────────────────────

  test('Engineer GET /api/reports/department-timesheet → 403', async ({ request }) => {
    const res = await request.get('/api/reports/department-timesheet?month=2026-03');
    expect(res.status()).toBe(403);
  });

  test('Engineer GET /api/reports/timesheet-compliance → 403', async ({ request }) => {
    const res = await request.get('/api/reports/timesheet-compliance?month=2026-03');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/reports/scheduled → 403', async ({ request }) => {
    const res = await request.post('/api/reports/scheduled');
    expect(res.status()).toBe(403);
  });

  // ── V2 進階報表（全部 withManager）────────────────────────────────────────

  const v2Reports = [
    'kpi-trend', 'kpi-correlation', 'kpi-composite',
    'incident-sla', 'permission-audit', 'workload-distribution',
    'milestone-achievement', 'unplanned-trend', 'overtime-analysis',
    'time-efficiency', 'velocity', 'overdue-analysis',
    'earned-value', 'utilization', 'change-summary',
  ];

  for (const report of v2Reports) {
    test(`Engineer GET /api/reports/v2/${report} → 403`, async ({ request }) => {
      const res = await request.get(`/api/reports/v2/${report}?year=2026`);
      expect(res.status()).toBe(403);
    });
  }

  // ── 通知推播 ────────────────────────────────────────────────────────────────

  test('Engineer POST /api/notifications/push → 403', async ({ request }) => {
    const res = await request.post('/api/notifications/push', {
      data: { title: 'test', body: 'test', userIds: [] },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/notifications/generate → 403', async ({ request }) => {
    const res = await request.post('/api/notifications/generate');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/notifications/trigger → 403（修復後）', async ({ request }) => {
    const res = await request.post('/api/notifications/trigger');
    expect(res.status()).toBe(403);
  });

  // ── 週期任務（修復後 withManager）────────────────────────────────────────

  test('Engineer POST /api/recurring/generate → 403（修復後）', async ({ request }) => {
    const res = await request.post('/api/recurring/generate');
    expect(res.status()).toBe(403);
  });

  // ── 管理員功能 ──────────────────────────────────────────────────────────────

  test('Engineer GET /api/admin/backup-status → 403', async ({ request }) => {
    const res = await request.get('/api/admin/backup-status');
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/admin/generate-reset-token → 403', async ({ request }) => {
    const res = await request.post('/api/admin/generate-reset-token', {
      data: { userId: 'fake-user-id' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/admin/unlock → 403', async ({ request }) => {
    const res = await request.post('/api/admin/unlock', {
      data: { userId: 'fake-user-id' },
    });
    expect(res.status()).toBe(403);
  });

  // ── 團隊指標 ────────────────────────────────────────────────────────────────

  test('Engineer GET /api/metrics/team-summary → 403', async ({ request }) => {
    const res = await request.get('/api/metrics/team-summary');
    expect(res.status()).toBe(403);
  });

  // ── 空間管理（Manager-only 操作）────────────────────────────────────────────

  test('Engineer POST /api/spaces/:id/members → 403', async ({ request }) => {
    const res = await request.post('/api/spaces/nonexistent-id/members', {
      data: { userId: 'fake-user-id' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer POST /api/spaces/:id/categories → 403', async ({ request }) => {
    const res = await request.post('/api/spaces/nonexistent-id/categories', {
      data: { name: 'hacked-category' },
    });
    expect(res.status()).toBe(403);
  });

  test('Engineer DELETE /api/spaces/:id → 403', async ({ request }) => {
    const res = await request.delete('/api/spaces/nonexistent-id');
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Manager 禁止存取 Admin-only API
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — Manager 禁止存取 Admin-only API', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('Manager PUT /api/admin/feature-flags → 403（ADMIN only）', async ({ request }) => {
    const res = await request.put('/api/admin/feature-flags', {
      data: { name: 'ENABLE_GANTT', enabled: false },
    });
    // Manager 角色不是 ADMIN，應被拒絕
    // 注意：如果 MANAGER 帳號同時具有 ADMIN 權限，此測試需調整
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 資料隔離驗證 — Engineer 不可讀取他人敏感資料
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — 資料隔離', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  test('Engineer 查詢工時 API 不回傳他人工時記錄', async ({ request }) => {
    // Engineer 正常查詢自己的工時
    const ownResp = await request.get('/api/time-entries');
    expect(ownResp.ok()).toBeTruthy();
    const ownData = await ownResp.json();

    // 所有回傳的工時記錄 userId 應等於自己的 ID
    const entries = Array.isArray(ownData?.data) ? ownData.data : [];
    if (entries.length > 0) {
      const firstUserId = entries[0].userId;
      // 所有記錄應來自同一個使用者（自己）
      for (const entry of entries) {
        expect(entry.userId).toBe(firstUserId);
      }
    }
  });

  test('Engineer 帶他人 userId 查詢工時 → 不回傳他人資料', async ({ request }) => {
    // 嘗試注入他人 userId
    const resp = await request.get('/api/time-entries?userId=00000000-0000-0000-0000-000000000001');
    // 應回傳自己的資料或空陣列（忽略 userId 參數）或 403
    expect([200, 403]).toContain(resp.status());

    if (resp.status() === 200) {
      const data = await resp.json();
      const entries = Array.isArray(data?.data) ? data.data : [];
      // 即使帶了別人的 userId，也不應回傳別人的資料
      if (entries.length > 0) {
        const firstUserId = entries[0].userId;
        for (const entry of entries) {
          expect(entry.userId).toBe(firstUserId);
        }
      }
    }
  });

  test('Engineer 不可讀取主管儀表板（cockpit）資料', async ({ request }) => {
    const res = await request.get('/api/cockpit?year=2026');
    expect(res.status()).toBe(403);
  });

  test('Engineer 不可讀取稽核日誌', async ({ request }) => {
    const res = await request.get('/api/audit?page=1&pageSize=10');
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 水平越權防護 — Engineer 不可提升自身角色
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — 水平越權防護', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  test('Engineer 嘗試透過 PATCH /api/users/:id 修改自身角色 → 拒絕', async ({ request }) => {
    // 先取得自己的 user info
    const meResp = await request.get('/api/users');
    const users = await meResp.json();
    const userList = Array.isArray(users?.data) ? users.data : [];

    // 找到工程師帳號
    const engineer = userList.find(
      (u: { email?: string }) => u.email === 'eng-a@titan.local'
    );

    if (engineer) {
      // 嘗試提升自己為 MANAGER
      const patchResp = await request.patch(`/api/users/${engineer.id}`, {
        data: { role: 'MANAGER' },
      });
      // 應該被拒絕（403）或角色欄位被忽略
      if (patchResp.ok()) {
        // 如果 200，確認角色沒有被修改
        const verifyResp = await request.get('/api/users');
        const verifyUsers = await verifyResp.json();
        const verifyList = Array.isArray(verifyUsers?.data) ? verifyUsers.data : [];
        const updated = verifyList.find(
          (u: { email?: string }) => u.email === 'eng-a@titan.local'
        );
        expect(updated?.role).toBe('ENGINEER');
      }
      // 403 也是正確行為
    }
  });

  test('Engineer 嘗試透過 PUT /api/users/:id 修改自身角色 → 403', async ({ request }) => {
    const res = await request.put('/api/users/nonexistent-id', {
      data: { name: 'hacker', role: 'ADMIN' },
    });
    // PUT /api/users/:id 需要 withManager，Engineer 應被拒絕
    expect(res.status()).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 安全標頭驗證
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — 安全標頭', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('API 回應包含安全標頭', async ({ request }) => {
    const res = await request.get('/api/tasks');

    const headers = res.headers();

    // X-Content-Type-Options: nosniff（防止 MIME-type 嗅探）
    expect(headers['x-content-type-options']).toBe('nosniff');

    // X-Request-ID 應存在（Correlation ID）
    expect(headers['x-request-id']).toBeDefined();
  });

  test('頁面回應包含 CSP 標頭', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    if (response) {
      const headers = response.headers();

      // Content-Security-Policy 應存在
      const csp = headers['content-security-policy'];
      expect(csp).toBeDefined();

      // CSP 應包含 nonce 或 script-src 限制
      if (csp) {
        const hasScriptSrc = csp.includes('script-src') || csp.includes('default-src');
        expect(hasScriptSrc).toBeTruthy();
      }
    }
  });

  test('頁面回應包含 X-Frame-Options', async ({ page }) => {
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    if (response) {
      const headers = response.headers();
      // X-Frame-Options 或 CSP frame-ancestors 防止 clickjacking
      const xfo = headers['x-frame-options'];
      const csp = headers['content-security-policy'] || '';
      const hasFrameProtection = xfo || csp.includes('frame-ancestors');
      expect(hasFrameProtection).toBeTruthy();
    }
  });

  test('每個請求都有唯一的 Correlation ID', async ({ request }) => {
    const res1 = await request.get('/api/tasks');
    const res2 = await request.get('/api/tasks');

    const id1 = res1.headers()['x-request-id'];
    const id2 = res2.headers()['x-request-id'];

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    // 每次請求的 Correlation ID 應不同
    expect(id1).not.toBe(id2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. 403 回應不洩漏敏感資料
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — 403 回應不洩漏資料', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  const forbiddenEndpoints = [
    { method: 'GET', path: '/api/cockpit?year=2026' },
    { method: 'GET', path: '/api/audit' },
    { method: 'POST', path: '/api/kpi' },
    { method: 'POST', path: '/api/deliverables' },
    { method: 'POST', path: '/api/users' },
    { method: 'GET', path: '/api/reports/department-timesheet?month=2026-03' },
  ];

  for (const ep of forbiddenEndpoints) {
    test(`${ep.method} ${ep.path} 的 403 回應不包含敏感資料`, async ({ request }) => {
      let res;
      if (ep.method === 'GET') {
        res = await request.get(ep.path);
      } else {
        res = await request.post(ep.path, { data: {} });
      }

      expect(res.status()).toBe(403);

      const body = await res.json();
      const bodyStr = JSON.stringify(body);

      // 403 回應不應包含資料庫記錄、堆疊追蹤、內部路徑等
      expect(bodyStr).not.toContain('prisma');
      expect(bodyStr).not.toContain('stack');
      expect(bodyStr).not.toContain('/home/');
      expect(bodyStr).not.toContain('/app/');
      expect(bodyStr).not.toContain('node_modules');
      expect(bodyStr).not.toContain('SELECT');
      expect(bodyStr).not.toContain('password');

      // 回應應只包含 ok: false 和簡短錯誤訊息
      expect(body.ok).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. 未認證存取 Manager-only API → 401
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — 未認證存取 Manager-only API', () => {

  const managerOnlyEndpoints = [
    '/api/cockpit?year=2026',
    '/api/audit',
    '/api/alerts/active',
    '/api/permissions',
    '/api/reports/department-timesheet?month=2026-03',
    '/api/time-entries/monthly?month=2026-03',
    '/api/metrics/team-summary',
    '/api/admin/backup-status',
  ];

  for (const path of managerOnlyEndpoints) {
    test(`未認證 GET ${path} → 401`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Manager 正向驗證 — 確認 Manager 可存取所有必要 API
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC 深度驗證 — Manager 正向存取', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('Manager GET /api/cockpit → 200', async ({ request }) => {
    const res = await request.get('/api/cockpit?year=2026');
    expect(res.ok()).toBeTruthy();
  });

  test('Manager GET /api/audit → 200', async ({ request }) => {
    const res = await request.get('/api/audit');
    expect(res.ok()).toBeTruthy();
  });

  test('Manager GET /api/permissions → 200', async ({ request }) => {
    const res = await request.get('/api/permissions');
    expect(res.ok()).toBeTruthy();
  });

  test('Manager GET /api/alerts/active → 200', async ({ request }) => {
    const res = await request.get('/api/alerts/active');
    expect(res.ok()).toBeTruthy();
  });

  test('Manager GET /api/metrics/team-summary → 200', async ({ request }) => {
    const res = await request.get('/api/metrics/team-summary');
    expect(res.ok()).toBeTruthy();
  });

  test('Manager GET /api/reports/v2/velocity → 200', async ({ request }) => {
    const res = await request.get('/api/reports/v2/velocity?year=2026');
    expect(res.ok()).toBeTruthy();
  });
});
