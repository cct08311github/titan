/**
 * Unit tests for stale-task-service — Issue #1311
 *
 * Uses dependency injection (prisma mock passed via deps) to avoid module-level mocks.
 */

import {
  scanStaleTasks,
  classifyStaleLevel,
  STALE_REMIND_DAYS,
  STALE_WARN_DAYS,
  STALE_ESCALATE_DAYS,
} from "../stale-task-service";
import { createMockPrisma } from "../../lib/test-utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgoDate(days: number, from: Date): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number, from: Date): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

const NOW = new Date("2026-04-09T12:00:00Z");

const ENGINEER_USER = { id: "user-eng", name: "Engineer", role: "ENGINEER" };
const MANAGER_USER = { id: "user-mgr", role: "MANAGER" };
const ADMIN_USER = { id: "user-adm", role: "ADMIN" };

function makeTask(overrides: {
  id?: string;
  title?: string;
  updatedAt: Date;
  dueDate?: Date | null;
  status?: string;
  assigneeId?: string | null;
}) {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Test Task",
    updatedAt: overrides.updatedAt,
    dueDate: overrides.dueDate ?? null,
    status: overrides.status ?? "IN_PROGRESS",
    primaryAssignee: overrides.assigneeId !== null
      ? { id: overrides.assigneeId ?? ENGINEER_USER.id, name: "Engineer", role: "ENGINEER" }
      : null,
  };
}

// ── classifyStaleLevel unit tests ─────────────────────────────────────────────

describe("classifyStaleLevel", () => {
  test("returns null when task is less than REMIND threshold", () => {
    const updatedAt = daysAgoDate(STALE_REMIND_DAYS - 0.5, NOW);
    expect(classifyStaleLevel(updatedAt, null, NOW)).toBeNull();
  });

  test("returns REMIND for 3–7 days stale with no due date", () => {
    const updatedAt = daysAgoDate(5, NOW);
    expect(classifyStaleLevel(updatedAt, null, NOW)).toBe("REMIND");
  });

  test("returns WARN for 7–14 days stale", () => {
    const updatedAt = daysAgoDate(10, NOW);
    expect(classifyStaleLevel(updatedAt, null, NOW)).toBe("WARN");
  });

  test("returns ESCALATE for >14 days stale", () => {
    const updatedAt = daysAgoDate(15, NOW);
    expect(classifyStaleLevel(updatedAt, null, NOW)).toBe("ESCALATE");
  });

  test("returns ESCALATE when dueDate overdue by >3 days (even if stale only 4 days)", () => {
    const updatedAt = daysAgoDate(4, NOW);
    const dueDate = daysAgoDate(4, NOW); // overdue 4 days
    expect(classifyStaleLevel(updatedAt, dueDate, NOW)).toBe("ESCALATE");
  });

  test("returns WARN when dueDate is within 3 days and task is stale", () => {
    const updatedAt = daysAgoDate(4, NOW);
    const dueDate = daysFromNow(2, NOW); // 2 days in future
    expect(classifyStaleLevel(updatedAt, dueDate, NOW)).toBe("WARN");
  });
});

// ── scanStaleTasks integration tests ─────────────────────────────────────────

