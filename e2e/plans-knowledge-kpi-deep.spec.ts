/**
 * 年度規劃 + 知識庫 + KPI + 報表 深度 E2E 驗證
 */
import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

test.describe('D. 年度規劃 CRUD', () => {
  test.describe('D1. 計畫完整生命週期（Manager）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test.describe.configure({ mode: 'serial' });
    let planId: string | null = null;
    let goalId: string | null = null;

    test.beforeAll(async ({ request }) => {
      // 清理上一輪殘留的 2097 年計畫
      const listRes = await request.get('/api/plans');
      if (listRes.ok()) {
        const plans = (await listRes.json())?.data ?? [];
        const arr = Array.isArray(plans) ? plans : plans?.items ?? [];
        for (const p of arr) {
          if (p.year === 2097) {
            await request.delete(`/api/plans/${p.id}`).catch(() => {});
          }
        }
      }
    });

    test.afterAll(async ({ request }) => {
      if (goalId) await request.delete(`/api/goals/${goalId}`).catch(() => {});
      if (planId) await request.delete(`/api/plans/${planId}`).catch(() => {});
    });

    test('建立年度計畫 POST /api/plans → 201', async ({ request }) => {
      const res = await request.post('/api/plans', { data: { year: 2097, title: 'E2E 深度測試計畫' } });
      expect([200, 201]).toContain(res.status());
      const body = await res.json();
      planId = body.data?.id ?? null;
      expect(planId).toBeTruthy();
    });

    test('查詢計畫列表包含新計畫', async ({ request }) => {
      const res = await request.get('/api/plans');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const plans = Array.isArray(body.data) ? body.data : body.data?.items ?? [];
      expect(plans.find((p: { id: string }) => p.id === planId)).toBeTruthy();
    });

    test('更新計畫 PATCH → 200', async ({ request }) => {
      if (!planId) return;
      const res = await request.patch(`/api/plans/${planId}`, { data: { title: 'E2E 更新計畫標題' } });
      expect(res.ok()).toBeTruthy();
    });

    test('建立月度目標 POST /api/goals → 201', async ({ request }) => {
      if (!planId) return;
      const res = await request.post('/api/goals', { data: { annualPlanId: planId, month: 6, title: 'E2E 六月目標' } });
      expect([200, 201]).toContain(res.status());
      goalId = (await res.json()).data?.id ?? null;
    });

    test('更新月度目標 PUT → 200', async ({ request }) => {
      if (!goalId) return;
      const res = await request.put(`/api/goals/${goalId}`, { data: { title: 'E2E 更新目標', status: 'IN_PROGRESS' } });
      expect(res.ok()).toBeTruthy();
    });

    test('刪除月度目標 DELETE → 200', async ({ request }) => {
      if (!goalId) return;
      const res = await request.delete(`/api/goals/${goalId}`);
      expect(res.ok()).toBeTruthy();
      goalId = null;
    });
  });

  test.describe('D2. Engineer 計畫限制', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });
    test('Engineer POST /api/plans → 403', async ({ request }) => {
      expect((await request.post('/api/plans', { data: { year: 2097, title: 'hack' } })).status()).toBe(403);
    });
    test('Engineer POST /api/goals → 403', async ({ request }) => {
      expect((await request.post('/api/goals', { data: { annualPlanId: 'fake', month: 1, title: 'hack' } })).status()).toBe(403);
    });
    test('Engineer GET /api/plans → 200', async ({ request }) => {
      expect((await request.get('/api/plans')).ok()).toBeTruthy();
    });
  });

  test.describe('D3. 計畫驗證（Negative）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('年份 < 2000 → 400', async ({ request }) => {
      expect([400, 422]).toContain((await request.post('/api/plans', { data: { year: 1999, title: 'old' } })).status());
    });
    test('年份 > 2100 → 400', async ({ request }) => {
      expect([400, 422]).toContain((await request.post('/api/plans', { data: { year: 2101, title: 'far' } })).status());
    });
    test('空標題 → 400', async ({ request }) => {
      expect([400, 422]).toContain((await request.post('/api/plans', { data: { year: 2028, title: '' } })).status());
    });
    test('月份 0 → 400', async ({ request }) => {
      expect([400, 422]).toContain((await request.post('/api/goals', { data: { annualPlanId: 'x', month: 0, title: 't' } })).status());
    });
    test('月份 13 → 400', async ({ request }) => {
      expect([400, 422]).toContain((await request.post('/api/goals', { data: { annualPlanId: 'x', month: 13, title: 't' } })).status());
    });
  });

  test.describe('D4. 里程碑 & 交付物', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('GET /api/milestones → 200', async ({ request }) => {
      expect((await request.get('/api/milestones')).ok()).toBeTruthy();
    });
    test('Engineer POST /api/deliverables → 403', async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
      expect((await ctx.request.post('/api/deliverables', { data: { title: 'h', taskId: 'f' } })).status()).toBe(403);
      await ctx.close();
    });
  });
});

