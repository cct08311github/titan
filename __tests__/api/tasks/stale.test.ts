/**
 * @jest-environment node
 */
/**
 * API route tests: GET /api/tasks/stale — Issue #1312
 */
import { createMockRequest } from "../../utils/test-utils";

// Mock next/headers (required for Edge runtime — see CLAUDE.md)
jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

// Mock the stale task service
const mockListStaleTasksForUser = jest.fn();
jest.mock("@/services/stale-task-service", () => ({
  listStaleTasksForUser: (...args: unknown[]) =>
    mockListStaleTasksForUser(...args),
  scanStaleTasks: jest.fn(),
  classifyStaleLevel: jest.fn(),
  STALE_REMIND_DAYS: 3,
  STALE_WARN_DAYS: 7,
  STALE_ESCALATE_DAYS: 14,
  DEDUP_WINDOW_HOURS: 24,
}));

// Mock requireAuth from rbac
const mockRequireAuth = jest.fn();
jest.mock("@/lib/rbac", () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: jest.fn(),
  requireManagerOrAbove: jest.fn(),
}));

// Mock prisma (needed by imported dependencies)
jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { findMany: jest.fn(), createMany: jest.fn() },
  },
}));

// Mock next-auth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

// ── Session fixtures ────────────────────────────────────────────────────────

const SESSION_ENGINEER = {
  user: { id: "e1", name: "Engineer", email: "e@test.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

const SESSION_MANAGER = {
  user: { id: "m1", name: "Manager", email: "m@test.com", role: "MANAGER" },
  expires: "2099-01-01",
};

const SESSION_ADMIN = {
  user: { id: "a1", name: "Admin", email: "a@test.com", role: "ADMIN" },
  expires: "2099-01-01",
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_STALE_TASKS = [
  {
    id: "task-1",
    title: "停滯任務 A",
    level: "ESCALATE" as const,
    daysSinceUpdate: 20,
    dueDate: null,
    assigneeName: "Alice",
    status: "IN_PROGRESS",
  },
  {
    id: "task-2",
    title: "停滯任務 B",
    level: "WARN" as const,
    daysSinceUpdate: 10,
    dueDate: new Date("2024-12-31"),
    assigneeName: "Bob",
    status: "TODO",
  },
  {
    id: "task-3",
    title: "停滯任務 C",
    level: "REMIND" as const,
    daysSinceUpdate: 4,
    dueDate: null,
    assigneeName: "Charlie",
    status: "BACKLOG",
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/tasks/stale", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListStaleTasksForUser.mockResolvedValue(MOCK_STALE_TASKS);
  });

  it("returns 401 when unauthenticated", async () => {
    const { UnauthorizedError } = await import("@/services/errors");
    mockRequireAuth.mockRejectedValue(new UnauthorizedError("Not authenticated"));

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 with tasks for ENGINEER (own tasks only)", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_ENGINEER);
    // ENGINEER should only see own tasks — service handles filtering
    const engineerTasks = [MOCK_STALE_TASKS[0]];
    mockListStaleTasksForUser.mockResolvedValue(engineerTasks);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tasks).toHaveLength(1);
    expect(mockListStaleTasksForUser).toHaveBeenCalledWith(
      "e1",
      "ENGINEER"
    );
  });

  it("returns 200 with all team tasks for MANAGER", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);
    mockListStaleTasksForUser.mockResolvedValue(MOCK_STALE_TASKS);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tasks).toHaveLength(3);
    expect(mockListStaleTasksForUser).toHaveBeenCalledWith(
      "m1",
      "MANAGER"
    );
  });

  it("returns 200 with all tasks for ADMIN", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_ADMIN);
    mockListStaleTasksForUser.mockResolvedValue(MOCK_STALE_TASKS);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tasks).toHaveLength(3);
    expect(mockListStaleTasksForUser).toHaveBeenCalledWith(
      "a1",
      "ADMIN"
    );
  });

  it("filters by level query param", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);
    mockListStaleTasksForUser.mockResolvedValue(MOCK_STALE_TASKS);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale", {
      searchParams: { level: "ESCALATE" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Only ESCALATE tasks pass through filter
    expect(body.data.tasks.every((t: { level: string }) => t.level === "ESCALATE")).toBe(true);
  });

  it("returns 400 for invalid level param", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale", {
      searchParams: { level: "INVALID_LEVEL" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ValidationError");
  });

  it("returns 400 for invalid limit param (non-numeric)", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale", {
      searchParams: { limit: "not-a-number" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ValidationError");
  });

  it("returns 400 for limit out of range", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale", {
      searchParams: { limit: "200" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("respects limit param", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_MANAGER);
    mockListStaleTasksForUser.mockResolvedValue(MOCK_STALE_TASKS);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale", {
      searchParams: { limit: "2" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(2);
    expect(body.data.total).toBe(3); // total reflects all before limit
  });

  it("returns 200 with empty tasks when no stale tasks", async () => {
    mockRequireAuth.mockResolvedValue(SESSION_ENGINEER);
    mockListStaleTasksForUser.mockResolvedValue([]);

    const { GET } = await import("@/app/api/tasks/stale/route");
    const req = createMockRequest("/api/tasks/stale");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(0);
    expect(body.data.total).toBe(0);
  });
});
