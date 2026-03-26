/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #861: Custom Query Report API
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = {
  findMany: jest.fn(),
  count: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION_MANAGER = {
  user: { id: "u1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099",
};

const SESSION_ENGINEER = {
  user: { id: "u2", name: "Engineer", email: "e@e.com", role: "ENGINEER" },
  expires: "2099",
};

const MOCK_TASKS = [
  {
    id: "t1",
    title: "Oracle patch",
    description: "Apply 19.22 patch",
    category: "PLANNED",
    status: "DONE",
    priority: "P1",
    dueDate: new Date("2026-03-15"),
    createdAt: new Date("2026-01-10"),
    updatedAt: new Date("2026-03-10"),
    estimatedHours: 8,
    actualHours: 10,
    primaryAssignee: { id: "u2", name: "Engineer" },
  },
  {
    id: "t2",
    title: "帳務系統異常排查",
    description: "帳務對帳失敗",
    category: "INCIDENT",
    status: "DONE",
    priority: "P0",
    dueDate: new Date("2026-02-20"),
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-02-18"),
    estimatedHours: 4,
    actualHours: 6,
    primaryAssignee: { id: "u3", name: "Senior" },
  },
];

describe("GET /api/reports/custom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
  });

  it("returns tasks within date range", async () => {
    mockTask.count.mockResolvedValue(2);
    mockTask.findMany.mockResolvedValue(MOCK_TASKS);

    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(2);
    expect(body.data.data).toHaveLength(2);
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(50);
  });

  it("returns 400 when from/to missing", async () => {
    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: { from: "2026-01-01" },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("from");
  });

  it("returns 400 when from > to", async () => {
    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-06-01",
          to: "2026-01-01",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("起始日期不可晚於結束日期");
  });

  it("filters by category", async () => {
    mockTask.count.mockResolvedValue(1);
    mockTask.findMany.mockResolvedValue([MOCK_TASKS[0]]);

    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          category: "PLANNED,INCIDENT",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    // Verify category filter was passed to prisma
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { in: ["PLANNED", "INCIDENT"] },
        }),
      })
    );
  });

  it("filters by status and priority", async () => {
    mockTask.count.mockResolvedValue(1);
    mockTask.findMany.mockResolvedValue([MOCK_TASKS[1]]);

    const { GET } = await import("@/app/api/reports/custom/route");
    await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          status: "DONE",
          priority: "P0,P1",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["DONE"] },
          priority: { in: ["P0", "P1"] },
        }),
      })
    );
  });

  it("supports field selection", async () => {
    mockTask.count.mockResolvedValue(2);
    mockTask.findMany.mockResolvedValue(MOCK_TASKS);

    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          fields: "title,createdAt,category",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // Field-filtered results should still contain id
    expect(body.data.data[0]).toHaveProperty("id");
    expect(body.data.data[0]).toHaveProperty("title");
  });

  it("supports pagination", async () => {
    mockTask.count.mockResolvedValue(100);
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          page: "3",
          limit: "10",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.page).toBe(3);
    expect(body.data.limit).toBe(10);

    // Verify skip/take in prisma call
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (3-1) * 10
        take: 10,
      })
    );
  });

  it("supports sorting", async () => {
    mockTask.count.mockResolvedValue(0);
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/custom/route");
    await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          sort: "priority",
          order: "asc",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { priority: "asc" },
      })
    );
  });

  it("ignores invalid category values", async () => {
    mockTask.count.mockResolvedValue(0);
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/custom/route");
    await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
          category: "INVALID,PLANNED",
        },
      }),
      { params: Promise.resolve({}) }
    );

    // Only valid category should be in the filter
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { in: ["PLANNED"] },
        }),
      })
    );
  });

  it("engineer only sees own tasks", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
    mockTask.count.mockResolvedValue(0);
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/custom/route");
    await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
        },
      }),
      { params: Promise.resolve({}) }
    );

    // Should have OR filter for permission
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ primaryAssigneeId: "u2" }),
          ]),
        }),
      })
    );
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/reports/custom/route");
    const res = await GET(
      createMockRequest("/api/reports/custom", {
        searchParams: {
          from: "2026-01-01",
          to: "2026-03-31",
        },
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(401);
  });
});

// ─── TaskFilters type tests ────────────────────────────────────────────

describe("TaskFilters type — Issue #861", () => {
  it("emptyFilters has new date fields", () => {
    const { emptyFilters } = require("@/app/components/task-filters");
    expect(emptyFilters).toHaveProperty("createdAtFrom", "");
    expect(emptyFilters).toHaveProperty("createdAtTo", "");
    expect(emptyFilters).toHaveProperty("completedAtFrom", "");
    expect(emptyFilters).toHaveProperty("completedAtTo", "");
  });

  it("hasActiveFilters detects createdAtFrom", () => {
    const { hasActiveFilters, emptyFilters } = require("@/app/components/task-filters");
    expect(hasActiveFilters(emptyFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyFilters, createdAtFrom: "2026-01-01" })).toBe(true);
  });
});
