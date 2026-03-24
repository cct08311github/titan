import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3100';

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
  await page.waitForLoadState('domcontentloaded');

  await page.fill('#username', email);
  await page.fill('#password', password);
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
  await loginAndSave('admin@titan.local', 'Titan@2026', MANAGER_STATE_FILE);
  // Small delay between logins to avoid rate limiting
  await new Promise((r) => setTimeout(r, 500));
  await loginAndSave('eng-a@titan.local', 'Titan@2026', ENGINEER_STATE_FILE);
}
