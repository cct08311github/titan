import { Page, BrowserContext } from '@playwright/test';
import path from 'path';

export const MANAGER = {
  email: 'admin@titan.local',
  password: 'Admin@2026!x',
  role: 'MANAGER',
};

export const ENGINEER = {
  email: 'eng-a@titan.local',
  password: 'Admin@2026!x',
  role: 'ENGINEER',
};

export const MANAGER_STATE_FILE = path.join(__dirname, '..', '.auth', 'manager.json');
export const ENGINEER_STATE_FILE = path.join(__dirname, '..', '.auth', 'engineer.json');

/**
 * Navigate to a protected page using already-saved session cookies.
 * Call this after creating a browser context with the appropriate storageState.
 *
 * Usage in tests:
 *   test.use({ storageState: MANAGER_STATE_FILE });
 *   test('...', async ({ page }) => { await page.goto('/dashboard'); });
 */
export async function goToDashboard(page: Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Login via UI form — only for tests that specifically test the login flow.
 * For general navigation tests, use storageState instead.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('#username', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Legacy loginAs — used only for tests that need fresh login.
 * Prefer storageState for all other tests.
 */
export async function loginAs(
  page: Page,
  user: { email: string; password: string }
) {
  await loginViaUI(page, user.email, user.password);
}
