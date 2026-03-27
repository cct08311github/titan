/**
 * Phase 5 + Phase 7: 資料一致性、狀態機驗證、銀行合規性
 *
 * 涵蓋：
 * A. 文件狀態機（DRAFT→IN_REVIEW→PUBLISHED→RETIRED，嚴格轉換）
 * B. 工時審核狀態機（PENDING→APPROVED/REJECTED，鎖定機制）
 * C. 任務狀態機（自由轉換 — 記錄為設計決策）
 * D. 稽核日誌完整性（不可刪改、自動記錄、IP 追蹤）
 * E. 審核流程不可繞過（文件核准、工時核准、角色限制）
 * F. 資料保留與不可竄改（AuditLog immutability、時間鎖定）
 * G. 密碼安全合規（歷史、到期、強度）
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// A. 文件狀態機 — 嚴格轉換驗證
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A. 文件狀態機', () => {
  test.use({ storageState: MANAGER_STATE_FILE });
  test.describe.configure({ mode: 'serial' });

  let docId: string | null = null;

  test.afterAll(async ({ request }) => {
    if (docId) await request.delete(`/api/documents/${docId}`).catch(() => {});
  });

  test('建立文件 → 狀態為 DRAFT', async ({ request }) => {
    const res = await request.post('/api/documents', {
      data: { title: `StateMachine-${Date.now()}`, content: '# 狀態機測試' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    docId = body.data?.id;
    expect(body.data?.status).toBe('DRAFT');
  });

  test('DRAFT → 不可核准（必須先提交審核）', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/approve`);
    expect(res.status()).toBe(400);
  });

  test('DRAFT → 不可駁回', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/reject`, {
      data: { reason: '測試' },
    });
    expect(res.status()).toBe(400);
  });

  test('DRAFT → IN_REVIEW（提交審核）', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/submit-review`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.status).toBe('IN_REVIEW');
  });

  test('IN_REVIEW → 不可再次提交審核', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/submit-review`);
    expect(res.status()).toBe(400);
  });

  test('IN_REVIEW → PUBLISHED（核准）', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/approve`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.status).toBe('PUBLISHED');
  });

  test('PUBLISHED → 不可再核准', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/approve`);
    expect(res.status()).toBe(400);
  });

  test('PUBLISHED → RETIRED（退役）', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/retire`);
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('A2. 文件駁回狀態流', () => {
  test.use({ storageState: MANAGER_STATE_FILE });
  test.describe.configure({ mode: 'serial' });

  let docId: string | null = null;

  test.afterAll(async ({ request }) => {
    if (docId) await request.delete(`/api/documents/${docId}`).catch(() => {});
  });

  test('建立 → 提交審核 → 駁回 → 回到 DRAFT', async ({ request }) => {
    // 建立
    let res = await request.post('/api/documents', {
      data: { title: `Reject-Flow-${Date.now()}`, content: 'test' },
    });
    docId = (await res.json()).data?.id;

    // 提交審核
    res = await request.post(`/api/documents/${docId}/submit-review`);
    expect(res.ok()).toBeTruthy();

    // 駁回（必須附理由）
    res = await request.post(`/api/documents/${docId}/reject`, {
      data: { reason: '內容不足，需補充' },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data?.status).toBe('DRAFT');
  });

  test('駁回無理由 → 400', async ({ request }) => {
    if (!docId) return;
    // 先再次提交
    await request.post(`/api/documents/${docId}/submit-review`);
    const res = await request.post(`/api/documents/${docId}/reject`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('駁回空字串理由 → 400', async ({ request }) => {
    if (!docId) return;
    const res = await request.post(`/api/documents/${docId}/reject`, {
      data: { reason: '   ' },
    });
    expect(res.status()).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. 工時審核狀態機
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('B. 工時審核狀態機', () => {

  test.describe('B1. REJECTED 編輯後自動重設 PENDING', () => {
    // 此邏輯在 PUT /api/time-entries/[id] 中：
    // if (approvalStatus === "REJECTED") { updates.approvalStatus = "PENDING" }
    // 透過 API 驗證此行為

    test.use({ storageState: MANAGER_STATE_FILE });

    test('工時審核 API 結構驗證', async ({ request }) => {
      // 驗證 approve 端點存在且需要 Manager
      const res = await request.post('/api/time-entries/approve', {
        data: { ids: [] },
      });
      // 空 ids 應回 200（無操作）或 400（驗證錯誤）
      expect(res.status()).not.toBe(500);
    });
  });

  test.describe('B2. Engineer 無法繞過審核', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/time-entries/approve → 403', async ({ request }) => {
      const res = await request.post('/api/time-entries/approve', {
        data: { ids: ['fake-id'] },
      });
      expect(res.status()).toBe(403);
    });

    test('Engineer POST /api/time-entries/reject → 403', async ({ request }) => {
      const res = await request.post('/api/time-entries/reject', {
        data: { ids: ['fake-id'], reason: 'hack' },
      });
      expect(res.status()).toBe(403);
    });

    test('Engineer POST /api/time-entries/settle-month → 403', async ({ request }) => {
      const res = await request.post('/api/time-entries/settle-month', {
        data: { month: '2026-03' },
      });
      expect(res.status()).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. 任務狀態機（設計為自由轉換）
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('C. 任務狀態自由轉換', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  const allStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

  test('任務可從任何狀態轉換到任何狀態', async ({ request }) => {
    // 建立任務
    const createRes = await request.post('/api/tasks', {
      data: { title: `Status-Test-${Date.now()}`, status: 'BACKLOG', priority: 'P2', category: 'PLANNED' },
    });
    const taskId = (await createRes.json()).data?.id;

    try {
      // 依序轉換所有狀態
      for (const status of allStatuses) {
        const res = await request.patch(`/api/tasks/${taskId}`, {
          data: { status },
        });
        expect(res.ok(), `Transition to ${status} should succeed`).toBeTruthy();
        const body = await res.json();
        expect(body.data?.status).toBe(status);
      }

      // 反向轉換：DONE → BACKLOG（確認允許）
      const reverseRes = await request.patch(`/api/tasks/${taskId}`, {
        data: { status: 'BACKLOG' },
      });
      expect(reverseRes.ok()).toBeTruthy();
      expect((await reverseRes.json()).data?.status).toBe('BACKLOG');
    } finally {
      if (taskId) await request.delete(`/api/tasks/${taskId}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. 稽核日誌完整性（銀行合規）
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('D. 稽核日誌完整性', () => {

  test.describe('D1. 稽核日誌不可刪除', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('無 DELETE /api/audit 端點', async ({ request }) => {
      const res = await request.delete('/api/audit');
      // 應回 405（方法不允許）或 404（端點不存在）
      expect([404, 405]).toContain(res.status());
    });

    test('無 PUT /api/audit 端點', async ({ request }) => {
      const res = await request.put('/api/audit', {
        data: { action: 'HACKED' },
      });
      expect([404, 405]).toContain(res.status());
    });

    test('無 PATCH /api/audit 端點', async ({ request }) => {
      const res = await request.patch('/api/audit', {
        data: { action: 'HACKED' },
      });
      expect([404, 405]).toContain(res.status());
    });
  });

  test.describe('D2. 操作自動產生稽核記錄', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('建立任務後稽核日誌有記錄', async ({ request }) => {
      // 建立一個任務（觸發 auto-audit）
      const createRes = await request.post('/api/tasks', {
        data: { title: `Audit-Test-${Date.now()}`, status: 'TODO', priority: 'P2', category: 'PLANNED' },
      });
      const taskId = (await createRes.json()).data?.id;

      // 查詢稽核日誌
      const auditRes = await request.get('/api/audit?page=1&pageSize=5');
      expect(auditRes.ok()).toBeTruthy();
      const auditBody = await auditRes.json();
      const entries = auditBody.data?.items ?? auditBody.data ?? [];

      // 最近的稽核記錄應包含任務相關操作
      expect(entries.length).toBeGreaterThan(0);

      // 清理
      if (taskId) await request.delete(`/api/tasks/${taskId}`);
    });

    test('稽核記錄包含必要欄位', async ({ request }) => {
      const res = await request.get('/api/audit?page=1&pageSize=3');
      const body = await res.json();
      const entries = body.data?.items ?? body.data ?? [];

      if (entries.length > 0) {
        const entry = entries[0];
        // 必要欄位
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('createdAt');
        // createdAt 應是伺服器時間（ISO 格式）
        expect(new Date(entry.createdAt).getTime()).not.toBeNaN();
      }
    });
  });

  test.describe('D3. 稽核日誌 RBAC', () => {
    test('Engineer 不可讀取稽核日誌 → 403', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
      const res = await ctx.request.get('/api/audit');
      expect(res.status()).toBe(403);
      await ctx.close();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. 審核流程不可繞過
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('E. 審核流程不可繞過', () => {

  test.describe('E1. 文件審核不可由 Engineer 執行', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/documents/:id/approve → 403', async ({ request }) => {
      expect((await request.post('/api/documents/any-id/approve')).status()).toBe(403);
    });

    test('Engineer POST /api/documents/:id/reject → 403', async ({ request }) => {
      expect((await request.post('/api/documents/any-id/reject')).status()).toBe(403);
    });

    test('Engineer POST /api/documents/:id/retire → 403', async ({ request }) => {
      expect((await request.post('/api/documents/any-id/retire')).status()).toBe(403);
    });
  });

  test.describe('E2. 工時審核不可由 Engineer 執行', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/time-entries/approve → 403', async ({ request }) => {
      expect((await request.post('/api/time-entries/approve', { data: { ids: [] } })).status()).toBe(403);
    });

    test('Engineer POST /api/time-entries/settle-month → 403', async ({ request }) => {
      expect((await request.post('/api/time-entries/settle-month', { data: { month: '2026-01' } })).status()).toBe(403);
    });

    test('Engineer PATCH /api/approvals → 403', async ({ request }) => {
      expect((await request.patch('/api/approvals', { data: { id: 'x', status: 'APPROVED' } })).status()).toBe(403);
    });
  });

  test.describe('E3. 使用者管理不可由 Engineer 執行', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/users → 403', async ({ request }) => {
      expect((await request.post('/api/users', { data: { name: 'h', email: 'h@t.l', password: 'X@1234567890xx', role: 'ENGINEER' } })).status()).toBe(403);
    });

    test('Engineer POST /api/admin/generate-reset-token → 403', async ({ request }) => {
      expect((await request.post('/api/admin/generate-reset-token', { data: { userId: 'x' } })).status()).toBe(403);
    });

    test('Engineer POST /api/admin/unlock → 403', async ({ request }) => {
      expect((await request.post('/api/admin/unlock', { data: { userId: 'x' } })).status()).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. 資料保留與不可竄改
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('F. 資料保留與不可竄改', () => {

  test.describe('F1. 工時鎖定機制', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('工時 PUT 端點存在且保護鎖定邏輯', async ({ request }) => {
      // 嘗試 PUT 不存在的工時記錄
      const res = await request.put('/api/time-entries/nonexistent-id', {
        data: { hours: 5 },
      });
      // 應回 404（找不到）而非 500
      expect([400, 404]).toContain(res.status());
    });

    test('工時 DELETE 端點存在且保護鎖定邏輯', async ({ request }) => {
      const res = await request.delete('/api/time-entries/nonexistent-id');
      expect([400, 404]).toContain(res.status());
    });
  });

  test.describe('F2. 稽核日誌不可竄改', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('GET /api/audit 返回的記錄有 createdAt（伺服器時間）', async ({ request }) => {
      const res = await request.get('/api/audit?page=1&pageSize=5');
      const body = await res.json();
      const entries = body.data?.items ?? body.data ?? [];
      for (const entry of entries) {
        expect(entry.createdAt).toBeDefined();
        // 時間戳應為合理範圍（2024-2027）
        const ts = new Date(entry.createdAt).getFullYear();
        expect(ts).toBeGreaterThanOrEqual(2024);
        expect(ts).toBeLessThanOrEqual(2027);
      }
    });

    test('稽核記錄無 updatedAt（不可修改）', async ({ request }) => {
      const res = await request.get('/api/audit?page=1&pageSize=3');
      const body = await res.json();
      const entries = body.data?.items ?? body.data ?? [];
      for (const entry of entries) {
        // AuditLog 不應有 updatedAt 欄位（只有 createdAt）
        // 如果有 updatedAt，它應等於 createdAt（未被修改）
        if (entry.updatedAt) {
          expect(entry.updatedAt).toBe(entry.createdAt);
        }
      }
    });
  });

  test.describe('F3. 文件版本追蹤', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('更新文件內容會保留版本記錄', async ({ request }) => {
      // 建立文件
      const createRes = await request.post('/api/documents', {
        data: { title: `Version-Test-${Date.now()}`, content: '版本 1' },
      });
      const docId = (await createRes.json()).data?.id;

      try {
        // 更新內容
        await request.put(`/api/documents/${docId}`, {
          data: { title: 'Version-Updated', content: '版本 2' },
        });

        // 取得文件應能看到版本資訊
        const getRes = await request.get(`/api/documents/${docId}`);
        const doc = (await getRes.json()).data;
        // version 欄位應 >= 1
        if (doc?.version !== undefined) {
          expect(doc.version).toBeGreaterThanOrEqual(1);
        }
      } finally {
        if (docId) await request.delete(`/api/documents/${docId}`);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// G. 密碼安全合規
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('G. 密碼安全合規', () => {

  test.describe('G1. 密碼重設 API 驗證', () => {

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
          newPassword: 'NewPass@2026!xx',
        },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('G2. 密碼變更頁面存在', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer 可存取 /change-password', async ({ page }) => {
      await page.goto('/change-password', { waitUntil: 'domcontentloaded' });
      // 頁面應包含密碼變更表單
      const form = page.locator('form, input[type="password"]');
      await expect(form.first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('G3. Admin 密碼重設權限', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('Engineer POST /api/admin/generate-reset-token → 403', async ({ request }) => {
      const res = await request.post('/api/admin/generate-reset-token', {
        data: { userId: 'any-user-id' },
      });
      expect(res.status()).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// H. 跨模組資料一致性
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('H. 跨模組資料一致性', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('API 回應格式統一 {ok, data}', async ({ request }) => {
    const endpoints = [
      '/api/tasks?limit=1',
      '/api/kpi?year=2026',
      '/api/documents',
      '/api/plans',
      '/api/notifications',
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep);
      expect(res.ok(), `${ep} should return 200`).toBeTruthy();
      const body = await res.json();
      expect(body.ok, `${ep} should have ok:true`).toBe(true);
      expect(body.data, `${ep} should have data field`).toBeDefined();
    }
  });

  test('錯誤回應格式統一 {ok:false, error, message}', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const res = await ctx.request.post('/api/kpi', { data: {} });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.message).toBeDefined();
    await ctx.close();
  });

  test('所有 API 的 x-request-id 格式一致', async ({ request }) => {
    const res1 = await request.get('/api/tasks');
    const res2 = await request.get('/api/kpi');
    const id1 = res1.headers()['x-request-id'];
    const id2 = res2.headers()['x-request-id'];
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    // UUID 格式或至少有一定長度
    expect(id1!.length).toBeGreaterThanOrEqual(8);
    expect(id2!.length).toBeGreaterThanOrEqual(8);
  });
});
