/**
 * @jest-environment node
 */
/**
 * API route tests: POST /api/cron/cleanup-deleted — Issue #1324
 *
 * Covers:
 *   1. Auth: Returns 401 without CRON_SECRET header
 *   2. Auth: Returns 401 with wrong CRON_SECRET
 *   3. Auth: Returns 200 with correct CRON_SECRET
 *   4. Batch deletion: tasks with deletedAt < cutoff are deleted
 *   5. Batch preservation: tasks with deletedAt > cutoff are NOT deleted
 *   6. Batch preservation: tasks with deletedAt = null are NOT deleted
 *   7. KPI cascade: KPITaskLink records deleted with KPIs in $transaction
 *   8. TimeEntry: isDeleted=true + old updatedAt entries are deleted
 *   9. Token cleanup: expired refresh tokens and used/expired reset tokens
 *  10. Empty run: Returns 200 with all counts = 0 when no records match
 */

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTask = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockTaskComment = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockDocument = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockKPI = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockKPITaskLink = { deleteMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockRefreshToken = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockPasswordResetToken = { findMany: jest.fn(), deleteMany: jest.fn() };
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    taskComment: mockTaskComment,
    document: mockDocument,
    kPI: mockKPI,
    kPITaskLink: mockKPITaskLink,
    timeEntry: mockTimeEntry,
    refreshToken: mockRefreshToken,
    passwordResetToken: mockPasswordResetToken,
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// ── cron-auth mock ───────────────────────────────────────────────────────────
const mockVerifyCronSecret = jest.fn();
jest.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: (...args: unknown[]) => mockVerifyCronSecret(...args),
}));

// ── Logger mock ──────────────────────────────────────────────────────────────
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ── Redis mock (required by apiHandler) ─────────────────────────────────────
jest.mock("@/lib/redis", () => ({
  getRedisClient: jest.fn(() => null),
}));

// ── next/headers mock (required for Edge runtime) ───────────────────────────
jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

// ── next-auth mock ────────────────────────────────────────────────────────────
jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

// ── @/auth mock (used by apiHandler for audit logging) ───────────────────────
jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue(null),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";

/** Build a NextRequest for the cleanup-deleted cron endpoint. */
function buildCronRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["x-cron-secret"] = secret;
  }
  return new NextRequest("http://localhost:3100/api/cron/cleanup-deleted", {
    method: "POST",
    headers,
  });
}

/** Simulate a single prisma findMany batch then empty (stops the while loop). */
function singleBatch<T>(items: T[]) {
  return jest
    .fn()
    .mockResolvedValueOnce(items)
    .mockResolvedValue([]); // empty second call breaks the while(true)
}

/** Return mock that immediately resolves empty (no records to process). */
function emptyBatch() {
  return jest.fn().mockResolvedValue([]);
}

/** Default: configure all findMany mocks to return empty (no-op run). */
function setupAllEmpty() {
  mockTask.findMany.mockResolvedValue([]);
  mockTaskComment.findMany.mockResolvedValue([]);
  mockDocument.findMany.mockResolvedValue([]);
  mockKPI.findMany.mockResolvedValue([]);
  mockTimeEntry.findMany.mockResolvedValue([]);
  mockRefreshToken.findMany.mockResolvedValue([]);
  mockPasswordResetToken.findMany.mockResolvedValue([]);

  // $transaction resolves the array of promises (array form)
  mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
}

const CRON_SECRET = "test-cron-secret-abc123";

// ── Test suite ───────────────────────────────────────────────────────────────

