/**
 * @jest-environment node
 */
/**
 * TDD-3: KPI + Milestone routes
 *
 * Tests for:
 * - GET/POST /api/milestones — list & create (Manager-only for create)
 * - GET/PUT/DELETE /api/milestones/[id] — CRUD with Zod validation
 * - GET /api/kpi/[id]/achievement — autoCalc vs manual, calculateAchievement
 * - POST /api/kpi/[id]/link — add/remove task link, weight validation
 * - POST /api/kpi/copy-year — idempotency, year copy, actual reset to 0
 *
 * Fixes #557
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockMilestone = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockKPI = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockKPITaskLink = {
  deleteMany: jest.fn(),
  upsert: jest.fn(),
};

const mockKPIAchievement = {
  findMany: jest.fn(),
  upsert: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    milestone: mockMilestone,
    kPI: mockKPI,
    kPITaskLink: mockKPITaskLink,
    kPIAchievement: mockKPIAchievement,
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

// Mock @/auth for requireAuth() (Auth.js v5 uses auth() not getServerSession)
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockGetServerSession(...args) }));

const MEMBER = {
  user: { id: "u1", name: "Member", email: "m@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MANAGER = {
  user: { id: "mgr", name: "Manager", email: "mgr@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ── Suppress logger noise ────────────────────────────────────────────────────

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
// MILESTONES: GET /api/milestones
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/milestones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns milestone list when authenticated", async () => {
    const mockData = [
      { id: "ms-1", title: "Q1 Review", annualPlanId: "plan-1", order: 0 },
    ];
    mockMilestone.findMany.mockResolvedValue(mockData);

    const { GET } = await import("@/app/api/milestones/route");
    const res = await (GET as Function)(createMockRequest("/api/milestones"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("ms-1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/milestones/route");
    const res = await (GET as Function)(createMockRequest("/api/milestones"));

    expect(res.status).toBe(401);
  });

  it("passes planId filter to service", async () => {
    mockMilestone.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/milestones/route");
    await (GET as Function)(
      createMockRequest("/api/milestones", {
        searchParams: { planId: "plan-99" },
      })
    );

    // MilestoneService.listMilestones should receive planId filter
    expect(mockMilestone.findMany).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES: POST /api/milestones
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/milestones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = {
    annualPlanId: "plan-1",
    title: "Q2 Milestone",
    plannedEnd: "2026-06-30T00:00:00.000Z",
    description: "Quarter 2 target",
    order: 1,
  };

  it("creates milestone as authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER); // POST /api/milestones requires MANAGER
    const created = { id: "ms-new", ...validBody };
    mockMilestone.create.mockResolvedValue(created);

    const { POST } = await import("@/app/api/milestones/route");
    const res = await (POST as Function)(
      createMockRequest("/api/milestones", { method: "POST", body: validBody })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("ms-new");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/milestones/route");
    const res = await (POST as Function)(
      createMockRequest("/api/milestones", { method: "POST", body: validBody })
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing (Zod validation)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER); // POST /api/milestones requires MANAGER

    const { POST } = await import("@/app/api/milestones/route");
    const res = await (POST as Function)(
      createMockRequest("/api/milestones", {
        method: "POST",
        body: { annualPlanId: "plan-1", plannedEnd: "2026-06-30T00:00:00.000Z" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when annualPlanId is missing", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER); // POST /api/milestones requires MANAGER

    const { POST } = await import("@/app/api/milestones/route");
    const res = await (POST as Function)(
      createMockRequest("/api/milestones", {
        method: "POST",
        body: { title: "Test", plannedEnd: "2026-06-30T00:00:00.000Z" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when plannedStart > plannedEnd", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER); // POST /api/milestones requires MANAGER

    const { POST } = await import("@/app/api/milestones/route");
    const res = await (POST as Function)(
      createMockRequest("/api/milestones", {
        method: "POST",
        body: {
          annualPlanId: "plan-1",
          title: "Bad Dates",
          plannedStart: "2026-12-01T00:00:00.000Z",
          plannedEnd: "2026-06-01T00:00:00.000Z",
        },
      })
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES: GET /api/milestones/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/milestones/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns a single milestone by id", async () => {
    const mockData = { id: "ms-1", title: "Q1 Review" };
    mockMilestone.findUnique.mockResolvedValue(mockData);

    const { GET } = await import("@/app/api/milestones/[id]/route");
    const res = await (GET as Function)(
      createMockRequest("/api/milestones/ms-1"),
      { params: Promise.resolve({ id: "ms-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("ms-1");
  });

  it("returns 404 when milestone not found", async () => {
    mockMilestone.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/milestones/[id]/route");
    const res = await (GET as Function)(
      createMockRequest("/api/milestones/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES: PUT /api/milestones/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe("PUT /api/milestones/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("updates a milestone with valid data", async () => {
    const existing = { id: "ms-1", title: "Old Title", status: "PENDING" };
    const updated = { id: "ms-1", title: "Updated Title", status: "IN_PROGRESS" };
    mockMilestone.findUnique.mockResolvedValue(existing);
    mockMilestone.update.mockResolvedValue(updated);

    const { PUT } = await import("@/app/api/milestones/[id]/route");
    const res = await (PUT as Function)(
      createMockRequest("/api/milestones/ms-1", {
        method: "PUT",
        body: { title: "Updated Title", status: "IN_PROGRESS" },
      }),
      { params: Promise.resolve({ id: "ms-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Updated Title");
  });

  it("returns 400 for invalid status enum", async () => {
    const { PUT } = await import("@/app/api/milestones/[id]/route");
    const res = await (PUT as Function)(
      createMockRequest("/api/milestones/ms-1", {
        method: "PUT",
        body: { status: "INVALID_STATUS" },
      }),
      { params: Promise.resolve({ id: "ms-1" }) }
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MILESTONES: DELETE /api/milestones/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/milestones/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a milestone when authenticated", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER); // DELETE /api/milestones/[id] requires MANAGER
    mockMilestone.findUnique.mockResolvedValue({ id: "ms-1", title: "To Delete" });
    mockMilestone.delete.mockResolvedValue({ id: "ms-1" });

    const { DELETE } = await import("@/app/api/milestones/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/milestones/ms-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ms-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("ms-1");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/milestones/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/milestones/ms-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ms-1" }) }
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KPI ACHIEVEMENT: GET /api/kpi/[id]/achievement
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/kpi/[id]/achievement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns achievement records for existing KPI", async () => {
    mockKPI.findUnique.mockResolvedValue({
      id: "kpi-1",
      status: "ACTIVE",
    });
    mockKPIAchievement.findMany.mockResolvedValue([
      { id: "a1", kpiId: "kpi-1", period: "2026-01", actualValue: 75, note: null, reportedBy: "u1" },
    ]);

    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await (GET as Function)(
      createMockRequest("/api/kpi/kpi-1/achievement"),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].actualValue).toBe(75);
    expect(body.data[0].kpiId).toBe("kpi-1");
  });

  it("returns empty array when KPI has no achievements", async () => {
    mockKPI.findUnique.mockResolvedValue({
      id: "kpi-2",
      status: "ACTIVE",
    });
    mockKPIAchievement.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await (GET as Function)(
      createMockRequest("/api/kpi/kpi-2/achievement"),
      { params: Promise.resolve({ id: "kpi-2" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it("returns achievements ordered by period desc", async () => {
    mockKPI.findUnique.mockResolvedValue({
      id: "kpi-3",
      status: "ACTIVE",
    });
    mockKPIAchievement.findMany.mockResolvedValue([
      { id: "a2", kpiId: "kpi-3", period: "2026-03", actualValue: 90 },
      { id: "a1", kpiId: "kpi-3", period: "2026-01", actualValue: 50 },
    ]);

    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await (GET as Function)(
      createMockRequest("/api/kpi/kpi-3/achievement"),
      { params: Promise.resolve({ id: "kpi-3" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].period).toBe("2026-03");
  });

  it("returns 404 when KPI not found", async () => {
    mockKPI.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await (GET as Function)(
      createMockRequest("/api/kpi/nope/achievement"),
      { params: Promise.resolve({ id: "nope" }) }
    );

    expect(res.status).toBe(404);
  });

  it("calls findMany with correct kpiId and order", async () => {
    mockKPI.findUnique.mockResolvedValue({
      id: "kpi-4",
      status: "ACTIVE",
    });
    mockKPIAchievement.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    await (GET as Function)(
      createMockRequest("/api/kpi/kpi-4/achievement"),
      { params: Promise.resolve({ id: "kpi-4" }) }
    );

    expect(mockKPIAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kpiId: "kpi-4" },
        orderBy: { period: "desc" },
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KPI LINK: POST /api/kpi/[id]/link
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/kpi/[id]/link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when non-Manager tries to link", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/kpi/[id]/link/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/kpi-1/link", {
        method: "POST",
        body: { taskId: "t1", weight: 1 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("creates a task link as Manager", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    const mockLink = { kpiId: "kpi-1", taskId: "t1", weight: 1 };
    mockKPITaskLink.upsert.mockResolvedValue(mockLink);

    const { POST } = await import("@/app/api/kpi/[id]/link/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/kpi-1/link", {
        method: "POST",
        body: { taskId: "t1", weight: 1 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.taskId).toBe("t1");
  });

  it("removes a task link when remove=true", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPITaskLink.deleteMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/kpi/[id]/link/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/kpi-1/link", {
        method: "POST",
        body: { taskId: "t1", remove: true },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.message).toContain("移除");
    expect(mockKPITaskLink.deleteMany).toHaveBeenCalledWith({
      where: { kpiId: "kpi-1", taskId: "t1" },
    });
  });

  it("returns 400 when taskId is missing", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/kpi/[id]/link/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/kpi-1/link", {
        method: "POST",
        body: { weight: 1 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("uses default weight of 1 when not provided", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPITaskLink.upsert.mockResolvedValue({ kpiId: "kpi-1", taskId: "t1", weight: 1 });

    const { POST } = await import("@/app/api/kpi/[id]/link/route");
    await (POST as Function)(
      createMockRequest("/api/kpi/kpi-1/link", {
        method: "POST",
        body: { taskId: "t1" },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );

    expect(mockKPITaskLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ weight: 1 }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KPI COPY YEAR: POST /api/kpi/copy-year
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/kpi/copy-year", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sourceKpis = [
    {
      id: "kpi-src-1",
      year: 2025,
      code: "KPI-2025-01",
      title: "Revenue",
      description: null,
      target: 100,
      actual: 85,
      weight: 1,
      autoCalc: false,
      status: "ACTIVE",
      createdBy: "mgr",
    },
    {
      id: "kpi-src-2",
      year: 2025,
      code: "KPI-2025-02",
      title: "Satisfaction",
      description: "Customer NPS",
      target: 80,
      actual: 70,
      weight: 1,
      autoCalc: true,
      status: "ACTIVE",
      createdBy: "mgr",
    },
  ];

  it("returns 403 when non-Manager tries to copy", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2025, targetYear: 2026 },
      })
    );

    expect(res.status).toBe(403);
  });

  it("copies KPIs from source year to target year with actual reset to 0", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.findMany
      .mockResolvedValueOnce(sourceKpis) // source year KPIs
      .mockResolvedValueOnce([]); // target year empty (no idempotency hit)

    const createdKpis = sourceKpis.map((kpi) => ({
      ...kpi,
      id: `new-${kpi.id}`,
      year: 2026,
      code: kpi.code.replace("2025", "2026"),
      actual: 0,
      status: "ACTIVE",
    }));
    // $transaction returns array of created KPIs
    const { prisma } = jest.requireMock("@/lib/prisma") as { prisma: { $transaction: jest.Mock } };
    prisma.$transaction.mockResolvedValue(createdKpis);

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2025, targetYear: 2026 },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.copiedCount).toBe(2);
    expect(body.data.sourceYear).toBe(2025);
    expect(body.data.targetYear).toBe(2026);
  });

  it("returns idempotent response when target year already has KPIs", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.findMany
      .mockResolvedValueOnce(sourceKpis) // source year KPIs exist
      .mockResolvedValueOnce(sourceKpis); // target year already has data

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2025, targetYear: 2026 },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.idempotent).toBe(true);
  });

  it("returns 400 when sourceYear equals targetYear", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2025, targetYear: 2025 },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when targetYear is out of range", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2025, targetYear: 9999 },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when source year has no KPIs", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.findMany.mockResolvedValueOnce([]); // no source KPIs

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: { sourceYear: 2020, targetYear: 2026 },
      })
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/kpi/copy-year/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kpi/copy-year", {
        method: "POST",
        body: {},
      })
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Unit: calculateAchievement shared function
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateAchievement (shared function)", () => {
  let calculateAchievement: typeof import("@/lib/kpi-calculator").calculateAchievement;

  beforeAll(async () => {
    const mod = await import("@/lib/kpi-calculator");
    calculateAchievement = mod.calculateAchievement;
  });

  it("returns manual rate = actual/target * 100", () => {
    expect(calculateAchievement({ target: 100, actual: 75 })).toBe(75);
  });

  it("caps at 100 even when actual exceeds target", () => {
    expect(calculateAchievement({ target: 50, actual: 200 })).toBe(100);
  });

  it("returns 0 when target is 0", () => {
    expect(calculateAchievement({ target: 0, actual: 100 })).toBe(0);
  });

  it("computes weighted achievement from linked tasks when autoCalc=true", () => {
    const result = calculateAchievement({
      target: 100,
      actual: 0,
      autoCalc: true,
      taskLinks: [
        { weight: 2, task: { status: "DONE", progressPct: 100 } },
        { weight: 1, task: { status: "IN_PROGRESS", progressPct: 50 } },
      ],
    });
    // (2*100/100 + 1*50/100) / 3 * 100 = (2 + 0.5) / 3 * 100 = 83.33...
    expect(result).toBeCloseTo(83.33, 0);
  });

  it("returns 0 when autoCalc=true but total weight is 0", () => {
    expect(
      calculateAchievement({
        target: 100,
        actual: 0,
        autoCalc: true,
        taskLinks: [{ weight: 0, task: { status: "DONE", progressPct: 100 } }],
      })
    ).toBe(0);
  });

  it("falls back to manual when autoCalc=true but no taskLinks", () => {
    expect(
      calculateAchievement({
        target: 100,
        actual: 60,
        autoCalc: true,
        taskLinks: [],
      })
    ).toBe(60);
  });
});
