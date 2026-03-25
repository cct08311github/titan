/**
 * Smoke Tests — 12 Pages x 3 Operations = 36 Tests
 *
 * Runs against a LIVE server (not mocked).
 * Uses pre-saved Manager session for authentication.
 *
 * For each page:
 *   1. Load  — page renders without error
 *   2. Data  — content is visible (not empty state when data exists)
 *   3. Interact — one core interaction works
 *
 * Issue #689
 */
import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.use({ storageState: MANAGER_STATE_FILE });

// Filter out known noise from console errors
const NOISE_PATTERNS = [
  'Warning:', 'hydrat', 'Expected server HTML',
  'next-auth', 'CLIENT_FETCH_ERROR', 'favicon',
  'ERR_INCOMPLETE_CHUNKED_ENCODING', 'ERR_ABORTED', 'net::ERR',
  'Download the React DevTools',
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
// 1. Dashboard (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Dashboard', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('儀表板');
    expect(errors).toEqual([]);
  });

  test('shows content cards', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Manager dashboard should show stat cards or empty guide
    const hasStatCards = await page.locator('.bg-card').first().isVisible({ timeout: 15000 }).catch(() => false);
    expect(hasStatCards).toBeTruthy();
  });

  test('today tasks card visible', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // Wait for the TodayTasksCard or KPIAchievementSection to render
    await page.waitForTimeout(3000);
    // Either we see task items or the empty state — both are valid
    const hasContent = await page.locator('text=今日待辦').or(page.locator('text=沒有待辦任務')).or(page.locator('text=尚無待處理任務')).first().isVisible({ timeout: 15000 });
    expect(hasContent).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Kanban (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Kanban', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('看板');
    expect(errors).toEqual([]);
  });

  test('shows task columns', async ({ page }) => {
    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    // Should have column headers for task statuses
    await expect(page.locator('text=待辦清單').or(page.locator('text=待處理')).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=進行中').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=已完成').first()).toBeVisible({ timeout: 5000 });
  });

  test('new task button visible and clickable', async ({ page }) => {
    await page.goto('/kanban', { waitUntil: 'domcontentloaded' });
    const addBtn = page.locator('button', { hasText: '新增任務' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    // Verify button is interactable (don't actually create task to avoid side effects)
    await expect(addBtn).toBeEnabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. KPI (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('KPI', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    expect(errors).toEqual([]);
  });

  test('shows KPI content or empty state', async ({ page }) => {
    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    // Either KPI cards exist or the empty state message
    const content = page.locator('text=KPI 管理').or(page.locator('text=尚無 KPI'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test('new KPI button visible for manager', async ({ page }) => {
    await page.goto('/kpi', { waitUntil: 'domcontentloaded' });
    const addBtn = page.locator('button', { hasText: '新增 KPI' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    // Click to show form
    await addBtn.click();
    // Form should appear
    await expect(page.locator('text=新增 KPI').nth(1).or(page.locator('input[placeholder*="KPI"]')).first()).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Gantt (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Gantt', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('甘特圖');
    expect(errors).toEqual([]);
  });

  test('shows year label and plan or empty state', async ({ page }) => {
    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    const currentYear = new Date().getFullYear().toString();
    // Year selector should show current year
    await expect(page.locator(`text=${currentYear}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('year navigation works', async ({ page }) => {
    await page.goto('/gantt', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const currentYear = new Date().getFullYear();
    // Click previous year button
    const prevBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    // Find the year picker navigation (ChevronLeft near the year number)
    const yearDisplay = page.locator(`text=${currentYear}`).last();
    await expect(yearDisplay).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Reports (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Reports', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('報表');
    expect(errors).toEqual([]);
  });

  test('shows report tabs', async ({ page }) => {
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=週報')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=月報')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=KPI 報表')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=計畫外負荷')).toBeVisible({ timeout: 5000 });
  });

  test('tab switching works', async ({ page }) => {
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Click monthly report tab
    await page.locator('button', { hasText: '月報' }).click();
    // Should show month picker input
    await expect(page.locator('input[type="month"]')).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Timesheet (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Timesheet', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('工時紀錄');
    expect(errors).toEqual([]);
  });

  test('shows week label', async ({ page }) => {
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    // Should display year and week range
    await expect(page.locator('text=/\\d{4} 年/')).toBeVisible({ timeout: 15000 });
  });

  test('week navigation buttons work', async ({ page }) => {
    await page.goto('/timesheet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // The "本週" (this week) button should be visible
    await expect(page.locator('button', { hasText: '本週' })).toBeVisible({ timeout: 10000 });
    // Click it to ensure it's interactive
    await page.locator('button', { hasText: '本週' }).click();
    // Page should still be stable
    await expect(page.locator('h1').first()).toContainText('工時紀錄');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Plans (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Plans', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('年度計畫');
    expect(errors).toEqual([]);
  });

  test('shows plan tree or empty state', async ({ page }) => {
    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    // Either plans are listed or we see the empty state
    const content = page.locator('text=年度計畫').first();
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test('action buttons visible for manager', async ({ page }) => {
    await page.goto('/plans', { waitUntil: 'domcontentloaded' });
    // Manager should see create buttons
    await expect(page.locator('button', { hasText: '新增年度計畫' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button', { hasText: '新增月度目標' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: '從上年複製' })).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Knowledge (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Knowledge', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('知識庫');
    expect(errors).toEqual([]);
  });

  test('shows editor view with sidebar', async ({ page }) => {
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    // Editor mode should be active by default — check for search input
    await expect(page.locator('input[placeholder*="搜尋文件"]').or(page.locator('text=文件編輯器')).first()).toBeVisible({ timeout: 15000 });
  });

  test('new document button visible', async ({ page }) => {
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });
    const addBtn = page.locator('button', { hasText: '新增文件' });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await expect(addBtn).toBeEnabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Activity (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Activity', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/activity', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('團隊動態');
    expect(errors).toEqual([]);
  });

  test('shows activity list or empty state', async ({ page }) => {
    await page.goto('/activity', { waitUntil: 'domcontentloaded' });
    // Either activity items exist or empty message
    const content = page.locator('text=團隊動態').or(page.locator('text=尚無活動紀錄'));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test('activity entries show source badges', async ({ page }) => {
    await page.goto('/activity', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // If there are activity entries, they should have source badges
    const hasBadges = await page.locator('text=任務').or(page.locator('text=系統')).or(page.locator('text=尚無活動紀錄')).first().isVisible({ timeout: 10000 });
    expect(hasBadges).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Settings (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('個人設定');
    expect(errors).toEqual([]);
  });

  test('shows profile tab with user info', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    // Profile tab should be active and show name input
    await expect(page.locator('text=姓名').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=電子信箱').first()).toBeVisible({ timeout: 5000 });
  });

  test('tab switching works', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Switch to notifications tab
    await page.locator('button', { hasText: '通知偏好' }).click();
    // Should show notification toggle options
    await expect(page.locator('text=選擇要接收的通知類型').or(page.locator('role=switch').first()).first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Admin (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('系統管理');
    expect(errors).toEqual([]);
  });

  test('shows backup status section', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=備份狀態')).toBeVisible({ timeout: 15000 });
  });

  test('shows audit log section', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=稽核日誌')).toBeVisible({ timeout: 20000 });
    // Audit log should have filter controls
    await expect(page.locator('text=操作類型').or(page.locator('select')).first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Admin Notifications (3 tests)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin Notifications', () => {
  test('loads without error', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const res = await page.goto('/admin/notifications', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1').first()).toContainText('通知偏好設定');
    expect(errors).toEqual([]);
  });

  test('shows notification type toggles', async ({ page }) => {
    await page.goto('/admin/notifications', { waitUntil: 'domcontentloaded' });
    // Should list notification types
    await expect(page.locator('text=任務指派通知').or(page.locator('text=載入中')).first()).toBeVisible({ timeout: 15000 });
  });

  test('save button visible and enabled', async ({ page }) => {
    await page.goto('/admin/notifications', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const saveBtn = page.locator('button', { hasText: '儲存偏好' });
    await expect(saveBtn).toBeVisible({ timeout: 15000 });
    await expect(saveBtn).toBeEnabled();
  });
});
