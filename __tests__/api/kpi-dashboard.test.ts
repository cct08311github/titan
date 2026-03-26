/**
 * @jest-environment node
 */
/**
 * KPI Dashboard API tests — Issue #823 (KP-3)
 * Tests the GET /api/kpi endpoint with dashboard-specific params
 */
import { createMockRequest } from "../utils/test-utils";

const mockKPI = { findMany: jest.fn(), count: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { kPI: mockKPI } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const ENGINEER = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" }, expires: "2099" };
const MANAGER = { user: { id: "mgr", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_KPI_WITH_ACHIEVEMENT = {
  id: "kpi-1",
  code: "KPI-01",
  title: "Uptime",
  target: 99.9,
  actual: 99.5,
  weight: 30,
  unit: "%",
  status: "ACTIVE",
  frequency: "MONTHLY",
  visibility: "ALL",
  autoCalc: false,
  taskLinks: [],
  deliverables: [],
  creator: { id: "mgr", name: "Mgr" },
  achievements: [{ id: "a1", period: "2026-01", actualValue: 99.5 }],
};

const MOCK_KPI_NO_ACHIEVEMENT = {
  ...MOCK_KPI_WITH_ACHIEVEMENT,
  id: "kpi-2",
  code: "KPI-02",
  title: "No Data",
  actual: 0,
  achievements: [],
};

describe("KPI Dashboard API (GET /api/kpi with dashboard params)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.findMany.mockResolvedValue([MOCK_KPI_WITH_ACHIEVEMENT, MOCK_KPI_NO_ACHIEVEMENT]);
    mockKPI.count.mockResolvedValue(2);
  });

  it("returns KPIs with achievement data for dashboard", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi", {
      searchParams: { include: "latestAchievement", status: "ACTIVE", page: "1", limit: "9" },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBe(2);
  });

  it("supports pagination with page and limit", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", {
      searchParams: { page: "2", limit: "9" },
    }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 9,
        take: 9,
      })
    );
  });

  it("filters ACTIVE KPIs for dashboard", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", {
      searchParams: { status: "ACTIVE" },
    }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("includes latestAchievement when requested", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", {
      searchParams: { include: "latestAchievement" },
    }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          achievements: expect.objectContaining({ take: 1 }),
        }),
      })
    );
  });

  it("ENGINEER only sees ALL-visible KPIs in dashboard", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER);
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", {
      searchParams: { status: "ACTIVE", include: "latestAchievement" },
    }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: "ALL" }),
      })
    );
  });
});