describe("POST /api/cron/cleanup-deleted", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
    setupAllEmpty();
    // Default: cron auth passes (returns null = no error)
    mockVerifyCronSecret.mockReturnValue(null);
    // Default: $transaction resolves array of promises
    mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── 1. Auth: Missing header → 401 ─────────────────────────────────────────

  it("returns 401 when x-cron-secret header is missing", async () => {
    // verifyCronSecret returns an error Response when header is absent
    const { error } = await import("@/lib/api-response");
    const authErrorResponse = error("UnauthorizedError", "Missing cron secret header", 401);
    mockVerifyCronSecret.mockReturnValue(authErrorResponse);

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(/* no header */));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  // ── 2. Auth: Wrong secret → 401 ───────────────────────────────────────────

  it("returns 401 when x-cron-secret header has wrong value", async () => {
    const { error } = await import("@/lib/api-response");
    const authErrorResponse = error("UnauthorizedError", "Invalid cron secret", 401);
    mockVerifyCronSecret.mockReturnValue(authErrorResponse);

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest("wrong-secret"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  // ── 3. Auth: Correct secret → 200 ─────────────────────────────────────────

  it("returns 200 with correct CRON_SECRET and all zero counts", async () => {
    // All mocks already return empty arrays (setupAllEmpty)
    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
  });

  // ── 4. Batch deletion: tasks with deletedAt < cutoff are deleted ───────────

  it("deletes tasks whose deletedAt is before the 24h cutoff", async () => {
    const staleTaskIds = [{ id: "task-1" }, { id: "task-2" }, { id: "task-3" }];
    mockTask.findMany
      .mockResolvedValueOnce(staleTaskIds) // first batch: 3 tasks
      .mockResolvedValue([]); // second call: none left
    mockTask.deleteMany.mockResolvedValue({ count: 3 });

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tasks).toBe(3);

    // Verify deleteMany was called with the correct IDs
    expect(mockTask.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-1", "task-2", "task-3"] } },
    });
  });

  // ── 5. Batch preservation: recently deleted tasks are NOT deleted ──────────

  it("does NOT delete tasks whose deletedAt is within the last 24h (recent)", async () => {
    // findMany returns empty — the route won't even call deleteMany
    mockTask.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toBe(0);
    // deleteMany must not have been called for tasks
    expect(mockTask.deleteMany).not.toHaveBeenCalled();
  });

  // ── 6. Batch preservation: tasks with deletedAt=null are NOT deleted ────────

  it("does NOT delete tasks with deletedAt = null (live records)", async () => {
    // The route queries `{ deletedAt: { lt: cutoff } }` which excludes null;
    // simulate prisma correctly filtering them out by returning an empty array.
    mockTask.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toBe(0);

    // Confirm the where clause passed to findMany targets deletedAt lt only
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: { lt: expect.any(Date) } },
      })
    );
    expect(mockTask.deleteMany).not.toHaveBeenCalled();
  });

  // ── 7. KPI cascade: KPITaskLink deleted atomically with KPI ─────────────────

  it("deletes KPITaskLink records inside a $transaction alongside KPIs", async () => {
    const staleKpiIds = [{ id: "kpi-1" }, { id: "kpi-2" }];
    mockKPI.findMany
      .mockResolvedValueOnce(staleKpiIds)
      .mockResolvedValue([]);

    // Capture what was passed to $transaction
    let transactionOps: unknown[] = [];
    mockTransaction.mockImplementation((ops: unknown[]) => {
      transactionOps = ops;
      return Promise.all(ops);
    });

    // Mock the individual delete operations that get queued into the transaction array
    mockKPITaskLink.deleteMany.mockResolvedValue({ count: 5 });
    mockKPI.deleteMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.kpis).toBe(2);

    // $transaction must have been called (atomic batch)
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Both kPITaskLink.deleteMany and kPI.deleteMany were called within $transaction
    expect(mockKPITaskLink.deleteMany).toHaveBeenCalledWith({
      where: { kpiId: { in: ["kpi-1", "kpi-2"] } },
    });
    expect(mockKPI.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["kpi-1", "kpi-2"] } },
    });
  });

  // ── 8. TimeEntry: isDeleted=true + old updatedAt entries are deleted ─────────

  it("deletes time entries where isDeleted=true and updatedAt is older than cutoff", async () => {
    const staleEntries = [{ id: "te-1" }, { id: "te-2" }];
    mockTimeEntry.findMany
      .mockResolvedValueOnce(staleEntries)
      .mockResolvedValue([]);
    mockTimeEntry.deleteMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.timeEntries).toBe(2);

    // findMany must use both isDeleted=true and updatedAt < cutoff
    expect(mockTimeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: true,
          updatedAt: { lt: expect.any(Date) },
        },
      })
    );

    expect(mockTimeEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["te-1", "te-2"] } },
    });
  });

  // ── 9. Token cleanup ──────────────────────────────────────────────────────

  it("deletes expired refresh tokens and expired/used password reset tokens", async () => {
    // Refresh tokens: expired
    const expiredRefreshTokens = [{ id: "rt-1" }, { id: "rt-2" }];
    mockRefreshToken.findMany
      .mockResolvedValueOnce(expiredRefreshTokens)
      .mockResolvedValue([]);
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 2 });

    // Password reset tokens: mix of expired + used
    const staleResetTokens = [{ id: "prt-1" }, { id: "prt-2" }, { id: "prt-3" }];
    mockPasswordResetToken.findMany
      .mockResolvedValueOnce(staleResetTokens)
      .mockResolvedValue([]);
    mockPasswordResetToken.deleteMany.mockResolvedValue({ count: 3 });

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.expiredRefreshTokens).toBe(2);
    expect(body.data.expiredResetTokens).toBe(3);

    // refreshToken.findMany must filter on expiresAt < now
    expect(mockRefreshToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { expiresAt: { lt: expect.any(Date) } },
      })
    );

    // passwordResetToken.findMany must use OR: expired OR used
    expect(mockPasswordResetToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { expiresAt: { lt: expect.any(Date) } },
            { usedAt: { not: null } },
          ]),
        },
      })
    );

    expect(mockRefreshToken.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["rt-1", "rt-2"] } },
    });
    expect(mockPasswordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["prt-1", "prt-2", "prt-3"] } },
    });
  });

  // ── 10. Empty run: all counts = 0 ─────────────────────────────────────────

  it("returns 200 with all zero counts when no stale records exist", async () => {
    // All mocks are already empty via setupAllEmpty()
    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tasks).toBe(0);
    expect(body.data.comments).toBe(0);
    expect(body.data.documents).toBe(0);
    expect(body.data.kpis).toBe(0);
    expect(body.data.timeEntries).toBe(0);
    expect(body.data.expiredRefreshTokens).toBe(0);
    expect(body.data.expiredResetTokens).toBe(0);
    expect(body.data.cleanedAt).toBeDefined();
    expect(body.data.cutoff).toBeDefined();

    // None of the deleteMany methods should have been called
    expect(mockTask.deleteMany).not.toHaveBeenCalled();
    expect(mockTaskComment.deleteMany).not.toHaveBeenCalled();
    expect(mockDocument.deleteMany).not.toHaveBeenCalled();
    expect(mockKPI.deleteMany).not.toHaveBeenCalled();
    expect(mockKPITaskLink.deleteMany).not.toHaveBeenCalled();
    expect(mockTimeEntry.deleteMany).not.toHaveBeenCalled();
    expect(mockRefreshToken.deleteMany).not.toHaveBeenCalled();
    expect(mockPasswordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // ── 11. Multi-batch: processes > BATCH_SIZE records across multiple loops ───

  it("accumulates counts across multiple batches (simulates > 1000 records)", async () => {
    const batch1 = Array.from({ length: 3 }, (_, i) => ({ id: `task-batch1-${i}` }));
    const batch2 = Array.from({ length: 2 }, (_, i) => ({ id: `task-batch2-${i}` }));

    mockTask.findMany
      .mockResolvedValueOnce(batch1) // first loop iteration
      .mockResolvedValueOnce(batch2) // second loop iteration
      .mockResolvedValue([]); // third call: empty → breaks loop

    mockTask.deleteMany.mockResolvedValue({ count: 0 });

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toBe(5); // 3 + 2

    // deleteMany called twice, once per batch
    expect(mockTask.deleteMany).toHaveBeenCalledTimes(2);
  });

  // ── 12. Error handling: prisma throws → 500 ────────────────────────────────

  it("returns 500 when a prisma operation throws an unexpected error", async () => {
    mockTask.findMany.mockRejectedValue(new Error("Database connection lost"));

    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ServerError");
  });

  // ── 13. Response shape: includes cleanedAt and cutoff timestamps ────────────

  it("includes cleanedAt ISO string and cutoff ISO string in response data", async () => {
    const { POST } = await import("@/app/api/cron/cleanup-deleted/route");
    const res = await (POST as Function)(buildCronRequest(CRON_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cleanedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(body.data.cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // cutoff should be ~24h before cleanedAt
    const cleanedAt = new Date(body.data.cleanedAt).getTime();
    const cutoff = new Date(body.data.cutoff).getTime();
    const diffMs = cleanedAt - cutoff;
    // Within 5 minutes of exactly 24 hours
    expect(diffMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 5 * 60 * 1000);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 5 * 60 * 1000);
  });
});
