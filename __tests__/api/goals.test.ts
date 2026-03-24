/**
 * @jest-environment node
 */
/**
 * API route tests: /api/goals
 */
import { createMockRequest } from "../utils/test-utils";

const mockMonthlyGoal = { findMany: jest.fn(), create: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { monthlyGoal: mockMonthlyGoal } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

const MOCK_GOAL = {
  id: "goal-1",
  annualPlanId: "plan-1",
  month: 1,
  title: "January Goal",
  annualPlan: { id: "plan-1", title: "2024 Plan", year: 2024 },
  _count: { tasks: 0 },
  deliverables: [],
};

describe("GET /api/goals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockMonthlyGoal.findMany.mockResolvedValue([MOCK_GOAL]);
  });

  it("returns goal list when authenticated", async () => {
    const { GET } = await import("@/app/api/goals/route");
    const res = await GET(createMockRequest("/api/goals"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].id).toBe("goal-1");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/goals/route");
    const res = await GET(createMockRequest("/api/goals"));
    expect(res.status).toBe(401);
  });

  it("filters by planId", async () => {
    const { GET } = await import("@/app/api/goals/route");
    await GET(createMockRequest("/api/goals", { searchParams: { planId: "plan-1" } }));
    expect(mockMonthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ annualPlanId: "plan-1" }) })
    );
  });

  it("filters by month", async () => {
    const { GET } = await import("@/app/api/goals/route");
    await GET(createMockRequest("/api/goals", { searchParams: { month: "3" } }));
    expect(mockMonthlyGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ month: 3 }) })
    );
  });

  it("returns 500 on database error", async () => {
    mockMonthlyGoal.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/goals/route");
    const res = await GET(createMockRequest("/api/goals"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/goals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockMonthlyGoal.create.mockResolvedValue(MOCK_GOAL);
  });

  it("creates goal with valid data", async () => {
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(createMockRequest("/api/goals", {
      method: "POST",
      body: { annualPlanId: "plan-1", month: 1, title: "January Goal" },
    }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when annualPlanId missing", async () => {
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(createMockRequest("/api/goals", { method: "POST", body: { month: 1, title: "Goal" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when month missing", async () => {
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(createMockRequest("/api/goals", { method: "POST", body: { annualPlanId: "plan-1", title: "Goal" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title missing", async () => {
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(createMockRequest("/api/goals", { method: "POST", body: { annualPlanId: "plan-1", month: 1 } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(createMockRequest("/api/goals", {
      method: "POST",
      body: { annualPlanId: "plan-1", month: 1, title: "Goal" },
    }));
    expect(res.status).toBe(401);
  });
});
