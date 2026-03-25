/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 *
 * Issue #165: Session timeout uses server-side tracking, not client header
 * Issue #166: getCachedSession calls getServerSession only once per request
 */

// ── Mock next/server ──────────────────────────────────────────────────────
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        _body: body,
        json: async () => body,
      })),
    },
  };
});

// ── Mock next-auth ─────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock @/lib/prisma to avoid real DB connection ─────────────────────────
jest.mock("@/lib/prisma", () => ({ prisma: {} }));

// ── Mock @/services/audit-service ─────────────────────────────────────────
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ── Mock @/lib/rate-limiter ────────────────────────────────────────────────
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import {
  withSessionTimeout,
  sessionLastActivity,
  _cleanupStaleEntries,
  _resetCleanupTimer,
} from "@/lib/security-middleware";
import { getCachedSession, clearCachedSession } from "@/lib/session-cache";

// ── Helpers ────────────────────────────────────────────────────────────────
function makeFakeRequest(
  url = "http://localhost/api/test",
  headers: Record<string, string> = {}
): NextRequest {
  return {
    url,
    method: "GET",
    headers: new Headers(headers),
    json: jest.fn(),
  } as unknown as NextRequest;
}

const noopHandler = jest.fn().mockResolvedValue({ status: 200 });

// ── Tests: withSessionTimeout (Issue #165) ─────────────────────────────────

describe("withSessionTimeout — server-side tracking", () => {
  beforeEach(() => {
    sessionLastActivity.clear();
    _resetCleanupTimer();
    mockGetServerSession.mockReset();
    noopHandler.mockClear();
  });

  test("session timeout uses server-side tracking, not client header", async () => {
    const userId = "user-timeout-test";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    const req = makeFakeRequest("http://localhost/api/test");
    const handler = withSessionTimeout(noopHandler);

    // First request — records activity
    await handler(req);
    expect(sessionLastActivity.has(userId)).toBe(true);

    // Simulate 31 minutes of idle by backdating the stored timestamp
    const thirtyOneMinAgo = Date.now() - 31 * 60 * 1000;
    sessionLastActivity.set(userId, thirtyOneMinAgo);

    // Second request — should be rejected
    const req2 = makeFakeRequest("http://localhost/api/test");
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    const response = await handler(req2);

    expect(response.status).toBe(401);
    expect(noopHandler).toHaveBeenCalledTimes(1); // only first call went through
  });

  test("cannot bypass timeout by sending fake header", async () => {
    const userId = "user-bypass-test";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Pre-set a stale timestamp (31 minutes ago)
    const thirtyOneMinAgo = Date.now() - 31 * 60 * 1000;
    sessionLastActivity.set(userId, thirtyOneMinAgo);

    // Attacker sends a fresh timestamp in the (now-ignored) client header
    const req = makeFakeRequest("http://localhost/api/test", {
      "x-session-last-activity": String(Date.now()),
    });

    const handler = withSessionTimeout(noopHandler);
    const response = await handler(req);

    // Must still be rejected — server-side state takes precedence
    expect(response.status).toBe(401);
    expect(noopHandler).not.toHaveBeenCalled();
  });

  test("active session is allowed through and timestamp is refreshed", async () => {
    const userId = "user-active-test";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Set last activity 5 minutes ago (well within 30-min window)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    sessionLastActivity.set(userId, fiveMinAgo);

    const req = makeFakeRequest("http://localhost/api/test");
    const handler = withSessionTimeout(noopHandler);
    const response = await handler(req);

    expect(response.status).toBe(200);
    expect(noopHandler).toHaveBeenCalled();

    // Timestamp must have been updated to now
    const updatedTs = sessionLastActivity.get(userId)!;
    expect(updatedTs).toBeGreaterThan(fiveMinAgo);
  });

  test("exactly 30 minutes idle is allowed (uses strict > comparison)", async () => {
    const userId = "user-boundary-test";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Set last activity to exactly 30 minutes ago, minus 1ms buffer for execution time
    const exactly30min = Date.now() - 30 * 60 * 1000 + 50;
    sessionLastActivity.set(userId, exactly30min);

    const req = makeFakeRequest("http://localhost/api/test");
    const handler = withSessionTimeout(noopHandler);
    const response = await handler(req);

    // Exactly 30 min is NOT > 30 min, so it should pass
    expect(response.status).toBe(200);
    expect(noopHandler).toHaveBeenCalled();
  });

  test("timeout deletes entry from Map to prevent unbounded growth", async () => {
    const userId = "user-cleanup-test";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    // Pre-set stale timestamp
    sessionLastActivity.set(userId, Date.now() - 31 * 60 * 1000);
    expect(sessionLastActivity.has(userId)).toBe(true);

    const req = makeFakeRequest("http://localhost/api/test");
    const handler = withSessionTimeout(noopHandler);
    await handler(req);

    // Entry should be deleted after timeout rejection
    expect(sessionLastActivity.has(userId)).toBe(false);
  });

  test("periodic cleanup removes entries older than 2x timeout", () => {
    const now = Date.now();

    // Add entries with varying ages
    sessionLastActivity.set("recent-user", now - 10 * 60 * 1000); // 10 min ago
    sessionLastActivity.set("stale-user", now - 90 * 60 * 1000); // 90 min ago (> 2x30min)
    sessionLastActivity.set("very-stale", now - 120 * 60 * 1000); // 120 min ago

    _resetCleanupTimer(); // ensure cleanup runs
    _cleanupStaleEntries(now);

    expect(sessionLastActivity.has("recent-user")).toBe(true);
    expect(sessionLastActivity.has("stale-user")).toBe(false);
    expect(sessionLastActivity.has("very-stale")).toBe(false);
  });

  test("cleanup is throttled — does not run on every call", () => {
    const now = Date.now();

    sessionLastActivity.set("stale", now - 90 * 60 * 1000);

    // First call runs cleanup
    _resetCleanupTimer();
    _cleanupStaleEntries(now);
    expect(sessionLastActivity.has("stale")).toBe(false);

    // Re-add and call again immediately — should NOT clean up (throttled)
    sessionLastActivity.set("stale", now - 90 * 60 * 1000);
    _cleanupStaleEntries(now + 1000); // only 1 second later
    expect(sessionLastActivity.has("stale")).toBe(true); // still there — throttled
  });
});

