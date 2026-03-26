/**
 * @jest-environment node
 */
/**
 * Activity Log API + Service tests — Issue #802 (AF-1)
 *
 * Tests the unified activity_log infrastructure including:
 * - ActivityLogger service (logActivity function)
 * - Action/Module enums
 * - GET /api/activity endpoint with pagination/filtering
 * - Append-only constraint (no UPDATE/DELETE)
 * - Metadata JSONB support
 */

import { NextRequest } from "next/server";

// ── Auth mock (manual for node env) ──────────────────────────────────────
const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuthFn(...args),
}));

// ── Prisma mock ─────────────────────────────────────────────────────────
const mockAuditCreate = jest.fn().mockResolvedValue({
  id: "act-1",
  userId: "user-1",
  action: "CREATE",
  module: "KANBAN",
  resourceType: "Task",
  resourceId: "task-1",
  metadata: { before: null, after: { title: "New Task" } },
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0",
  createdAt: new Date(),
});

const mockAuditFindMany = jest.fn().mockResolvedValue([
  {
    id: "act-1",
    userId: "user-1",
    action: "CREATE",
    module: "KANBAN",
    resourceType: "Task",
    resourceId: "task-1",
    metadata: null,
    detail: null,
    ipAddress: "127.0.0.1",
    userAgent: null,
    createdAt: new Date("2026-03-01"),
  },
]);

const mockAuditCount = jest.fn().mockResolvedValue(1);

const mockTaskActivityFindMany = jest.fn().mockResolvedValue([
  {
    id: "ta-1",
    taskId: "task-1",
    userId: "user-1",
    action: "STATUS_CHANGE",
    detail: { from: "TODO", to: "IN_PROGRESS" },
    createdAt: new Date("2026-03-02"),
    user: { id: "user-1", name: "Test User" },
    task: { id: "task-1", title: "Test Task" },
  },
]);

const mockTaskActivityCount = jest.fn().mockResolvedValue(1);

jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
      findMany: (...args: unknown[]) => mockAuditFindMany(...args),
      count: (...args: unknown[]) => mockAuditCount(...args),
    },
    taskActivity: {
      findMany: (...args: unknown[]) => mockTaskActivityFindMany(...args),
      count: (...args: unknown[]) => mockTaskActivityCount(...args),
    },
  },
}));

// ── Rate limiter mock ────────────────────────────────────────────────────
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}),
  checkRateLimit: jest.fn(),
  createLoginRateLimiter: () => ({}),
  RateLimitError: class extends Error {
    retryAfter = 60;
  },
}));

// ── CSRF mock ────────────────────────────────────────────────────────────
jest.mock("@/lib/csrf", () => ({
  validateCsrf: jest.fn(),
  CsrfError: class extends Error {},
}));

// ── Logger mock ──────────────────────────────────────────────────────────
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/lib/request-logger", () => ({
  requestLogger: (_req: unknown, fn: () => unknown) => fn(),
}));

// ═════════════════════════════════════════════════════════════════════════
// ActivityLogger service tests
// ═════════════════════════════════════════════════════════════════════════

