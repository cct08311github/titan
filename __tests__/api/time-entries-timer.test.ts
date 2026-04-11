/**
 * @jest-environment node
 */
/**
 * Timer API tests — TDD for Issues #711, #713, #714
 *
 * POST /api/time-entries/start — creates a running timer entry
 * POST /api/time-entries/stop  — stops the running timer, calculates hours
 * GET  /api/time-entries/running — returns current running entry
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// T1452: start/stop routes wrap logic in $transaction. Mock invokes the
// callback with the same prisma mock so tx.timeEntry.* calls work correctly.
const mockPrismaTimer = {
  timeEntry: mockTimeEntry,
  $transaction: jest.fn().mockImplementation((arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(mockPrismaTimer);
    return Promise.all(arg as unknown[]);
  }),
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrismaTimer }));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

// ── Test Data ────────────────────────────────────────────────────────────────
const NOW = new Date("2026-03-25T09:00:00.000Z");
const LATER = new Date("2026-03-25T11:30:00.000Z");

const RUNNING_ENTRY = {
  id: "entry-running",
  userId: "u1",
  taskId: "task-1",
  date: NOW,
  hours: 0,
  startTime: NOW,
  endTime: null,
  isRunning: true,
  category: "PLANNED_TASK",
  description: null,
  task: { id: "task-1", title: "Test Task", category: "PLANNED" },
};

const STOPPED_ENTRY = {
  ...RUNNING_ENTRY,
  endTime: LATER,
  hours: 2.5,
  isRunning: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/time-entries/start
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates a running entry when no timer is active", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(null); // no running entry
    mockTimeEntry.create.mockResolvedValue(RUNNING_ENTRY);

    const { POST } = await import("@/app/api/time-entries/start/route");
    const res = await POST(
      createMockRequest("/api/time-entries/start", {
        method: "POST",
        body: { taskId: "task-1" },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(true);
    expect(body.data.startTime).toBeDefined();
  });

  it("returns 409 when a timer is already running", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(RUNNING_ENTRY); // already running

    const { POST } = await import("@/app/api/time-entries/start/route");
    const res = await POST(
      createMockRequest("/api/time-entries/start", {
        method: "POST",
        body: { taskId: "task-1" },
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("creates entry without taskId (free time)", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(null);
    const entryNoTask = { ...RUNNING_ENTRY, taskId: null, task: null };
    mockTimeEntry.create.mockResolvedValue(entryNoTask);

    const { POST } = await import("@/app/api/time-entries/start/route");
    const res = await POST(
      createMockRequest("/api/time-entries/start", {
        method: "POST",
        body: {},
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.taskId).toBeNull();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/start/route");
    const res = await POST(
      createMockRequest("/api/time-entries/start", {
        method: "POST",
        body: {},
      })
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/time-entries/stop
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-entries/stop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("stops running timer and calculates hours", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(RUNNING_ENTRY);
    mockTimeEntry.update.mockResolvedValue(STOPPED_ENTRY);

    const { POST } = await import("@/app/api/time-entries/stop/route");
    const res = await POST(
      createMockRequest("/api/time-entries/stop", { method: "POST", body: {} })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(false);
    expect(body.data.endTime).toBeDefined();
    expect(body.data.hours).toBeGreaterThan(0);
  });

  it("returns 404 when no timer is running", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/stop/route");
    const res = await POST(
      createMockRequest("/api/time-entries/stop", { method: "POST", body: {} })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/stop/route");
    const res = await POST(
      createMockRequest("/api/time-entries/stop", { method: "POST", body: {} })
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/time-entries/running
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/time-entries/running", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns the running entry when one exists", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(RUNNING_ENTRY);

    const { GET } = await import("@/app/api/time-entries/running/route");
    const res = await GET(
      createMockRequest("/api/time-entries/running")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRunning).toBe(true);
    expect(body.data.id).toBe("entry-running");
  });

  it("returns null when no timer is running", async () => {
    mockTimeEntry.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/time-entries/running/route");
    const res = await GET(
      createMockRequest("/api/time-entries/running")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeNull();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/time-entries/running/route");
    const res = await GET(
      createMockRequest("/api/time-entries/running")
    );

    expect(res.status).toBe(401);
  });
});
