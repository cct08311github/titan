/**
 * @jest-environment node
 */
/**
 * Tests for Dashboard Tab Integration — Issue #990
 * Verifies the view param on /api/my-day works correctly.
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock prisma ──────────────────────────────────────────────────────────
const mockTask = { findMany: jest.fn() };
const mockTimeEntry = { aggregate: jest.fn(), findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockAnnualPlan = { findMany: jest.fn() };
const mockMonthlyGoal = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    timeEntry: mockTimeEntry,
    user: mockUser,
    annualPlan: mockAnnualPlan,
    monthlyGoal: mockMonthlyGoal,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const MANAGER_SESSION = {
  user: { id: "m1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

const ENGINEER_SESSION = {
  user: { id: "e1", name: "Engineer", email: "e@e.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

function resetMocks() {
  jest.clearAllMocks();
  mockTask.findMany.mockResolvedValue([]);
  mockTimeEntry.aggregate.mockResolvedValue({ _sum: { hours: 0 }, _count: 0 });
  mockTimeEntry.findMany.mockResolvedValue([]);
  mockUser.findMany.mockResolvedValue([]);
  mockAnnualPlan.findMany.mockResolvedValue([]);
  mockMonthlyGoal.findMany.mockResolvedValue([]);
}

describe("GET /api/my-day — view param (Issue #990)", () => {
  beforeEach(resetMocks);

  it("returns MANAGER data by default for managers", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(createMockRequest("/api/my-day"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("MANAGER");
  });

  it("returns MANAGER data with view=team", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(
      createMockRequest("/api/my-day", { searchParams: { view: "team" } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("MANAGER");
    expect(body.data).toHaveProperty("memberWorkload");
  });

  it("returns ENGINEER data when manager requests view=my-day", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(
      createMockRequest("/api/my-day", { searchParams: { view: "my-day" } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("ENGINEER");
    expect(body.data).toHaveProperty("dueTodayTasks");
    expect(body.data).toHaveProperty("dailyTarget");
  });

  it("returns ENGINEER data for engineers regardless of view param", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(
      createMockRequest("/api/my-day", { searchParams: { view: "team" } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("ENGINEER");
  });

  it("backward compatible — no view param for engineer", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(createMockRequest("/api/my-day"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("ENGINEER");
    expect(body.data).toHaveProperty("inProgressTasks");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/my-day/route");
    const res = await GET(createMockRequest("/api/my-day"));
    expect(res.status).toBe(401);
  });
});