// ── Tests: getCachedSession (Issue #166) ───────────────────────────────────

describe("getCachedSession — request-level cache", () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
  });

  test("getCachedSession calls getServerSession only once per request", async () => {
    const fakeSession = { user: { id: "u-cache-test" } };
    mockGetServerSession.mockResolvedValue(fakeSession);

    const req = makeFakeRequest();

    // Call three times for the same request object
    const s1 = await getCachedSession(req);
    const s2 = await getCachedSession(req);
    const s3 = await getCachedSession(req);

    expect(s1).toBe(fakeSession);
    expect(s2).toBe(fakeSession);
    expect(s3).toBe(fakeSession);

    // getServerSession must have been called exactly once
    expect(mockGetServerSession).toHaveBeenCalledTimes(1);
  });

  test("different Request objects get independent cache entries", async () => {
    const sessionA = { user: { id: "u-a" } };
    const sessionB = { user: { id: "u-b" } };
    mockGetServerSession
      .mockResolvedValueOnce(sessionA)
      .mockResolvedValueOnce(sessionB);

    const reqA = makeFakeRequest();
    const reqB = makeFakeRequest();

    const sA = await getCachedSession(reqA);
    const sB = await getCachedSession(reqB);

    expect(sA).toBe(sessionA);
    expect(sB).toBe(sessionB);
    expect(mockGetServerSession).toHaveBeenCalledTimes(2);
  });

  test("clearCachedSession forces a fresh getServerSession call", async () => {
    const first = { user: { id: "u-clear-1" } };
    const second = { user: { id: "u-clear-2" } };
    mockGetServerSession
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);

    const req = makeFakeRequest();

    const s1 = await getCachedSession(req);
    clearCachedSession(req);
    const s2 = await getCachedSession(req);

    expect(s1).toBe(first);
    expect(s2).toBe(second);
    expect(mockGetServerSession).toHaveBeenCalledTimes(2);
  });
});
