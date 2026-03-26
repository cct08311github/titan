/**
 * @jest-environment node
 */
/**
 * JWT Middleware tests — Issue #799 (AU-6)
 */

const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuthFn(...args) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { UnauthorizedError } from "@/services/errors";

describe("shouldBypassAuth", () => {
  let shouldBypassAuth: typeof import("@/lib/middleware/auth").shouldBypassAuth;
  beforeAll(async () => { const mod = await import("@/lib/middleware/auth"); shouldBypassAuth = mod.shouldBypassAuth; });

  it("bypasses /api/auth/login", () => expect(shouldBypassAuth("/api/auth/login")).toBe(true));
  it("bypasses /api/auth/refresh", () => expect(shouldBypassAuth("/api/auth/refresh")).toBe(true));
  it("bypasses /api/health", () => expect(shouldBypassAuth("/api/health")).toBe(true));
  it("bypasses /api/auth/reset-password", () => expect(shouldBypassAuth("/api/auth/reset-password")).toBe(true));
  it("does NOT bypass /api/users", () => expect(shouldBypassAuth("/api/users")).toBe(false));
  it("does NOT bypass /api/tasks", () => expect(shouldBypassAuth("/api/tasks")).toBe(false));
  it("does NOT bypass /api/admin/settings", () => expect(shouldBypassAuth("/api/admin/settings")).toBe(false));
});

describe("getUserContext", () => {
  let getUserContext: typeof import("@/lib/middleware/auth-guard").getUserContext;
  let tryGetUserContext: typeof import("@/lib/middleware/auth-guard").tryGetUserContext;
  beforeAll(async () => { const mod = await import("@/lib/middleware/auth-guard"); getUserContext = mod.getUserContext; tryGetUserContext = mod.tryGetUserContext; });
  beforeEach(() => jest.clearAllMocks());

  it("throws UnauthorizedError when no session", async () => {
    mockAuthFn.mockResolvedValueOnce(null);
    await expect(getUserContext()).rejects.toThrow(UnauthorizedError);
  });

  it("returns user context for valid session", async () => {
    mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "ENGINEER", email: "a@b.com", name: "Alice" } });
    const ctx = await getUserContext();
    expect(ctx.userId).toBe("u1");
    expect(ctx.role).toBe("ENGINEER");
    expect(ctx.email).toBe("a@b.com");
  });

  it("tryGetUserContext returns null for no session", async () => {
    mockAuthFn.mockResolvedValueOnce(null);
    expect(await tryGetUserContext()).toBeNull();
  });

  it("tryGetUserContext returns context for valid session", async () => {
    mockAuthFn.mockResolvedValueOnce({ user: { id: "u1", role: "MANAGER" } });
    const ctx = await tryGetUserContext();
    expect(ctx?.userId).toBe("u1");
  });

  it("throws when session has no role", async () => {
    mockAuthFn.mockResolvedValueOnce({ user: { id: "u1" } });
    await expect(getUserContext()).rejects.toThrow(UnauthorizedError);
  });
});

describe("API 401 response format", () => {
  it("auth-depth returns uniform 401 JSON", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/lib/auth-depth.ts", "utf8"
    );
    // All 401 responses should use consistent format
    const matches = content.match(/NextResponse\.json\(\{ error: "Unauthorized" \}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3); // no token, invalid, expired
  });
});
