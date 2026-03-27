/**
 * @jest-environment node
 */
/**
 * Tests for Reports V2 API endpoints — Issue #984
 * 15 endpoints, 1+ test per endpoint.
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock prisma ──────────────────────────────────────────────────────────
const mockUser = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockTask = { findMany: jest.fn() };
const mockAnnualPlan = { findUnique: jest.fn() };
const mockMilestone = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };
const mockKPIHistory = { findMany: jest.fn() };
const mockChangeRecord = { findMany: jest.fn() };
const mockIncidentRecord = { findMany: jest.fn() };
const mockAuditLog = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockUser,
    timeEntry: mockTimeEntry,
    task: mockTask,
    annualPlan: mockAnnualPlan,
    milestone: mockMilestone,
    kPI: mockKPI,
    kPIHistory: mockKPIHistory,
    changeRecord: mockChangeRecord,
    incidentRecord: mockIncidentRecord,
    auditLog: mockAuditLog,
  },
}));

// ── Mock auth (MANAGER session) ──────────────────────────────────────────
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
  mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
  mockUser.findMany.mockResolvedValue([]);
  mockTimeEntry.findMany.mockResolvedValue([]);
  mockTask.findMany.mockResolvedValue([]);
  mockAnnualPlan.findUnique.mockResolvedValue(null);
  mockMilestone.findMany.mockResolvedValue([]);
  mockKPI.findMany.mockResolvedValue([]);
  mockKPIHistory.findMany.mockResolvedValue([]);
  mockChangeRecord.findMany.mockResolvedValue([]);
  mockIncidentRecord.findMany.mockResolvedValue([]);
  mockAuditLog.findMany.mockResolvedValue([]);
}

// ── 1. Utilization ───────────────────────────────────────────────────────
describe("GET /api/reports/v2/utilization", () => {
  beforeEach(resetMocks);

  it("returns utilization data for manager", async () => {
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 32 },
      { userId: "u2", hours: 40 },
    ]);

    const { GET } = await import("@/app/api/reports/v2/utilization/route");
    const res = await GET(
      createMockRequest("/api/reports/v2/utilization", {
        searchParams: { startDate: "2026-03-01", endDate: "2026-03-07" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.users).toHaveLength(2);
    expect(body.data).toHaveProperty("avgUtilization");
  });

  it("returns 403 for engineer", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/reports/v2/utilization/route");
    const res = await GET(createMockRequest("/api/reports/v2/utilization"));
    expect(res.status).toBe(403);
  });
});

// ── 2. Unplanned Trend ──────────────────────────────────────────────────
describe("GET /api/reports/v2/unplanned-trend", () => {
  beforeEach(resetMocks);

  it("returns unplanned trend data", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { date: new Date("2026-01-15"), hours: 8, category: "PLANNED_TASK" },
      { date: new Date("2026-01-16"), hours: 4, category: "INCIDENT" },
    ]);

    const { GET } = await import("@/app/api/reports/v2/unplanned-trend/route");
    const res = await GET(createMockRequest("/api/reports/v2/unplanned-trend"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("months");
    expect(body.data).toHaveProperty("avgUnplannedRate");
  });
});

// ── 3. Workload Distribution ────────────────────────────────────────────
describe("GET /api/reports/v2/workload-distribution", () => {
  beforeEach(resetMocks);

  it("returns workload distribution", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 6, category: "PLANNED_TASK", user: { id: "u1", name: "Alice" } },
    ]);

    const { GET } = await import("@/app/api/reports/v2/workload-distribution/route");
    const res = await GET(createMockRequest("/api/reports/v2/workload-distribution"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.users).toHaveLength(1);
    expect(body.data.users[0]).toHaveProperty("byCategory");
  });
});

// ── 4. Velocity ─────────────────────────────────────────────────────────
describe("GET /api/reports/v2/velocity", () => {
  beforeEach(resetMocks);

  it("returns velocity data", async () => {
    const now = new Date();
    mockTask.findMany.mockResolvedValue([
      { id: "t1", status: "DONE", createdAt: now, updatedAt: now },
    ]);

    const { GET } = await import("@/app/api/reports/v2/velocity/route");
    const res = await GET(createMockRequest("/api/reports/v2/velocity"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("weeks");
    expect(body.data).toHaveProperty("avgVelocity");
  });
});

// ── 5. Time Efficiency ──────────────────────────────────────────────────
describe("GET /api/reports/v2/time-efficiency", () => {
  beforeEach(resetMocks);

  it("returns time efficiency data", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 16, user: { id: "u1", name: "Alice" } },
    ]);
    mockTask.findMany.mockResolvedValue([
      { id: "t1", primaryAssigneeId: "u1" },
      { id: "t2", primaryAssigneeId: "u1" },
    ]);

    const { GET } = await import("@/app/api/reports/v2/time-efficiency/route");
    const res = await GET(createMockRequest("/api/reports/v2/time-efficiency"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("avgHoursPerTask");
    expect(body.data.users[0].hoursPerTask).toBe(8);
  });
});

// ── 6. Earned Value ─────────────────────────────────────────────────────
describe("GET /api/reports/v2/earned-value", () => {
  beforeEach(resetMocks);

  it("returns earned value for a plan", async () => {
    mockAnnualPlan.findUnique.mockResolvedValue({
      id: "p1",
      title: "2026 Plan",
      linkedTasks: [
        { id: "t1", status: "DONE", estimatedHours: 100, actualHours: 90, progressPct: 100, dueDate: new Date("2026-01-01"), createdAt: new Date() },
        { id: "t2", status: "IN_PROGRESS", estimatedHours: 50, actualHours: 30, progressPct: 50, dueDate: new Date("2026-06-01"), createdAt: new Date() },
      ],
    });

    const { GET } = await import("@/app/api/reports/v2/earned-value/route");
    const res = await GET(
      createMockRequest("/api/reports/v2/earned-value", {
        searchParams: { planId: "p1" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("spi");
    expect(body.data).toHaveProperty("cpi");
    expect(body.data.planId).toBe("p1");
  });

  it("returns 404 for nonexistent plan", async () => {
    mockAnnualPlan.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/v2/earned-value/route");
    const res = await GET(
      createMockRequest("/api/reports/v2/earned-value", {
        searchParams: { planId: "nonexistent" },
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 without planId", async () => {
    const { GET } = await import("@/app/api/reports/v2/earned-value/route");
    const res = await GET(createMockRequest("/api/reports/v2/earned-value"));
    expect(res.status).toBe(400);
  });
});

// ── 7. Overdue Analysis ─────────────────────────────────────────────────
describe("GET /api/reports/v2/overdue-analysis", () => {
  beforeEach(resetMocks);

  it("returns overdue analysis", async () => {
    mockTask.findMany.mockResolvedValue([
      {
        id: "t1",
        title: "Late task",
        dueDate: new Date("2026-03-01"),
        status: "IN_PROGRESS",
        category: "PLANNED",
        primaryAssignee: { id: "u1", name: "Alice" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/v2/overdue-analysis/route");
    const res = await GET(createMockRequest("/api/reports/v2/overdue-analysis"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalOverdue).toBe(1);
    expect(body.data).toHaveProperty("byPerson");
  });
});

// ── 8. Milestone Achievement ────────────────────────────────────────────
describe("GET /api/reports/v2/milestone-achievement", () => {
  beforeEach(resetMocks);

  it("returns milestone achievement rate", async () => {
    mockMilestone.findMany.mockResolvedValue([
      {
        id: "ms1",
        title: "Launch",
        status: "COMPLETED",
        plannedEnd: new Date("2026-03-01"),
        actualEnd: new Date("2026-03-02"),
        annualPlan: { title: "2026 Plan" },
      },
      {
        id: "ms2",
        title: "Audit",
        status: "DELAYED",
        plannedEnd: new Date("2026-06-01"),
        actualEnd: null,
        annualPlan: { title: "2026 Plan" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/v2/milestone-achievement/route");
    const res = await GET(createMockRequest("/api/reports/v2/milestone-achievement"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.achievementRate).toBe(50);
    expect(body.data.milestones).toHaveLength(2);
  });
});

// ── 9. KPI Trend ────────────────────────────────────────────────────────
describe("GET /api/reports/v2/kpi-trend", () => {
  beforeEach(resetMocks);

  it("returns KPI trend with history", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "kpi1", title: "Availability", target: 99.9 },
    ]);
    mockKPIHistory.findMany.mockResolvedValue([
      { kpiId: "kpi1", period: "2026-01", actual: 99.8 },
      { kpiId: "kpi1", period: "2026-02", actual: 99.95 },
    ]);

    const { GET } = await import("@/app/api/reports/v2/kpi-trend/route");
    const res = await GET(createMockRequest("/api/reports/v2/kpi-trend"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.kpis[0].months).toHaveLength(2);
    expect(body.data.kpis[0]).toHaveProperty("forecast");
  });
});

// ── 10. KPI Correlation ─────────────────────────────────────────────────
describe("GET /api/reports/v2/kpi-correlation", () => {
  beforeEach(resetMocks);

  it("returns KPI correlation data", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "kpi1", title: "SLA", target: 95, actual: 92, taskLinks: [{ taskId: "t1" }] },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      { taskId: "t1", hours: 20 },
    ]);

    const { GET } = await import("@/app/api/reports/v2/kpi-correlation/route");
    const res = await GET(createMockRequest("/api/reports/v2/kpi-correlation"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.kpis[0]).toHaveProperty("linkedTaskHours");
    expect(body.data.kpis[0]).toHaveProperty("correlation");
  });
});

// ── 11. KPI Composite ───────────────────────────────────────────────────
describe("GET /api/reports/v2/kpi-composite", () => {
  beforeEach(resetMocks);

  it("returns composite KPI score", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "kpi1", title: "SLA", target: 95, actual: 95, weight: 60 },
      { id: "kpi2", title: "MTTR", target: 30, actual: 25, weight: 40 },
    ]);

    const { GET } = await import("@/app/api/reports/v2/kpi-composite/route");
    const res = await GET(createMockRequest("/api/reports/v2/kpi-composite"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("compositeScore");
    expect(body.data.kpis).toHaveLength(2);
  });
});

// ── 12. Overtime Analysis ───────────────────────────────────────────────
describe("GET /api/reports/v2/overtime-analysis", () => {
  beforeEach(resetMocks);

  it("returns overtime analysis", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 3, overtimeType: "WEEKDAY", date: new Date("2026-03-15"), user: { id: "u1", name: "Alice" } },
      { userId: "u1", hours: 8, overtimeType: "REST_DAY", date: new Date("2026-03-16"), user: { id: "u1", name: "Alice" } },
    ]);

    const { GET } = await import("@/app/api/reports/v2/overtime-analysis/route");
    const res = await GET(createMockRequest("/api/reports/v2/overtime-analysis"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.users).toHaveLength(1);
    expect(body.data.users[0].totalOvertimeHours).toBe(11);
    expect(body.data).toHaveProperty("byMonth");
  });
});

// ── 13. Change Summary ──────────────────────────────────────────────────
describe("GET /api/reports/v2/change-summary", () => {
  beforeEach(resetMocks);

  it("returns change management summary", async () => {
    mockChangeRecord.findMany.mockResolvedValue([
      {
        id: "cr1",
        changeNumber: "CHG-2026-0301-01",
        type: "NORMAL",
        status: "COMPLETED",
        riskLevel: "MEDIUM",
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        createdAt: new Date(),
        task: { id: "t1", title: "Deploy v2" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/v2/change-summary/route");
    const res = await GET(createMockRequest("/api/reports/v2/change-summary"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data).toHaveProperty("byType");
    expect(body.data).toHaveProperty("byStatus");
  });
});

// ── 14. Incident SLA ────────────────────────────────────────────────────
describe("GET /api/reports/v2/incident-sla", () => {
  beforeEach(resetMocks);

  it("returns incident SLA metrics", async () => {
    mockIncidentRecord.findMany.mockResolvedValue([
      {
        id: "inc1",
        severity: "SEV1",
        incidentStart: new Date("2026-03-01T10:00:00"),
        incidentEnd: new Date("2026-03-01T11:00:00"),
        mttrMinutes: 60,
        task: { id: "t1", title: "DB Outage", slaDeadline: new Date("2026-03-01T14:00:00"), status: "DONE" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/v2/incident-sla/route");
    const res = await GET(createMockRequest("/api/reports/v2/incident-sla"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.slaMetRate).toBe(100);
    expect(body.data.avgMttr).toBe(60);
    expect(body.data).toHaveProperty("bySeverity");
  });
});

// ── 15. Permission Audit ────────────────────────────────────────────────
describe("GET /api/reports/v2/permission-audit", () => {
  beforeEach(resetMocks);

  it("returns permission audit logs", async () => {
    mockAuditLog.findMany.mockResolvedValue([
      {
        id: "al1",
        userId: "m1",
        action: "CREATE_PERMISSIONS",
        resourceId: "p1",
        detail: "Granted VIEW_TEAM to u1",
        createdAt: new Date(),
        metadata: {},
      },
    ]);

    const { GET } = await import("@/app/api/reports/v2/permission-audit/route");
    const res = await GET(createMockRequest("/api/reports/v2/permission-audit"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalChanges).toBe(1);
    expect(body.data).toHaveProperty("byAction");
  });
});

// ── Cross-cutting: Auth denied ──────────────────────────────────────────
describe("Reports V2 — auth enforcement", () => {
  beforeEach(resetMocks);

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/v2/utilization/route");
    const res = await GET(createMockRequest("/api/reports/v2/utilization"));
    expect(res.status).toBe(401);
  });
});
