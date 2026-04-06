/**
 * @jest-environment node
 */
/**
 * TDD tests for:
 *   - POST /api/time-entries/batch (TS-06)
 *   - POST /api/time-entries/copy-week (TS-07)
 *   - Audit trail on update/delete (TS-08)
 *
 * Tests written BEFORE implementation (Red phase).
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockAuditLog = {
  create: jest.fn(),
  findMany: jest.fn(),
};
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    auditLog: mockAuditLog,
    $transaction: mockTransaction,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION_ENGINEER = {
  user: { id: "u1", name: "Engineer", email: "e@t.com", role: "ENGINEER" },
  expires: "2099",
};

const SESSION_MANAGER = {
  user: { id: "m1", name: "Manager", email: "m@t.com", role: "MANAGER" },
  expires: "2099",
};

// ═══════════════════════════════════════════════════════════════════════════════
// TS-06: Batch time entries
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/batch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
  });

  test("creates multiple entries in a single request", async () => {
    const created = [
      { id: "e1", userId: "u1", date: new Date("2026-03-23"), hours: 4, category: "PLANNED_TASK" },
      { id: "e2", userId: "u1", date: new Date("2026-03-24"), hours: 3, category: "SUPPORT" },
    ];
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        timeEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn()
            .mockResolvedValueOnce(created[0])
            .mockResolvedValueOnce(created[1]),
        },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          entries: [
            { date: "2026-03-23", hours: 4, category: "PLANNED_TASK" },
            { date: "2026-03-24", hours: 3, category: "SUPPORT" },
          ],
        },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test("rejects overlapping times (same date + same task)", async () => {
    // Simulate existing entry on 2026-03-23 for same task
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        timeEntry: {
          findMany: jest.fn().mockResolvedValue([
            { id: "existing", userId: "u1", date: new Date("2026-03-23"), hours: 4, taskId: "t1" },
          ]),
          create: jest.fn(),
        },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          entries: [
            { date: "2026-03-23", hours: 4, taskId: "t1", category: "PLANNED_TASK" },
          ],
        },
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("validates all entries before creating any", async () => {
    // Second entry has invalid hours (-1), entire batch should fail
    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          entries: [
            { date: "2026-03-23", hours: 4, category: "PLANNED_TASK" },
            { date: "2026-03-24", hours: -1, category: "SUPPORT" },
          ],
        },
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("rejects batch with more than 50 entries", async () => {
    const entries = Array.from({ length: 51 }, (_, i) => ({
      date: "2026-03-23",
      hours: 1,
      category: "PLANNED_TASK",
    }));

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: { entries },
      })
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: { entries: [{ date: "2026-03-23", hours: 4 }] },
      })
    );

    expect(res.status).toBe(401);
  });

  test("rejects empty entries array", async () => {
    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: { entries: [] },
      })
    );

    expect(res.status).toBe(400);
  });

  // T-1: Daily 24hr limit enforcement in batch endpoint
  test("rejects batch that exceeds daily 24hr limit against existing entries", async () => {
    // User already has 20 hours on 2026-03-23
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        timeEntry: {
          findMany: jest.fn().mockResolvedValue([
            { date: new Date("2026-03-23"), taskId: "t1", hours: 12 },
            { date: new Date("2026-03-23"), taskId: "t2", hours: 8 },
          ]),
          create: jest.fn(),
        },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          // Adding 5 hours would bring total to 25 — must be rejected
          entries: [{ date: "2026-03-23", hours: 5, taskId: "t3", category: "PLANNED_TASK" }],
        },
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/24/);
  });

  test("rejects batch where multiple entries on same day collectively exceed 24hr limit", async () => {
    // No existing entries; batch itself totals 25 hours on one day
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        timeEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
        },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          entries: [
            { date: "2026-03-23", hours: 12, taskId: "t1", category: "PLANNED_TASK" },
            { date: "2026-03-23", hours: 8,  taskId: "t2", category: "SUPPORT" },
            { date: "2026-03-23", hours: 5,  taskId: "t3", category: "MEETING" }, // 12+8+5 = 25
          ],
        },
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("allows batch that exactly reaches 24hr limit", async () => {
    // No existing entries; batch totals exactly 24 hours — should pass
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        timeEntry: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn()
            .mockResolvedValueOnce({ id: "e1", hours: 12 })
            .mockResolvedValueOnce({ id: "e2", hours: 12 }),
        },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/time-entries/batch/route");
    const res = await POST(
      createMockRequest("/api/time-entries/batch", {
        method: "POST",
        body: {
          entries: [
            { date: "2026-03-23", hours: 12, taskId: "t1", category: "PLANNED_TASK" },
            { date: "2026-03-23", hours: 12, taskId: "t2", category: "SUPPORT" },
          ],
        },
      })
    );

    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TS-07: Copy week
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/copy-week", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
  });

  test("copies entries from source week +7 days", async () => {
    const sourceEntries = [
      { id: "s1", userId: "u1", taskId: "t1", date: new Date("2026-03-16"), hours: 4, category: "PLANNED_TASK", description: "coding" },
      { id: "s2", userId: "u1", taskId: "t2", date: new Date("2026-03-17"), hours: 3, category: "SUPPORT", description: null },
    ];

    mockTimeEntry.findMany
      .mockResolvedValueOnce(sourceEntries)   // source week entries
      .mockResolvedValueOnce([]);              // target week entries (empty)

    const created = [
      { ...sourceEntries[0], id: "c1", date: new Date("2026-03-23") },
      { ...sourceEntries[1], id: "c2", date: new Date("2026-03-24") },
    ];
    mockTimeEntry.createMany.mockResolvedValue({ count: 2 });
    mockTimeEntry.findMany.mockResolvedValueOnce(created); // final fetch

    const { POST } = await import("@/app/api/time-entries/copy-week/route");
    const res = await POST(
      createMockRequest("/api/time-entries/copy-week", {
        method: "POST",
        body: { sourceWeekStart: "2026-03-16" },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("skips copy if target week already has entries", async () => {
    const sourceEntries = [
      { id: "s1", userId: "u1", taskId: "t1", date: new Date("2026-03-16"), hours: 4, category: "PLANNED_TASK", description: null },
    ];
    const targetEntries = [
      { id: "x1", userId: "u1", taskId: "t1", date: new Date("2026-03-23"), hours: 4, category: "PLANNED_TASK", description: null },
    ];

    mockTimeEntry.findMany
      .mockResolvedValueOnce(sourceEntries)   // source week
      .mockResolvedValueOnce(targetEntries);  // target week has entries

    const { POST } = await import("@/app/api/time-entries/copy-week/route");
    const res = await POST(
      createMockRequest("/api/time-entries/copy-week", {
        method: "POST",
        body: { sourceWeekStart: "2026-03-16" },
      })
    );

    // Should skip duplicates; either 200 with message or partial copy
    const body = await res.json();
    expect(body.ok).toBe(true);
    // createMany should not have been called for the duplicate
    expect(mockTimeEntry.createMany).not.toHaveBeenCalled();
  });

  test("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/copy-week/route");
    const res = await POST(
      createMockRequest("/api/time-entries/copy-week", {
        method: "POST",
        body: { sourceWeekStart: "2026-03-16" },
      })
    );

    expect(res.status).toBe(401);
  });

  test("returns 400 when sourceWeekStart is missing", async () => {
    const { POST } = await import("@/app/api/time-entries/copy-week/route");
    const res = await POST(
      createMockRequest("/api/time-entries/copy-week", {
        method: "POST",
        body: {},
      })
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TS-08: Audit trail
// ═══════════════════════════════════════════════════════════════════════════════

describe("Audit trail for time entry changes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
    // T-1: Mock findMany for daily limit check
    mockTimeEntry.findMany.mockResolvedValue([]);
  });

  test("updating time entry creates audit log", async () => {
    const existing = {
      id: "entry-1",
      userId: "u1",
      taskId: null,
      date: new Date("2026-03-23"),
      hours: 4,
      category: "PLANNED_TASK",
      description: "original",
    };
    mockTimeEntry.findUnique.mockResolvedValue(existing);
    mockTimeEntry.update.mockResolvedValue({ ...existing, hours: 6, task: null });
    mockAuditLog.create.mockResolvedValue({ id: "audit-1" });

    const { PUT } = await import("@/app/api/time-entries/[id]/route");
    const res = await PUT(
      createMockRequest("/api/time-entries/entry-1", {
        method: "PUT",
        body: { hours: 6 },
      }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(200);
    // Audit log should be created with old/new values
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE_TIME_ENTRY",
          resourceType: "TimeEntry",
          resourceId: "entry-1",
          userId: "u1",
        }),
      })
    );
  });

  test("deleting time entry creates audit log", async () => {
    const existing = {
      id: "entry-1",
      userId: "u1",
      taskId: null,
      date: new Date("2026-03-23"),
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
    };
    mockTimeEntry.findUnique.mockResolvedValue(existing);
    mockTimeEntry.delete.mockResolvedValue(existing);
    mockAuditLog.create.mockResolvedValue({ id: "audit-2" });

    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/time-entries/entry-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DELETE_TIME_ENTRY",
          resourceType: "TimeEntry",
          resourceId: "entry-1",
          userId: "u1",
        }),
      })
    );
  });
});