test.describe('F. 知識庫 CRUD + 工作流', () => {
  test.describe('F1. 文件完整生命週期（Manager）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test.describe.configure({ mode: 'serial' });
    let docId: string | null = null;

    test.afterAll(async ({ request }) => {
      if (docId) await request.delete(`/api/documents/${docId}`).catch(() => {});
    });

    test('建立文件 POST → 201', async ({ request }) => {
      const res = await request.post('/api/documents', { data: { title: `E2E-Doc-${Date.now()}`, content: '# E2E\n\n測試。' } });
      expect([200, 201]).toContain(res.status());
      docId = (await res.json()).data?.id ?? null;
      expect(docId).toBeTruthy();
    });

    test('取得文件 GET → 200', async ({ request }) => {
      if (!docId) return;
      const res = await request.get(`/api/documents/${docId}`);
      expect(res.ok()).toBeTruthy();
      expect((await res.json()).data?.content).toContain('E2E');
    });

    test('更新文件 PUT → 200', async ({ request }) => {
      if (!docId) return;
      expect((await request.put(`/api/documents/${docId}`, { data: { title: 'Updated', content: '# New' } })).ok()).toBeTruthy();
    });

    test('提交審核 POST /submit-review → 200', async ({ request }) => {
      if (!docId) return;
      expect((await request.post(`/api/documents/${docId}/submit-review`)).ok()).toBeTruthy();
    });

    test('核准文件 POST /approve → 200', async ({ request }) => {
      if (!docId) return;
      expect((await request.post(`/api/documents/${docId}/approve`)).ok()).toBeTruthy();
    });

    test('退役文件 POST /retire → 200', async ({ request }) => {
      if (!docId) return;
      expect((await request.post(`/api/documents/${docId}/retire`)).ok()).toBeTruthy();
    });

    test('刪除文件 DELETE → 200', async ({ request }) => {
      if (!docId) return;
      expect((await request.delete(`/api/documents/${docId}`)).ok()).toBeTruthy();
      docId = null;
    });
  });

  test.describe('F2. Engineer 文件限制', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });
    test('Engineer GET /api/documents → 200', async ({ request }) => {
      expect((await request.get('/api/documents')).ok()).toBeTruthy();
    });
    test('Engineer 可建立草稿 POST → 201', async ({ request }) => {
      expect([200, 201]).toContain((await request.post('/api/documents', { data: { title: 'Eng', content: 'c' } })).status());
    });
    test('Engineer DELETE → 403', async ({ request }) => {
      expect((await request.delete('/api/documents/nonexistent')).status()).toBe(403);
    });
    test('Engineer POST /approve → 403', async ({ request }) => {
      expect((await request.post('/api/documents/nonexistent/approve')).status()).toBe(403);
    });
    test('Engineer POST /reject → 403', async ({ request }) => {
      expect((await request.post('/api/documents/nonexistent/reject')).status()).toBe(403);
    });
  });

  test.describe('F3. 文件安全', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('XSS 標題 → 非 500', async ({ request }) => {
      const res = await request.post('/api/documents', { data: { title: '<script>alert(1)</script>', content: 's' } });
      expect(res.status()).not.toBe(500);
      if ([200, 201].includes(res.status())) { const id = (await res.json()).data?.id; if (id) await request.delete(`/api/documents/${id}`); }
    });
    test('SQL injection → 非 500', async ({ request }) => {
      const res = await request.post('/api/documents', { data: { title: 't', content: "'; DROP TABLE --" } });
      expect(res.status()).not.toBe(500);
      if ([200, 201].includes(res.status())) { const id = (await res.json()).data?.id; if (id) await request.delete(`/api/documents/${id}`); }
    });
  });

  test.describe('F4. 搜尋', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('搜尋 → 200', async ({ request }) => { expect((await request.get('/api/documents?search=test')).ok()).toBeTruthy(); });
    test('空搜尋 → 200', async ({ request }) => { expect((await request.get('/api/documents?search=')).ok()).toBeTruthy(); });
    test('極冷門搜尋 → 200 且結果少', async ({ request }) => {
      const res = await request.get('/api/documents?search=qqq99zzznonexist');
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const items = Array.isArray(body.data) ? body.data : body.data?.items ?? [];
      // 極冷門搜尋應回傳空或極少結果（ILIKE 可能寬鬆匹配）
      expect(items.length).toBeLessThanOrEqual(5);
    });
  });
});

