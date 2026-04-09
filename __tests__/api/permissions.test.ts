/**
 * @jest-environment node
 */
/**
 * API route tests: /api/permissions
 */
import { createMockRequest } from "../utils/test-utils";

const mockPermission = { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1), create: jest.fn(), updateMany: jest.fn() };
const mockAuditLog = { create: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    permission: mockPermission,
    auditLog: mockAuditLog,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

// Mock logger to suppress output in tests
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const MEMBER = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };
const MANAGER = { user: { id: "mgr", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_PERM = {
  id: "perm-1",
  granteeId: "u1",
  granterId: "mgr",
  permType: "VIEW_ALL_TASKS",
  isActive: true,
  expiresAt: null,
  grantee: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" },
  granter: { id: "mgr", name: "Mgr" },
};

describe("GET /api/permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockPermission.findMany.mockResolvedValue([MOCK_PERM]);
  });

  it("returns permissions list as manager", async () => {
    const { GET } = await import("@/app/api/permissions/route");
    const res = await GET(createMockRequest("/api/permissions"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // T1362: response now wrapped in { items, total, page, limit }
    expect(body.data.items[0].id).toBe("perm-1");
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    const { GET } = await import("@/app/api/permissions/route");
    const res = await GET(createMockRequest("/api/permissions"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/permissions/route");
    const res = await GET(createMockRequest("/api/permissions"));
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockPermission.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/permissions/route");
    const res = await GET(createMockRequest("/api/permissions"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockPermission.create.mockResolvedValue(MOCK_PERM);
    mockPermission.updateMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates permission as manager", async () => {
    const { POST } = await import("@/app/api/permissions/route");
    const res = await POST(createMockRequest("/api/permissions", {
      method: "POST",
      body: { granteeId: "u1", permType: "VIEW_TEAM" },
    }));
    expect(res.status).toBe(201);
  });

  it("revokes permission via DELETE", async () => {
    const { DELETE } = await import("@/app/api/permissions/route");
    const res = await DELETE(createMockRequest("/api/permissions", {
      method: "DELETE",
      body: { granteeId: "u1", permType: "VIEW_TEAM" },
    }));
    expect(res.status).toBe(200);
    expect(mockPermission.updateMany).toHaveBeenCalled();
  });

  it("returns 400 when granteeId missing", async () => {
    const { POST } = await import("@/app/api/permissions/route");
    const res = await POST(createMockRequest("/api/permissions", { method: "POST", body: { permType: "VIEW_TEAM" } }));
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-manager", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    const { POST } = await import("@/app/api/permissions/route");
    const res = await POST(createMockRequest("/api/permissions", {
      method: "POST",
      body: { granteeId: "u1", permType: "VIEW_TEAM" },
    }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/permissions/route");
    const res = await POST(createMockRequest("/api/permissions", {
      method: "POST",
      body: { granteeId: "u1", permType: "VIEW_ALL_TASKS" },
    }));
    expect(res.status).toBe(401);
  });
});
