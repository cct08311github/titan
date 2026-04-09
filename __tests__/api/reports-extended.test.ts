/**
 * @jest-environment node
 */
/**
 * Extended API route tests for report endpoints — Issue #560 (TDD-6)
 *
 * Covers:
 *   - GET  /api/reports/weekly      — date range, data aggregation
 *   - GET  /api/reports/monthly     — month boundaries, stats
 *   - GET  /api/reports/export      — CSV format, Excel format, Content-Type headers
 *   - GET  /api/reports/trends      — multi-year, metric parameter
 *   - GET  /api/reports/delay-change — delay/change stats
 *   - POST /api/reports/scheduled   — idempotency, Manager notification
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTask = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockTaskChange = { findMany: jest.fn() };
const mockMonthlyGoal = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };
const mockNotification = { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn() };
const mockUser = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    timeEntry: mockTimeEntry,
    taskChange: mockTaskChange,
    monthlyGoal: mockMonthlyGoal,
    kPI: mockKPI,
    notification: mockNotification,
    user: mockUser,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// Mock @/auth for requireAuth() (Auth.js v5 uses auth() not getServerSession)
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockGetServerSession(...args) }));

// ── Service mocks ────────────────────────────────────────────────────────────
const mockGetWeeklyReport = jest.fn();
const mockGetMonthlyReport = jest.fn();
const mockGetDelayChangeReport = jest.fn();
jest.mock("@/services/report-service", () => ({
  ReportService: jest.fn().mockImplementation(() => ({
    getWeeklyReport: mockGetWeeklyReport,
    getMonthlyReport: mockGetMonthlyReport,
    getDelayChangeReport: mockGetDelayChangeReport,
  })),
}));

const mockExportWeekly = jest.fn();
const mockExportMonthly = jest.fn();
const mockExportKPI = jest.fn();
const mockExportWorkload = jest.fn();
const mockGenerateExcel = jest.fn();
const mockGeneratePDF = jest.fn();
jest.mock("@/services/export-service", () => ({
  ExportService: jest.fn().mockImplementation(() => ({
    exportWeeklyReport: mockExportWeekly,
    exportMonthlyReport: mockExportMonthly,
    exportKPIReport: mockExportKPI,
    exportWorkloadReport: mockExportWorkload,
    generateExcel: mockGenerateExcel,
    generatePDF: mockGeneratePDF,
  })),
}));

jest.mock("@/lib/kpi-calculator", () => ({
  calculateAchievement: jest.fn((kpi: { actual: number; target: number }) =>
    kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0
  ),
  calculateAvgAchievement: jest.fn((rates: number[]) =>
    rates.length > 0 ? rates.reduce((a: number, b: number) => a + b, 0) / rates.length : 0
  ),
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

// ── Session fixtures ─────────────────────────────────────────────────────────
const MEMBER_SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};
const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/reports/weekly — extended
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/reports/weekly — extended", () => {
  const mockWeeklyData = {
    period: { start: new Date("2024-01-15"), end: new Date("2024-01-21") },
    completedTasks: [{ id: "t1" }],
    completedCount: 1,
    totalHours: 6,
    hoursByCategory: { PLANNED_TASK: 4, SUPPORT: 2 },
    overdueTasks: [],
    overdueCount: 0,
    changes: [],
    delayCount: 2,
    scopeChangeCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockGetWeeklyReport.mockResolvedValue(mockWeeklyData);
  });

  it("returns weekly report with date range and aggregated data", async () => {
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("period");
    expect(body.data).toHaveProperty("totalHours");
    expect(body.data).toHaveProperty("completedTasks");
    expect(body.data.totalHours).toBe(6);
  });

  it("accepts a specific date parameter for custom week range", async () => {
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(
      createMockRequest("/api/reports/weekly", { searchParams: { date: "2024-06-15" } }),
    );
    expect(res.status).toBe(200);
    expect(mockGetWeeklyReport).toHaveBeenCalledWith(
      expect.objectContaining({
        refDate: expect.any(Date),
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    expect(res.status).toBe(401);
  });

  it("returns delay and scope change counts from report data", async () => {
    const { GET } = await import("@/app/api/reports/weekly/route");
    const res = await GET(createMockRequest("/api/reports/weekly"));
    const body = await res.json();
    expect(body.data.delayCount).toBe(2);
    expect(body.data.scopeChangeCount).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/reports/monthly — extended
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/reports/monthly — extended", () => {
  const mockMonthlyData = {
    period: { year: 2024, month: 3, start: new Date("2024-03-01"), end: new Date("2024-03-31") },
    totalTasks: 10,
    completedTasks: 5,
    completionRate: 50,
    totalHours: 160,
    hoursByCategory: { PLANNED_TASK: 120 },
    monthlyGoals: [],
    changes: [],
    delayCount: 1,
    scopeChangeCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockGetMonthlyReport.mockResolvedValue(mockMonthlyData);
  });

  it("returns monthly report with correct period boundaries", async () => {
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(
      createMockRequest("/api/reports/monthly", { searchParams: { month: "2024-03" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("period");
    expect(body.data).toHaveProperty("completionRate");
  });

  it("reports correct completion rate from service data", async () => {
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly"));
    const body = await res.json();
    expect(body.data.completionRate).toBe(50);
  });

  it("passes correct year/month to ReportService", async () => {
    const { GET } = await import("@/app/api/reports/monthly/route");
    await GET(createMockRequest("/api/reports/monthly", { searchParams: { month: "2025-12" } }));
    expect(mockGetMonthlyReport).toHaveBeenCalledWith(
      expect.objectContaining({ year: 2025, month: 12 }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/monthly/route");
    const res = await GET(createMockRequest("/api/reports/monthly"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/reports/export
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/reports/export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.findMany.mockResolvedValue([]);
    mockTimeEntry.findMany.mockResolvedValue([]);
    mockKPI.findMany.mockResolvedValue([]);
    mockExportWeekly.mockReturnValue({
      title: "Weekly Report",
      columns: [{ header: "Task", key: "title" }],
      rows: [{ title: "T1" }],
    });
    mockExportMonthly.mockReturnValue({
      title: "Monthly Report",
      columns: [{ header: "Task", key: "title" }],
      rows: [{ title: "T1" }],
    });
    mockGenerateExcel.mockResolvedValue(Buffer.from("xlsx-data"));
    mockGeneratePDF.mockReturnValue("<html>report</html>");
  });

  it("returns CSV with correct Content-Type header", async () => {
    const { GET } = await import("@/app/api/reports/export/route");
    const res = await GET(
      createMockRequest("/api/reports/export", {
        searchParams: { type: "weekly", format: "csv" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("weekly-report.csv");
  });

  it("returns Excel (xlsx) with correct Content-Type header", async () => {
    const { GET } = await import("@/app/api/reports/export/route");
    const res = await GET(
      createMockRequest("/api/reports/export", {
        searchParams: { type: "weekly", format: "xlsx" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toContain("weekly-report.xlsx");
  });

  it("returns PDF (HTML) with correct Content-Type header", async () => {
    const { GET } = await import("@/app/api/reports/export/route");
    const res = await GET(
      createMockRequest("/api/reports/export", {
        searchParams: { type: "weekly", format: "pdf" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("defaults to xlsx format when format param is not specified", async () => {
    const { GET } = await import("@/app/api/reports/export/route");
    const res = await GET(
      createMockRequest("/api/reports/export", { searchParams: { type: "weekly" } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/export/route");
    const res = await GET(createMockRequest("/api/reports/export"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/reports/trends
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/reports/trends", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockKPI.findMany.mockResolvedValue([]);
    mockTimeEntry.findMany.mockResolvedValue([]);
    mockTask.findMany.mockResolvedValue([]);
  });

  it("returns multi-year KPI trends", async () => {
    mockKPI.findMany.mockResolvedValue([
      { code: "K1", title: "KPI 1", target: 100, actual: 80, status: "ACTIVE", weight: 1 },
    ]);
    const { GET } = await import("@/app/api/reports/trends/route");
    const res = await GET(
      createMockRequest("/api/reports/trends", {
        searchParams: { metric: "kpi", years: "2024,2025" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Response is wrapped: { ok: true, data: { metric, years, data } }
    expect(body.data.metric).toBe("kpi");
    expect(body.data.years).toEqual([2024, 2025]);
    expect(body.data.data).toHaveProperty("2024");
    expect(body.data.data).toHaveProperty("2025");
  });

  it("returns workload trend data for specified metric", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { date: new Date("2024-03-15"), hours: 8, task: { category: "PLANNED" } },
    ]);
    const { GET } = await import("@/app/api/reports/trends/route");
    const res = await GET(
      createMockRequest("/api/reports/trends", {
        searchParams: { metric: "workload", years: "2024" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Response is wrapped: { ok: true, data: { metric, years, data } }
    expect(body.data.metric).toBe("workload");
    expect(body.data.data[2024]).toHaveLength(12);
  });

  it("returns 400 for invalid years parameter", async () => {
    const { GET } = await import("@/app/api/reports/trends/route");
    const res = await GET(
      createMockRequest("/api/reports/trends", {
        searchParams: { years: "abc" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown metric", async () => {
    const { GET } = await import("@/app/api/reports/trends/route");
    const res = await GET(
      createMockRequest("/api/reports/trends", {
        searchParams: { metric: "invalid", years: "2024" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/trends/route");
    // trends route uses apiHandler which catches UnauthorizedError and returns 401
    const res = await GET(createMockRequest("/api/reports/trends"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/reports/delay-change
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/reports/delay-change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockGetDelayChangeReport.mockResolvedValue({
      delays: 5,
      scopeChanges: 3,
      total: 8,
    });
  });

  it("returns delay/change stats for authenticated user", async () => {
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("delays");
  });

  it("accepts date range parameters", async () => {
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(
      createMockRequest("/api/reports/delay-change", {
        searchParams: { startDate: "2024-01-01", endDate: "2024-01-31" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockGetDelayChangeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/reports/delay-change/route");
    const res = await GET(createMockRequest("/api/reports/delay-change"));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/reports/scheduled
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/reports/scheduled", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockNotification.count.mockResolvedValue(0);
    mockNotification.findMany.mockResolvedValue([]);
    mockNotification.createMany.mockResolvedValue({ count: 2 });
    mockUser.findMany.mockResolvedValue([
      { id: "mgr-1" },
      { id: "mgr-2" },
    ]);
    mockGetWeeklyReport.mockResolvedValue({
      period: { start: new Date("2024-01-08"), end: new Date("2024-01-14") },
      completedCount: 5,
      totalHours: 40,
      overdueCount: 1,
      delayCount: 2,
      scopeChangeCount: 0,
    });
  });

  it("generates scheduled report and notifies managers", async () => {
    const { POST } = await import("@/app/api/reports/scheduled/route");
    const res = await POST(createMockRequest("/api/reports/scheduled", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveProperty("notified");
    expect(body.data).toHaveProperty("managers");
  });

  it("returns idempotent response when report was already generated today", async () => {
    mockNotification.count.mockResolvedValue(1);
    const { POST } = await import("@/app/api/reports/scheduled/route");
    const res = await POST(createMockRequest("/api/reports/scheduled", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.idempotent).toBe(true);
    expect(body.data.notified).toBe(0);
  });

  it("rejects non-MANAGER users with 403", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { POST } = await import("@/app/api/reports/scheduled/route");
    const res = await POST(createMockRequest("/api/reports/scheduled", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/reports/scheduled/route");
    const res = await POST(createMockRequest("/api/reports/scheduled", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});
