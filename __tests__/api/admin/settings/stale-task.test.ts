/**
 * @jest-environment node
 */
/**
 * API route tests: GET/PUT /api/admin/settings/stale-task — Issue #1313
 *
 * Verifies:
 * - GET returns current config (fallback defaults when not configured)
 * - PUT ADMIN → updates config successfully
 * - PUT MANAGER → 403 Forbidden
 * - PUT ENGINEER → 403 Forbidden
 * - PUT with invalid data (remindDays >= warnDays) → 400
 * - PUT writes audit log
 */
import { createMockRequest } from "../../../utils/test-utils";

// ── Mock next/headers ─────────────────────────────────────────────────────────
jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

// ── Mock auth ─────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// ── Mock prisma ───────────────────────────────────────────────────────────────
const mockSystemSetting = {
  findUnique: jest.fn(),
  upsert: jest.fn(),
};
const mockAuditLog = {
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: mockSystemSetting,
    auditLog: mockAuditLog,
  },
}));

// ── Mock system-setting-service (direct import avoidance for route tests) ─────
const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn();
jest.mock("@/services/system-setting-service", () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: (...args: unknown[]) => mockSetSetting(...args),
  clearSettingCache: jest.fn(),
}));

// ── Mock audit service ────────────────────────────────────────────────────────
const mockLogAsync = jest.fn().mockResolvedValue(undefined);
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
    logAsync: (...args: unknown[]) => mockLogAsync(...args),
  })),
}));

// ── Sessions ──────────────────────────────────────────────────────────────────
const SESSION_ADMIN = {
  user: { id: "admin-1", name: "Admin", email: "admin@test.com", role: "ADMIN" },
  expires: "2099-01-01",
};
const SESSION_MANAGER = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@test.com", role: "MANAGER" },
  expires: "2099-01-01",
};
const SESSION_ENGINEER = {
  user: { id: "eng-1", name: "Engineer", email: "eng@test.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

const DEFAULT_CONFIG = { remindDays: 3, warnDays: 7, escalateDays: 14 };
const CUSTOM_CONFIG = { remindDays: 5, warnDays: 10, escalateDays: 20 };

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/admin/settings/stale-task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockResolvedValue(DEFAULT_CONFIG);
  });

  it("returns default config when not configured (ADMIN)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { GET } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await GET(createMockRequest("/api/admin/settings/stale-task"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.config).toEqual(DEFAULT_CONFIG);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await GET(createMockRequest("/api/admin/settings/stale-task"));

    expect(res.status).toBe(401);
  });

  it("returns 403 for MANAGER role", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { GET } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await GET(createMockRequest("/api/admin/settings/stale-task"));

    expect(res.status).toBe(403);
  });

  it("returns stored config when previously configured", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);
    mockGetSetting.mockResolvedValue(CUSTOM_CONFIG);

    const { GET } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await GET(createMockRequest("/api/admin/settings/stale-task"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.config).toEqual(CUSTOM_CONFIG);
  });
});

// ── PUT tests ─────────────────────────────────────────────────────────────────

describe("PUT /api/admin/settings/stale-task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // GET called to read old config for audit diff, then new config
    mockGetSetting.mockResolvedValue(DEFAULT_CONFIG);
    mockSetSetting.mockResolvedValue(undefined);
    mockLogAsync.mockResolvedValue(undefined);
  });

  it("updates config successfully for ADMIN", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: CUSTOM_CONFIG,
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.config).toEqual(CUSTOM_CONFIG);
    expect(mockSetSetting).toHaveBeenCalledWith(
      "system.staleTaskThresholds",
      CUSTOM_CONFIG,
      "admin-1"
    );
  });

  it("returns 403 for MANAGER role", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: CUSTOM_CONFIG,
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 403 for ENGINEER role", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: CUSTOM_CONFIG,
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when remindDays >= warnDays", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: { remindDays: 7, warnDays: 7, escalateDays: 14 }, // remindDays == warnDays → invalid
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 400 when warnDays >= escalateDays", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: { remindDays: 3, warnDays: 14, escalateDays: 14 }, // warnDays == escalateDays → invalid
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when remindDays is out of range (< 1)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: { remindDays: 0, warnDays: 7, escalateDays: 14 },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when escalateDays exceeds maximum (> 60)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    const res = await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: { remindDays: 3, warnDays: 7, escalateDays: 61 },
      })
    );

    expect(res.status).toBe(400);
  });

  it("writes audit log on successful update", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: CUSTOM_CONFIG,
      })
    );

    expect(mockLogAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "admin.settings.staleTask.update",
        resourceType: "SystemSetting",
        resourceId: "system.staleTaskThresholds",
      })
    );
  });

  it("audit log detail contains before/after values", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ADMIN);

    const { PUT } = await import("@/app/api/admin/settings/stale-task/route");
    await PUT(
      createMockRequest("/api/admin/settings/stale-task", {
        method: "PUT",
        body: CUSTOM_CONFIG,
      })
    );

    const auditCall = mockLogAsync.mock.calls[0][0] as { detail: string };
    const detail = JSON.parse(auditCall.detail) as { before: unknown; after: unknown };
    expect(detail.before).toEqual(DEFAULT_CONFIG);
    expect(detail.after).toEqual(CUSTOM_CONFIG);
  });
});
