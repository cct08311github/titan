/**
 * @jest-environment node
 */
/**
 * Three-role RBAC tests — Issue #801 (AD-2)
 */

const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuthFn(...args) }));
jest.mock("@/lib/prisma", () => ({
  prisma: { permission: { findFirst: jest.fn().mockResolvedValue(null) }, auditLog: { create: jest.fn().mockResolvedValue({}) } },
}));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}), checkRateLimit: jest.fn(), createLoginRateLimiter: () => ({}),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));

import { ForbiddenError, UnauthorizedError } from "@/services/errors";

describe("permissions module", () => {
  let hasMinimumRole: typeof import("@/lib/auth/permissions").hasMinimumRole;
  let getRequiredRole: typeof import("@/lib/auth/permissions").getRequiredRole;
  beforeAll(async () => { const mod = await import("@/lib/auth/permissions"); hasMinimumRole = mod.hasMinimumRole; getRequiredRole = mod.getRequiredRole; });

  describe("hasMinimumRole", () => {
    it("ADMIN >= ADMIN", () => expect(hasMinimumRole("ADMIN", "ADMIN")).toBe(true));
    it("ADMIN >= MANAGER", () => expect(hasMinimumRole("ADMIN", "MANAGER")).toBe(true));
    it("ADMIN >= ENGINEER", () => expect(hasMinimumRole("ADMIN", "ENGINEER")).toBe(true));
    it("MANAGER >= MANAGER", () => expect(hasMinimumRole("MANAGER", "MANAGER")).toBe(true));
    it("MANAGER >= ENGINEER", () => expect(hasMinimumRole("MANAGER", "ENGINEER")).toBe(true));
    it("MANAGER < ADMIN", () => expect(hasMinimumRole("MANAGER", "ADMIN")).toBe(false));
    it("ENGINEER >= ENGINEER", () => expect(hasMinimumRole("ENGINEER", "ENGINEER")).toBe(true));
    it("ENGINEER < MANAGER", () => expect(hasMinimumRole("ENGINEER", "MANAGER")).toBe(false));
    it("ENGINEER < ADMIN", () => expect(hasMinimumRole("ENGINEER", "ADMIN")).toBe(false));
    it("unknown role < ENGINEER", () => expect(hasMinimumRole("UNKNOWN", "ENGINEER")).toBe(false));
  });

  describe("getRequiredRole", () => {
    it("returns ADMIN for /api/admin/*", () => expect(getRequiredRole("/api/admin/settings", "GET")).toBe("ADMIN"));
    it("returns MANAGER for POST /api/users", () => expect(getRequiredRole("/api/users", "POST")).toBe("MANAGER"));
    it("returns ENGINEER for GET /api/tasks", () => expect(getRequiredRole("/api/tasks", "GET")).toBe("ENGINEER"));
  });
});

describe("rbac module", () => {
  let requireAuth: typeof import("@/lib/rbac").requireAuth;
  let requireRole: typeof import("@/lib/rbac").requireRole;
  let requireMinRole: typeof import("@/lib/rbac").requireMinRole;
  let requireOwnerOrManager: typeof import("@/lib/rbac").requireOwnerOrManager;
  beforeAll(async () => { const mod = await import("@/lib/rbac"); requireAuth = mod.requireAuth; requireRole = mod.requireRole; requireMinRole = mod.requireMinRole; requireOwnerOrManager = mod.requireOwnerOrManager; });
  beforeEach(() => jest.clearAllMocks());

  it("requireAuth throws 401 when no session", async () => {
    mockAuthFn.mockResolvedValueOnce(null);
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
  });
  it("requireAuth returns session", async () => {
    mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ENGINEER" }, expires: "2099-01-01" });
    const s = await requireAuth(); expect(s.user.id).toBe("u1");
  });

  describe("requireRole with ADMIN override", () => {
    it("ADMIN can access MANAGER endpoints", async () => {
      mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ADMIN" }, expires: "2099-01-01" });
      const s = await requireRole("MANAGER"); expect(s.user.role).toBe("ADMIN");
    });
    it("ENGINEER cannot access MANAGER endpoints", async () => {
      mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ENGINEER" }, expires: "2099-01-01" });
      await expect(requireRole("MANAGER")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("requireMinRole", () => {
    it("ADMIN passes ADMIN min", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ADMIN" }, expires: "2099-01-01" }); await expect(requireMinRole("ADMIN")).resolves.toBeDefined(); });
    it("MANAGER passes MANAGER min", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "MANAGER" }, expires: "2099-01-01" }); await expect(requireMinRole("MANAGER")).resolves.toBeDefined(); });
    it("ENGINEER fails MANAGER min", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ENGINEER" }, expires: "2099-01-01" }); await expect(requireMinRole("MANAGER")).rejects.toThrow(ForbiddenError); });
    it("MANAGER fails ADMIN min", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "MANAGER" }, expires: "2099-01-01" }); await expect(requireMinRole("ADMIN")).rejects.toThrow(ForbiddenError); });
  });

  describe("requireOwnerOrManager with ADMIN", () => {
    it("ADMIN can access any resource", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "a1", role: "ADMIN" }, expires: "2099-01-01" }); await expect(requireOwnerOrManager("other")).resolves.toBeDefined(); });
    it("MANAGER can access any resource", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "m1", role: "MANAGER" }, expires: "2099-01-01" }); await expect(requireOwnerOrManager("other")).resolves.toBeDefined(); });
    it("ENGINEER can access own resource", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "e1", role: "ENGINEER" }, expires: "2099-01-01" }); await expect(requireOwnerOrManager("e1")).resolves.toBeDefined(); });
    it("ENGINEER cannot access other resource", async () => { mockAuthFn.mockResolvedValueOnce({ user: { id: "e1", role: "ENGINEER" }, expires: "2099-01-01" }); await expect(requireOwnerOrManager("other")).rejects.toThrow(ForbiddenError); });
  });
});

describe("auth middleware wrappers", () => {
  it("exports withAdmin", async () => { const mod = await import("@/lib/auth-middleware"); expect(typeof mod.withAdmin).toBe("function"); });
  it("exports withManager", async () => { const mod = await import("@/lib/auth-middleware"); expect(typeof mod.withManager).toBe("function"); });
  it("exports withAuth", async () => { const mod = await import("@/lib/auth-middleware"); expect(typeof mod.withAuth).toBe("function"); });
});

describe("role-guard helpers", () => {
  let isAdmin: typeof import("@/lib/middleware/role-guard").isAdmin;
  let isManagerOrAbove: typeof import("@/lib/middleware/role-guard").isManagerOrAbove;
  beforeAll(async () => { const mod = await import("@/lib/middleware/role-guard"); isAdmin = mod.isAdmin; isManagerOrAbove = mod.isManagerOrAbove; });

  it("isAdmin('ADMIN') is true", () => expect(isAdmin("ADMIN")).toBe(true));
  it("isAdmin('MANAGER') is false", () => expect(isAdmin("MANAGER")).toBe(false));
  it("isManagerOrAbove('ADMIN') is true", () => expect(isManagerOrAbove("ADMIN")).toBe(true));
  it("isManagerOrAbove('MANAGER') is true", () => expect(isManagerOrAbove("MANAGER")).toBe(true));
  it("isManagerOrAbove('ENGINEER') is false", () => expect(isManagerOrAbove("ENGINEER")).toBe(false));
});
