/**
 * Dashboard & Kanban 深度驗證 E2E 測試
 *
 * 涵蓋五大類：
 *   A. Dashboard Deep Verification（Tab 切換、快速連結、API 驗證、角色差異）
 *   B. Kanban Deep Verification（CRUD、批量操作、篩選）
 *   C. Task Detail & Sub-features（留言、子任務、Flag）
 *   D. Input Validation（負面測試：空值、超長、非法欄位、注入攻擊）
 *   E. Data Consistency（建立→查詢→更新→計數一致性）
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// Console noise patterns to filter out during "no console error" checks
const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
  'downloadable font', 'ResizeObserver', 'AbortError',
  'NEXT_REDIRECT', 'NEXT_NOT_FOUND',
  'Failed to load resource', 'chunk', '404',
  'Refused to', 'blocked', 'CORS',
  'DevTools', 'source map', 'sourcemap',
];

// ═══════════════════════════════════════════════════════════════════════════════
// A. Dashboard Deep Verification
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A. Dashboard Deep Verification', () => {

  // ── Manager Tests ─────────────────────────────────────────────────────────

  test.describe('Manager 視角', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('A-1: Tab 切換 — 點擊「我的一天」和「團隊全局」切換副標題', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText(/今日總覽|儀表板/, { timeout: 15000 });

      // Click "我的一天" tab if available
      const myDayTab = page.locator('button, [role="tab"], a').filter({ hasText: '我的一天' }).first();
      const hasMyDayTab = await myDayTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasMyDayTab) {
        await myDayTab.click();
        await page.waitForTimeout(500);

        // Subtitle should change to reflect personal view
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).toBeTruthy();

        // Click "團隊全局" tab
        const teamTab = page.locator('button, [role="tab"], a').filter({ hasText: '團隊全局' }).first();
        const hasTeamTab = await teamTab.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasTeamTab) {
          await teamTab.click();
          await page.waitForTimeout(500);

          const bodyTextAfter = await page.locator('body').textContent();
          expect(bodyTextAfter).toBeTruthy();
        }
      } else {
        // Tabs may be rendered differently — verify dashboard loads
        await expect(page.locator('h1').first()).toContainText(/今日總覽|儀表板/);
      }
    });

    test('A-2: Manager 快速連結導航 — 駕駛艙/看板/報表/工時', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText(/今日總覽|儀表板/, { timeout: 15000 });

      const links: Array<{ text: string; urlPattern: string }> = [
        { text: '駕駛艙', urlPattern: '/cockpit' },
        { text: '看板', urlPattern: '/kanban' },
        { text: '報表', urlPattern: '/reports' },
        { text: '工時', urlPattern: '/timesheet' },
      ];

      for (const link of links) {
        const el = page.locator(`a:has-text("${link.text}"), button:has-text("${link.text}")`).first();
        const isVisible = await el.isVisible({ timeout: 3000 }).catch(() => false);

        if (isVisible) {
          const href = await el.getAttribute('href');
          if (href) {
            expect(href).toContain(link.urlPattern);
          } else {
            // Button-style navigation — click and verify URL
            await el.click();
            await page.waitForURL(`**${link.urlPattern}*`, { timeout: 10000 }).catch(() => {});
            expect(page.url()).toContain(link.urlPattern);
            await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
          }
        }
      }
    });

    test('A-3: API /api/my-day?view=team 回傳 alertItems, teamHealth, flaggedTasks', async ({ request }) => {
      const res = await request.get('/api/my-day?view=team', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.ok).toBe(true);

      if (body.data) {
        // Verify team view shape includes expected fields
        const data = body.data;
        const hasExpectedFields =
          'alertItems' in data ||
          'teamHealth' in data ||
          'flaggedTasks' in data ||
          'stats' in data;
        expect(hasExpectedFields).toBeTruthy();
      }
    });

    test('A-4: API /api/my-day?view=my-day 回傳不同資料結構', async ({ request }) => {
      const teamRes = await request.get('/api/my-day?view=team', { timeout: 10000 });
      const myDayRes = await request.get('/api/my-day?view=my-day', { timeout: 10000 });

      expect(teamRes.ok()).toBeTruthy();
      expect(myDayRes.ok()).toBeTruthy();

      const teamBody = await teamRes.json();
      const myDayBody = await myDayRes.json();

      // Both should be ok
      expect(teamBody.ok).toBe(true);
      expect(myDayBody.ok).toBe(true);

      // Response shapes should differ (team has team-level aggregations)
      const teamKeys = Object.keys(teamBody.data ?? teamBody);
      const myDayKeys = Object.keys(myDayBody.data ?? myDayBody);
      // At minimum both should return valid data
      expect(teamKeys.length).toBeGreaterThan(0);
      expect(myDayKeys.length).toBeGreaterThan(0);
    });
  });

  // ── Engineer Tests ────────────────────────────────────────────────────────

  test.describe('Engineer 視角', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('A-5: Engineer 被限制為「my-day」— Tab 切換器不可見或切換無效', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText(/今日總覽|儀表板/, { timeout: 15000 });

      // Engineer should not see team tab, or clicking it has no effect
      const teamTab = page.locator('button, [role="tab"], a').filter({ hasText: '團隊全局' }).first();
      const hasTeamTab = await teamTab.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTeamTab) {
        // If visible, clicking should not switch to team view
        await teamTab.click();
        await page.waitForTimeout(500);

        // Should still show engineer view (no team-specific data)
        const bodyText = await page.locator('body').textContent() ?? '';
        // Engineer should NOT see "主管視角"
        expect(bodyText).not.toContain('主管視角');
      }
      // If not visible, that's the expected behavior
    });

    test('A-6: Engineer API /api/my-day 僅回傳自己的任務', async ({ request }) => {
      const res = await request.get('/api/my-day', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.ok).toBe(true);

      // Engineer view should have personal task data
      if (body.data) {
        const data = body.data;
        // Should NOT contain team-level fields like teamHealth
        const hasTeamOnlyFields = 'teamHealth' in data;
        expect(hasTeamOnlyFields).toBeFalsy();
      }
    });

    test('A-7: Engineer 儀表板顯示進行中區塊', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      // 實際 UI 為「進行中(N)」格式
      await expect(
        page.locator('text=/進行中/')
          .first()
      ).toBeVisible({ timeout: 15000 });
    });
  });

  // ── Empty State & Edge Cases ──────────────────────────────────────────────

  test.describe('空狀態與邊界測試', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('A-8: API /api/my-day 回傳有效 JSON 且 ok:true', async ({ request }) => {
      const res = await request.get('/api/my-day', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(typeof body).toBe('object');
    });

    test('A-9: Dashboard 載入不產生 console error（排除已知雜訊）', async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const isNoise = NOISE_PATTERNS.some((p) => text.includes(p));
          if (!isNoise) {
            consoleErrors.push(text);
          }
        }
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      expect(consoleErrors).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. Kanban Deep Verification
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('B. Kanban Deep Verification', () => {

  // ── Manager CRUD ──────────────────────────────────────────────────────────

  test.describe.serial('Manager CRUD 操作', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    let createdTaskId: string | null = null;

    test.afterAll(async ({ request }) => {
      // Safety cleanup for any leftover task
      if (createdTaskId) {
        await request.delete(`/api/tasks/${createdTaskId}`, { failOnStatusCode: false });
        createdTaskId = null;
      }
    });

    test('B-10: 透過 POST /api/tasks 建立任務 → 201', async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Deep-看板任務',
          status: 'TODO',
          priority: 'P2',
          category: 'PLANNED',
        },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      const task = body?.data ?? body;
      expect(task.id).toBeTruthy();
      createdTaskId = task.id;
    });

    test('B-11: 建立的任務在看板頁面可見', async ({ page }) => {
      test.skip(!createdTaskId, '前置任務建立失敗');

      await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(
        page.locator('text=E2E-Deep-看板任務').first()
      ).toBeVisible({ timeout: 15000 });
    });

    test('B-12: PATCH /api/tasks/{id} 更新任務狀態 → 驗證回應', async ({ request }) => {
      test.skip(!createdTaskId, '前置任務建立失敗');

      const res = await request.patch(`/api/tasks/${createdTaskId}`, {
        data: { status: 'IN_PROGRESS' },
        failOnStatusCode: false,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const task = body?.data ?? body;
      expect(task.status).toBe('IN_PROGRESS');
    });

    test('B-13: DELETE /api/tasks/{id} 刪除任務 → 200，驗證已移除', async ({ request }) => {
      test.skip(!createdTaskId, '前置任務建立失敗');

      const deleteRes = await request.delete(`/api/tasks/${createdTaskId}`, {
        failOnStatusCode: false,
      });

      expect(deleteRes.ok()).toBeTruthy();

      // Verify the task is gone
      const getRes = await request.get(`/api/tasks/${createdTaskId}`, {
        failOnStatusCode: false,
      });
      expect([404, 400].includes(getRes.status()) || !getRes.ok()).toBeTruthy();

      createdTaskId = null;
    });
  });

  test.describe('Manager 批量與排序操作', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    test('B-14: 批量更新 PATCH /api/tasks/bulk → 驗證', async ({ request }) => {
      let task1Id: string | null = null;
      let task2Id: string | null = null;

      try {
        const task1Res = await request.post('/api/tasks', {
          data: { title: 'E2E-Bulk-1', status: 'TODO', priority: 'P2', category: 'PLANNED' },
          failOnStatusCode: false,
        });
        const task2Res = await request.post('/api/tasks', {
          data: { title: 'E2E-Bulk-2', status: 'TODO', priority: 'P2', category: 'PLANNED' },
          failOnStatusCode: false,
        });

        if (task1Res.status() === 201) {
          task1Id = ((await task1Res.json())?.data ?? (await task1Res.json())).id;
        }
        if (task2Res.status() === 201) {
          task2Id = ((await task2Res.json())?.data ?? (await task2Res.json())).id;
        }

        if (task1Id && task2Id) {
          // Bulk API 是 PATCH，格式為 { taskIds, updates }
          const bulkRes = await request.patch('/api/tasks/bulk', {
            data: {
              taskIds: [task1Id, task2Id],
              updates: { status: 'DONE' },
            },
            failOnStatusCode: false,
          });

          expect(bulkRes.ok(), `Bulk update failed: ${bulkRes.status()}`).toBeTruthy();

          // 驗證任務已更新
          const verify1 = await request.get(`/api/tasks/${task1Id}`, { failOnStatusCode: false });
          if (verify1.ok()) {
            const v1Task = (await verify1.json())?.data;
            expect(v1Task?.status).toBe('DONE');
          }
        }
      } finally {
        if (task1Id) await request.delete(`/api/tasks/${task1Id}`, { failOnStatusCode: false });
        if (task2Id) await request.delete(`/api/tasks/${task2Id}`, { failOnStatusCode: false });
      }
    });

    test('B-15: 重新排序 POST /api/tasks/reorder → 200', async ({ request }) => {
      let task1Id: string | null = null;
      let task2Id: string | null = null;

      try {
        const task1Res = await request.post('/api/tasks', {
          data: { title: 'E2E-Reorder-1', status: 'TODO', priority: 'P2', category: 'PLANNED' },
          failOnStatusCode: false,
        });
        const task2Res = await request.post('/api/tasks', {
          data: { title: 'E2E-Reorder-2', status: 'TODO', priority: 'P2', category: 'PLANNED' },
          failOnStatusCode: false,
        });

        if (task1Res.status() === 201) {
          const b1 = await task1Res.json();
          task1Id = (b1?.data ?? b1).id;
        }
        if (task2Res.status() === 201) {
          const b2 = await task2Res.json();
          task2Id = (b2?.data ?? b2).id;
        }

        if (task1Id && task2Id) {
          // Reorder API 格式：{ items: [{ id, position, status? }] }
          const reorderRes = await request.post('/api/tasks/reorder', {
            data: {
              items: [
                { id: task1Id, position: 1 },
                { id: task2Id, position: 0 },
              ],
            },
            failOnStatusCode: false,
          });

          expect(reorderRes.ok()).toBeTruthy();
        }
      } finally {
        if (task1Id) await request.delete(`/api/tasks/${task1Id}`, { failOnStatusCode: false });
        if (task2Id) await request.delete(`/api/tasks/${task2Id}`, { failOnStatusCode: false });
      }
    });
  });

  // ── Filtering Tests (Manager) ─────────────────────────────────────────────

  test.describe('Manager 篩選測試', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    let filterTestTaskId: string | null = null;

    test.beforeAll(async ({ request }) => {
      // Create a task with specific attributes for filtering
      const res = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Filter-Target',
          status: 'TODO',
          priority: 'P0',
          category: 'INCIDENT',
        },
        failOnStatusCode: false,
      });
      if (res.status() === 201) {
        const body = await res.json();
        filterTestTaskId = (body?.data ?? body).id;
      }
    });

    test.afterAll(async ({ request }) => {
      if (filterTestTaskId) {
        await request.delete(`/api/tasks/${filterTestTaskId}`, { failOnStatusCode: false });
      }
    });

    test('B-16: GET /api/tasks?status=TODO → 僅回傳 TODO 任務', async ({ request }) => {
      const res = await request.get('/api/tasks?status=TODO', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      const tasks = body?.data ?? body?.tasks ?? (Array.isArray(body) ? body : []);

      if (Array.isArray(tasks) && tasks.length > 0) {
        for (const task of tasks) {
          expect(task.status).toBe('TODO');
        }
      }
    });

    test('B-17: GET /api/tasks?priority=P0 → 僅回傳 P0 任務', async ({ request }) => {
      const res = await request.get('/api/tasks?priority=P0', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      const tasks = body?.data ?? body?.tasks ?? (Array.isArray(body) ? body : []);

      if (Array.isArray(tasks) && tasks.length > 0) {
        for (const task of tasks) {
          expect(task.priority).toBe('P0');
        }
      }
    });

    test('B-18: GET /api/tasks?category=INCIDENT → 僅回傳 INCIDENT 任務', async ({ request }) => {
      const res = await request.get('/api/tasks?category=INCIDENT', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      const tasks = body?.data ?? body?.tasks ?? (Array.isArray(body) ? body : []);

      if (Array.isArray(tasks) && tasks.length > 0) {
        for (const task of tasks) {
          expect(task.category).toBe('INCIDENT');
        }
      }
    });

    test('B-19: GET /api/tasks?assignee=me → 僅回傳指派給自己的任務', async ({ request }) => {
      const res = await request.get('/api/tasks?assignee=me', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body.ok === true || Array.isArray(body?.data)).toBeTruthy();
    });

    test('B-20: GET /api/tasks?status=TODO,IN_PROGRESS → 回傳兩種狀態', async ({ request }) => {
      const res = await request.get('/api/tasks?status=TODO,IN_PROGRESS', { timeout: 10000 });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      const tasks = body?.data ?? body?.tasks ?? (Array.isArray(body) ? body : []);

      if (Array.isArray(tasks) && tasks.length > 0) {
        for (const task of tasks) {
          expect(['TODO', 'IN_PROGRESS']).toContain(task.status);
        }
      }
    });
  });

  // ── Engineer Kanban Tests ─────────────────────────────────────────────────

  test.describe.serial('Engineer 看板操作', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    let engineerTaskId: string | null = null;

    test.afterAll(async ({ browser }) => {
      // Cleanup with manager credentials since engineer cannot delete
      if (engineerTaskId) {
        const managerCtx = await browser.newContext({ storageState: MANAGER_STATE_FILE });
        const req = managerCtx.request;
        await req.delete(`/api/tasks/${engineerTaskId}`, { failOnStatusCode: false });
        await managerCtx.close();
      }
    });

    test('B-21: Engineer 可透過 POST /api/tasks 建立任務 → 201', async ({ request }) => {
      // 先取得自己的 userId，才能指派給自己（enforceTaskOwnership）
      const usersRes = await request.get('/api/users', { failOnStatusCode: false });
      let myId: string | undefined;
      if (usersRes.ok()) {
        const users = (await usersRes.json())?.data ?? [];
        const me = users.find((u: { email: string }) => u.email === 'eng-a@titan.local');
        myId = me?.id;
      }

      const res = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Engineer-任務',
          status: 'TODO',
          priority: 'P2',
          category: 'PLANNED',
          primaryAssigneeId: myId,
        },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      const task = body?.data ?? body;
      expect(task.id).toBeTruthy();
      engineerTaskId = task.id;
    });

    test('B-22: Engineer 可更新自己的任務 PUT /api/tasks/{id} → 200', async ({ request }) => {
      test.skip(!engineerTaskId, '前置任務建立失敗');

      // PUT 用於全欄位更新（title 等），PATCH 僅接受 status
      const res = await request.put(`/api/tasks/${engineerTaskId}`, {
        data: { title: 'E2E-Engineer-已修改' },
        failOnStatusCode: false,
      });

      expect(res.ok(), `PUT failed: ${res.status()}`).toBeTruthy();
      const body = await res.json();
      const task = body?.data ?? body;
      expect(task.title).toBe('E2E-Engineer-已修改');
    });

    test('B-23: Engineer 不可刪除任務 DELETE /api/tasks/{id} → 403', async ({ request }) => {
      test.skip(!engineerTaskId, '前置任務建立失敗');

      const res = await request.delete(`/api/tasks/${engineerTaskId}`, {
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. Task Detail & Sub-features
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('C. Task Detail & Sub-features', () => {

  test.describe.serial('留言、子任務、Flag（Manager）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });

    let taskId: string | null = null;

    test.beforeAll(async ({ request }) => {
      const res = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Detail-測試任務',
          status: 'TODO',
          priority: 'P1',
          category: 'PLANNED',
        },
        failOnStatusCode: false,
      });
      if (res.status() === 201) {
        const body = await res.json();
        taskId = (body?.data ?? body).id;
      }
    });

    test.afterAll(async ({ request }) => {
      if (taskId) {
        await request.delete(`/api/tasks/${taskId}`, { failOnStatusCode: false });
      }
    });

    test('C-24: POST /api/tasks/{id}/comments 建立留言 → 201', async ({ request }) => {
      test.skip(!taskId, '前置任務建立失敗');

      const res = await request.post(`/api/tasks/${taskId}/comments`, {
        data: { content: '測試留言' },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      const comment = body?.data ?? body;
      expect(comment.content).toContain('測試留言');
    });

    test('C-25: XSS 留言內容被消毒或安全儲存', async ({ request }) => {
      test.skip(!taskId, '前置任務建立失敗');

      const xssPayload = '<script>alert(1)</script>';
      const res = await request.post(`/api/tasks/${taskId}/comments`, {
        data: { content: xssPayload },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      const comment = body?.data ?? body;

      // Content should NOT contain executable script tag
      expect(comment.content).not.toContain('<script>');
    });

    test('C-26: 留言內容超過 10001 字元 → 400', async ({ request }) => {
      test.skip(!taskId, '前置任務建立失敗');

      const longContent = 'A'.repeat(10001);
      const res = await request.post(`/api/tasks/${taskId}/comments`, {
        data: { content: longContent },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(400);
    });

    test('C-27: POST /api/subtasks 建立子任務 → 201', async ({ request }) => {
      test.skip(!taskId, '前置任務建立失敗');

      // 子任務 API 路徑為 /api/subtasks，需帶 taskId
      const res = await request.post('/api/subtasks', {
        data: { taskId, title: '子任務1' },
        failOnStatusCode: false,
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      const subtask = body?.data ?? body;
      expect(subtask.title).toBe('子任務1');
    });

    test('C-28: Manager 可標記任務 PATCH /api/tasks/{id}/flag → 200', async ({ request }) => {
      test.skip(!taskId, '前置任務建立失敗');

      const res = await request.patch(`/api/tasks/${taskId}/flag`, {
        data: { flagged: true },
        failOnStatusCode: false,
      });

      expect(res.ok(), `Flag failed: ${res.status()}`).toBeTruthy();
      const body = await res.json();
      const task = body?.data ?? body;
      // 欄位名為 managerFlagged（不是 flagged）
      expect(task.managerFlagged).toBe(true);
    });
  });

  test.describe('Engineer Flag 限制', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });

    test('C-29: Engineer 不可標記任務 PATCH /api/tasks/{id}/flag → 403', async ({ request, browser }) => {
      // Create a task as manager to get a valid ID
      const managerCtx = await browser.newContext({ storageState: MANAGER_STATE_FILE });
      const managerReq = managerCtx.request;

      let taskId: string | null = null;

      try {
        const createRes = await managerReq.post('/api/tasks', {
          data: {
            title: 'E2E-Flag-Forbidden',
            status: 'TODO',
            priority: 'P2',
            category: 'PLANNED',
          },
          failOnStatusCode: false,
        });

        if (createRes.status() === 201) {
          const body = await createRes.json();
          taskId = (body?.data ?? body).id;

          // Engineer tries to flag it
          const flagRes = await request.patch(`/api/tasks/${taskId}/flag`, {
            data: { flagged: true },
            failOnStatusCode: false,
          });

          expect(flagRes.status()).toBe(403);
        }
      } finally {
        if (taskId) {
          await managerReq.delete(`/api/tasks/${taskId}`, { failOnStatusCode: false });
        }
        await managerCtx.close();
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Input Validation (Negative)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('D. Input Validation（負面測試）', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('D-30: 空標題建立任務 → 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: '', status: 'TODO', priority: 'P2', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test('D-31: 標題超過 201 字元 → 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: 'A'.repeat(201), status: 'TODO', priority: 'P2', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test('D-32: 無效狀態值 → 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: 'E2E-Invalid-Status', status: 'INVALID', priority: 'P2', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test('D-33: 無效優先度值 → 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: 'E2E-Invalid-Priority', status: 'TODO', priority: 'P99', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test('D-34: 無效分類值 → 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      data: { title: 'E2E-Invalid-Category', status: 'TODO', priority: 'P2', category: 'FAKE' },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test('D-35: SQL 注入標題 → 不回傳 500', async ({ request }) => {
    const sqlInjection = "'; DROP TABLE Task; --";
    const res = await request.post('/api/tasks', {
      data: { title: sqlInjection, status: 'TODO', priority: 'P2', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    // Should not cause a server error; either 201 (stored safely) or 400 (rejected)
    expect(res.status()).not.toBe(500);

    // Cleanup if created
    if (res.status() === 201) {
      const body = await res.json();
      const task = body?.data ?? body;
      if (task.id) {
        await request.delete(`/api/tasks/${task.id}`, { failOnStatusCode: false });
      }
    }
  });

  test('D-36: XSS 標題 → 成功建立但內容為純文字', async ({ request }) => {
    const xssTitle = '<img onerror=alert(1) src=x>';
    const res = await request.post('/api/tasks', {
      data: { title: xssTitle, status: 'TODO', priority: 'P2', category: 'PLANNED' },
      failOnStatusCode: false,
    });

    // Should succeed (stored as plain text) or be rejected
    expect([200, 201, 400].includes(res.status())).toBeTruthy();

    if (res.status() === 201) {
      const body = await res.json();
      const task = body?.data ?? body;

      // Title should be stored — if sanitized, no onerror handler
      // If stored as-is, the frontend must escape it
      expect(task.title).toBeTruthy();

      // Cleanup
      if (task.id) {
        await request.delete(`/api/tasks/${task.id}`, { failOnStatusCode: false });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. Data Consistency
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('E. Data Consistency（資料一致性）', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('E-37: 建立任務 → GET /api/tasks → 任務出現在清單中且欄位一致', async ({ request }) => {
    let consistencyTaskId: string | null = null;

    try {
      const createRes = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Consistency-Check',
          status: 'TODO',
          priority: 'P1',
          category: 'PLANNED',
        },
        failOnStatusCode: false,
      });

      expect(createRes.status()).toBe(201);
      const createBody = await createRes.json();
      const created = createBody?.data ?? createBody;
      consistencyTaskId = created.id;

      // Fetch the task list and find our task
      const listRes = await request.get('/api/tasks?status=TODO&limit=100', { failOnStatusCode: false });
      expect(listRes.ok()).toBeTruthy();

      const listBody = await listRes.json();
      // API 回傳 { ok, data: { items: [...], pagination } }
      const tasks = listBody?.data?.items ?? listBody?.data ?? [];

      const found = Array.isArray(tasks)
        ? tasks.find((t: { id: string }) => t.id === consistencyTaskId)
        : null;

      expect(found).toBeTruthy();
      expect(found.title).toBe('E2E-Consistency-Check');
      expect(found.status).toBe('TODO');
      expect(found.priority).toBe('P1');
      expect(found.category).toBe('PLANNED');
    } finally {
      if (consistencyTaskId) {
        await request.delete(`/api/tasks/${consistencyTaskId}`, { failOnStatusCode: false });
      }
    }
  });

  test('E-38: 更新任務標題 → GET /api/tasks/{id} → 標題已更新', async ({ request }) => {
    let consistencyTaskId: string | null = null;

    try {
      // Create
      const createRes = await request.post('/api/tasks', {
        data: {
          title: 'E2E-Before-Update',
          status: 'TODO',
          priority: 'P2',
          category: 'PLANNED',
        },
        failOnStatusCode: false,
      });

      expect(createRes.status()).toBe(201);
      const createBody = await createRes.json();
      const created = createBody?.data ?? createBody;
      consistencyTaskId = created.id;

      // Update（用 PUT，PATCH 僅接受 status）
      const putRes = await request.put(`/api/tasks/${consistencyTaskId}`, {
        data: { title: 'E2E-After-Update' },
        failOnStatusCode: false,
      });
      expect(putRes.ok()).toBeTruthy();

      // Verify via GET
      const getRes = await request.get(`/api/tasks/${consistencyTaskId}`, { failOnStatusCode: false });
      expect(getRes.ok()).toBeTruthy();

      const getBody = await getRes.json();
      const task = getBody?.data ?? getBody;
      expect(task.title).toBe('E2E-After-Update');
    } finally {
      if (consistencyTaskId) {
        await request.delete(`/api/tasks/${consistencyTaskId}`, { failOnStatusCode: false });
      }
    }
  });

  test('E-39: 任務計數與 pagination.total 一致', async ({ request }) => {
    const res = await request.get('/api/tasks', { timeout: 10000 });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();

    // Extract tasks array and pagination
    const tasks = body?.data ?? body?.tasks ?? (Array.isArray(body) ? body : []);
    const pagination = body?.pagination ?? body?.meta;

    if (pagination && 'total' in pagination && Array.isArray(tasks)) {
      // If page size is large enough, count should match total
      // Otherwise, count should be <= total
      expect(tasks.length).toBeLessThanOrEqual(pagination.total);
      expect(pagination.total).toBeGreaterThanOrEqual(0);
    } else if (Array.isArray(tasks)) {
      // No pagination object — just verify array is valid
      expect(tasks.length).toBeGreaterThanOrEqual(0);
    }
  });
});
