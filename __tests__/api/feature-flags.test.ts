/**
 * @jest-environment node
 */
/**
 * Tests for Feature Flags — Issue #988, DB migration Issue #1328
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock auth ────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// ── Mock Prisma (feature flags now stored in DB) ─────────────────────────
const mockFeatureFlagFindMany = jest.fn();
const mockFeatureFlagFindUnique = jest.fn();
const mockFeatureFlagUpsert = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    featureFlag: {
      findMany: (...args: unknown[]) => mockFeatureFlagFindMany(...args),
      findUnique: (...args: unknown[]) => mockFeatureFlagFindUnique(...args),
      upsert: (...args: unknown[]) => mockFeatureFlagUpsert(...args),
    },
    auditLog: { create: jest.fn() },
  },
}));

// ── Mock Redis (feature flags use Redis cache) ───────────────────────────
jest.mock("@/lib/redis", () => ({
  getRedisClient: () => null, // no Redis in test — forces DB path
}));

const ADMIN_SESSION = {
  user: { id: "a1", name: "Admin", email: "a@e.com", role: "ADMIN", mustChangePassword: false },
  sessionId: "sid-admin",
  expires: "2099-01-01",
};
const ENGINEER_SESSION = {
  user: { id: "e1", name: "Engineer", email: "e@e.com", role: "ENGINEER", mustChangePassword: false },
  sessionId: "sid-eng",
  expires: "2099-01-01",
};
const MANAGER_SESSION = {
  user: { id: "m1", name: "Manager", email: "m@e.com", role: "MANAGER", mustChangePassword: false },
  sessionId: "sid-mgr",
  expires: "2099-01-01",
};

// ── lib/feature-flags unit tests ─────────────────────────────────────────
describe("lib/feature-flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("isValidFlagName accepts known flags", async () => {
    const { isValidFlagName } = await import("@/lib/feature-flags");
    expect(isValidFlagName("V2_DASHBOARD")).toBe(true);
    expect(isValidFlagName("INVALID_FLAG")).toBe(false);
  });
});

// ── GET /api/admin/feature-flags ─────────────────────────────────────────
describe("GET /api/admin/feature-flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockFeatureFlagFindMany.mockResolvedValue([]);
  });

  // T1452: GET /api/admin/feature-flags requires ADMIN (withAdmin middleware).
  it("returns flags for ADMIN user", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await import("@/app/api/admin/feature-flags/route");
    const res = await GET(createMockRequest("/api/admin/feature-flags"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.flags).toBeDefined();
  });

  it("returns 403 for non-ADMIN user", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/admin/feature-flags/route");
    const res = await GET(createMockRequest("/api/admin/feature-flags"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/feature-flags/route");
    const res = await GET(createMockRequest("/api/admin/feature-flags"));
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/admin/feature-flags ─────────────────────────────────────────
describe("PUT /api/admin/feature-flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockFeatureFlagUpsert.mockResolvedValue({ key: "V2_DASHBOARD", enabled: true });
    mockFeatureFlagFindMany.mockResolvedValue([{ key: "V2_DASHBOARD", enabled: true }]);
  });

  it("updates flag for ADMIN", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await import("@/app/api/admin/feature-flags/route");
    const res = await PUT(
      createMockRequest("/api/admin/feature-flags", {
        method: "PUT",
        body: { name: "V2_DASHBOARD", enabled: true },
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 for MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { PUT } = await import("@/app/api/admin/feature-flags/route");
    const res = await PUT(
      createMockRequest("/api/admin/feature-flags", {
        method: "PUT",
        body: { name: "V2_DASHBOARD", enabled: true },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid flag name", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await import("@/app/api/admin/feature-flags/route");
    const res = await PUT(
      createMockRequest("/api/admin/feature-flags", {
        method: "PUT",
        body: { name: "INVALID", enabled: true },
      })
    );
    expect(res.status).toBe(400);
  });
});
