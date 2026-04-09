/**
 * @jest-environment node
 */
/**
 * API route tests: /api/cron/stale-task-scan — Issue #1311
 */
import { createMockRequest } from "../utils/test-utils";

// Mock next/headers (required for Edge runtime — see CLAUDE.md Jest pitfalls)
jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

/** Create a request with x-cron-secret header */
function createCronRequest(secret?: string) {
  const req = createMockRequest("/api/cron/stale-task-scan", { method: "POST" });
  const headers = new Headers();
  if (secret !== undefined) headers.set("x-cron-secret", secret);
  // Override headers on the mock object
  (req as unknown as Record<string, unknown>).headers = headers;
  return req;
}

// Mock the stale task service
const mockScanStaleTasks = jest.fn();
jest.mock("@/services/stale-task-service", () => ({
  scanStaleTasks: (...args: unknown[]) => mockScanStaleTasks(...args),
}));

// Mock prisma (needed by apiHandler)
jest.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { createMany: jest.fn(), findMany: jest.fn() },
    task: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

// Mock next-auth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

const CRON_SECRET = "test-secret-1234";

describe("POST /api/cron/stale-task-scan", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── Test 1: Missing CRON_SECRET env → 500 ───────────────────────────────

  it("returns 503 when CRON_SECRET env var is not configured", async () => {
    delete process.env.CRON_SECRET;

    const { POST } = await import("@/app/api/cron/stale-task-scan/route");
    const res = await (POST as Function)(createCronRequest());

    // T1352: shared cron-auth helper returns 503 (service unavailable)
    // when secret env is missing — was 500 in original inline check
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ServerError");
  });

  // ── Test 2: Wrong secret → 401 ──────────────────────────────────────────

  it("returns 401 when wrong x-cron-secret header is provided", async () => {
    const { POST } = await import("@/app/api/cron/stale-task-scan/route");
    const res = await (POST as Function)(createCronRequest("wrong-secret"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  // ── Test 3: Correct secret → 200 + service result ───────────────────────

  it("returns 200 with service result when valid secret is provided", async () => {
    mockScanStaleTasks.mockResolvedValue({
      remindCount: 2,
      warnCount: 1,
      escalateCount: 0,
      skippedCount: 1,
    });

    const { POST } = await import("@/app/api/cron/stale-task-scan/route");
    const res = await (POST as Function)(createCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.remindCount).toBe(2);
    expect(body.data.warnCount).toBe(1);
    expect(body.data.escalateCount).toBe(0);
    expect(body.data.skippedCount).toBe(1);
    expect(body.data.scannedAt).toBeDefined();
  });

  // ── Test 4: Service throws → 500 ────────────────────────────────────────

  it("returns 500 when scanStaleTasks throws an error", async () => {
    mockScanStaleTasks.mockRejectedValue(new Error("Database connection failed"));

    const { POST } = await import("@/app/api/cron/stale-task-scan/route");
    const res = await (POST as Function)(createCronRequest(CRON_SECRET));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ServerError");
  });
});
