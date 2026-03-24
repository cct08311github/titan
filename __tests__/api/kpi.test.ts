/**
 * @jest-environment node
 */
/**
 * API route tests: /api/kpi and /api/kpi/[id]
 */
import { createMockRequest } from "../utils/test-utils";

const mockKPI = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { kPI: mockKPI } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const MEMBER = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };
const MANAGER = { user: { id: "mgr", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_KPI = {
  id: "kpi-1",
  year: 2024,
  code: "KPI-01",
  title: "Revenue Growth",
  target: 100,
  actual: 80,
  weight: 1,
  autoCalc: false,
  taskLinks: [],
  deliverables: [],
  creator: { id: "mgr", name: "Mgr" },
};

describe("GET /api/kpi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
    mockKPI.findMany.mockResolvedValue([MOCK_KPI]);
  });

  it("returns kpi list when authenticated", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].id).toBe("kpi-1");
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
    expect(mockKPI.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { year: 2023 } }));
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
  });

  it("creates KPI as manager", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2024, code: "KPI-01", title: "Revenue Growth", target: 100 },
    }));
    expect(res.status).toBe(201);
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2024, code: "KPI-01", title: "Revenue Growth", target: 100 },
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields missing", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", { method: "POST", body: { year: 2024 } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(createMockRequest("/api/kpi", {
      method: "POST",
      body: { year: 2024, code: "KPI-01", title: "Revenue Growth", target: 100 },
    }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/kpi/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
    mockKPI.findUnique.mockResolvedValue(MOCK_KPI);
  });

  it("returns kpi by id", async () => {
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/kpi-1"), { params: { id: "kpi-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("kpi-1");
  });

  it("returns 404 when not found", async () => {
    mockKPI.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/x"), { params: { id: "x" } });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/route");
    const res = await GET(createMockRequest("/api/kpi/kpi-1"), { params: { id: "kpi-1" } });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/kpi/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockKPI.update.mockResolvedValue({ ...MOCK_KPI, actual: 90 });
  });

  it("updates KPI as manager", async () => {
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { actual: 90 } }), { params: { id: "kpi-1" } });
    expect(res.status).toBe(200);
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    const { PUT } = await import("@/app/api/kpi/[id]/route");
    const res = await PUT(createMockRequest("/api/kpi/kpi-1", { method: "PUT", body: { actual: 90 } }), { params: { id: "kpi-1" } });
    expect(res.status).toBe(403);
  });
});
