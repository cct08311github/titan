/**
 * @jest-environment node
 */
/**
 * Tests for Feature Flags — Issue #988
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock auth ────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// Mock prisma (needed by apiHandler audit logging)
jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: jest.fn() },
  },
}));

const ADMIN_SESSION = {
  user: { id: "a1", name: "Admin", email: "a@e.com", role: "ADMIN" },
  expires: "2099-01-01",
};
const MANAGER_SESSION = {
  user: { id: "m1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};
const ENGINEER_SESSION = {
  user: { id: "e1", name: "Engineer", email: "e@e.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

// ── lib/feature-flags.ts unit tests ──────────────────────────────────────
describe("lib/feature-flags", () => {
  beforeEach(() => {
    // Clear all TITAN_FF_ env vars
    delete process.env.TITAN_FF_V2_DASHBOARD;
    delete process.env.TITAN_FF_V2_REPORTS;
    delete process.env.TITAN_FF_ALERT_BANNER;
  });

  it("returns default values when env vars not set", async () => {
    const { getAllFeatureFlags } = await import("@/lib/feature-flags");
    const flags = getAllFeatureFlags();
    expect(flags.V2_DASHBOARD).toBe(false);
    expect(flags.V2_REPORTS).toBe(false);
    expect(flags.ALERT_BANNER).toBe(true);
  });

  it("reads true from env var", async () => {
    process.env.TITAN_FF_V2_DASHBOARD = "true";
    const { getFeatureFlag } = await import("@/lib/feature-flags");
    expect(getFeatureFlag("V2_DASHBOARD")).toBe(true);
  });

  it("reads 1 as true", async () => {
    process.env.TITAN_FF_V2_REPORTS = "1";
    const { getFeatureFlag } = await import("@/lib/feature-flags");
    expect(getFeatureFlag("V2_REPORTS")).toBe(true);
  });

  it("reads false from env var", async () => {
    process.env.TITAN_FF_ALERT_BANNER = "false";
    const { getFeatureFlag } = await import("@/lib/feature-flags");
    expect(getFeatureFlag("ALERT_BANNER")).toBe(false);
  });

  it("validates flag names", async () => {
    const { isValidFlagName } = await import("@/lib/feature-flags");
    expect(isValidFlagName("V2_DASHBOARD")).toBe(true);
    expect(isValidFlagName("INVALID_FLAG")).toBe(false);
  });
});

// ── API route tests ──────────────────────────────────────────────────────
describe("GET /api/admin/feature-flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TITAN_FF_V2_DASHBOARD;
    delete process.env.TITAN_FF_V2_REPORTS;
    delete process.env.TITAN_FF_ALERT_BANNER;
  });

  it("returns flags for any authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/admin/feature-flags/route");
    const res = await GET(createMockRequest("/api/admin/feature-flags"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.flags).toHaveProperty("V2_DASHBOARD");
    expect(body.data.flags).toHaveProperty("ALERT_BANNER");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/feature-flags/route");
    const res = await GET(createMockRequest("/api/admin/feature-flags"));
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/admin/feature-flags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TITAN_FF_V2_DASHBOARD;
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
    const body = await res.json();
    expect(body.data.flags.V2_DASHBOARD).toBe(true);
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

  it("returns 400 for missing fields", async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
    const { PUT } = await import("@/app/api/admin/feature-flags/route");
    const res = await PUT(
      createMockRequest("/api/admin/feature-flags", {
        method: "PUT",
        body: { name: "V2_DASHBOARD" },
      })
    );
    expect(res.status).toBe(400);
  });
});
