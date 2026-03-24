/**
 * @jest-environment node
 */
/**
 * API route tests: /api/reports/*
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockTaskChange = { findMany: jest.fn() };
const mockMonthlyGoal = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    timeEntry: mockTimeEntry,
    taskChange: mockTaskChange,
    monthlyGoal: mockMonthlyGoal,
    kPI: mockKPI,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

function setupMocks() {
  mockTask.findMany.mockResolvedValue([]);
  mockTimeEntry.findMany.mockResolvedValue([]);
  mockTaskChange.findMany.mockResolvedValue([]);
  mockMonthlyGoal.findMany.mockResolvedValue([]);
  mockKPI.findMany.mockResolvedValue([]);
}

describe("GET /api/reports/weekly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    setupMocks();
  });

  it("returns weekly report when authenticated", async () => {
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("period");
    expect(data).toHaveProperty("completedTasks");
    expect(data).toHaveProperty("totalHours");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    expect(res.status).toBe(401);
  });

  it("accepts date query param", async () => {
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly", { searchParams: { date: "2024-01-15" } }));
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error", async () => {
    mockTask.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    expect(res.status).toBe(500);
  });

  it("returns delay and scope change counts", async () => {
    mockTaskChange.findMany.mockResolvedValue([
      { changeType: "DELAY" },
      { changeType: "SCOPE_CHANGE" },
    ]);
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    const body = await res.json();
    const data = body.data;
    expect(data.delayCount).toBe(1);
    expect(data.scopeChangeCount).toBe(1);
  });
});

describe("GET /api/reports/monthly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    setupMocks();
  });

  it("returns monthly report when authenticated", async () => {
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("period");
    expect(data).toHaveProperty("completionRate");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly"));
    expect(res.status).toBe(401);
  });

  it("accepts month query param", async () => {
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly", { searchParams: { month: "2024-01" } }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/reports/workload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    setupMocks();
  });

  it("returns workload report when authenticated", async () => {
    const { GET } = await import("@/app/api/reports/workload/route");
    const res = await GET(createMockRequest("/api/reports/workload"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("totalHours");
    expect(data).toHaveProperty("byPerson");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/workload/route");
    const res = await GET(createMockRequest("/api/reports/workload"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/reports/kpi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockKPI.findMany.mockResolvedValue([
      { id: "k1", code: "K1", title: "KPI 1", target: 100, actual: 80, weight: 1, autoCalc: false, taskLinks: [] },
    ]);
  });

  it("returns kpi report when authenticated", async () => {
    const { GET } = await import("@/app/api/reports/kpi/route");
    const res = await GET(createMockRequest("/api/reports/kpi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("year");
    expect(data).toHaveProperty("kpis");
    expect(data).toHaveProperty("avgAchievement");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/kpi/route");
    const res = await GET(createMockRequest("/api/reports/kpi"));
    expect(res.status).toBe(401);
  });

  it("calculates achievement rate from actual vs target", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "k1", code: "K1", title: "KPI 1", target: 100, actual: 100, weight: 1, autoCalc: false, taskLinks: [] },
    ]);
    const { GET } = await import("@/app/api/reports/kpi/route");
    const res = await GET(createMockRequest("/api/reports/kpi"));
    const body = await res.json();
    const data = body.data;
    expect(data.achievedCount).toBe(1);
  });
});

describe("GET /api/reports/delay-change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    setupMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    expect(res.status).toBe(401);
  });

  it("returns delay and change counts when authenticated", async () => {
    mockTaskChange.findMany.mockResolvedValue([
      { changeType: "DELAY", changedAt: new Date("2024-01-10") },
      { changeType: "DELAY", changedAt: new Date("2024-01-11") },
      { changeType: "SCOPE_CHANGE", changedAt: new Date("2024-01-12") },
    ]);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("delayCount");
    expect(data).toHaveProperty("scopeChangeCount");
    expect(data).toHaveProperty("total");
    expect(data.delayCount).toBe(2);
    expect(data.scopeChangeCount).toBe(1);
    expect(data.total).toBe(3);
  });

  it("accepts startDate and endDate query params", async () => {
    mockTaskChange.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(
      createMockRequest("/api/reports/delay-change", {
        searchParams: { startDate: "2024-01-01", endDate: "2024-01-31" },
      })
    );
    expect(res.status).toBe(200);
    expect(mockTaskChange.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          changedAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    );
  });

  it("groups changes by date in byDate field", async () => {
    mockTaskChange.findMany.mockResolvedValue([
      { changeType: "DELAY", changedAt: new Date("2024-01-10T10:00:00Z") },
      { changeType: "SCOPE_CHANGE", changedAt: new Date("2024-01-10T14:00:00Z") },
      { changeType: "DELAY", changedAt: new Date("2024-01-11T09:00:00Z") },
    ]);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("byDate");
    expect(Array.isArray(data.byDate)).toBe(true);
  });

  it("returns 500 on database error", async () => {
    mockTaskChange.findMany.mockRejectedValue(new Error("DB error"));
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    expect(res.status).toBe(500);
  });

  it("returns empty result when no changes exist", async () => {
    mockTaskChange.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    const body = await res.json();
    const data = body.data;
    expect(data.delayCount).toBe(0);
    expect(data.scopeChangeCount).toBe(0);
    expect(data.total).toBe(0);
  });
});
