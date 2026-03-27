import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

/**
 * E2E deep tests for Timesheet (Time Entry) API features
 *
 * Covers:
 *   A. Time Entry CRUD (Manager)
 *   B. Timer Operations (Engineer)
 *   C. Validation (Negative cases)
 *   D. Approval Workflow (Manager approves Engineer entries)
 *   E. Monthly Settlement
 *   F. Batch & Copy
 *   G. IDOR Protection
 *   H. Templates
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function thisMonday(): string {
  return mondayOfWeek(new Date());
}

function lastMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return mondayOfWeek(d);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const BASE = '/api/time-entries';

// ── A. Time Entry CRUD (Manager) ──────────────────────────────────────────

test.describe('A. Time Entry CRUD (Manager)', () => {
  let createdEntryId: string;
  let taskEntryId: string;

  test.describe.configure({ mode: 'serial' });

  test('A1: Create time entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 2, category: 'PLANNED_TASK' },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    createdEntryId = body.data.id;

    await context.close();
  });

  test('A2: Read entries for this week includes created entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}?weekStart=${thisMonday()}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    const ids = (Array.isArray(body.data) ? body.data : []).map((e: any) => e.id);
    expect(ids).toContain(createdEntryId);

    await context.close();
  });

  test('A3: Update entry hours', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.put(`${BASE}/${createdEntryId}`, {
      data: { hours: 3 },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.hours).toBe(3);

    await context.close();
  });

  test('A4: Delete entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.delete(`${BASE}/${createdEntryId}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    await context.close();
  });

  test('A5: Create entry with taskId', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    // First, fetch a valid task to get taskId
    const tasksRes = await page.request.get('/api/tasks?limit=1');
    const tasksBody = await tasksRes.json();
    const tasks = tasksBody.data?.items ?? tasksBody.data ?? [];
    const validTaskId = tasks.length > 0 ? tasks[0].id : undefined;

    if (validTaskId) {
      const res = await page.request.post(BASE, {
        data: { date: todayStr(), hours: 1, taskId: validTaskId },
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      taskEntryId = body.data.id;

      // Cleanup
      await page.request.delete(`${BASE}/${taskEntryId}`);
    }

    await context.close();
  });
});

// ── B. Timer Operations (Engineer) ────────────────────────────────────────

test.describe('B. Timer Operations (Engineer)', () => {
  test.describe.configure({ mode: 'serial' });

  let runningEntryId: string;

  // Ensure no leftover running timer before each test group
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();
    // Attempt to stop any running timer (ignore failures)
    await page.request.post(`${BASE}/stop`).catch(() => {});
    await context.close();
  });

  test('B6: Start timer creates running entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/start`, { data: {} });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(true);
    runningEntryId = body.data.id;

    await context.close();
  });

  test('B7: Get running timer returns the running entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}/running`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.isRunning).toBe(true);

    await context.close();
  });

  test('B8: Stop timer sets isRunning=false and calculates hours', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/stop`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(false);
    expect(typeof body.data.hours).toBe('number');

    // Cleanup: delete the stopped entry
    if (body.data.id) {
      await page.request.delete(`${BASE}/${body.data.id}`);
    }

    await context.close();
  });

  test('B9: Double start returns 409 conflict', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    // Start first timer
    const res1 = await page.request.post(`${BASE}/start`, { data: {} });
    expect(res1.status()).toBe(201);

    // Start second timer → conflict
    const res2 = await page.request.post(`${BASE}/start`, { data: {} });
    expect(res2.status()).toBe(409);

    // Cleanup: stop and delete
    const stopRes = await page.request.post(`${BASE}/stop`);
    const stopBody = await stopRes.json();
    if (stopBody.data?.id) {
      await page.request.delete(`${BASE}/${stopBody.data.id}`);
    }

    await context.close();
  });

  test('B10: Start timer with taskId and category', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    // Fetch a valid task
    const tasksRes = await page.request.get('/api/tasks?limit=1');
    const tasksBody = await tasksRes.json();
    const tasks = tasksBody.data?.items ?? tasksBody.data ?? [];
    const validTaskId = tasks.length > 0 ? tasks[0].id : undefined;

    const data: Record<string, unknown> = { category: 'INCIDENT' };
    if (validTaskId) {
      data.taskId = validTaskId;
    }

    const res = await page.request.post(`${BASE}/start`, { data });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(true);

    // Cleanup
    const stopRes = await page.request.post(`${BASE}/stop`);
    const stopBody = await stopRes.json();
    if (stopBody.data?.id) {
      await page.request.delete(`${BASE}/${stopBody.data.id}`);
    }

    await context.close();
  });
});

// ── C. Validation (Negative) ──────────────────────────────────────────────

test.describe('C. Validation (Negative)', () => {

  test('C11: Hours negative → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: -1 },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('C12: Hours over 24 → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 25 },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('C13: Hours not 0.5 increment → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 1.3 },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('C14: Missing date → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { hours: 2 },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('C15: Invalid category → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 1, category: 'FAKE' },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('C16: Daily limit exceeded → 400', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const date = todayStr();
    const createdIds: string[] = [];

    try {
      // Create 12h entry
      const res1 = await page.request.post(BASE, {
        data: { date, hours: 12, category: 'PLANNED_TASK' },
      });
      expect(res1.status()).toBe(201);
      const body1 = await res1.json();
      createdIds.push(body1.data.id);

      // Create another 12h entry (total = 24h)
      const res2 = await page.request.post(BASE, {
        data: { date, hours: 12, category: 'ADMIN' },
      });
      expect(res2.status()).toBe(201);
      const body2 = await res2.json();
      createdIds.push(body2.data.id);

      // Try 1h more → should fail
      const res3 = await page.request.post(BASE, {
        data: { date, hours: 1, category: 'SUPPORT' },
      });
      expect(res3.status()).toBe(400);
    } finally {
      // Cleanup
      for (const id of createdIds) {
        await page.request.delete(`${BASE}/${id}`);
      }
    }

    await context.close();
  });
});

// ── D. Approval Workflow ──────────────────────────────────────────────────

test.describe('D. Approval Workflow', () => {
  test.describe.configure({ mode: 'serial' });

  let engineerEntryId: string;
  let engineerEntryId2: string;

  test('D17: Engineer creates entry → status is PENDING', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 2, category: 'PLANNED_TASK' },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('PENDING');
    engineerEntryId = body.data.id;

    // Create a second entry for reject test
    const res2 = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 1, category: 'ADMIN' },
    });
    expect(res2.status()).toBe(201);
    const body2 = await res2.json();
    engineerEntryId2 = body2.data.id;

    await context.close();
  });

  test('D18: Manager GET /api/time-entries/monthly → 200, sees team entries', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}/monthly`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    await context.close();
  });

  test('D19: Manager approves entry', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/approve`, {
      data: { ids: [engineerEntryId] },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    await context.close();
  });

  test('D20: Verify entry is now APPROVED', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}?weekStart=${thisMonday()}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    const entries = Array.isArray(body.data) ? body.data : [];
    const approved = entries.find((e: any) => e.id === engineerEntryId);
    expect(approved).toBeDefined();
    expect(approved.status).toBe('APPROVED');

    await context.close();
  });

  test('D21: Manager rejects entry with reason', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/reject`, {
      data: { ids: [engineerEntryId2], reason: '工時不合理' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    await context.close();
  });

  test('D22: Engineer cannot approve → 403', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/approve`, {
      data: { ids: [engineerEntryId2] },
    });
    expect(res.status()).toBe(403);

    await context.close();
  });

  test('D23: Engineer cannot reject → 403', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/reject`, {
      data: { ids: [engineerEntryId2], reason: 'test' },
    });
    expect(res.status()).toBe(403);

    // Cleanup: delete both engineer entries
    const mgrCtx = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const mgrPage = await mgrCtx.newPage();
    await mgrPage.request.delete(`${BASE}/${engineerEntryId}`).catch(() => {});
    await mgrPage.request.delete(`${BASE}/${engineerEntryId2}`).catch(() => {});
    await mgrCtx.close();

    await context.close();
  });
});

// ── E. Monthly Settlement ─────────────────────────────────────────────────

test.describe('E. Monthly Settlement', () => {
  test.describe.configure({ mode: 'serial' });

  const settleMonth = '2026-03';

  test('E24: Manager settles month → 200', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/settle-month`, {
      data: { month: settleMonth },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);

    await context.close();
  });

  test('E25: Double settle same month → 409', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/settle-month`, {
      data: { month: settleMonth },
    });
    expect(res.status()).toBe(409);

    await context.close();
  });

  test('E26: GET monthly-summary returns stats', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}/monthly-summary?month=${settleMonth}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();

    await context.close();
  });
});

// ── F. Batch & Copy ───────────────────────────────────────────────────────

test.describe('F. Batch & Copy', () => {

  test('F27: Batch create multiple entries → 201', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const date1 = todayStr();
    const date2 = tomorrowStr();

    const res = await page.request.post(`${BASE}/batch`, {
      data: {
        entries: [
          { date: date1, hours: 2, category: 'PLANNED_TASK' },
          { date: date2, hours: 3, category: 'ADMIN' },
        ],
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);

    // Cleanup: delete batch-created entries
    const created = Array.isArray(body.data) ? body.data : [];
    for (const entry of created) {
      if (entry.id) {
        await page.request.delete(`${BASE}/${entry.id}`);
      }
    }

    await context.close();
  });

  test('F28: Batch with 51 entries → 400 (over limit)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const entries = Array.from({ length: 51 }, (_, i) => ({
      date: todayStr(),
      hours: 0.5,
      category: 'ADMIN',
    }));

    const res = await page.request.post(`${BASE}/batch`, {
      data: { entries },
    });
    expect(res.status()).toBe(400);

    await context.close();
  });

  test('F29: Copy week → 200 or 201', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/copy-week`, {
      data: {
        sourceWeekStart: lastMonday(),
        targetWeekStart: thisMonday(),
      },
    });

    // copy-week may return 200 or 201 depending on whether entries existed
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body.ok).toBe(true);

    // Cleanup: delete copied entries if any were created
    const created = Array.isArray(body.data) ? body.data : [];
    for (const entry of created) {
      if (entry.id) {
        await page.request.delete(`${BASE}/${entry.id}`);
      }
    }

    await context.close();
  });
});

// ── G. IDOR Protection ────────────────────────────────────────────────────

test.describe('G. IDOR Protection', () => {

  let managerEntryId: string;

  test.beforeAll(async ({ browser }) => {
    // Manager creates an entry that Engineer should not be able to access
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(BASE, {
      data: { date: todayStr(), hours: 1.5, category: 'SUPPORT' },
    });
    const body = await res.json();
    managerEntryId = body.data.id;

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup manager's entry
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    await page.request.delete(`${BASE}/${managerEntryId}`).catch(() => {});
    await context.close();
  });

  test('G30: Engineer cannot view other user entries → 403 or filtered', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    // Get manager's userId from the entry (use a fake/other userId)
    const res = await page.request.get(`${BASE}?userId=other-user-id-that-is-not-mine`);

    // Should either be 403 or return only own entries (not the other user's)
    if (res.status() === 403) {
      expect(res.status()).toBe(403);
    } else {
      expect(res.status()).toBe(200);
      const body = await res.json();
      const entries = Array.isArray(body.data) ? body.data : [];
      // Should not contain other user's entries
      const foreignEntries = entries.filter((e: any) => e.id === managerEntryId);
      expect(foreignEntries).toHaveLength(0);
    }

    await context.close();
  });

  test('G31: Engineer cannot delete manager entry → 403', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.delete(`${BASE}/${managerEntryId}`);
    expect(res.status()).toBe(403);

    await context.close();
  });

  test('G32: Engineer cannot update manager entry → 403', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.put(`${BASE}/${managerEntryId}`, {
      data: { hours: 8 },
    });
    expect(res.status()).toBe(403);

    await context.close();
  });
});

// ── H. Templates ──────────────────────────────────────────────────────────

test.describe('H. Templates', () => {
  test.describe.configure({ mode: 'serial' });

  let templateId: string;

  test('H33: Create template → 201', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/templates`, {
      data: {
        name: '日常模板',
        entries: [
          { hours: 4, category: 'PLANNED_TASK' },
          { hours: 2, category: 'ADMIN' },
        ],
      },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    templateId = body.data.id;

    await context.close();
  });

  test('H34: List templates → 200', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.get(`${BASE}/templates`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    const templates = Array.isArray(body.data) ? body.data : [];
    const found = templates.find((t: any) => t.id === templateId);
    expect(found).toBeDefined();

    await context.close();
  });

  test('H35: Apply template → 201', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    const res = await page.request.post(`${BASE}/templates/${templateId}/apply`, {
      data: { date: todayStr() },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.ok).toBe(true);

    // Cleanup: delete applied entries
    const created = Array.isArray(body.data) ? body.data : [];
    for (const entry of created) {
      if (entry.id) {
        await page.request.delete(`${BASE}/${entry.id}`);
      }
    }

    // Cleanup: delete template
    await page.request.delete(`${BASE}/templates/${templateId}`).catch(() => {});

    await context.close();
  });
});
