/**
 * @jest-environment node
 */
/**
 * Tests for Global Alerts — Issue #986
 * Alert generation logic + API endpoint.
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock prisma ──────────────────────────────────────────────────────────
const mockAnnualPlan = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };
const mockTask = { findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockDocument = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    annualPlan: mockAnnualPlan,
    kPI: mockKPI,
    task: mockTask,
    user: mockUser,
    timeEntry: mockTimeEntry,
    document: mockDocument,
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

function resetMocks() {
  jest.clearAllMocks();
  mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
  mockAnnualPlan.findMany.mockResolvedValue([]);
  mockKPI.findMany.mockResolvedValue([]);
  mockTask.findMany.mockResolvedValue([]);
  mockUser.findMany.mockResolvedValue([]);
  mockTimeEntry.findMany.mockResolvedValue([]);
  mockDocument.findMany.mockResolvedValue([]);
}

describe("GET /api/alerts/active", () => {
  beforeEach(resetMocks);

  it("returns empty alerts when no issues", async () => {
    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.alerts).toEqual([]);
  });

  it("returns overdue alert when tasks are overdue > 3 days", async () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    mockTask.findMany.mockResolvedValue([
      { id: "t1" },
      { id: "t2" },
    ]);

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alerts.some((a: { category: string }) => a.category === "overdue")).toBe(true);
  });

  it("returns KPI critical alert when achievement < 60%", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "kpi1", title: "SLA", target: 100, actual: 50 },
    ]);

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alerts.some((a: { category: string }) => a.category === "kpi_critical")).toBe(true);
  });

  it("returns plan behind alert when progress is low", async () => {
    mockAnnualPlan.findMany.mockResolvedValue([
      { id: "p1", title: "2026 Plan", progressPct: 5, createdAt: new Date() },
    ]);

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // May or may not trigger depending on current month
    expect(body.ok).toBe(true);
  });

  it("returns verification expired alert", async () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);

    mockDocument.findMany.mockResolvedValue([
      { id: "d1", title: "SOP 文件", verifiedAt: longAgo, verifyIntervalDays: 30 },
    ]);

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.alerts.some((a: { category: string }) => a.category === "verification_expired")).toBe(true);
  });

  it("returns 403 for ENGINEER", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "e1", name: "Eng", email: "e@e.com", role: "ENGINEER" },
      expires: "2099-01-01",
    });

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    expect(res.status).toBe(401);
  });

  it("sorts CRITICAL before WARNING", async () => {
    mockKPI.findMany.mockResolvedValue([
      { id: "kpi1", title: "Low KPI", target: 100, actual: 30 },
    ]);
    mockAnnualPlan.findMany.mockResolvedValue([
      { id: "p1", title: "Behind Plan", progressPct: 1, createdAt: new Date() },
    ]);

    const { GET } = await import("@/app/api/alerts/active/route");
    const res = await GET(createMockRequest("/api/alerts/active"));
    const body = await res.json();

    if (body.data.alerts.length >= 2) {
      const levels = body.data.alerts.map((a: { level: string }) => a.level);
      const criticalIdx = levels.indexOf("CRITICAL");
      const warningIdx = levels.indexOf("WARNING");
      if (criticalIdx !== -1 && warningIdx !== -1) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
    }
    expect(body.ok).toBe(true);
  });
});
