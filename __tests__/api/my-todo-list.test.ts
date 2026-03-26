/**
 * @jest-environment node
 */
/**
 * My Todo List — Issue #807 (D-1)
 *
 * Tests the GET /api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW endpoint
 * used by the dashboard "我的待辦" component.
 */

import { NextRequest } from "next/server";

// ── Auth mock ─────────────────────────────────────────────────────────
const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuthFn(...args),
}));

// ── Prisma mock ─────────────────────────────────────────────────────
const mockTaskFindMany = jest.fn();
const mockTaskCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: (...args: unknown[]) => mockTaskFindMany(...args),
      count: (...args: unknown[]) => mockTaskCount(...args),
    },
  },
}));

// ── Import route handler after mocks ────────────────────────────────
import { GET } from "@/app/api/tasks/route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const NOW = new Date("2026-03-26T10:00:00+08:00");

const TASKS = [
  {
    id: "t1",
    title: "逾期任務",
    status: "TODO",
    priority: "P0",
    dueDate: new Date("2026-03-20"),
    tags: ["urgent"],
    primaryAssignee: { id: "u1", name: "王小明", avatar: null },
    backupAssignee: null,
    creator: { id: "u1", name: "王小明" },
    monthlyGoal: null,
    subTasks: [],
    deliverables: [],
    incidentRecord: null,
    _count: { subTasks: 0, comments: 0 },
  },
  {
    id: "t2",
    title: "今天截止",
    status: "IN_PROGRESS",
    priority: "P1",
    dueDate: new Date("2026-03-26"),
    tags: [],
    primaryAssignee: { id: "u1", name: "王小明", avatar: null },
    backupAssignee: null,
    creator: { id: "u1", name: "王小明" },
    monthlyGoal: null,
    subTasks: [],
    deliverables: [],
    incidentRecord: null,
    _count: { subTasks: 0, comments: 0 },
  },
  {
    id: "t3",
    title: "無截止日任務",
    status: "REVIEW",
    priority: "P2",
    dueDate: null,
    tags: ["feature"],
    primaryAssignee: { id: "u1", name: "王小明", avatar: null },
    backupAssignee: null,
    creator: { id: "u1", name: "王小明" },
    monthlyGoal: null,
    subTasks: [],
    deliverables: [],
    incidentRecord: null,
    _count: { subTasks: 0, comments: 0 },
  },
];

describe("GET /api/tasks (my todos — D-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthFn.mockResolvedValue({
      user: { id: "u1", name: "王小明", email: "wang@test.com", role: "ENGINEER" },
      expires: "2099-01-01",
    });
    mockTaskFindMany.mockResolvedValue(TASKS);
    mockTaskCount.mockResolvedValue(TASKS.length);
  });

  it("returns tasks assigned to current user with statuses TODO, IN_PROGRESS, REVIEW", async () => {
    const req = makeRequest("/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW&limit=50");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(3);
    expect(body.data.items[0].id).toBe("t1");
    expect(body.data.items[1].id).toBe("t2");
    expect(body.data.items[2].id).toBe("t3");
  });

  it("does not include DONE tasks", async () => {
    const req = makeRequest("/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW");
    await GET(req);

    // Verify the Prisma call filters for the correct statuses
    const callArgs = mockTaskFindMany.mock.calls[0][0];
    const statusFilter = callArgs.where.status;
    expect(statusFilter).toEqual({ in: ["TODO", "IN_PROGRESS", "REVIEW"] });
  });

  it("resolves assignee=me to the session user id", async () => {
    const req = makeRequest("/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW");
    await GET(req);

    const callArgs = mockTaskFindMany.mock.calls[0][0];
    expect(callArgs.where.OR).toEqual([
      { primaryAssigneeId: "u1" },
      { backupAssigneeId: "u1" },
    ]);
  });

  it("returns empty array with pagination when no tasks", async () => {
    mockTaskFindMany.mockResolvedValue([]);
    mockTaskCount.mockResolvedValue(0);

    const req = makeRequest("/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW");
    const res = await GET(req);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  it("rejects unauthenticated requests", async () => {
    mockAuthFn.mockResolvedValue(null);

    const req = makeRequest("/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
