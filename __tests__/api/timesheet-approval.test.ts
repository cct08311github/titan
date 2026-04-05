/**
 * @jest-environment node
 */
/**
 * API tests: Phase 2 Timesheet Approval — Issue #853
 *
 * Tests for:
 *   - POST /api/time-entries/approve (batch approve)
 *   - POST /api/time-entries/reject (batch reject)
 *   - GET /api/time-entries/monthly (monthly view)
 *   - GET /api/time-entries/monthly-summary (summary stats)
 *   - PUT /api/time-entries/[id] auto-reset REJECTED → PENDING
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockTransaction = jest.fn();
const mockTimeEntry = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};
const mockTimesheetApproval = {
  createMany: jest.fn(),
};
const mockAuditLog = { create: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockNotification = { createMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    timesheetApproval: mockTimesheetApproval,
    auditLog: mockAuditLog,
    user: mockUser,
    notification: mockNotification,
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        timeEntry: mockTimeEntry,
        timesheetApproval: mockTimesheetApproval,
        auditLog: mockAuditLog,
        notification: mockNotification,
      }),
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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PENDING_ENTRY = {
  id: "entry-1",
  userId: "u1",
  hours: 8,
  date: new Date("2026-03-02"),
  category: "PLANNED_TASK",
  isRunning: false,
  locked: false,
  approvalStatus: "PENDING",
};

const REJECTED_ENTRY = {
  id: "entry-2",
  userId: "u1",
  hours: 4,
  date: new Date("2026-03-03"),
  category: "PLANNED_TASK",
  isRunning: false,
  locked: false,
  approvalStatus: "REJECTED",
};

const RUNNING_ENTRY = {
  id: "entry-3",
  userId: "u1",
  hours: 0,
  date: new Date("2026-03-04"),
  category: "PLANNED_TASK",
  isRunning: true,
  locked: false,
  approvalStatus: "PENDING",
};

const SELF_ENTRY = {
  id: "entry-4",
  userId: "m1", // same as manager
  hours: 6,
  date: new Date("2026-03-05"),
  category: "PLANNED_TASK",
  isRunning: false,
  locked: false,
  approvalStatus: "PENDING",
};

const APPROVED_ENTRY = {
  id: "entry-5",
  userId: "u1",
  hours: 8,
  date: new Date("2026-03-06"),
  category: "PLANNED_TASK",
  isRunning: false,
  locked: true,
  approvalStatus: "APPROVED",
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/time-entries/approve
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("approve PENDING entries succeeds", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([PENDING_ENTRY]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 1 });
    mockTimesheetApproval.createMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-1"] },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.approved).toBe(1);
    expect(mockTimeEntry.updateMany).toHaveBeenCalled();
  });

  test("approve REJECTED entries succeeds", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([REJECTED_ENTRY]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 1 });
    mockTimesheetApproval.createMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-2"] },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.approved).toBe(1);
  });

  test("self-approval blocked with 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([SELF_ENTRY]);

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-4"] },
      })
    );

    expect(res.status).toBe(403);
  });

  test("isRunning entries excluded from approval", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([RUNNING_ENTRY]);

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-3"] },
      })
    );

    // No eligible entries → 400
    expect(res.status).toBe(400);
  });

  test("approve empty entryIds returns validation error", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: [] },
      })
    );

    // Zod validation error
    expect(res.status).toBe(400);
  });

  test("approve already-approved entry is skipped (idempotent)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([APPROVED_ENTRY]);

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-5"] },
      })
    );

    // Already approved → no eligible → 400
    expect(res.status).toBe(400);
  });

  test("approve creates AuditLog records", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([PENDING_ENTRY]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 1 });
    mockTimesheetApproval.createMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/time-entries/approve/route");
    await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-1"] },
      })
    );

    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BATCH_APPROVE_TIME_ENTRIES",
        }),
      })
    );
  });

  test("non-manager gets 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { POST } = await import("@/app/api/time-entries/approve/route");
    const res = await POST(
      createMockRequest("/api/time-entries/approve", {
        method: "POST",
        body: { entryIds: ["entry-1"] },
      })
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/time-entries/reject
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("reject with reason succeeds", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([PENDING_ENTRY]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 1 });
    mockTimesheetApproval.createMany.mockResolvedValue({ count: 1 });
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/time-entries/reject/route");
    const res = await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: ["entry-1"], reason: "時數不正確" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rejected).toBe(1);
  });

  test("reject sets locked=false", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockTimeEntry.findMany.mockResolvedValue([APPROVED_ENTRY]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 1 });
    mockTimesheetApproval.createMany.mockResolvedValue({ count: 1 });
    mockNotification.createMany.mockResolvedValue({ count: 1 });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/time-entries/reject/route");
    await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: ["entry-5"], reason: "需要修正" },
      })
    );

    expect(mockTimeEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locked: false, approvalStatus: "REJECTED" }),
      })
    );
  });

  test("reject requires reason (empty string fails)", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { POST } = await import("@/app/api/time-entries/reject/route");
    const res = await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: ["entry-1"], reason: "" },
      })
    );

    expect(res.status).toBe(400);
  });

  test("reject without reason field fails", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { POST } = await import("@/app/api/time-entries/reject/route");
    const res = await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: ["entry-1"] },
      })
    );

    expect(res.status).toBe(400);
  });

  test("reject empty entryIds returns validation error", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { POST } = await import("@/app/api/time-entries/reject/route");
    const res = await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: [], reason: "理由" },
      })
    );

    expect(res.status).toBe(400);
  });

  test("non-manager gets 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { POST } = await import("@/app/api/time-entries/reject/route");
    const res = await POST(
      createMockRequest("/api/time-entries/reject", {
        method: "POST",
        body: { entryIds: ["entry-1"], reason: "理由" },
      })
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/time-entries/monthly
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/time-entries/monthly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("returns correct structure for a month", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "Engineer", email: "e@t.com" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      {
        ...PENDING_ENTRY,
        task: { id: "t1", title: "Task 1", category: "PLANNED" },
      },
    ]);

    const { GET } = await import("@/app/api/time-entries/monthly/route");
    const res = await GET(
      createMockRequest("/api/time-entries/monthly", {
        searchParams: { month: "2026-03" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.month).toBe("2026-03");
    expect(body.data.daysInMonth).toBe(31);
    expect(body.data.members).toHaveLength(1);
    expect(body.data.members[0].userId).toBe("u1");
  });

  test("invalid month param returns error", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { GET } = await import("@/app/api/time-entries/monthly/route");
    const res = await GET(
      createMockRequest("/api/time-entries/monthly", {
        searchParams: { month: "invalid" },
      })
    );

    // Error shape: { ok: false, error: "INVALID_PARAM", message: "..." }
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });

  test("non-manager gets 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { GET } = await import("@/app/api/time-entries/monthly/route");
    const res = await GET(
      createMockRequest("/api/time-entries/monthly", {
        searchParams: { month: "2026-03" },
      })
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/time-entries/monthly-summary
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/time-entries/monthly-summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("summary calculates overtime correctly", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "Engineer" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      { ...PENDING_ENTRY, overtimeType: "WEEKDAY", hours: 2 },
      { ...PENDING_ENTRY, id: "entry-1b", overtimeType: "HOLIDAY", hours: 4 },
      { ...PENDING_ENTRY, id: "entry-1c", overtimeType: "NONE", hours: 8 },
    ]);

    const { GET } = await import("@/app/api/time-entries/monthly-summary/route");
    const res = await GET(
      createMockRequest("/api/time-entries/monthly-summary", {
        searchParams: { month: "2026-03" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.teamOvertime.weekday).toBe(2);
    expect(body.data.teamOvertime.holiday).toBe(4);
    expect(body.data.teamOvertime.total).toBe(6);
    expect(body.data.members[0].totalHours).toBe(14);
  });

  test("non-manager gets 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { GET } = await import("@/app/api/time-entries/monthly-summary/route");
    const res = await GET(
      createMockRequest("/api/time-entries/monthly-summary", {
        searchParams: { month: "2026-03" },
      })
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/time-entries/[id] — auto-reset REJECTED → PENDING
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /api/time-entries/[id] — auto-reset REJECTED → PENDING", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("editing REJECTED entry auto-resets to PENDING", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
    const rejectedEntry = {
      ...REJECTED_ENTRY,
      userId: "u1",
      description: "old",
      taskId: null,
    };
    mockTimeEntry.findUnique.mockResolvedValue(rejectedEntry);
    mockTimeEntry.update.mockResolvedValue({
      ...rejectedEntry,
      hours: 6,
      approvalStatus: "PENDING",
    });
    mockAuditLog.create.mockResolvedValue({});

    const { PUT } = await import("@/app/api/time-entries/[id]/route");
    const res = await PUT(
      createMockRequest("/api/time-entries/entry-2", {
        method: "PUT",
        body: { hours: 6 },
      }),
      { params: Promise.resolve({ id: "entry-2" }) }
    );

    expect(res.status).toBe(200);
    expect(mockTimeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvalStatus: "PENDING" }),
      })
    );
  });
});
