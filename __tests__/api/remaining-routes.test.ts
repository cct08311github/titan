/**
 * @jest-environment node
 */
/**
 * API route tests for remaining endpoints — Issue #561 (TDD-7)
 *
 * Covers:
 *   - GET  /api/search                          — multi-resource search, pagination, query param
 *   - GET  /api/time-entries/stats               — aggregation, IDOR protection
 *   - GET/POST /api/approvals                    — CRUD, requester/approver roles
 *   - GET  /api/outline/auth-redirect            — session check, redirect URL
 *   - GET/PUT /api/users/[id]/notification-preferences — preferences CRUD
 *   - GET  /api/admin/backup-status              — Manager-only, status format
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTask = { findMany: jest.fn() };
const mockDocument = { findMany: jest.fn() };
const mockTaskComment = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };
const mockUser = { findMany: jest.fn(), findUnique: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockApprovalRequest = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};
const mockNotificationPreference = {
  findMany: jest.fn(),
  upsert: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    document: mockDocument,
    taskComment: mockTaskComment,
    kPI: mockKPI,
    user: mockUser,
    timeEntry: mockTimeEntry,
    approvalRequest: mockApprovalRequest,
    notificationPreference: mockNotificationPreference,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// ── Mock @prisma/client for NotificationType enum ────────────────────────────
jest.mock("@prisma/client", () => ({
  NotificationType: {
    TASK_ASSIGNED: "TASK_ASSIGNED",
    TASK_DUE_SOON: "TASK_DUE_SOON",
    TASK_OVERDUE: "TASK_OVERDUE",
    TASK_COMMENTED: "TASK_COMMENTED",
    MILESTONE_DUE: "MILESTONE_DUE",
    BACKUP_ACTIVATED: "BACKUP_ACTIVATED",
    TASK_CHANGED: "TASK_CHANGED",
  },
}));

// ── Logger / infra mocks ────────────────────────────────────────────────────
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/request-logger", () => ({
  requestLogger: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock("@/lib/csrf", () => ({
  validateCsrf: jest.fn(),
  CsrfError: class CsrfError extends Error {},
}));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}),
  checkRateLimit: jest.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({ log: jest.fn() })),
}));

// ── fs mock for admin/backup-status ──────────────────────────────────────────
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue(""),
  readdirSync: jest.fn().mockReturnValue([]),
}));

// ── Session fixtures ─────────────────────────────────────────────────────────
const MEMBER_SESSION = {
  user: { id: "user-1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};
const ENGINEER_SESSION = {
  user: { id: "eng-1", name: "Engineer", email: "eng@e.com", role: "ENGINEER" },
  expires: "2099-01-01",
};
const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/search
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.findMany.mockResolvedValue([{ id: "t1", title: "Deploy", status: "TODO", priority: "P1", dueDate: null, description: "Deploy app", updatedAt: new Date() }]);
    mockDocument.findMany.mockResolvedValue([]);
    mockTaskComment.findMany.mockResolvedValue([]);
    mockKPI.findMany.mockResolvedValue([]);
    mockUser.findMany.mockResolvedValue([]);
  });

  it("searches across tasks, documents, KPIs, users", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(createMockRequest("/api/search", { searchParams: { q: "Deploy" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("tasks");
    expect(body.data).toHaveProperty("documents");
    expect(body.data).toHaveProperty("kpis");
    expect(body.data).toHaveProperty("users");
    expect(body.data.tasks).toHaveLength(1);
    expect(body.data.tasks[0].type).toBe("task");
  });

  it("returns 200 with empty results when query is empty", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(createMockRequest("/api/search", { searchParams: { q: "" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(0);
  });

  it("returns 200 with empty results when query param is missing", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(createMockRequest("/api/search"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(createMockRequest("/api/search", { searchParams: { q: "test" } }));
    expect(res.status).toBe(401);
  });

  it("includes user search results only for MANAGER role", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockUser.findMany.mockResolvedValue([{ id: "u1", name: "Alice", email: "a@e.com", role: "ENGINEER" }]);
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(createMockRequest("/api/search", { searchParams: { q: "Alice" } }));
    const body = await res.json();
    expect(body.data.users).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/time-entries/stats
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/time-entries/stats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTimeEntry.findMany.mockResolvedValue([
      { hours: 6, category: "PLANNED_TASK" },
      { hours: 2, category: "SUPPORT" },
    ]);
  });

  it("returns aggregated stats for own user", async () => {
    const { GET } = await import("@/app/api/time-entries/stats/route");
    const res = await GET(createMockRequest("/api/time-entries/stats"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalHours).toBe(8);
    expect(body.data.entryCount).toBe(2);
    expect(body.data).toHaveProperty("breakdown");
    expect(body.data).toHaveProperty("taskInvestmentRate");
  });

  it("blocks IDOR — engineer cannot query another user's stats", async () => {
    const { GET } = await import("@/app/api/time-entries/stats/route");
    const res = await GET(
      createMockRequest("/api/time-entries/stats", { searchParams: { userId: "other-user" } }),
    );
    expect(res.status).toBe(403);
  });

  it("allows MANAGER to query another user's stats", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/time-entries/stats/route");
    const res = await GET(
      createMockRequest("/api/time-entries/stats", { searchParams: { userId: "other-user" } }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts date range filters", async () => {
    const { GET } = await import("@/app/api/time-entries/stats/route");
    const res = await GET(
      createMockRequest("/api/time-entries/stats", {
        searchParams: { startDate: "2024-01-01", endDate: "2024-01-31" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockTimeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "eng-1",
          date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/time-entries/stats/route");
    const res = await GET(createMockRequest("/api/time-entries/stats"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET/POST /api/approvals
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/approvals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockApprovalRequest.findMany.mockResolvedValue([
      { id: "a1", type: "TASK_STATUS_CHANGE", status: "PENDING", requesterId: "user-1" },
    ]);
    mockApprovalRequest.count.mockResolvedValue(1);
  });

  it("returns approval list for authenticated user", async () => {
    const { GET } = await import("@/app/api/approvals/route");
    const res = await GET(createMockRequest("/api/approvals"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("items");
    expect(body.data).toHaveProperty("pagination");
  });

  it("filters by status when param provided", async () => {
    const { GET } = await import("@/app/api/approvals/route");
    await GET(createMockRequest("/api/approvals", { searchParams: { status: "PENDING" } }));
    expect(mockApprovalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/approvals/route");
    const res = await GET(createMockRequest("/api/approvals"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/approvals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockApprovalRequest.create.mockResolvedValue({
      id: "new-a1",
      type: "TASK_STATUS_CHANGE",
      resourceId: "task-1",
      resourceType: "Task",
      requesterId: "user-1",
      status: "PENDING",
      requester: { id: "user-1", name: "Test", email: "t@e.com" },
      approver: null,
    });
  });

  it("creates an approval request with valid input", async () => {
    const { POST } = await import("@/app/api/approvals/route");
    const res = await POST(
      createMockRequest("/api/approvals", {
        method: "POST",
        body: {
          type: "TASK_STATUS_CHANGE",
          resourceId: "task-1",
          resourceType: "Task",
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.type).toBe("TASK_STATUS_CHANGE");
  });

  it("rejects missing required fields with 400", async () => {
    const { POST } = await import("@/app/api/approvals/route");
    const res = await POST(
      createMockRequest("/api/approvals", {
        method: "POST",
        body: { type: "TASK_STATUS_CHANGE" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid approval type with 400", async () => {
    const { POST } = await import("@/app/api/approvals/route");
    const res = await POST(
      createMockRequest("/api/approvals", {
        method: "POST",
        body: { type: "INVALID_TYPE", resourceId: "x", resourceType: "Y" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("validates approverId must reference a MANAGER", async () => {
    mockUser.findUnique.mockResolvedValue({ role: "ENGINEER" });
    const { POST } = await import("@/app/api/approvals/route");
    const res = await POST(
      createMockRequest("/api/approvals", {
        method: "POST",
        body: {
          type: "TASK_STATUS_CHANGE",
          resourceId: "task-1",
          resourceType: "Task",
          approverId: "eng-1",
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/approvals/route");
    const res = await POST(
      createMockRequest("/api/approvals", {
        method: "POST",
        body: { type: "TASK_STATUS_CHANGE", resourceId: "t1", resourceType: "Task" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/outline/auth-redirect
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/outline/auth-redirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
  });

  it("redirects to Outline URL when authenticated", async () => {
    const { GET } = await import("@/app/api/outline/auth-redirect/route");
    const res = await GET(createMockRequest("http://localhost:3100/api/outline/auth-redirect"));
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBeTruthy();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/outline/auth-redirect/route");
    const res = await GET(createMockRequest("http://localhost:3100/api/outline/auth-redirect"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET/PUT /api/users/[id]/notification-preferences
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/users/[id]/notification-preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockNotificationPreference.findMany.mockResolvedValue([
      { type: "TASK_ASSIGNED", enabled: true },
      { type: "TASK_OVERDUE", enabled: false },
    ]);
  });

  it("returns all notification preferences for own user", async () => {
    const { GET } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await GET(
      createMockRequest("/api/users/user-1/notification-preferences"),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("preferences");
    expect(body.data.preferences.length).toBeGreaterThan(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await GET(
      createMockRequest("/api/users/user-1/notification-preferences"),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects MEMBER accessing other user preferences with 403", async () => {
    const { GET } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await GET(
      createMockRequest("/api/users/other-user/notification-preferences"),
      { params: Promise.resolve({ id: "other-user" }) },
    );
    expect(res.status).toBe(403);
  });

  it("allows MANAGER to access other user preferences", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await GET(
      createMockRequest("/api/users/other-user/notification-preferences"),
      { params: Promise.resolve({ id: "other-user" }) },
    );
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/users/[id]/notification-preferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockNotificationPreference.upsert.mockImplementation(({ create }: { create: { type: string; enabled: boolean } }) =>
      Promise.resolve({ type: create.type, enabled: create.enabled }),
    );
  });

  it("updates notification preferences for own user", async () => {
    const { PUT } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await PUT(
      createMockRequest("/api/users/user-1/notification-preferences", {
        method: "PUT",
        body: {
          preferences: [
            { type: "TASK_ASSIGNED", enabled: false },
            { type: "TASK_OVERDUE", enabled: true },
          ],
        },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.preferences).toHaveLength(2);
  });

  it("rejects invalid notification type with 400", async () => {
    const { PUT } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await PUT(
      createMockRequest("/api/users/user-1/notification-preferences", {
        method: "PUT",
        body: {
          preferences: [{ type: "INVALID_TYPE", enabled: false }],
        },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing preferences array with 400", async () => {
    const { PUT } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await PUT(
      createMockRequest("/api/users/user-1/notification-preferences", {
        method: "PUT",
        body: {},
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/users/[id]/notification-preferences/route");
    const res = await PUT(
      createMockRequest("/api/users/user-1/notification-preferences", {
        method: "PUT",
        body: { preferences: [{ type: "TASK_ASSIGNED", enabled: true }] },
      }),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/backup-status
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/admin/backup-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
  });

  it("returns backup status summary for MANAGER", async () => {
    const { GET } = await import("@/app/api/admin/backup-status/route");
    const res = await GET(createMockRequest("/api/admin/backup-status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("backupRoot");
    expect(body.data).toHaveProperty("backupCount");
    expect(body.data).toHaveProperty("totalSizeMB");
    expect(body.data).toHaveProperty("recentBackups");
    expect(body.data).toHaveProperty("lastLogLines");
  });

  it("rejects non-MANAGER users with 403", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { GET } = await import("@/app/api/admin/backup-status/route");
    const res = await GET(createMockRequest("/api/admin/backup-status"));
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/backup-status/route");
    const res = await GET(createMockRequest("/api/admin/backup-status"));
    expect(res.status).toBe(401);
  });

  it("returns numeric backup count and size", async () => {
    const { GET } = await import("@/app/api/admin/backup-status/route");
    const res = await GET(createMockRequest("/api/admin/backup-status"));
    const body = await res.json();
    expect(typeof body.data.backupCount).toBe("number");
    expect(typeof body.data.totalSizeMB).toBe("number");
  });
});
