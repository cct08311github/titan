/**
 * @jest-environment node
 */
/**
 * API route tests: /api/kpi/[id]/achievement
 * Issue #822: KP-2 KPI 填報介面
 */
import { createMockRequest } from "../utils/test-utils";

const mockKPI = { findUnique: jest.fn(), update: jest.fn() };
const mockKPIAchievement = {
  findMany: jest.fn(),
  upsert: jest.fn(),
};

// T1452: POST route wraps upsert + kpi.update in $transaction to prevent
// partial writes. Mock invokes the callback with the same prisma mock.
const mockPrismaKpi = {
  kPI: mockKPI,
  kPIAchievement: mockKPIAchievement,
  auditLog: { create: jest.fn() },
  $transaction: jest.fn().mockImplementation((arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrismaKpi);
    return Promise.all(arg as unknown[]);
  }),
};

jest.mock("@/lib/prisma", () => ({
  prisma: mockPrismaKpi,
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const ENGINEER = { user: { id: "eng1", name: "Engineer", email: "eng@test.com", role: "ENGINEER" }, expires: "2099" };
const ADMIN = { user: { id: "admin1", name: "Admin", email: "admin@test.com", role: "ADMIN" }, expires: "2099" };
const CREATOR = { user: { id: "creator1", name: "Creator", email: "c@test.com", role: "MANAGER" }, expires: "2099" };

const MOCK_KPI_ACTIVE = {
  id: "kpi-1",
  status: "ACTIVE",
  minValue: 0,
  maxValue: 100,
  createdBy: "creator1",
};

const MOCK_ACHIEVEMENT = {
  id: "ach-1",
  kpiId: "kpi-1",
  period: "2026-01",
  actualValue: 85,
  note: "Good",
  reportedBy: "creator1",
};

describe("GET /api/kpi/[id]/achievement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER);
    mockKPI.findUnique.mockResolvedValue(MOCK_KPI_ACTIVE);
    mockKPIAchievement.findMany.mockResolvedValue([MOCK_ACHIEVEMENT]);
  });

  it("returns achievement history", async () => {
    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await GET(
      createMockRequest("/api/kpi/kpi-1/achievement"),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].period).toBe("2026-01");
  });

  it("returns 404 for non-existent KPI", async () => {
    mockKPI.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await GET(
      createMockRequest("/api/kpi/x/achievement"),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await GET(
      createMockRequest("/api/kpi/kpi-1/achievement"),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/kpi/[id]/achievement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(CREATOR);
    mockKPI.findUnique.mockResolvedValue(MOCK_KPI_ACTIVE);
    mockKPIAchievement.upsert.mockResolvedValue(MOCK_ACHIEVEMENT);
    mockKPIAchievement.findMany.mockResolvedValue([MOCK_ACHIEVEMENT]);
    mockKPI.update.mockResolvedValue({});
  });

  it("creates achievement as KPI creator", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 85, note: "Good" },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(201);
    expect(mockKPIAchievement.upsert).toHaveBeenCalled();
  });

  it("creates achievement as Admin (non-creator)", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN);
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 85 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(201);
  });

  it("returns 403 for non-creator non-admin", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER);
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 85 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("rejects reporting on non-ACTIVE KPI", async () => {
    mockKPI.findUnique.mockResolvedValue({ ...MOCK_KPI_ACTIVE, status: "DRAFT" });
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 85 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects value below minValue", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: -5 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects value above maxValue", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 150 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty period", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "", actualValue: 85 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("updates KPI actual value after reporting", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/achievement/route");
    await POST(
      createMockRequest("/api/kpi/kpi-1/achievement", {
        method: "POST",
        body: { period: "2026-01", actualValue: 85 },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(mockKPI.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "kpi-1" },
        data: { actual: 85 },
      })
    );
  });
});
