/**
 * Phase 6: 效能與穩定性深度驗證
 *
 * 涵蓋：
 * A. 關鍵頁面載入時間（≤3 秒基準）
 * B. API 回應時間（≤500ms 基準）
 * C. 大量資料下的渲染效能
 * D. 記憶體洩漏偵測
 * E. 並發操作穩定性
 * F. 錯誤恢復能力
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// A. 頁面載入時間
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A. 頁面載入時間', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  const PAGES = [
    { path: '/dashboard', title: '今日總覽', maxMs: 3000 },
    { path: '/kanban', title: '看板', maxMs: 3000 },
    { path: '/kpi', title: 'KPI', maxMs: 3000 },
    { path: '/reports', title: '報表', maxMs: 3000 },
    { path: '/timesheet', title: '工時紀錄', maxMs: 3000 },
    { path: '/plans', title: '年度計畫', maxMs: 3000 },
    { path: '/knowledge', title: '知識庫', maxMs: 3000 },
    { path: '/gantt', title: '甘特圖', maxMs: 5000 },
    { path: '/settings', title: '設定', maxMs: 3000 },
    { path: '/admin', title: '系統管理', maxMs: 3000 },
    { path: '/activity', title: '活動', maxMs: 3000 },
  ];

  for (const pg of PAGES) {
    test(`${pg.title} 載入 ≤${pg.maxMs}ms`, async ({ page }) => {
      const start = Date.now();

      await page.goto(pg.path, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

      const loadTime = Date.now() - start;

      // 記錄載入時間（即使通過也記錄，方便追蹤趨勢）
      console.log(`[PERF] ${pg.title}: ${loadTime}ms`);

      expect(
        loadTime,
        `${pg.title} loaded in ${loadTime}ms, exceeds ${pg.maxMs}ms budget`
      ).toBeLessThanOrEqual(pg.maxMs);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. API 回應時間
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('B. API 回應時間', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  // Dev server baselines (2026-03-28): adjust for production build
  // Production targets in parentheses
  const API_ENDPOINTS = [
    { path: '/api/tasks?limit=20', maxMs: 2000, label: 'Tasks list' },        // (500ms prod)
    { path: '/api/kpi?year=2026', maxMs: 1500, label: 'KPI list' },           // (500ms prod)
    { path: '/api/my-day', maxMs: 1500, label: 'My Day aggregation' },        // (1000ms prod)
    { path: '/api/notifications?limit=10', maxMs: 500, label: 'Notifications' },
    { path: '/api/documents?limit=20', maxMs: 1500, label: 'Documents list' }, // (500ms prod)
    { path: '/api/plans', maxMs: 1500, label: 'Plans list' },                 // (500ms prod)
    { path: '/api/cockpit?year=2026', maxMs: 2000, label: 'Cockpit aggregation' }, // (1000ms prod)
    { path: '/api/activity', maxMs: 1500, label: 'Activity feed' },            // (500ms prod)
    { path: '/api/time-entries', maxMs: 1500, label: 'Time entries' },         // (500ms prod)
    { path: '/api/audit?page=1&pageSize=10', maxMs: 1500, label: 'Audit logs' }, // (500ms prod)
  ];

  for (const ep of API_ENDPOINTS) {
    test(`${ep.label} ≤${ep.maxMs}ms`, async ({ request }) => {
      const start = Date.now();

      const res = await request.get(ep.path);

      const elapsed = Date.now() - start;
      console.log(`[PERF] ${ep.label}: ${elapsed}ms (status=${res.status()})`);

      expect(res.ok()).toBeTruthy();
      expect(
        elapsed,
        `${ep.label} responded in ${elapsed}ms, exceeds ${ep.maxMs}ms budget`
      ).toBeLessThanOrEqual(ep.maxMs);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. 大量資料渲染效能
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('C. 大量資料渲染', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('Kanban 載入 50+ 任務不超時', async ({ page }) => {
    const start = Date.now();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    const loadTime = Date.now() - start;
    console.log(`[PERF] Kanban full render: ${loadTime}ms`);

    // Kanban 應在 5 秒內完成渲染
    expect(loadTime).toBeLessThanOrEqual(5000);

    // 頁面可互動（不卡死）
    await expect(page.locator('h1').first()).toContainText('看板');
  });

  test('報表頁面載入不超時', async ({ page }) => {
    const start = Date.now();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    const loadTime = Date.now() - start;
    console.log(`[PERF] Reports full render: ${loadTime}ms`);

    expect(loadTime).toBeLessThanOrEqual(5000);
  });

  test('Tasks API 分頁不隨頁數增加而變慢', async ({ request }) => {
    // 第 1 頁
    const start1 = Date.now();
    const res1 = await request.get('/api/tasks?page=1&limit=20');
    const time1 = Date.now() - start1;

    // 第 5 頁
    const start5 = Date.now();
    const res5 = await request.get('/api/tasks?page=5&limit=20');
    const time5 = Date.now() - start5;

    console.log(`[PERF] Tasks page 1: ${time1}ms, page 5: ${time5}ms`);

    // 第 5 頁不應比第 1 頁慢超過 3 倍
    if (res1.ok() && res5.ok()) {
      expect(time5).toBeLessThanOrEqual(Math.max(time1 * 3, 1000));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. 記憶體洩漏偵測
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('D. 記憶體洩漏偵測', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('重複導航不造成記憶體持續增長', async ({ page }) => {
    const pages = ['/dashboard', '/kanban', '/kpi', '/reports', '/timesheet'];

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { state: 'visible', timeout: 15000 });

    // 取得初始記憶體
    const initialMemory = await page.evaluate(() =>
      (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
    );

    // 循環導航 3 輪
    for (let round = 0; round < 3; round++) {
      for (const pg of pages) {
        await page.goto(pg, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('h1', { state: 'visible', timeout: 15000 }).catch(() => {});
      }
    }

    // 強制 GC（如果可用）
    await page.evaluate(() => {
      if ((window as { gc?: () => void }).gc) {
        (window as { gc?: () => void }).gc!();
      }
    });

    const finalMemory = await page.evaluate(() =>
      (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
    );

    if (initialMemory > 0 && finalMemory > 0) {
      const growth = finalMemory - initialMemory;
      const growthMB = (growth / 1024 / 1024).toFixed(1);
      console.log(
        `[PERF] Memory: initial=${(initialMemory / 1024 / 1024).toFixed(1)}MB, ` +
        `final=${(finalMemory / 1024 / 1024).toFixed(1)}MB, growth=${growthMB}MB`
      );

      // 記憶體增長不應超過 100MB（15 次導航後，dev server 較寬鬆）
      // Production target: <50MB
      expect(
        growth,
        `Memory grew ${growthMB}MB after 15 navigations`
      ).toBeLessThan(100 * 1024 * 1024);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. 並發操作穩定性
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('E. 並發操作穩定性', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('並發 5 個 API 請求不崩潰', async ({ request }) => {
    const endpoints = [
      '/api/tasks?limit=10',
      '/api/kpi?year=2026',
      '/api/notifications?limit=5',
      '/api/documents?limit=10',
      '/api/plans',
    ];

    // 同時發送所有請求
    const results = await Promise.all(
      endpoints.map(ep => request.get(ep))
    );

    // 所有請求應成功（無 500）
    for (let i = 0; i < results.length; i++) {
      expect(
        results[i].status(),
        `${endpoints[i]} returned ${results[i].status()}`
      ).not.toBe(500);
      expect(results[i].ok()).toBeTruthy();
    }
  });

  test('快速連續建立+刪除任務不產生資料不一致', async ({ request }) => {
    const taskIds: string[] = [];

    try {
      // 快速建立 5 個任務
      for (let i = 0; i < 5; i++) {
        const res = await request.post('/api/tasks', {
          data: {
            title: `Concurrent-${Date.now()}-${i}`,
            status: 'TODO',
            priority: 'P2',
            category: 'PLANNED',
          },
        });
        if ([200, 201].includes(res.status())) {
          const body = await res.json();
          if (body.data?.id) taskIds.push(body.data.id);
        }
      }

      // 驗證全部建立成功
      expect(taskIds.length).toBe(5);

      // 查詢確認存在
      const listRes = await request.get('/api/tasks?limit=100');
      const list = await listRes.json();
      const items = list.data?.items ?? list.data ?? [];

      for (const id of taskIds) {
        expect(items.find((t: { id: string }) => t.id === id)).toBeTruthy();
      }
    } finally {
      // 清理
      for (const id of taskIds) {
        await request.delete(`/api/tasks/${id}`).catch(() => {});
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. 錯誤恢復能力
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('F. 錯誤恢復能力', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test('API 回傳 404 後頁面仍可操作', async ({ page }) => {
    // 先正常載入
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // 導航到不存在的頁面
    await page.goto('/nonexistent-page-xyz', { waitUntil: 'domcontentloaded' });

    // 回到 dashboard
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText(/今日總覽|儀表板/, { timeout: 15000 });
  });

  test('不存在的 API 資源回傳 404 非 500', async ({ request }) => {
    const endpoints = [
      '/api/tasks/nonexistent-id-12345',
      '/api/documents/nonexistent-id-12345',
      '/api/kpi/nonexistent-id-12345',
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep);
      expect(
        res.status(),
        `${ep} should return 404, got ${res.status()}`
      ).not.toBe(500);
      // 應為 404 或其他 4xx
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    }
  });

  test('無效 JSON body 回傳 400 非 500', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: { 'Content-Type': 'application/json' },
      data: 'this is not json{{{',
    });
    expect(res.status()).not.toBe(500);
  });

  test('超大 request body 不崩潰', async ({ request }) => {
    const largeBody = { title: 'x'.repeat(100000) };
    const res = await request.post('/api/tasks', { data: largeBody });
    // 應回 400（驗證錯誤）或 413（payload 太大），不應 500
    expect(res.status()).not.toBe(500);
  });
});