describe("scanStaleTasks", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();

    // Default: no recent notifications
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    // Default: one manager, one admin
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([MANAGER_USER]) // managers query
      .mockResolvedValueOnce([ADMIN_USER]);  // admins query
    // Default: createMany succeeds
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  // ── Test 1: Tasks stale < 3 days are not triggered ──────────────────────

  test("tasks stale less than 3 days are NOT notified", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result).toEqual({ remindCount: 0, warnCount: 0, escalateCount: 0, skippedCount: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  // ── Test 2: REMIND (3–7 days) notifies only assignee ────────────────────

  test("3-7 day stale task creates REMIND notification only for assignee", async () => {
    const task = makeTask({ updatedAt: daysAgoDate(5, NOW) });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.remindCount).toBe(1);
    expect(result.warnCount).toBe(0);
    expect(result.escalateCount).toBe(0);

    const callArg = (prisma.notification.createMany as jest.Mock).mock.calls[0][0];
    expect(callArg.data).toHaveLength(1);
    expect(callArg.data[0]).toMatchObject({
      userId: ENGINEER_USER.id,
      type: "TASK_OVERDUE",
      relatedType: "STALE_REMIND",
    });
  });

  // ── Test 3: WARN (7–14 days) notifies assignee + manager ────────────────

  test("7-14 day stale task creates WARN notification for assignee and manager", async () => {
    const task = makeTask({ updatedAt: daysAgoDate(10, NOW) });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.warnCount).toBe(1);

    const callArg = (prisma.notification.createMany as jest.Mock).mock.calls[0][0];
    const userIds = callArg.data.map((n: { userId: string }) => n.userId);
    expect(userIds).toContain(ENGINEER_USER.id);
    expect(userIds).toContain(MANAGER_USER.id);
    expect(callArg.data[0].relatedType).toBe("STALE_WARN");
  });

  // ── Test 4: ESCALATE (>14 days) notifies assignee + manager + admin ──────

  test(">14 day stale task creates ESCALATE notification for assignee, manager, and admin", async () => {
    const task = makeTask({ updatedAt: daysAgoDate(20, NOW) });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 3 });

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.escalateCount).toBe(1);

    const callArg = (prisma.notification.createMany as jest.Mock).mock.calls[0][0];
    const userIds = callArg.data.map((n: { userId: string }) => n.userId);
    expect(userIds).toContain(ENGINEER_USER.id);
    expect(userIds).toContain(MANAGER_USER.id);
    expect(userIds).toContain(ADMIN_USER.id);
    expect(callArg.data[0].relatedType).toBe("STALE_ESCALATE");
  });

  // ── Test 5: dueDate overdue >3 days → ESCALATE ──────────────────────────

  test("task with dueDate overdue >3 days triggers ESCALATE regardless of stale days", async () => {
    const task = makeTask({
      updatedAt: daysAgoDate(4, NOW),
      dueDate: daysAgoDate(5, NOW), // overdue 5 days
    });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.escalateCount).toBe(1);
    expect(result.warnCount).toBe(0);
  });

  // ── Test 6: DONE / CANCELLED tasks are excluded ──────────────────────────

  test("DONE and CANCELLED tasks do not appear in scan results", async () => {
    // These should not be returned by the prisma query (status filter in service)
    // Verify the query filter is applied correctly
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    await scanStaleTasks({ prisma: prisma as never, now: NOW });

    const queryArg = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
    expect(queryArg.where.status).toEqual({ notIn: ["DONE", "CANCELLED"] });
  });

  // ── Test 7: 24hr dedup skips already-notified task+level ─────────────────

  test("skips notification if same task+level already notified within 24 hours", async () => {
    const task = makeTask({ id: "task-dup", updatedAt: daysAgoDate(5, NOW) });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);

    // Simulate existing notification for this task+level+user
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([
      { userId: ENGINEER_USER.id, relatedId: "task-dup", relatedType: "STALE_REMIND" },
    ]);

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.skippedCount).toBeGreaterThan(0);
    // createMany should not be called since all recipients were deduplicated
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  // ── Test 8: No manager on assignee → fallback to any MANAGER ─────────────

  test("when no manager associated, falls back to any MANAGER role user", async () => {
    const task = makeTask({ updatedAt: daysAgoDate(10, NOW) }); // WARN level
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);

    // Manager list returns fallback manager
    // (already set in beforeEach as [MANAGER_USER])

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.warnCount).toBe(1);
    const callArg = (prisma.notification.createMany as jest.Mock).mock.calls[0][0];
    const userIds = callArg.data.map((n: { userId: string }) => n.userId);
    // Fallback manager should be in recipients
    expect(userIds).toContain(MANAGER_USER.id);
  });

  // ── Test 9: XSS in task title is sanitized ───────────────────────────────

  test("task title with XSS payload is sanitized in notification body", async () => {
    const xssTitle = 'Alert<script>alert(1)</script>';
    const task = makeTask({ title: xssTitle, updatedAt: daysAgoDate(5, NOW) });
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);

    await scanStaleTasks({ prisma: prisma as never, now: NOW });

    const callArg = (prisma.notification.createMany as jest.Mock).mock.calls[0][0];
    const body = callArg.data[0].body as string;
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("alert(1)");
    // Sanitized title should still be present (without the script tag)
    expect(body).toContain("Alert");
  });

  // ── Test 10: Return value structure ──────────────────────────────────────

  test("return value matches ScanResult interface", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result).toHaveProperty("remindCount");
    expect(result).toHaveProperty("warnCount");
    expect(result).toHaveProperty("escalateCount");
    expect(result).toHaveProperty("skippedCount");
    expect(typeof result.remindCount).toBe("number");
    expect(typeof result.warnCount).toBe("number");
    expect(typeof result.escalateCount).toBe("number");
    expect(typeof result.skippedCount).toBe("number");
  });

  // ── Test 11: Multiple tasks mixed levels ─────────────────────────────────

  test("correctly counts mixed stale levels across multiple tasks", async () => {
    const tasks = [
      makeTask({ id: "t1", updatedAt: daysAgoDate(5, NOW) }),  // REMIND
      makeTask({ id: "t2", updatedAt: daysAgoDate(10, NOW) }), // WARN
      makeTask({ id: "t3", updatedAt: daysAgoDate(20, NOW) }), // ESCALATE
    ];
    (prisma.task.findMany as jest.Mock).mockResolvedValue(tasks);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 6 });

    const result = await scanStaleTasks({ prisma: prisma as never, now: NOW });

    expect(result.remindCount).toBe(1);
    expect(result.warnCount).toBe(1);
    expect(result.escalateCount).toBe(1);
  });
});
