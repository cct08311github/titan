/**
 * @jest-environment node
 *
 * TDD tests for Issue #153 — Security controls wiring
 *
 * Covers:
 *   1. withRateLimit   — rate limiter called per userId; skips /api/auth/*
 *   2. withAuditLog    — AuditService.log called after successful mutations; skipped on GET / errors
 *   3. withSessionTimeout — rejects idle sessions > 30 min; allows active sessions
 *   4. withJwtBlacklist   — rejects blacklisted Bearer tokens and suspended user keys
 *   5. suspendUser        — adds user:${id} to JwtBlacklist
 */

// ── Module mocks (must be declared before imports) ───────────────────────────

const mockCheckRateLimit = jest.fn();
const mockGetApiRateLimiter = jest.fn();
jest.mock("@/lib/rate-limiter", () => ({
  ...jest.requireActual("@/lib/rate-limiter"),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockAuditLog = jest.fn();
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: (...args: unknown[]) => mockAuditLog(...args),
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import {
  withRateLimit,
  withAuditLog,
  withSessionTimeout,
  withJwtBlacklist,
  setApiRateLimiter,
  sessionLastActivity,
} from "@/lib/security-middleware";
import { JwtBlacklist } from "@/lib/jwt-blacklist";
import { UserService } from "@/services/user-service";
import { createMockPrisma } from "@/lib/test-utils";
import { RateLimitError } from "@/lib/rate-limiter";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(
  method: string,
  path: string,
  extraHeaders: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost${path}`;
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function okHandler(): ReturnType<typeof withRateLimit> {
  return jest.fn().mockResolvedValue(
    NextResponse.json({ ok: true }, { status: 200 })
  ) as ReturnType<typeof withRateLimit>;
}

function createdHandler(): ReturnType<typeof withRateLimit> {
  return jest.fn().mockResolvedValue(
    NextResponse.json({ ok: true }, { status: 201 })
  ) as ReturnType<typeof withRateLimit>;
}

function errorHandler(): ReturnType<typeof withRateLimit> {
  return jest.fn().mockResolvedValue(
    NextResponse.json({ ok: false }, { status: 500 })
  ) as ReturnType<typeof withRateLimit>;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  JwtBlacklist.clear();
  sessionLastActivity.clear(); // reset server-side session tracking between tests
  setApiRateLimiter(null); // reset singleton between tests
});

// ── 1. withRateLimit ─────────────────────────────────────────────────────────

describe("withRateLimit", () => {
  test("calls checkRateLimit with userId extracted from session", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-42" } });

    // Inject a mock limiter whose consume always succeeds
    const fakeLimiter = { consume: jest.fn().mockResolvedValue(undefined) };
    setApiRateLimiter(fakeLimiter as never);

    // Spy on the real checkRateLimit via the mock
    mockCheckRateLimit.mockResolvedValue(undefined);

    const wrapped = withRateLimit(okHandler());
    await wrapped(makeReq("GET", "/api/tasks"));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "user-42"
    );
  });

  test("skips rate limit check for /api/auth/* paths", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-42" } });

    const wrapped = withRateLimit(okHandler());
    await wrapped(makeReq("POST", "/api/auth/signin"));

    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  test("propagates RateLimitError (429) when limit exceeded", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-99" } });
    mockCheckRateLimit.mockRejectedValue(new RateLimitError("too many requests", 60));

    const wrapped = withRateLimit(okHandler());
    await expect(wrapped(makeReq("GET", "/api/tasks"))).rejects.toThrow(RateLimitError);
  });
});

// ── 2. withAuditLog ──────────────────────────────────────────────────────────

describe("withAuditLog", () => {
  test("logs POST mutations with correct action, resourceType, and userId", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockAuditLog.mockResolvedValue({ id: "audit-1" });

    const wrapped = withAuditLog(createdHandler());
    const res = await wrapped(makeReq("POST", "/api/tasks"));

    expect(res.status).toBe(201);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "POST_TASKS",
        resourceType: "tasks",
      })
    );
  });

  test("logs DELETE with resourceId extracted from URL path", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-2" } });
    mockAuditLog.mockResolvedValue({ id: "audit-2" });

    const wrapped = withAuditLog(okHandler());
    await wrapped(makeReq("DELETE", "/api/tasks/task-abc"));

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE_TASKS",
        resourceType: "tasks",
        resourceId: "task-abc",
        userId: "user-2",
      })
    );
  });

  test("does NOT log audit entry for GET requests", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });

    const wrapped = withAuditLog(okHandler());
    const res = await wrapped(makeReq("GET", "/api/tasks"));

    expect(res.status).toBe(200);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  test("does NOT log audit entry when handler returns an error response", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });

    const wrapped = withAuditLog(errorHandler());
    await wrapped(makeReq("POST", "/api/tasks"));

    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ── 3. withSessionTimeout ────────────────────────────────────────────────────
//
// Updated for Issue #165: server-side Map tracking replaces client header trust.

describe("withSessionTimeout", () => {
  test("allows request when server-side last-activity is within 30 minutes", async () => {
    const userId = "user-active-sc";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Pre-record activity 5 minutes ago
    sessionLastActivity.set(userId, Date.now() - 5 * 60 * 1000);

    const wrapped = withSessionTimeout(okHandler());
    const res = await wrapped(makeReq("GET", "/api/tasks", { "x-user-id": userId }));

    expect(res.status).toBe(200);
  });

  test("rejects with 401 when server-side last-activity exceeds 30 minutes", async () => {
    const userId = "user-stale-sc";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Pre-record stale activity 31 minutes ago
    sessionLastActivity.set(userId, Date.now() - 31 * 60 * 1000);

    const wrapped = withSessionTimeout(okHandler());
    const res = await wrapped(makeReq("GET", "/api/tasks", { "x-user-id": userId }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/UnauthorizedError/);
  });

  test("ignores X-Session-Last-Activity header — client cannot bypass timeout", async () => {
    const userId = "user-bypass-sc";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Server records stale activity
    sessionLastActivity.set(userId, Date.now() - 31 * 60 * 1000);

    // Client sends a fresh fake timestamp in the header — must be ignored
    const wrapped = withSessionTimeout(okHandler());
    const res = await wrapped(
      makeReq("GET", "/api/tasks", {
        "x-user-id": userId,
        "x-session-last-activity": String(Date.now()), // fake fresh timestamp
      })
    );

    expect(res.status).toBe(401);
  });

  test("allows request when no server-side activity recorded yet (first request)", async () => {
    const userId = "user-new-sc";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // No entry in the Map — first request for this user
    const wrapped = withSessionTimeout(okHandler());
    const res = await wrapped(makeReq("GET", "/api/tasks", { "x-user-id": userId }));

    expect(res.status).toBe(200);
    // Activity must now be recorded
    expect(sessionLastActivity.has(userId)).toBe(true);
  });
});

// ── 4. withJwtBlacklist ──────────────────────────────────────────────────────

describe("withJwtBlacklist", () => {
  test("allows request when Bearer token is not blacklisted", async () => {
    const wrapped = withJwtBlacklist(okHandler());
    const res = await wrapped(
      makeReq("GET", "/api/tasks", {
        authorization: "Bearer valid.token.here",
      })
    );

    expect(res.status).toBe(200);
  });

  test("rejects with 401 when Bearer token is in the blacklist", async () => {
    JwtBlacklist.add("revoked.jwt.token");

    const wrapped = withJwtBlacklist(okHandler());
    const res = await wrapped(
      makeReq("GET", "/api/tasks", {
        authorization: "Bearer revoked.jwt.token",
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/UnauthorizedError/);
  });

  test("rejects with 401 when user:${id} key is in the blacklist (suspended user)", async () => {
    JwtBlacklist.add("user:suspended-user-id");

    const wrapped = withJwtBlacklist(okHandler());
    const res = await wrapped(
      makeReq("GET", "/api/tasks", {
        "x-user-id": "suspended-user-id",
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/UnauthorizedError/);
  });
});

// ── 5. suspendUser adds user to JwtBlacklist ─────────────────────────────────

describe("UserService.suspendUser — JWT blacklist integration", () => {
  test("adds user:${id} to JwtBlacklist after suspending a user", async () => {
    const mockPrisma = createMockPrisma();
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-suspend-1",
      isActive: true,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      id: "user-suspend-1",
      isActive: false,
    });

    const service = new UserService(mockPrisma as never);
    await service.suspendUser("user-suspend-1");

    expect(JwtBlacklist.has("user:user-suspend-1")).toBe(true);
  });
});

// ── 6. unsuspendUser removes user from JwtBlacklist (regression for #164) ──

describe("UserService.unsuspendUser — JWT blacklist removal", () => {
  test("removes user:${id} from JwtBlacklist after unsuspending", async () => {
    const mockPrisma = createMockPrisma();
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-unsuspend-1",
      isActive: false,
    });
    (mockPrisma.user.update as jest.Mock).mockResolvedValue({
      id: "user-unsuspend-1",
      isActive: true,
    });

    // Simulate prior suspension
    JwtBlacklist.add("user:user-unsuspend-1");
    expect(JwtBlacklist.has("user:user-unsuspend-1")).toBe(true);

    const service = new UserService(mockPrisma as never);
    await service.unsuspendUser("user-unsuspend-1");

    // Blacklist entry must be removed
    expect(JwtBlacklist.has("user:user-unsuspend-1")).toBe(false);
  });

  test("unsuspended user is no longer blocked by withJwtBlacklist", async () => {
    // First: suspend user (add to blacklist)
    JwtBlacklist.add("user:user-e2e-unsuspend");

    // Verify blocked
    mockGetServerSession.mockResolvedValue({ user: { id: "user-e2e-unsuspend" } });
    const blockedHandler = withJwtBlacklist(okHandler());
    const blockedRes = await blockedHandler(
      makeReq("GET", "/api/tasks", { "x-user-id": "user-e2e-unsuspend" })
    );
    expect(blockedRes.status).toBe(401);

    // Now unsuspend: remove from blacklist
    JwtBlacklist.remove("user:user-e2e-unsuspend");

    // Verify allowed
    const allowedHandler = withJwtBlacklist(okHandler());
    const allowedRes = await allowedHandler(
      makeReq("GET", "/api/tasks", { "x-user-id": "user-e2e-unsuspend" })
    );
    expect(allowedRes.status).toBe(200);
  });
});
