/**
 * @jest-environment node
 */
/**
 * API tests: /api/time-entries/suggestions and /api/time-entries/confirm-suggestions
 * Issue #963 — Auto Time Tracking Suggestions
 */

import { createMockRequest } from "../utils/test-utils";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTaskActivity = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn(), create: jest.fn() };
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    taskActivity: mockTaskActivity,
    timeEntry: mockTimeEntry,
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

// ── Suggestion Generation Tests ──────────────────────────────────────────────

describe("GET /api/time-entries/suggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTimeEntry.findMany.mockResolvedValue([]);
  });

  it("returns empty array when no status changes today", async () => {
    mockTaskActivity.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/time-entries/suggestions/route");
    const res = await GET(
      createMockRequest("/api/time-entries/suggestions", {
        searchParams: { date: "2026-03-27" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("suggests time_entry when task moved to DONE", async () => {
    const now = new Date("2026-03-27T10:00:00Z");
    const startTime = new Date("2026-03-27T08:00:00Z");

    mockTaskActivity.findMany.mockResolvedValue([
      {
        id: "act-1",
        taskId: "task-1",
        userId: "u1",
        action: "STATUS_CHANGE",
        detail: { from: "TODO", to: "IN_PROGRESS" },
        createdAt: startTime,
        task: { id: "task-1", title: "Fix bug", category: "PLANNED", status: "DONE" },
      },
      {
        id: "act-2",
        taskId: "task-1",
        userId: "u1",
        action: "STATUS_CHANGE",
        detail: { from: "IN_PROGRESS", to: "DONE" },
        createdAt: now,
        task: { id: "task-1", title: "Fix bug", category: "PLANNED", status: "DONE" },
      },
    ]);

    const { GET } = await import("@/app/api/time-entries/suggestions/route");
    const res = await GET(
      createMockRequest("/api/time-entries/suggestions", {
        searchParams: { date: "2026-03-27" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    // Should suggest a time entry with ~2h (10:00 - 08:00)
    const entry = body.data.find(
      (s: { type: string }) => s.type === "time_entry"
    );
    expect(entry).toBeDefined();
    expect(entry.taskId).toBe("task-1");
    expect(entry.suggestedHours).toBe(2);
    expect(entry.alreadyLogged).toBe(false);
  });

  it("suggests timer_start when task moved to IN_PROGRESS", async () => {
    mockTaskActivity.findMany.mockResolvedValue([
      {
        id: "act-1",
        taskId: "task-2",
        userId: "u1",
        action: "STATUS_CHANGE",
        detail: { from: "TODO", to: "IN_PROGRESS" },
        createdAt: new Date("2026-03-27T09:00:00Z"),
        task: { id: "task-2", title: "Review PR", category: "PLANNED", status: "IN_PROGRESS" },
      },
    ]);

    const { GET } = await import("@/app/api/time-entries/suggestions/route");
    const res = await GET(
      createMockRequest("/api/time-entries/suggestions", {
        searchParams: { date: "2026-03-27" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    const start = body.data.find(
      (s: { type: string }) => s.type === "timer_start"
    );
    expect(start).toBeDefined();
    expect(start.taskId).toBe("task-2");
    expect(start.suggestedHours).toBe(0);
  });

  it("marks suggestion as alreadyLogged when time entry exists", async () => {
    const now = new Date("2026-03-27T10:00:00Z");
    const startTime = new Date("2026-03-27T08:00:00Z");

    mockTaskActivity.findMany.mockResolvedValue([
      {
        id: "act-1",
        taskId: "task-1",
        userId: "u1",
        action: "STATUS_CHANGE",
        detail: { from: "TODO", to: "IN_PROGRESS" },
        createdAt: startTime,
        task: { id: "task-1", title: "Fix bug", category: "PLANNED", status: "DONE" },
      },
      {
        id: "act-2",
        taskId: "task-1",
        userId: "u1",
        action: "STATUS_CHANGE",
        detail: { from: "IN_PROGRESS", to: "DONE" },
        createdAt: now,
        task: { id: "task-1", title: "Fix bug", category: "PLANNED", status: "DONE" },
      },
    ]);

    // Already logged 2h
    mockTimeEntry.findMany.mockResolvedValue([
      { taskId: "task-1", hours: 2 },
    ]);

    const { GET } = await import("@/app/api/time-entries/suggestions/route");
    const res = await GET(
      createMockRequest("/api/time-entries/suggestions", {
        searchParams: { date: "2026-03-27" },
      })
    );
    const body = await res.json();
    const entry = body.data.find(
      (s: { type: string }) => s.type === "time_entry"
    );
    expect(entry).toBeDefined();
    expect(entry.suggestedHours).toBe(0);
    expect(entry.alreadyLogged).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/time-entries/suggestions/route");
    const res = await GET(createMockRequest("/api/time-entries/suggestions"));
    expect(res.status).toBe(401);
  });
});

// ── Confirmation Tests ───────────────────────────────────────────────────────

describe("POST /api/time-entries/confirm-suggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates time entries for confirmed suggestions", async () => {
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops)
    );
    mockTimeEntry.create.mockResolvedValue({ id: "entry-1" });

    const { POST } = await import(
      "@/app/api/time-entries/confirm-suggestions/route"
    );
    const res = await POST(
      createMockRequest("/api/time-entries/confirm-suggestions", {
        method: "POST",
        body: {
          suggestions: [
            { taskId: "task-1", hours: 2, date: "2026-03-27", category: "PLANNED_TASK" },
          ],
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.confirmed).toBe(1);
  });

  it("rejects empty suggestions array", async () => {
    const { POST } = await import(
      "@/app/api/time-entries/confirm-suggestions/route"
    );
    const res = await POST(
      createMockRequest("/api/time-entries/confirm-suggestions", {
        method: "POST",
        body: { suggestions: [] },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid hours", async () => {
    const { POST } = await import(
      "@/app/api/time-entries/confirm-suggestions/route"
    );
    const res = await POST(
      createMockRequest("/api/time-entries/confirm-suggestions", {
        method: "POST",
        body: {
          suggestions: [
            { taskId: "task-1", hours: -1, date: "2026-03-27" },
          ],
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid date format", async () => {
    const { POST } = await import(
      "@/app/api/time-entries/confirm-suggestions/route"
    );
    const res = await POST(
      createMockRequest("/api/time-entries/confirm-suggestions", {
        method: "POST",
        body: {
          suggestions: [
            { taskId: "task-1", hours: 1, date: "invalid" },
          ],
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import(
      "@/app/api/time-entries/confirm-suggestions/route"
    );
    const res = await POST(
      createMockRequest("/api/time-entries/confirm-suggestions", {
        method: "POST",
        body: { suggestions: [{ taskId: "t1", hours: 1, date: "2026-03-27" }] },
      })
    );
    expect(res.status).toBe(401);
  });
});
