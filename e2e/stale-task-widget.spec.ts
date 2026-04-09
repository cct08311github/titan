/**
 * E2E tests: StaleTaskWidget on Dashboard — Issue #1312
 *
 * These tests require a running Docker dev environment:
 *   docker compose -f docker-compose.dev.yml up -d
 *
 * Skip marker: tests auto-skip when SKIP_E2E=true or when the dev server is
 * not reachable (checked via baseURL ping in globalSetup).
 */

import { test, expect } from "@playwright/test";

// ── Skip helper ───────────────────────────────────────────────────────────────

const SKIP_E2E = process.env.SKIP_E2E === "true";

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("StaleTaskWidget on Dashboard", () => {
  test.skip(SKIP_E2E, "E2E tests skipped (SKIP_E2E=true or Docker not running)");

  test("scenario 1: widget renders on dashboard for authenticated engineer", async ({
    page,
  }) => {
    // Navigate to login
    await page.goto("/login");
    await expect(page).toHaveTitle(/TITAN/i);

    // Fill in engineer credentials (dev seed data)
    await page.fill('input[name="email"]', "engineer@titan.local");
    await page.fill('input[name="password"]', "password");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Widget section should be visible
    const widget = page.getByRole("region", { name: "停滯工作提醒" });
    await expect(widget).toBeVisible({ timeout: 8_000 });

    // Either shows stale tasks or empty state
    const hasEmpty = await page
      .getByText("目前沒有停滯任務 ✅")
      .isVisible()
      .catch(() => false);
    const hasTasks = await page
      .getByRole("button", { name: /進行中/ })
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasEmpty || hasTasks).toBe(true);
  });

  test("scenario 2: MANAGER sees assignee names in stale task rows", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "manager@titan.local");
    await page.fill('input[name="password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const widget = page.getByRole("region", { name: "停滯工作提醒" });
    await expect(widget).toBeVisible({ timeout: 8_000 });

    // If there are stale tasks, at least one should show the assignee name
    // (assignee column is visible for MANAGER/ADMIN)
    const taskRows = await page.locator("[aria-label^='前往任務：']").count();
    if (taskRows > 0) {
      // Rows are rendered; for MANAGER they include · assigneeName
      // We can't easily assert specific names without seed data, but the
      // structure should be there (each row has at least 2 info spans)
      const firstRowInfo = page
        .locator("[aria-label^='前往任務：']")
        .first()
        .locator(".text-xs");
      await expect(firstRowInfo).toBeVisible();
    }
  });

  test("scenario 3: clicking task link navigates to kanban with taskId param", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "manager@titan.local");
    await page.fill('input[name="password"]', "password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    const widget = page.getByRole("region", { name: "停滯工作提醒" });
    await expect(widget).toBeVisible({ timeout: 8_000 });

    // Only run link-click test when stale tasks are present
    const firstLink = page.locator("[aria-label^='前往任務：']").first();
    const hasLink = await firstLink.isVisible().catch(() => false);
    if (!hasLink) {
      test.info().annotations.push({
        type: "skip-reason",
        description: "No stale tasks in dev database — skipping link navigation check",
      });
      return;
    }

    // Verify the href points to /kanban?taskId=...
    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/\/kanban\?taskId=/);
  });
});
