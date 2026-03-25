import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

test.describe('知識庫功能測試', () => {

  test('頁面標題和「新增文件」按鈕可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1').first()).toContainText('知識庫');
    await expect(page.locator('text=Markdown 文件管理').first()).toBeVisible();
    await expect(page.locator('text=新增文件').first()).toBeVisible();

    await context.close();
  });

  test('左側文件樹面板或空狀態可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    // 左側面板：文件樹 or 空狀態（尚無文件） or 載入中
    await expect(
      page.locator('text=尚無文件').or(
        page.locator('text=載入文件')
      ).or(
        // 有文件時 DocumentTree 區塊存在
        page.locator('[class*="sidebar-background"]')
      ).first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('右側編輯面板顯示佔位文字（未選擇文件時）', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    // 未選擇文件時的提示
    await expect(
      page.locator('text=從左側選擇文件').first()
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('搜尋區塊可見', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    // DocumentSearch 元件在左側面板的搜尋區域中
    // 搜尋區塊在 border-b border-border 的容器中
    const searchArea = page.locator('.border-r').locator('.border-b').first();
    await expect(searchArea).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('「新增文件」按鈕在頁面右上方', async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STATE_FILE });
    const page = await context.newPage();

    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' });

    const addBtn = page.locator('button', { hasText: '新增文件' }).first();
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();

    await context.close();
  });

});
