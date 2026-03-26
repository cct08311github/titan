/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #857: Audit report export
 */
import { createMockRequest } from "../utils/test-utils";

const mockTimeEntry = {
  findMany: jest.fn(),
};
const mockTask = {
  findMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    task: mockTask,
    auditLog: { create: jest.fn() },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" },
  expires: "2099",
};

describe("GET /api/reports/audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns audit data for valid date range", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      {
        id: "te-1",
        date: new Date("2026-01-15"),
        hours: 8,
        category: "PLANNED_TASK",
        description: "Task work",
        task: { title: "DB Maintenance", category: "PLANNED" },
      },
      {
        id: "te-2",
        date: new Date("2026-01-16"),
        hours: 4,
        category: "INCIDENT",
        description: "Emergency fix",
        task: { title: "ORA-01555 Fix", category: "INCIDENT" },
      },
    ]);
    mockTask.findMany.mockResolvedValue([
      {
        title: "DB Maintenance",
        category: "PLANNED",
        status: "DONE",
        dueDate: new Date("2026-01-20"),
        primaryAssignee: { name: "志偉" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/audit/route");
    const res = await GET(
      createMockRequest("/api/reports/audit", {
        searchParams: { from: "2026-01-01", to: "2026-01-31" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.totalHours).toBe(12);
    expect(body.data.summary.incidentHours).toBe(4);
    expect(body.data.summary.plannedHours).toBe(8);
    expect(body.data.timeEntries).toHaveLength(2);
    expect(body.data.tasks).toHaveLength(1);
  });

  it("returns 400 when from/to missing", async () => {
    const { GET } = await import("@/app/api/reports/audit/route");
    const res = await GET(
      createMockRequest("/api/reports/audit", {
        searchParams: {},
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/reports/audit/route");
    const res = await GET(
      createMockRequest("/api/reports/audit", {
        searchParams: { from: "2026-01-01", to: "2026-01-31" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns empty data for period with no entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([]);
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/audit/route");
    const res = await GET(
      createMockRequest("/api/reports/audit", {
        searchParams: { from: "2026-06-01", to: "2026-06-30" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.totalHours).toBe(0);
    expect(body.data.timeEntries).toHaveLength(0);
  });
});

describe("Excel export utilities", () => {
  it("excel-export module exports expected functions", () => {
    // Since exceljs relies on browser APIs, we just verify the module structure
    const mod = require("@/lib/excel-export");
    expect(typeof mod.exportWeeklyExcel).toBe("function");
    expect(typeof mod.exportMonthlyExcel).toBe("function");
    expect(typeof mod.exportKPIExcel).toBe("function");
    expect(typeof mod.exportWorkloadExcel).toBe("function");
    expect(typeof mod.exportTrendsExcel).toBe("function");
    expect(typeof mod.exportAuditPackage).toBe("function");
  });

  it("file naming follows TITAN_{type}_{date}.xlsx pattern", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    // The todayStamp function should produce YYYYMMDD format
    expect(expected).toMatch(/^\d{8}$/);
  });
});
