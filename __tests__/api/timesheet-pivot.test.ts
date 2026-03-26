/**
 * @jest-environment node
 */
/**
 * TDD: Timesheet pivot table — Fixes #832 (T-5)
 *
 * Tests:
 *   - Weekly pivot: GET /api/reports/weekly?view=pivot
 *   - Monthly pivot: GET /api/reports/monthly?view=pivot
 *   - Pivot row/column totals correctness
 *   - Overtime separate accounting
 *   - Empty data returns empty rows
 *   - Manager sees all users, Member sees only self
 */

import { createMockRequest } from "../utils/test-utils";

const mockTimeEntry = { findMany: jest.fn() };
const mockTask = { findMany: jest.fn() };
const mockTaskChange = { findMany: jest.fn() };
const mockMonthlyGoal = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    task: mockTask,
    taskChange: mockTaskChange,
    monthlyGoal: mockMonthlyGoal,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));

const MANAGER_SESSION = { user: { id: "m1", name: "Manager", email: "m@e.com", role: "MANAGER" }, expires: "2099" };
const ENGINEER_SESSION = { user: { id: "e1", name: "Engineer", email: "e@e.com", role: "ENGINEER" }, expires: "2099" };

function makeTimeEntry(userId: string, userName: string, category: string, hours: number, overtimeType = "NONE") {
  return { userId, hours, category, overtimeType, user: { id: userId, name: userName } };
}

describe("Weekly Pivot — GET /api/reports/weekly?view=pivot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(MANAGER_SESSION);
    mockTask.findMany.mockResolvedValue([]);
    mockTaskChange.findMany.mockResolvedValue([]);
    mockMonthlyGoal.findMany.mockResolvedValue([]);
  });

  it("returns pivot data with correct structure", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 8),
      makeTimeEntry("u1", "Alice", "ADMIN", 2),
      makeTimeEntry("u2", "Bob", "PLANNED_TASK", 6),
    ]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    expect(res.status).toBe(200);

    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("period");
    expect(data).toHaveProperty("rows");
    expect(data).toHaveProperty("categories");
    expect(data).toHaveProperty("categoryTotals");
    expect(data).toHaveProperty("grandTotal");
    expect(data).toHaveProperty("grandOvertimeTotal");
  });

  it("calculates row totals correctly", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 8),
      makeTimeEntry("u1", "Alice", "ADMIN", 2),
      makeTimeEntry("u1", "Alice", "SUPPORT", 1),
    ]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    const body = await res.json();
    const aliceRow = body.data.rows.find((r: { userId: string }) => r.userId === "u1");
    expect(aliceRow.total).toBe(11);
    expect(aliceRow.cells["PLANNED_TASK"]).toBe(8);
    expect(aliceRow.cells["ADMIN"]).toBe(2);
  });

  it("calculates column (category) totals correctly", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 8),
      makeTimeEntry("u2", "Bob", "PLANNED_TASK", 6),
      makeTimeEntry("u2", "Bob", "ADMIN", 3),
    ]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    const body = await res.json();
    expect(body.data.categoryTotals["PLANNED_TASK"]).toBe(14);
    expect(body.data.categoryTotals["ADMIN"]).toBe(3);
    expect(body.data.grandTotal).toBe(17);
  });

  it("accounts overtime separately", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 8, "NONE"),
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 3, "WEEKDAY"),
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 4, "HOLIDAY"),
    ]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    const body = await res.json();
    const row = body.data.rows[0];
    expect(row.total).toBe(15);
    expect(row.overtimeTotal).toBe(7); // 3 + 4
    expect(body.data.grandOvertimeTotal).toBe(7);
  });

  it("returns empty rows when no time entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    const body = await res.json();
    expect(body.data.rows).toEqual([]);
    expect(body.data.grandTotal).toBe(0);
  });

  it("shows zero/dash for empty cells", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 8),
      makeTimeEntry("u2", "Bob", "ADMIN", 3),
    ]);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    const body = await res.json();

    const alice = body.data.rows.find((r: { userId: string }) => r.userId === "u1");
    const bob = body.data.rows.find((r: { userId: string }) => r.userId === "u2");
    // Alice has no ADMIN entries
    expect(alice.cells["ADMIN"]).toBeUndefined();
    // Bob has no PLANNED_TASK entries
    expect(bob.cells["PLANNED_TASK"]).toBeUndefined();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(null);

    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { view: "pivot" } }));
    expect(res.status).toBe(401);
  });
});

describe("Monthly Pivot — GET /api/reports/monthly?view=pivot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(MANAGER_SESSION);
    mockTask.findMany.mockResolvedValue([]);
    mockTaskChange.findMany.mockResolvedValue([]);
    mockMonthlyGoal.findMany.mockResolvedValue([]);
  });

  it("returns monthly pivot data", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("u1", "Alice", "PLANNED_TASK", 40),
      makeTimeEntry("u2", "Bob", "PLANNED_TASK", 35),
      makeTimeEntry("u2", "Bob", "INCIDENT", 5),
    ]);

    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly", { searchParams: { view: "pivot", month: "2026-03" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.grandTotal).toBe(80);
    expect(body.data.rows).toHaveLength(2);
  });

  it("engineer sees only own data (no pivot for all users)", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(ENGINEER_SESSION);

    mockTimeEntry.findMany.mockResolvedValue([
      makeTimeEntry("e1", "Engineer", "PLANNED_TASK", 40),
    ]);

    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly", { searchParams: { view: "pivot", month: "2026-03" } }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify the filter was called with userId constraint
    const findManyCall = mockTimeEntry.findMany.mock.calls[0][0];
    expect(findManyCall.where).toHaveProperty("userId", "e1");
  });
});
