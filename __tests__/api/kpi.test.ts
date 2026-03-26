/**
 * @jest-environment node
 */
/**
 * API route tests: /api/kpi and /api/kpi/[id]
 * Enhanced for Sprint 7 KP-1 (#821): new fields, filters, weight validation
 */
import { createMockRequest } from "../utils/test-utils";

const mockKPI = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
};
const mockKPITaskLink = { deleteMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: { kPI: mockKPI, kPITaskLink: mockKPITaskLink },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const ENGINEER = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" }, expires: "2099" };
const MANAGER = { user: { id: "mgr", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_KPI = {
  id: "kpi-1",
  year: 2026,
  code: "KPI-01",
  title: "Revenue Growth",
  description: null,
  measureMethod: "Monthly revenue tracking",
  target: 100,
  actual: 80,
  weight: 10,
  frequency: "MONTHLY",
  minValue: 0,
  maxValue: 100,
  unit: "%",
  visibility: "ALL",
  status: "ACTIVE",
  autoCalc: false,
  taskLinks: [],
  deliverables: [],
  creator: { id: "mgr", name: "Mgr" },
};

describe("GET /api/kpi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER);
    mockKPI.findMany.mockResolvedValue([MOCK_KPI]);
    mockKPI.count.mockResolvedValue(1);
  });

  it("returns paginated kpi list when authenticated", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0].id).toBe("kpi-1");
    expect(body.data.total).toBe(1);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(401);
  });

  it("filters by year", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", { searchParams: { year: "2023" } }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ year: 2023 }),
      })
    );
  });

  it("filters by status", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", { searchParams: { status: "DRAFT" } }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT" }),
      })
    );
  });

  it("filters by frequency", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", { searchParams: { frequency: "QUARTERLY" } }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ frequency: "QUARTERLY" }),
      })
    );
  });

  it("supports search by title/code", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", { searchParams: { search: "revenue" } }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: expect.objectContaining({ contains: "revenue" }) }),
          ]),
        }),
      })
    );
  });

  it("ENGINEER only sees ALL-visibility KPIs", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER);
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi"));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: "ALL" }),
      })
    );
  });

  it("MANAGER sees all KPIs (no visibility filter)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi"));
    const callArgs = mockKPI.findMany.mock.calls[0][0];
    expect(callArgs.where.visibility).toBeUndefined();
  });

  it("returns 500 on database error", async () => {
    mockKPI.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/kpi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.create.mockResolvedValue(MOCK_KPI);
    mockKPI.aggregate.mockResolvedValue({ _sum: { weight: 0 } });
  });

  it("creates KPI with new fields as manager", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: {
        year: 2026, code: "KPI-01", title: "Revenue Growth", target: 100,
        weight: 10, frequency: "MONTHLY", minValue: 0, maxValue: 100,
        unit: "%", visibility: "ALL", measureMethod: "Monthly tracking",
      },
    }));
    expect(res.status).toBe(201);
    expect(mockKPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          frequency: "MONTHLY",
          visibility: "ALL",
          measureMethod: "Monthly tracking",
        }),
      })
    );
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2026, code: "KPI-01", title: "Revenue Growth", target: 100 },
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields missing", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", { method: "POST", body: { year: 2026 } }));
    expect(res.status).toBe(400);
  });

  it("rejects when weight total would exceed 100%", async () => {
    mockKPI.aggregate.mockResolvedValue({ _sum: { weight: 95 } });
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2026, code: "KPI-99", title: "Over Weight", target: 100, weight: 10 },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2026, code: "KPI-01", title: "Revenue Growth", target: 100 },
    }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/kpi/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER);
    mockKPI.findUnique.mockResolvedValue(MOCK_KPI);
  });

  it("returns kpi by id with new fields", async () => {
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/kpi-1"), { params: Promise.resolve({ id: "kpi-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("kpi-1");
  });

  it("returns 404 when not found", async () => {
    mockKPI.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/x"), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/kpi-1"), { params: Promise.resolve({ id: "kpi-1" }) });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/kpi/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.findUnique.mockResolvedValue(MOCK_KPI);
    mockKPI.update.mockResolvedValue({ ...MOCK_KPI, actual: 90 });
    mockKPI.aggregate.mockResolvedValue({ _sum: { weight: 10 } });
  });

  it("updates KPI as manager", async () => {
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { actual: 90 } }), { params: Promise.resolve({ id: "kpi-1" }) });
    expect(res.status).toBe(200);
  });

  it("rejects invalid status transition (ACTIVE -> DRAFT)", async () => {
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(
      createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { status: "DRAFT" } }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("allows valid status transition (DRAFT -> ACTIVE)", async () => {
    mockKPI.findUnique.mockResolvedValue({ ...MOCK_KPI, status: "DRAFT" });
    mockKPI.update.mockResolvedValue({ ...MOCK_KPI, status: "ACTIVE" });
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(
      createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { status: "ACTIVE" } }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER);
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { actual: 90 } }), { params: Promise.resolve({ id: "kpi-1" }) });
    expect(res.status).toBe(403);
  });
});