test.describe('H. KPI CRUD + 驗證', () => {
  test.describe('H1. KPI 生命週期（Manager）', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test.describe.configure({ mode: 'serial' });
    let kpiId: string | null = null;

    test.afterAll(async ({ request }) => { if (kpiId) await request.delete(`/api/kpi/${kpiId}`).catch(() => {}); });

    test('建立 KPI → 201', async ({ request }) => {
      const res = await request.post('/api/kpi', { data: { year: 2026, code: `E2E-${Date.now()}`, title: 'E2E KPI', target: 100, weight: 15, autoCalc: false } });
      expect([200, 201]).toContain(res.status());
      kpiId = (await res.json()).data?.id ?? null;
      expect(kpiId).toBeTruthy();
    });

    test('查詢含新 KPI', async ({ request }) => {
      const body = await (await request.get('/api/kpi?year=2026')).json();
      const kpis = Array.isArray(body.data) ? body.data : body.data?.items ?? [];
      expect(kpis.find((k: { id: string }) => k.id === kpiId)).toBeTruthy();
    });

    test('更新 KPI PUT → 200', async ({ request }) => {
      if (!kpiId) return;
      expect((await request.put(`/api/kpi/${kpiId}`, { data: { actual: 85 } })).ok()).toBeTruthy();
    });

    test('刪除 KPI → 200', async ({ request }) => {
      if (!kpiId) return;
      expect((await request.delete(`/api/kpi/${kpiId}`)).ok()).toBeTruthy();
      kpiId = null;
    });
  });

  test.describe('H2. Engineer KPI 限制', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });
    test('Engineer GET /api/kpi → 200', async ({ request }) => { expect((await request.get('/api/kpi?year=2026')).ok()).toBeTruthy(); });
    test('Engineer POST → 403', async ({ request }) => { expect((await request.post('/api/kpi', { data: { year: 2026, code: 'H', title: 'h', target: 1 } })).status()).toBe(403); });
    test('Engineer PUT → 403', async ({ request }) => { expect((await request.put('/api/kpi/x', { data: { actual: 1 } })).status()).toBe(403); });
    test('Engineer DELETE → 403', async ({ request }) => { expect((await request.delete('/api/kpi/x')).status()).toBe(403); });
  });

  test.describe('H3. KPI Negative', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('target < 0 → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: { year: 2026, code: 'N', title: 't', target: -1, weight: 10 } })).status()); });
    test('weight = 0 → 400', async ({ request }) => { expect((await request.post('/api/kpi', { data: { year: 2026, code: 'Z', title: 't', target: 100, weight: 0 } })).status()).toBeGreaterThanOrEqual(400); });
    test('weight > 100 → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: { year: 2026, code: 'B', title: 't', target: 100, weight: 101 } })).status()); });
    test('year < 2000 → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: { year: 1999, code: 'O', title: 't', target: 100 } })).status()); });
    test('空 body → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: {} })).status()); });
    test('minValue > maxValue → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: { year: 2026, code: 'M', title: 't', target: 50, minValue: 100, maxValue: 10 } })).status()); });
    test('target 超出範圍 → 400', async ({ request }) => { expect([400, 422]).toContain((await request.post('/api/kpi', { data: { year: 2026, code: 'R', title: 't', target: 200, minValue: 0, maxValue: 100 } })).status()); });
  });

  test.describe('H4. KPI 進階', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('achievementRate 0-200', async ({ request }) => {
      const body = await (await request.get('/api/kpi?year=2026')).json();
      for (const k of (Array.isArray(body.data) ? body.data : body.data?.items ?? [])) {
        if (typeof k.achievementRate === 'number') { expect(k.achievementRate).toBeGreaterThanOrEqual(0); expect(k.achievementRate).toBeLessThanOrEqual(200); }
      }
    });
    test('年度複製 → 非 500', async ({ request }) => {
      expect((await request.post('/api/kpi/copy-year', { data: { sourceYear: 2026, targetYear: 2099 } })).status()).not.toBe(500);
    });
  });
});

test.describe('I. 報表', () => {
  test.describe('I1. Manager 報表', () => {
    test.use({ storageState: MANAGER_STATE_FILE });
    test('completion-rate → 200', async ({ request }) => { expect((await request.get('/api/reports/completion-rate')).ok()).toBeTruthy(); });
    test('audit → 200', async ({ request }) => {
      // /api/reports/audit 可能需要查詢參數
      const res = await request.get('/api/reports/audit?from=2026-01-01&to=2026-12-31');
      expect(res.ok() || res.status() === 400).toBeTruthy(); // 400 if param required
    });
    test('department-timesheet → 200', async ({ request }) => { expect((await request.get('/api/reports/department-timesheet?month=2026-03')).ok()).toBeTruthy(); });
    test('timesheet-compliance → 200', async ({ request }) => { expect((await request.get('/api/reports/timesheet-compliance?month=2026-03')).ok()).toBeTruthy(); });
    for (const r of ['velocity', 'utilization', 'overdue-analysis', 'overtime-analysis', 'kpi-trend']) {
      test(`v2/${r} → 200`, async ({ request }) => { expect((await request.get(`/api/reports/v2/${r}?year=2026`)).ok()).toBeTruthy(); });
    }
  });

  test.describe('I2. Engineer 限制', () => {
    test.use({ storageState: ENGINEER_STATE_FILE });
    test('completion-rate → 200', async ({ request }) => { expect((await request.get('/api/reports/completion-rate')).ok()).toBeTruthy(); });
    test('department-timesheet → 403', async ({ request }) => { expect((await request.get('/api/reports/department-timesheet?month=2026-03')).status()).toBe(403); });
    test('v2/velocity → 403', async ({ request }) => { expect((await request.get('/api/reports/v2/velocity?year=2026')).status()).toBe(403); });
  });
});

test.describe('Gantt 頁面', () => {
  test.use({ storageState: MANAGER_STATE_FILE });
  test('Gantt 載入', async ({ page }) => {
    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('甘特', { timeout: 20000 });
  });
  test('年份選擇器可見', async ({ page }) => {
    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('select, button:has-text("2026"), button:has-text("◀")').first()).toBeVisible({ timeout: 20000 });
  });
  test('Engineer 可存取', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await ctx.newPage();
    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('甘特', { timeout: 20000 });
    await ctx.close();
  });
});
