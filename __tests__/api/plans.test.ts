/**
 * @jest-environment node
 */
/**
 * API route tests: /api/plans and /api/plans/[id]
 */
import { createMockRequest } from "../utils/test-utils";

const mockAnnualPlan = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { annualPlan: mockAnnualPlan } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const MANAGER_SESSION = { user: { id: "mgr-1", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_PLAN = {
  id: "plan-1",
  year: 2024,
  title: "2024 Annual Plan",
  creator: { id: "mgr-1", name: "Mgr" },
  milestones: [],
  monthlyGoals: [],
  _count: { monthlyGoals: 0 },
};

describe("GET /api/plans", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAnnualPlan.findMany.mockResolvedValue([MOCK_PLAN]);
  });

  it("returns plan list when authenticated", async () => {
    const { GET } = await import("@/app/api/plans/route");
    const res = await GET(createMockRequest("/api/plans"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data[0].id).toBe("plan-1");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/plans/route");
    const res = await GET(createMockRequest("/api/plans"));
    expect(res.status).toBe(401);
  });

  it("filters by year when provided", async () => {
    const { GET } = await import("@/app/api/plans/route");
    await GET(createMockRequest("/api/plans", { searchParams: { year: "2024" } }));
    expect(mockAnnualPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: 2024 } })
    );
  });

  it("returns 500 on database error", async () => {
    mockAnnualPlan.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/plans/route");
    const res = await GET(createMockRequest("/api/plans"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/plans", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAnnualPlan.create.mockResolvedValue(MOCK_PLAN);
  });

  it("creates plan with valid data", async () => {
    const { POST } = await import("@/app/api/plans/route");
    const res = await POST(createMockRequest("/api/plans", { method: "POST", body: { year: 2025, title: "Plan" } }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when year is missing", async () => {
    const { POST } = await import("@/app/api/plans/route");
    const res = await POST(createMockRequest("/api/plans", { method: "POST", body: { title: "Plan" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("@/app/api/plans/route");
    const res = await POST(createMockRequest("/api/plans", { method: "POST", body: { year: 2025 } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/plans/route");
    const res = await POST(createMockRequest("/api/plans", { method: "POST", body: { year: 2025, title: "Plan" } }));
    expect(res.status).toBe(401);
  });

  it("creates plan with milestones", async () => {
    mockAnnualPlan.create.mockResolvedValue({ ...MOCK_PLAN, milestones: [{ id: "m1", title: "Q1" }] });
    const { POST } = await import("@/app/api/plans/route");
    const res = await POST(createMockRequest("/api/plans", {
      method: "POST",
      body: { year: 2025, title: "Plan", milestones: [{ title: "Q1", plannedEnd: "2025-03-31" }] },
    }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/plans/copy-template", () => {
  const mockPlanService = {
    copyTemplate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockPlanService.copyTemplate.mockResolvedValue({ ...MOCK_PLAN, year: 2025, copiedFromYear: 2024 });
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await POST(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-1", targetYear: 2025 },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-manager calls copy-template", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", role: "MEMBER" }, expires: "2099" });
    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await POST(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-1", targetYear: 2025 },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when sourcePlanId is missing", async () => {
    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await POST(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { targetYear: 2025 },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetYear is missing", async () => {
    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await POST(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-1" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("copies plan template and returns 201 with the new plan", async () => {
    const copiedPlan = { ...MOCK_PLAN, id: "plan-2", year: 2025, copiedFromYear: 2024 };
    mockAnnualPlan.findUnique.mockResolvedValue({ ...MOCK_PLAN, milestones: [], monthlyGoals: [] });
    mockAnnualPlan.create.mockResolvedValue(copiedPlan);
    const { POST } = await import("@/app/api/plans/copy-template/route");
    const res = await POST(
      createMockRequest("/api/plans/copy-template", {
        method: "POST",
        body: { sourcePlanId: "plan-1", targetYear: 2025 },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const data = body.data;
    expect(data.year).toBe(2025);
  });
});
