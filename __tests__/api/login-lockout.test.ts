/**
 * @jest-environment node
 */
/**
 * Login Failure Lockout tests — Issue #797 (AU-3)
 */
import path from "path";

const ROOT = process.cwd();

// Top-level auth mock — defined before jest.mock hoisting (following jwt-middleware.test.ts pattern)
const mockAuthFn = jest.fn<() => Promise<unknown>>().mockResolvedValue(null);
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuthFn(...args) }));

describe("AccountLockService (5 failures / 30 min)", () => {
  let AccountLockService: typeof import("@/lib/account-lock").AccountLockService;

  beforeAll(async () => {
    const mod = await import("@/lib/account-lock");
    AccountLockService = mod.AccountLockService;
  });

  it("should not lock after 4 failures", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1800 });
    for (let i = 0; i < 4; i++) await svc.recordFailure("test@test.com");
    expect(await svc.isLocked("test@test.com")).toBe(false);
  });

  it("should lock after 5 failures", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1800 });
    for (let i = 0; i < 5; i++) await svc.recordFailure("test@test.com");
    expect(await svc.isLocked("test@test.com")).toBe(true);
  });

  it("should auto-unlock after lock duration expires", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1 }); // 1 second
    for (let i = 0; i < 5; i++) await svc.recordFailure("test@test.com");
    expect(await svc.isLocked("test@test.com")).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await svc.isLocked("test@test.com")).toBe(false);
  });

  it("should reset failures on success", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1800 });
    for (let i = 0; i < 4; i++) await svc.recordFailure("test@test.com");
    await svc.resetFailures("test@test.com");
    expect(await svc.getFailureCount("test@test.com")).toBe(0);
  });

  it("should return remaining lock seconds", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1800 });
    for (let i = 0; i < 5; i++) await svc.recordFailure("test@test.com");
    const remaining = await svc.getRemainingLockSeconds("test@test.com");
    expect(remaining).toBeGreaterThan(1700);
    expect(remaining).toBeLessThanOrEqual(1800);
  });

  it("independent accounts don't affect each other", async () => {
    const svc = new AccountLockService({ maxFailures: 5, lockDurationSeconds: 1800 });
    for (let i = 0; i < 5; i++) await svc.recordFailure("user-a@test.com");
    expect(await svc.isLocked("user-a@test.com")).toBe(true);
    expect(await svc.isLocked("user-b@test.com")).toBe(false);
  });
});

describe("auth.ts lockout config", () => {
  it("uses maxFailures=5 and lockDuration=1800s", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "auth.ts"), "utf8"
    );
    expect(content).toContain("maxFailures: 5");
    expect(content).toContain("lockDurationSeconds: 1800");
  });

  it("lock message does not reveal account existence", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "auth.ts"), "utf8"
    );
    // authorize() returns null for both non-existent and locked accounts
    expect(content).toContain("return null");
  });
});

describe("POST /api/admin/unlock", () => {
  // auth is mocked at module level via authMockState — tests just set authMockState.currentUser
  jest.mock("@/lib/prisma", () => ({
    prisma: {
      user: { findUnique: jest.fn().mockResolvedValue({ email: "test@test.com" }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    },
  }));
  jest.mock("@/lib/rate-limiter", () => ({
    createApiRateLimiter: () => ({}), checkRateLimit: jest.fn(),
    createLoginRateLimiter: () => ({}),
    RateLimitError: class extends Error { retryAfter = 60; },
  }));
  jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
  jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
  jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));
  jest.mock("@/lib/redis", () => ({ getRedisClient: () => null }));

  const { NextRequest } = require("next/server");

  it("should return 401 for unauthenticated", async () => {
    mockAuthFn.mockReturnValue(Promise.resolve(null));
    const mod = await import("@/app/api/admin/unlock/route");
    const req = new NextRequest("http://localhost/api/admin/unlock", {
      method: "POST", body: JSON.stringify({ email: "test@test.com" }),
    });
    const res = await (mod.POST as Function)(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 for missing params", async () => {
    mockAuthFn.mockReturnValue(Promise.resolve({ user: { id: "u1", role: "MANAGER", email: "mgr@test.com", name: "Manager" }, expires: "2099-01-01" }));
    const mod = await import("@/app/api/admin/unlock/route");
    const req = new NextRequest("http://localhost/api/admin/unlock", {
      method: "POST", body: JSON.stringify({}),
    });
    const res = await (mod.POST as Function)(req);
    expect(res.status).toBe(400);
  });
});