describe("ActivityLogger service", () => {
  let logActivity: typeof import("@/services/activity-logger").logActivity;
  let ActivityAction: typeof import("@/services/activity-logger").ActivityAction;
  let ActivityModule: typeof import("@/services/activity-logger").ActivityModule;

  beforeAll(async () => {
    const mod = await import("@/services/activity-logger");
    logActivity = mod.logActivity;
    ActivityAction = mod.ActivityAction;
    ActivityModule = mod.ActivityModule;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should write all required fields via logActivity()", async () => {
    await logActivity({
      userId: "user-1",
      action: ActivityAction.CREATE,
      module: ActivityModule.KANBAN,
      targetType: "Task",
      targetId: "task-1",
      metadata: { before: null, after: { title: "New Task" } },
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const arg = mockAuditCreate.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      userId: "user-1",
      action: "CREATE",
      module: "KANBAN",
      resourceType: "Task",
      resourceId: "task-1",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
    });
    expect(arg.data.metadata).toBeDefined();
  });

  it("should handle null optional fields", async () => {
    await logActivity({
      userId: null,
      action: ActivityAction.LOGIN,
      module: ActivityModule.AUTH,
    });

    const arg = mockAuditCreate.mock.calls[0][0];
    expect(arg.data.userId).toBeNull();
    expect(arg.data.resourceId).toBeNull();
    // Prisma.JsonNull is a special sentinel object, not literal null
    expect(arg.data.metadata).toBeDefined();
  });

  it("should expose all required action types", () => {
    const requiredActions = [
      "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "STATUS_CHANGE",
    ];
    for (const action of requiredActions) {
      expect(Object.values(ActivityAction)).toContain(action);
    }
  });

  it("should expose all required module types", () => {
    const requiredModules = [
      "AUTH", "KANBAN", "TIMESHEET", "KPI", "ADMIN", "GANTT", "PLAN", "SETTINGS",
    ];
    for (const mod of requiredModules) {
      expect(Object.values(ActivityModule)).toContain(mod);
    }
  });

  it("should store before/after diff in metadata", async () => {
    const diff = {
      before: { status: "TODO" },
      after: { status: "IN_PROGRESS" },
    };

    await logActivity({
      userId: "user-1",
      action: ActivityAction.STATUS_CHANGE,
      module: ActivityModule.KANBAN,
      targetType: "Task",
      targetId: "task-1",
      metadata: diff,
    });

    const arg = mockAuditCreate.mock.calls[0][0];
    expect(arg.data.metadata).toEqual(diff);
  });

  it("should not throw when prisma.create fails (fire-and-forget)", async () => {
    mockAuditCreate.mockRejectedValueOnce(new Error("DB connection lost"));

    await expect(
      logActivity({
        userId: "user-1",
        action: ActivityAction.CREATE,
        module: ActivityModule.KANBAN,
      })
    ).resolves.toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// queryActivityLogs service tests
// ═════════════════════════════════════════════════════════════════════════

describe("queryActivityLogs service", () => {
  let queryActivityLogs: typeof import("@/services/activity-logger").queryActivityLogs;

  beforeAll(async () => {
    const mod = await import("@/services/activity-logger");
    queryActivityLogs = mod.queryActivityLogs;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return paginated results with total count", async () => {
    const result = await queryActivityLogs({ page: 1, limit: 20 });

    expect(result.items).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("should apply module filter to where clause", async () => {
    await queryActivityLogs({ module: "AUTH" });

    const call = mockAuditFindMany.mock.calls[0][0];
    expect(call.where.module).toBe("AUTH");
  });

  it("should apply userId filter", async () => {
    await queryActivityLogs({ userId: "user-2" });

    const call = mockAuditFindMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-2");
  });

  it("should cap limit at 100", async () => {
    await queryActivityLogs({ limit: 500 });

    const call = mockAuditFindMany.mock.calls[0][0];
    expect(call.take).toBe(100);
  });

  it("should default page to 1 and limit to 20", async () => {
    await queryActivityLogs({});

    const call = mockAuditFindMany.mock.calls[0][0];
    expect(call.skip).toBe(0);
    expect(call.take).toBe(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/activity endpoint tests
// ═════════════════════════════════════════════════════════════════════════

describe("GET /api/activity", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/activity/route");
    GET = mod.GET as unknown as (req: NextRequest) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 for unauthenticated requests", async () => {
    mockAuthFn.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/activity");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should return merged activity feed for MANAGER", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "user-1", role: "MANAGER" },
      expires: "2099-01-01",
    });

    const req = new NextRequest("http://localhost/api/activity?page=1&limit=20");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.items).toBeDefined();
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it("should support module filter param", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "user-1", role: "MANAGER" },
      expires: "2099-01-01",
    });

    const req = new NextRequest("http://localhost/api/activity?module=AUTH");
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(mockAuditFindMany).toHaveBeenCalled();
    const auditCall = mockAuditFindMany.mock.calls[0][0];
    expect(auditCall.where.module).toBe("AUTH");
  });

  it("should force ENGINEER to see only own logs", async () => {
    mockAuthFn.mockResolvedValue({
      user: { id: "eng-1", role: "ENGINEER" },
      expires: "2099-01-01",
    });

    const req = new NextRequest("http://localhost/api/activity?userId=other-user");
    const res = await GET(req);
    expect(res.status).toBe(200);

    // ENGINEER should have userId forced to own
    const auditCall = mockAuditFindMany.mock.calls[0][0];
    expect(auditCall.where.userId).toBe("eng-1");
    const taskCall = mockTaskActivityFindMany.mock.calls[0][0];
    expect(taskCall.where.userId).toBe("eng-1");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Append-only constraint: no UPDATE/DELETE API
// ═════════════════════════════════════════════════════════════════════════

describe("Activity log append-only", () => {
  it("should NOT export PUT, PATCH, or DELETE handlers", async () => {
    const mod = await import("@/app/api/activity/route");
    expect((mod as Record<string, unknown>).PUT).toBeUndefined();
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined();
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
