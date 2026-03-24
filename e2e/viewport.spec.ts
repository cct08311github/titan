import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';

const VIEWPORTS = [
  { name: '1920x1080 (Full HD)', width: 1920, height: 1080 },
  { name: '1280x720 (HD)',       width: 1280, height: 720 },
  { name: '1024x768 (XGA)',      width: 1024, height: 768 },
];

test.describe('Viewport 測試', () => {
  for (const viewport of VIEWPORTS) {
    test(`Dashboard 在 ${viewport.name} 下正常渲染不 crash`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: MANAGER_STATE_FILE,
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      // Page should have visible h1
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('h1').first()).toContainText('儀表板');

      // Body should have a reasonable bounding box
      const bodyBox = await page.locator('body').boundingBox();
      expect(bodyBox).not.toBeNull();
      expect(bodyBox!.width).toBeGreaterThan(200);
      expect(bodyBox!.height).toBeGreaterThan(100);

      // No horizontal overflow that would indicate layout crash
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      // Allow up to 20px tolerance for scrollbar
      expect(scrollWidth - clientWidth).toBeLessThanOrEqual(20);

      await context.close();
    });
  }
});
