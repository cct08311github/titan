/**
 * @jest-environment node
 */
/**
 * TDD-4: Plan/Document/Task sub-routes
 *
 * Tests for:
 * - POST /api/plans/copy-template: milestone copying, date offset
 * - GET /api/documents/[id]/versions: version history list, auth
 * - GET /api/documents/search: search query, pagination
 * - GET/POST /api/tasks/[id]/changes: changeType enum validation, Zod schema
 *
 * Fixes #558
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockAnnualPlan = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockDocumentVersion = {
  findMany: jest.fn(),
};

const mockTaskChange = {
  findMany: jest.fn(),
  create: jest.fn(),
};

const mockPrismaRaw = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    annualPlan: mockAnnualPlan,
    documentVersion: mockDocumentVersion,
    taskChange: mockTaskChange,
    $queryRaw: mockPrismaRaw,
    $transaction: jest.fn((fns: unknown[]) => {
      if (Array.isArray(fns)) return Promise.all(fns);
      if (typeof fns === "function") return (fns as Function)();
      return Promise.resolve(fns);
    }),
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const MEMBER = {
  user: { id: "u1", name: "Member", email: "m@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MANAGER = {
  user: { id: "mgr", name: "Manager", email: "mgr@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ── Suppress infrastructure noise ────────────────────────────────────────────

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/lib/request-logger", () => ({
  requestLogger: (_req: unknown, fn: Function) => fn(),
}));

jest.mock("@/lib/csrf", () => ({
  validateCsrf: jest.fn(),
  CsrfError: class CsrfError extends Error {},
}));

jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 60;
  },
}));

jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ═══════════════════════════════════════════════════════════════════════════
// PLANS: POST /api/plans/copy-template
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/plans/copy-template", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sourcePlan = {
    id: "plan-src",
    year: 2025,
    title: "2025 Annual Plan",
    description: "Source plan",
    implementationPlan: null,
    monthlyGoals: [
      { month: 1, title: "Jan Goal", description: null, status: "COMPLETED", progressPct: 100 },
      { month: 2, title: "Feb Goal", description: null, status: "COMPLETED", progressPct: 100 },
    ],
    milestones: [
      {
        title: "Q1 Review",
        description: null,
        plannedStart: new Date("2025-01-01"),
        plannedEnd: new Date("2025-03-31"),
        order: 0,
      },
      {
        title: "Q2 Review",
        description: "Mid-year",
        plannedStart: new Date("2025-04-01"),
        plannedEnd: new Date("2025-06-30"),
        order: 1,
      },
    ],
  };

  it("returns 403 when non-Manager tries to copy", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-src", targetYear: 2026 },
      })
    );

    expect(res.status).toBe(403);
  });

  it("copies plan with milestones date-shifted by year delta", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockAnnualPlan.findUnique.mockResolvedValue(sourcePlan);

    const createdPlan = {
      id: "plan-new",
      year: 2026,
      title: "2025 Annual Plan",
      copiedFromYear: 2025,
      milestones: [
        { title: "Q1 Review", plannedStart: new Date("2026-01-01"), plannedEnd: new Date("2026-03-31") },
        { title: "Q2 Review", plannedStart: new Date("2026-04-01"), plannedEnd: new Date("2026-06-30") },
      ],
      monthlyGoals: [
        { month: 1, title: "Jan Goal", status: "NOT_STARTED", progressPct: 0 },
        { month: 2, title: "Feb Goal", status: "NOT_STARTED", progressPct: 0 },
      ],
    };
    mockAnnualPlan.create.mockResolvedValue(createdPlan);

    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-src", targetYear: 2026 },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.year).toBe(2026);

    // Verify create was called with milestone date-shift
    expect(mockAnnualPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          year: 2026,
          copiedFromYear: 2025,
          milestones: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                title: "Q1 Review",
                status: "PENDING",
              }),
            ]),
          }),
        }),
      })
    );
  });

  it("returns 404 when source plan does not exist", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockAnnualPlan.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "nonexistent", targetYear: 2026 },
      })
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when sourcePlanId is missing (Zod)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { targetYear: 2026 },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when targetYear is out of range", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-src", targetYear: 1900 },
      })
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS: GET /api/documents/[id]/versions
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/documents/[id]/versions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns version history ordered by version desc", async () => {
    const versions = [
      { id: "v3", version: 3, documentId: "doc-1", creator: { id: "u1", name: "User" } },
      { id: "v2", version: 2, documentId: "doc-1", creator: { id: "u1", name: "User" } },
      { id: "v1", version: 1, documentId: "doc-1", creator: { id: "u1", name: "User" } },
    ];
    mockDocumentVersion.findMany.mockResolvedValue(versions);

    const { GET } = await import("@/app/api/documents/[id]/versions/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0].version).toBe(3);

    // Verify ordering was requested
    expect(mockDocumentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "doc-1" },
        orderBy: { version: "desc" },
      })
    );
  });

  it("returns empty array when no versions exist", async () => {
    mockDocumentVersion.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/documents/[id]/versions/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/documents/[id]/versions/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(res.status).toBe(401);
  });

  it("includes creator info in response", async () => {
    const versions = [
      { id: "v1", version: 1, documentId: "doc-1", creator: { id: "u1", name: "Alice" } },
    ];
    mockDocumentVersion.findMany.mockResolvedValue(versions);

    const { GET } = await import("@/app/api/documents/[id]/versions/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockDocumentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          creator: expect.any(Object),
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS: GET /api/documents/search
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/documents/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns search results for valid query", async () => {
    const results = [
      { id: "doc-1", title: "Test Document", slug: "test-doc", parentId: null, snippet: "Content..." },
    ];
    mockPrismaRaw.mockResolvedValue(results);

    const { GET } = await import("@/app/api/documents/search/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/search", {
        searchParams: { q: "test" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Test Document");
  });

  it("returns empty array when query is empty", async () => {
    const { GET } = await import("@/app/api/documents/search/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/search", {
        searchParams: { q: "" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    // Should NOT call database when q is empty
    expect(mockPrismaRaw).not.toHaveBeenCalled();
  });

  it("returns empty array when q parameter is missing", async () => {
    const { GET } = await import("@/app/api/documents/search/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/search")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it("trims whitespace from query", async () => {
    const { GET } = await import("@/app/api/documents/search/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/search", {
        searchParams: { q: "   " },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(mockPrismaRaw).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/documents/search/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/search", {
        searchParams: { q: "test" },
      })
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS: GET /api/tasks/[id]/changes
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/tasks/[id]/changes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns change history with delay and scope counts", async () => {
    const changes = [
      { id: "c1", taskId: "t1", changeType: "DELAY", reason: "Extended", changedAt: new Date() },
      { id: "c2", taskId: "t1", changeType: "DELAY", reason: "Extended again", changedAt: new Date() },
      { id: "c3", taskId: "t1", changeType: "SCOPE_CHANGE", reason: "New scope", changedAt: new Date() },
    ];
    mockTaskChange.findMany.mockResolvedValue(changes);

    const { GET } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (GET as Function)(
      createMockRequest("/api/tasks/t1/changes"),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.changes).toHaveLength(3);
    expect(body.data.delayCount).toBe(2);
    expect(body.data.scopeChangeCount).toBe(1);
  });

  it("returns empty changes array for task with no history", async () => {
    mockTaskChange.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (GET as Function)(
      createMockRequest("/api/tasks/t99/changes"),
      { params: Promise.resolve({ id: "t99" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.changes).toEqual([]);
    expect(body.data.delayCount).toBe(0);
    expect(body.data.scopeChangeCount).toBe(0);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (GET as Function)(
      createMockRequest("/api/tasks/t1/changes"),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS: POST /api/tasks/[id]/changes
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/tasks/[id]/changes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("creates a DELAY change record", async () => {
    const created = {
      id: "c-new",
      taskId: "t1",
      changeType: "DELAY",
      reason: "Deadline extended",
      oldValue: "2026-03-01",
      newValue: "2026-04-01",
      changedBy: "u1",
      changedByUser: { id: "u1", name: "Member" },
    };
    mockTaskChange.create.mockResolvedValue(created);

    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: {
          changeType: "DELAY",
          reason: "Deadline extended",
          oldValue: "2026-03-01",
          newValue: "2026-04-01",
        },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.changeType).toBe("DELAY");
  });

  it("creates a SCOPE_CHANGE record", async () => {
    const created = {
      id: "c-new",
      taskId: "t1",
      changeType: "SCOPE_CHANGE",
      reason: "Requirements changed",
      changedByUser: { id: "u1", name: "Member" },
    };
    mockTaskChange.create.mockResolvedValue(created);

    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: {
          changeType: "SCOPE_CHANGE",
          reason: "Requirements changed",
        },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.changeType).toBe("SCOPE_CHANGE");
  });

  it("returns 400 for invalid changeType enum", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: {
          changeType: "INVALID_TYPE",
          reason: "test",
        },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: {
          changeType: "DELAY",
        },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when changeType is missing", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: {
          reason: "Some reason",
        },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/t1/changes", {
        method: "POST",
        body: { changeType: "DELAY", reason: "test" },
      }),
      { params: Promise.resolve({ id: "t1" }) }
    );

    expect(res.status).toBe(401);
  });
});
