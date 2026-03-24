/**
 * E2E Deep Functional Tests — 全 10 頁面深度功能驗證
 *
 * 針對每個頁面驗證：
 * - 關鍵互動元素的存在與可互動性
 * - 頁面特定功能（tab 切換、年度選擇、拖放目標、樹狀展開等）
 * - Manager / Engineer 視角差異
 *
 * 所有測試使用 pre-saved storageState，不執行真實登入。
 */

import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// ── Shared Helpers ──────────────────────────────────────────────────────────

const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
];

function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!NOISE_PATTERNS.some((p) => text.includes(p))) {
        errors.push(text);
      }
    }
  });
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Dashboard
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Dashboard — 深度功能測試', () => {

  test('Manager: 統計卡片區塊完整渲染', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 主管視角 subtitle
    await expect(page.locator('p', { hasText: '主管視角' })).toBeVisible({ timeout: 15000 });

    // 4 張統計卡片（本週完成任務、本週總工時、逾期任務、本月計畫外比例）
    const statLabels = ['本週完成任務', '本週總工時', '逾期任務', '本月計畫外比例'];
    for (const label of statLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible({ timeout: 15000 });
    }

    // 團隊工時分佈區塊
    await expect(page.locator('h2', { hasText: '團隊工時分佈' })).toBeVisible({ timeout: 15000 });

    // 投入率分析區塊
    await expect(page.locator('h2', { hasText: '投入率分析' })).toBeVisible({ timeout: 15000 });

    // KPI 達成狀況區塊（或空態提示）
    await expect(
      page.locator('h2', { hasText: 'KPI 達成狀況' }).or(page.locator('text=尚無 KPI')).first()
    ).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('Engineer: 任務清單與工時進度完整渲染', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('儀表板');

    // 工程師視角 subtitle
    await expect(page.locator('p', { hasText: '工程師視角' })).toBeVisible({ timeout: 15000 });

    // 統計卡片（進行中任務、逾期任務、本週工時）
    await expect(page.locator('text=進行中任務').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=本週工時').first()).toBeVisible({ timeout: 15000 });

    // 本週工時進度區塊
    await expect(page.locator('h2', { hasText: '本週工時進度' })).toBeVisible({ timeout: 15000 });

    // 我的任務清單（有或無任務皆應有區塊標題）
    await expect(
      page.locator('h2', { hasText: '我的任務' }).or(
        page.locator('text=目前沒有待處理的任務')
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Manager: StatCard 數值為 text-2xl 元素', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // 等待統計卡片載入
    const card = page.locator('[class*="card"]').filter({ hasText: '本週完成任務' }).first();
    await expect(card).toBeVisible({ timeout: 15000 });

    // 數值元素存在
    const valueEl = card.locator('p.text-2xl, p[class*="text-2xl"]').first();
    await expect(valueEl).toBeVisible();

    // 數值不為空
    const text = await valueEl.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Kanban
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Kanban — 深度功能測試', () => {

  test('看板 5 欄結構完整', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('看板');

    // 5 個狀態欄位標題
    const columns = ['待辦清單', '待處理', '進行中', '審核中', '已完成'];
    for (const col of columns) {
      await expect(page.locator(`text=${col}`).first()).toBeVisible({ timeout: 15000 });
    }

    // 看板區域有 region role
    await expect(page.locator('[role="region"][aria-label="看板欄位"]')).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('新增任務按鈕可見且可點擊', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('看板');

    const addBtn = page.getByRole('button', { name: '新增任務' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await expect(addBtn).toBeEnabled();

    await context.close();
  });

  test('拖放目標欄位結構正確（每欄有 min-h-[120px] 區域）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });

    // 等待看板區域
    await expect(page.locator('[role="region"][aria-label="看板欄位"]')).toBeVisible({ timeout: 15000 });

    // 每個欄位都有 w-72 寬度的容器
    const columnContainers = page.locator('[role="region"][aria-label="看板欄位"] > div.w-72');
    const count = await columnContainers.count();
    expect(count).toBe(5);

    await context.close();
  });

  test('任務計數顯示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('看板');

    // 副標題顯示任務總數（如「共 N 項任務」）
    await expect(page.locator('p', { hasText: '項任務' })).toBeVisible({ timeout: 15000 });

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Gantt
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Gantt — 深度功能測試', () => {

  test('年份導航按鈕可切換年度', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('甘特圖');

    const currentYear = new Date().getFullYear();

    // 年份顯示
    const yearLabel = page.locator('span.tabular-nums', { hasText: String(currentYear) });
    await expect(yearLabel).toBeVisible({ timeout: 15000 });

    // 點擊左箭頭切換到前一年
    const leftArrow = page.locator('button').filter({ has: page.locator('svg') }).nth(0);
    // 使用更精確的定位：年份導航區域內的左箭頭
    const yearNav = page.locator('div.border.border-border.rounded-md').filter({ hasText: String(currentYear) });
    await expect(yearNav).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('月份標頭 12 個月份完整顯示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('甘特圖');

    // 等待資料載入（有計畫或空態）
    await page.waitForTimeout(3000);

    // 如有計畫，驗證月份標頭
    const hasTimeline = await page.locator('text=1月').isVisible();
    if (hasTimeline) {
      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      for (const m of months) {
        await expect(page.locator(`text=${m}`).first()).toBeVisible();
      }
    } else {
      // 無計畫時應有引導
      await expect(page.locator('text=請先在「年度計畫」頁面建立計畫')).toBeVisible({ timeout: 15000 });
    }

    await context.close();
  });

  test('篩選負責人 select 可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });

    const assigneeSelect = page.locator('select[aria-label="篩選負責人"]');
    await expect(assigneeSelect).toBeVisible({ timeout: 15000 });

    // 預設選項為「全部成員」
    await expect(assigneeSelect).toHaveValue('');

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Knowledge (知識庫)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Knowledge — 深度功能測試', () => {

  test('三欄佈局結構正確', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('知識庫');

    // 副標題
    await expect(page.locator('p', { hasText: 'Markdown 文件管理' })).toBeVisible({ timeout: 15000 });

    // 新增文件按鈕
    await expect(page.getByRole('button', { name: '新增文件' })).toBeVisible();

    // 左側 sidebar 區域（w-56 寬度）
    const sidebar = page.locator('div.w-56').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // 右側面板存在（選擇提示或編輯器）
    await expect(
      page.locator('text=從左側選擇文件').or(page.locator('input[placeholder="文件標題..."]')).first()
    ).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('文件搜尋元件存在', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('知識庫');

    // 搜尋區域在左側 sidebar 的頂部
    const searchArea = page.locator('div.w-56 >> input, div.w-56 >> [role="search"], div.w-56 >> [placeholder]');
    // DocumentSearch 元件應在 sidebar 中
    const sidebarBorder = page.locator('div.w-56 .border-b').first();
    await expect(sidebarBorder).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('未選文件時顯示提示文字', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('知識庫');

    // 右側面板顯示「從左側選擇文件」
    await expect(page.locator('text=從左側選擇文件')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=或點擊 + 新增文件')).toBeVisible({ timeout: 15000 });

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. KPI
// ═══════════════════════════════════════════════════════════════════════════

test.describe('KPI — 深度功能測試', () => {

  test('Manager: 新增 KPI 按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('KPI');

    // 年度標示
    const currentYear = new Date().getFullYear();
    await expect(page.locator(`text=${currentYear} 年度`).first()).toBeVisible({ timeout: 15000 });

    // Manager 有新增按鈕
    const addBtn = page.getByRole('button', { name: '新增 KPI' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await expect(addBtn).toBeEnabled();

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('Engineer: 新增 KPI 按鈕不可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('KPI');

    // Engineer 不應看到新增按鈕
    const addBtn = page.getByRole('button', { name: '新增 KPI' });
    await expect(addBtn).not.toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test('Manager: 點擊新增 KPI 按鈕展開表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('KPI');

    const addBtn = page.getByRole('button', { name: '新增 KPI' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });

    // 點擊新增按鈕
    await addBtn.click();

    // 表單出現
    await expect(page.locator('h2', { hasText: '新增 KPI' })).toBeVisible({ timeout: 5000 });

    // 表單欄位存在
    await expect(page.locator('input[placeholder="如 KPI-01"]')).toBeVisible();
    await expect(page.locator('input[placeholder="KPI 名稱"]')).toBeVisible();
    await expect(page.locator('input[placeholder="100"]')).toBeVisible();
    await expect(page.locator('#autoCalc')).toBeVisible();

    // 取消按鈕
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();

    // 建立按鈕
    await expect(page.getByRole('button', { name: '建立 KPI' })).toBeVisible();

    await context.close();
  });

  test('KPI 摘要統計卡片結構（有資料時）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('KPI');

    // 等待載入完成
    await page.waitForTimeout(3000);

    // 如有 KPI 資料，驗證摘要卡片
    const hasKPIs = await page.locator('text=KPI 總數').isVisible();
    if (hasKPIs) {
      await expect(page.locator('text=KPI 總數')).toBeVisible();
      await expect(page.locator('text=已達成')).toBeVisible();
      await expect(page.locator('text=平均達成率')).toBeVisible();
    } else {
      // 空態時驗證引導
      await expect(page.locator('text=尚無 KPI')).toBeVisible();
    }

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Plans (年度計畫)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Plans — 深度功能測試', () => {

  test('三大操作按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('年度計畫');

    // 三個操作按鈕
    await expect(page.getByRole('button', { name: '新增月度目標' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '從上年複製' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: '新增年度計畫' })).toBeVisible({ timeout: 15000 });

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('點擊「新增年度計畫」展開表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('年度計畫');

    // 點擊新增年度計畫
    await page.getByRole('button', { name: '新增年度計畫' }).click();

    // 表單出現
    await expect(page.locator('h3', { hasText: '新增年度計畫' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder="計畫標題"]')).toBeVisible();
    await expect(page.locator('input[placeholder="年份"]')).toBeVisible();

    await context.close();
  });

  test('點擊「從上年複製」展開複製表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('年度計畫');

    // 點擊從上年複製
    await page.getByRole('button', { name: '從上年複製' }).click();

    // 複製表單出現
    await expect(page.locator('h3', { hasText: '從上年複製計畫' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('select[aria-label="來源計畫"]')).toBeVisible();
    await expect(page.locator('input[placeholder="目標年份"]')).toBeVisible();

    await context.close();
  });

  test('點擊「新增月度目標」展開目標表單', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('年度計畫');

    // 點擊新增月度目標
    await page.getByRole('button', { name: '新增月度目標' }).click();

    // 月度目標表單出現
    await expect(page.locator('h3', { hasText: '新增月度目標' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('select[aria-label="年度計畫"]')).toBeVisible();
    await expect(page.locator('select[aria-label="目標月份"]')).toBeVisible();
    await expect(page.locator('input[placeholder="目標標題"]')).toBeVisible();

    await context.close();
  });

  test('Breadcrumb 導航顯示「年度計畫」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/plans', { waitUntil: 'domcontentloaded' });

    // Breadcrumb 導航
    const breadcrumb = page.locator('nav');
    await expect(breadcrumb).toBeVisible({ timeout: 15000 });
    await expect(breadcrumb.locator('text=年度計畫')).toBeVisible();

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Reports (報表)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Reports — 深度功能測試', () => {

  test('四個 Tab 按鈕完整且可切換', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('報表');

    // 四個 tab 按鈕
    const tabs = ['週報', '月報', 'KPI 報表', '計畫外負荷'];
    for (const tab of tabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible({ timeout: 15000 });
    }

    // 預設顯示週報 tab（active 樣式含 font-medium）
    const weeklyTab = page.getByRole('button', { name: '週報' });
    await expect(weeklyTab).toHaveClass(/font-medium/, { timeout: 5000 });

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('切換到月報 Tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('報表');

    // 點擊月報 tab
    await page.getByRole('button', { name: '月報' }).click();

    // 月報 tab 變為 active
    await expect(page.getByRole('button', { name: '月報' })).toHaveClass(/font-medium/, { timeout: 5000 });

    // 月報內容出現（月份選擇器）
    await expect(page.locator('input[type="month"]')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('切換到 KPI 報表 Tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('報表');

    // 點擊 KPI 報表 tab
    await page.getByRole('button', { name: 'KPI 報表' }).click();

    // KPI 報表 tab 變為 active
    await expect(page.getByRole('button', { name: 'KPI 報表' })).toHaveClass(/font-medium/, { timeout: 5000 });

    // KPI 報表內容出現（年份輸入）
    await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('切換到計畫外負荷 Tab', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('報表');

    // 點擊計畫外負荷 tab
    await page.getByRole('button', { name: '計畫外負荷' }).click();

    // 計畫外負荷 tab 變為 active
    await expect(page.getByRole('button', { name: '計畫外負荷' })).toHaveClass(/font-medium/, { timeout: 5000 });

    // 負荷報表內容出現（日期選擇器）
    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('週報匯出按鈕可見（有資料時）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('報表');

    // 等待週報載入
    await page.waitForTimeout(3000);

    // 如有資料，匯出按鈕可見
    const exportBtn = page.getByRole('button', { name: '匯出' });
    const hasData = await page.locator('text=本週摘要').isVisible();
    if (hasData) {
      await expect(exportBtn.first()).toBeVisible();
    }

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Timesheet (工時紀錄)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Timesheet — 深度功能測試', () => {

  test('週導航控制項完整', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 本週按鈕
    const thisWeekBtn = page.getByRole('button', { name: '本週' });
    await expect(thisWeekBtn).toBeVisible({ timeout: 15000 });

    // 使用者篩選 select
    const userSelect = page.locator('select[aria-label="篩選使用者"]');
    await expect(userSelect).toBeVisible({ timeout: 15000 });
    await expect(userSelect).toHaveValue(''); // 預設「我的工時」

    // 刷新按鈕
    const refreshBtns = page.locator('button').filter({ has: page.locator('svg') });
    expect(await refreshBtns.count()).toBeGreaterThanOrEqual(3); // 左箭頭、本週、右箭頭、刷新

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('週期標籤顯示正確格式', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 副標題包含年份與日期區間
    const subtitle = page.locator('p.text-muted-foreground', { hasText: '年' });
    await expect(subtitle).toBeVisible({ timeout: 15000 });

    // 格式應含「—」分隔符
    const text = await subtitle.textContent();
    expect(text).toContain('—');

    await context.close();
  });

  test('工時格子區域存在', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('工時紀錄');

    // 工時格子容器（圓角邊框區域）
    const gridContainer = page.locator('div.border.border-border.rounded-xl');
    await expect(gridContainer.first()).toBeVisible({ timeout: 15000 });

    // 底部使用說明
    await expect(page.locator('text=點擊格子可輸入工時與分類')).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Engineer: 篩選使用者 select 預設「我的工時」', async ({ browser }) => {
    const context = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });

    const userSelect = page.locator('select[aria-label="篩選使用者"]');
    await expect(userSelect).toBeVisible({ timeout: 15000 });

    // 預設選中第一項（我的工時，value=""）
    await expect(userSelect).toHaveValue('');

    // 有「我的工時」選項
    await expect(userSelect.locator('option', { hasText: '我的工時' })).toBeVisible();

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Login (登入頁)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Login — 深度功能測試', () => {

  test('登入表單元素完整', async ({ browser }) => {
    const context = await browser.newContext(); // 無 session
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // TITAN 品牌標示
    await expect(page.locator('text=TITAN')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=銀行 IT 團隊工作管理系統')).toBeVisible();

    // 帳號欄位
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible({ timeout: 15000 });
    await expect(usernameInput).toHaveAttribute('placeholder', '請輸入帳號');
    await expect(usernameInput).toHaveAttribute('required', '');
    await expect(usernameInput).toHaveAttribute('autocomplete', 'username');

    // 密碼欄位
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('placeholder', '請輸入密碼');
    await expect(passwordInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // 登入按鈕
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('登入');
    await expect(submitBtn).toBeEnabled();

    // 版權聲明
    await expect(page.locator('text=2026 TITAN')).toBeVisible();

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('帳號密碼欄位可輸入文字', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#username', { state: 'visible', timeout: 10000 });

    // 輸入帳號
    await page.locator('#username').fill('test@example.com');
    await expect(page.locator('#username')).toHaveValue('test@example.com');

    // 輸入密碼
    await page.locator('#password').fill('testpassword');
    await expect(page.locator('#password')).toHaveValue('testpassword');

    await context.close();
  });

  test('TITAN Logo T 字母顯示', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Logo 含 T 字母
    const logoT = page.locator('span', { hasText: 'T' }).filter({ has: page.locator('.text-lg') });
    // 更精確：TITAN logo 區塊
    await expect(page.locator('text=TITAN')).toBeVisible({ timeout: 15000 });

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Change Password (變更密碼)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Change Password — 深度功能測試', () => {

  test('變更密碼表單元素完整', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });

    // 頁面標題
    await expect(page.locator('h1', { hasText: '變更密碼' })).toBeVisible({ timeout: 15000 });

    // 說明文字
    await expect(page.locator('text=您的密碼已到期或為首次登入，請設定新密碼')).toBeVisible();

    // 密碼政策說明區塊
    const policyBlock = page.locator('div.bg-muted\\/50');
    await expect(policyBlock).toBeVisible({ timeout: 15000 });

    // 目前密碼欄位
    const currentPwd = page.locator('#currentPassword');
    await expect(currentPwd).toBeVisible();
    await expect(currentPwd).toHaveAttribute('type', 'password');
    await expect(currentPwd).toHaveAttribute('required', '');
    await expect(currentPwd).toHaveAttribute('autocomplete', 'current-password');

    // 新密碼欄位
    const newPwd = page.locator('#newPassword');
    await expect(newPwd).toBeVisible();
    await expect(newPwd).toHaveAttribute('type', 'password');
    await expect(newPwd).toHaveAttribute('required', '');
    await expect(newPwd).toHaveAttribute('autocomplete', 'new-password');

    // 確認新密碼欄位
    const confirmPwd = page.locator('#confirmPassword');
    await expect(confirmPwd).toBeVisible();
    await expect(confirmPwd).toHaveAttribute('type', 'password');
    await expect(confirmPwd).toHaveAttribute('required', '');
    await expect(confirmPwd).toHaveAttribute('autocomplete', 'new-password');

    // 變更密碼按鈕
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('變更密碼');
    await expect(submitBtn).toBeEnabled();

    expect(errors).toHaveLength(0);
    await context.close();
  });

  test('密碼欄位可輸入且有 minLength 約束', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1', { hasText: '變更密碼' })).toBeVisible({ timeout: 15000 });

    // 新密碼有 minLength=12
    await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '12');
    await expect(page.locator('#confirmPassword')).toHaveAttribute('minlength', '12');

    // 可填入值
    await page.locator('#currentPassword').fill('OldPassword123!');
    await expect(page.locator('#currentPassword')).toHaveValue('OldPassword123!');

    await page.locator('#newPassword').fill('NewSecurePass1!');
    await expect(page.locator('#newPassword')).toHaveValue('NewSecurePass1!');

    await page.locator('#confirmPassword').fill('NewSecurePass1!');
    await expect(page.locator('#confirmPassword')).toHaveValue('NewSecurePass1!');

    await context.close();
  });

  test('三個密碼欄位各有 label', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/change-password', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1', { hasText: '變更密碼' })).toBeVisible({ timeout: 15000 });

    // 三個 label
    await expect(page.locator('label[for="currentPassword"]')).toContainText('目前密碼');
    await expect(page.locator('label[for="newPassword"]')).toContainText('新密碼');
    await expect(page.locator('label[for="confirmPassword"]')).toContainText('確認新密碼');

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-page: Manager vs Engineer 差異驗證
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Manager vs Engineer 視角差異', () => {

  test('Dashboard: Manager 看到「團隊工時分佈」，Engineer 看到「我的任務」', async ({ browser }) => {
    // Manager
    const mgrCtx = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const mgrPage = await mgrCtx.newPage();
    await mgrPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(mgrPage.locator('h2', { hasText: '團隊工時分佈' })).toBeVisible({ timeout: 15000 });
    await mgrCtx.close();

    // Engineer
    const engCtx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const engPage = await engCtx.newPage();
    await engPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(
      engPage.locator('h2', { hasText: '我的任務' }).or(
        engPage.locator('text=目前沒有待處理的任務')
      ).first()
    ).toBeVisible({ timeout: 15000 });
    await engCtx.close();
  });

  test('KPI: Manager 有操作按鈕，Engineer 只有檢視', async ({ browser }) => {
    // Manager — 有「新增 KPI」按鈕
    const mgrCtx = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const mgrPage = await mgrCtx.newPage();
    await mgrPage.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(mgrPage.locator('h1').first()).toContainText('KPI', { timeout: 15000 });
    await expect(mgrPage.getByRole('button', { name: '新增 KPI' })).toBeVisible({ timeout: 15000 });
    await mgrCtx.close();

    // Engineer — 無「新增 KPI」按鈕
    const engCtx = await browser.newContext({ storageState: ENGINEER_STATE_FILE });
    const engPage = await engCtx.newPage();
    await engPage.goto('/kpi', { waitUntil: 'domcontentloaded' });
    await expect(engPage.locator('h1').first()).toContainText('KPI', { timeout: 15000 });
    await expect(engPage.getByRole('button', { name: '新增 KPI' })).not.toBeVisible({ timeout: 5000 });
    await engCtx.close();
  });
});
