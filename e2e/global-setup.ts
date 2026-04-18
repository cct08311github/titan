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
  // Issue #1480: dropped `waitForLoadState('networkidle')`. networkidle
  // hangs when long-polls / beacons keep connections open — was the root
  // of the 2h+ E2E hangs. Waiting for the hydrated submit button is a
  // reliable interactive-readiness signal.
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
  await loginAndSave('admin@titan.local', '1234', MANAGER_STATE_FILE);
  // Small delay between logins to avoid rate limiting
  await new Promise((r) => setTimeout(r, 500));
  await loginAndSave('eng-a@titan.local', '1234', ENGINEER_STATE_FILE);
}
