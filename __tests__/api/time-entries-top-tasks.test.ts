/**
 * @jest-environment node
 */
/**
 * API: GET /api/time-entries/top-tasks — Issue #1539-4.
 *
 * Covers:
 *  - Aggregates user's recent entries by taskId and returns top N
 *  - Defaults: 14 days lookback, top 5
 *  - Caps query params: max 60 days, max 10 limit
 *  - Decimal-as-string hours coerced to Number (T1538)
 *  - Skips entries without taskId or task relation
 *  - Caller-scoped (no userId override)
 */
import { createMockRequest } from "../utils/test-utils";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/rbac", () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: jest.fn(),
  requireManagerOrAbove: jest.fn(),
  enforcePasswordChange: jest.fn(),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/auth-middleware", () => ({
  withAuth: (fn: unknown) => fn,
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    timeEntry: { findMany: jest.fn() },
  };
  return { prisma: mock };
});

import { GET } from "@/app/api/time-entries/top-tasks/route";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as {
  timeEntry: { findMany: jest.Mock };
};

const USER_ID = "cku111111111111111111111";

function callGet(query = "") {
  const req = createMockRequest(`/api/time-entries/top-tasks${query}`, { method: "GET" });
  return GET(req, { params: Promise.resolve({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { id: USER_ID } });
});

describe("GET /api/time-entries/top-tasks", () => {
  it("returns empty list when user has no entries", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([]);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toEqual([]);
    expect(body.data.windowDays).toBe(14);
  });

  it("aggregates entries by taskId and sorts by totalHours desc", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { taskId: "t1", hours: 3, date: new Date("2026-04-21"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
      { taskId: "t1", hours: 4, date: new Date("2026-04-22"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
      { taskId: "t2", hours: 2, date: new Date("2026-04-22"), task: { id: "t2", title: "Task B", category: "INCIDENT" } },
      { taskId: "t3", hours: 1, date: new Date("2026-04-23"), task: { id: "t3", title: "Task C", category: "ADMIN" } },
    ]);
    const res = await callGet();
    const body = await res.json();
    expect(body.data.items).toHaveLength(3);
    expect(body.data.items[0]).toMatchObject({
      taskId: "t1",
      taskTitle: "Task A",
      totalHours: 7,
      entryCount: 2,
      avgHoursPerEntry: 3.5,
    });
    expect(body.data.items[1].taskId).toBe("t2");
    expect(body.data.items[2].taskId).toBe("t3");
  });

  it("respects limit query param (clamped to max 10)", async () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      taskId: `t${i}`,
      hours: 15 - i, // descending hours
      date: new Date("2026-04-22"),
      task: { id: `t${i}`, title: `Task ${i}`, category: "PLANNED" },
    }));
    prismaMock.timeEntry.findMany.mockResolvedValue(entries);

    const res1 = await callGet("?limit=3");
    const body1 = await res1.json();
    expect(body1.data.items).toHaveLength(3);

    const res2 = await callGet("?limit=999");
    const body2 = await res2.json();
    expect(body2.data.items).toHaveLength(10); // capped at MAX_LIMIT
  });

  it("respects days query param (clamped to max 60)", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([]);
    await callGet("?days=30");
    const where1 = prismaMock.timeEntry.findMany.mock.calls[0][0].where;
    expect(where1.userId).toBe(USER_ID);
    expect(where1.isDeleted).toBe(false);
    expect((where1.date as { gte: Date }).gte).toBeInstanceOf(Date);

    await callGet("?days=999");
    // Just confirm no crash; clamp behavior tested via output below.
    const body = await (await callGet("?days=999")).json();
    expect(body.data.windowDays).toBe(60);
  });

  it("falls back to defaults when query params invalid", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([]);
    const res = await callGet("?days=abc&limit=xyz");
    const body = await res.json();
    expect(body.data.windowDays).toBe(14);
  });

  it("coerces Decimal-as-string hours via Number()", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { taskId: "t1", hours: "2.5", date: new Date("2026-04-21"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
      { taskId: "t1", hours: "3.5", date: new Date("2026-04-22"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
    ]);
    const res = await callGet();
    const body = await res.json();
    expect(body.data.items[0].totalHours).toBe(6); // 2.5 + 3.5 = 6
    expect(body.data.items[0].avgHoursPerEntry).toBe(3);
  });

  it("skips entries with null taskId or missing task relation", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { taskId: null, hours: 5, date: new Date("2026-04-22"), task: null },
      { taskId: "t1", hours: 2, date: new Date("2026-04-22"), task: null }, // missing relation
      { taskId: "t1", hours: 3, date: new Date("2026-04-23"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
    ]);
    const res = await callGet();
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].totalHours).toBe(3);
  });

  it("uses lastEntryDate as YYYY-MM-DD of most-recent entry", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { taskId: "t1", hours: 2, date: new Date("2026-04-21T10:00:00Z"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
      { taskId: "t1", hours: 3, date: new Date("2026-04-23T15:00:00Z"), task: { id: "t1", title: "Task A", category: "PLANNED" } },
    ]);
    const res = await callGet();
    const body = await res.json();
    expect(body.data.items[0].lastEntryDate).toBe("2026-04-23");
  });

  it("scopes query to caller userId only", async () => {
    prismaMock.timeEntry.findMany.mockResolvedValue([]);
    await callGet();
    const where = prismaMock.timeEntry.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe(USER_ID);
    expect(where.isDeleted).toBe(false);
    expect(where.taskId).toEqual({ not: null });
  });
});
