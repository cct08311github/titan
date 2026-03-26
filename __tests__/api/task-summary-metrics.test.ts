/**
 * @jest-environment node
 */
/**
 * Task Summary Metrics API — Issue #808 (D-2)
 *
 * Tests GET /api/metrics/task-summary for team/personal task status summary.
 */

import { NextRequest } from "next/server";

// ── Auth mock ─────────────────────────────────────────────────────────
const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuthFn(...args),
}));

// ── Prisma mock ─────────────────────────────────────────────────────
const mockTaskCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      count: (...args: unknown[]) => mockTaskCount(...args),
    },
  },
}));

import { GET } from "@/app/api/metrics/task-summary/route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/metrics/task-summary (D-2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: 6 calls in the handler (todo, inProgress, doneThisWeek, todoLastWeek, inProgressLastWeek, doneLastWeek)
    mockTaskCount
      .mockResolvedValueOnce(5)  // todo
      .mockResolvedValueOnce(3)  // inProgress
      .mockResolvedValueOnce(2)  // doneThisWeek
      .mockResolvedValueOnce(4)  // todoLastWeek
      .mockResolvedValueOnce(3)  // inProgressLastWeek
      .mockResolvedValueOnce(1); // doneLastWeek
  });

  it("returns team scope for MANAGER", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "mgr-1", name: "主管", email: "mgr@test.com", role: "MANAGER" },
      expires: "2099-01-01",
    });

    const req = makeRequest("/api/metrics/task-summary?period=week");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.scope).toBe("team");
    expect(body.data.todo).toEqual({ count: 5, trend: "up", diff: 1 });
    expect(body.data.inProgress).toEqual({ count: 3, trend: "same", diff: 0 });
    expect(body.data.done).toEqual({ count: 2, trend: "up", diff: 1 });
  });

  it("returns personal scope for ENGINEER with assignee filter", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "eng-1", name: "工程師", email: "eng@test.com", role: "ENGINEER" },
      expires: "2099-01-01",
    });

    mockTaskCount.mockReset();
    mockTaskCount
      .mockResolvedValueOnce(2)  // todo
      .mockResolvedValueOnce(1)  // inProgress
      .mockResolvedValueOnce(0)  // doneThisWeek
      .mockResolvedValueOnce(2)  // todoLastWeek
      .mockResolvedValueOnce(1)  // inProgressLastWeek
      .mockResolvedValueOnce(0); // doneLastWeek

    const req = makeRequest("/api/metrics/task-summary?period=week");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.scope).toBe("personal");

    // Verify assignee filter applied (check first call's where clause)
    const firstCall = mockTaskCount.mock.calls[0][0];
    expect(firstCall.where.OR).toEqual([
      { primaryAssigneeId: "eng-1" },
      { backupAssigneeId: "eng-1" },
    ]);
  });

  it("shows 0 counts without errors when no tasks exist", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "mgr-1", name: "主管", email: "mgr@test.com", role: "MANAGER" },
      expires: "2099-01-01",
    });

    mockTaskCount.mockReset();
    mockTaskCount.mockResolvedValue(0);

    const req = makeRequest("/api/metrics/task-summary?period=week");
    const res = await GET(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.todo.count).toBe(0);
    expect(body.data.inProgress.count).toBe(0);
    expect(body.data.done.count).toBe(0);
  });

  it("calculates correct trend directions", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "mgr-1", name: "主管", email: "mgr@test.com", role: "MANAGER" },
      expires: "2099-01-01",
    });

    mockTaskCount.mockReset();
    mockTaskCount
      .mockResolvedValueOnce(3)  // todo (less than last week 5)
      .mockResolvedValueOnce(5)  // inProgress (more than last week 2)
      .mockResolvedValueOnce(4)  // done (same as last week 4)
      .mockResolvedValueOnce(5)  // todoLastWeek
      .mockResolvedValueOnce(2)  // inProgressLastWeek
      .mockResolvedValueOnce(4); // doneLastWeek

    const req = makeRequest("/api/metrics/task-summary?period=week");
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.todo.trend).toBe("down");
    expect(body.data.todo.diff).toBe(-2);
    expect(body.data.inProgress.trend).toBe("up");
    expect(body.data.inProgress.diff).toBe(3);
    expect(body.data.done.trend).toBe("same");
    expect(body.data.done.diff).toBe(0);
  });

  it("rejects unauthenticated requests", async () => {
    mockAuthFn.mockResolvedValue(null);

    const req = makeRequest("/api/metrics/task-summary?period=week");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
