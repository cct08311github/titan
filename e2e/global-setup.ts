import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3100';

export const MANAGER_STATE_FILE = path.join(__dirname, '.auth/manager.json');
export const ENGINEER_STATE_FILE = path.join(__dirname, '.auth/engineer.json');

async function loginAndSave(
  email: string,
  password: string,
  storageStatePath: string
) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // 等待 React 水合完成
  await page.waitForSelector('button[type="submit"]', { state: 'visible', timeout: 10000 });

  await page.locator('#username').click();
  await page.locator('#username').fill(email);
  await page.locator('#password').click();
  await page.locator('#password').fill(password);
  await page.click('button[type="submit"]');

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');

  // Save cookie state
  await page.context().storageState({ path: storageStatePath });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Login sequentially to avoid rate limiter
  await loginAndSave('admin@titan.local', 'Admin@2026!x', MANAGER_STATE_FILE);
  // Small delay between logins to avoid rate limiting
  await new Promise((r) => setTimeout(r, 500));
  await loginAndSave('eng-a@titan.local', 'Admin@2026!x', ENGINEER_STATE_FILE);
}
