/**
 * @jest-environment node
 */
/**
 * TDD tests for:
 *   - PATCH /api/time-entries/:id/review — Manager lock (TS-24)
 *   - PUT locked entry -> 403 (TS-24)
 *   - GET /api/reports/department-timesheet — Team hours report (TS-26)
 *   - Time entry templates CRUD (TS-30)
 *   - Daily reminder service method (TS-29)
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
const mockAuditLog = { create: jest.fn(), findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockTimeEntryTemplate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};
const mockNotification = {
  findMany: jest.fn(),
  createMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    auditLog: mockAuditLog,
    user: mockUser,
    timeEntryTemplate: mockTimeEntryTemplate,
    notification: mockNotification,
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
// TS-24: Time entry review (lock/unlock)
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/time-entries/:id/review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("manager can lock (review) a time entry", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    const entry = {
      id: "entry-1",
      userId: "u1",
      hours: 4,
      locked: false,
      date: new Date("2026-03-23"),
      category: "PLANNED_TASK",
    };
    mockTimeEntry.findUnique.mockResolvedValue(entry);
    mockTimeEntry.update.mockResolvedValue({ ...entry, locked: true });
    mockAuditLog.create.mockResolvedValue({ id: "audit-1" });

    const { PATCH } = await import("@/app/api/time-entries/[id]/review/route");
    const res = await PATCH(
      createMockRequest("/api/time-entries/entry-1/review", {
        method: "PATCH",
        body: { locked: true },
      }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockTimeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry-1" },
        data: expect.objectContaining({ locked: true }),
      })
    );
  });

  test("PUT on locked entry returns 403", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
    const lockedEntry = {
      id: "entry-1",
      userId: "u1",
      hours: 4,
      locked: true,
      date: new Date("2026-03-23"),
      category: "PLANNED_TASK",
    };
    mockTimeEntry.findUnique.mockResolvedValue(lockedEntry);

    const { PUT } = await import("@/app/api/time-entries/[id]/route");
    const res = await PUT(
      createMockRequest("/api/time-entries/entry-1", {
        method: "PUT",
        body: { hours: 6 },
      }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(403);
  });

  test("only MANAGER can review (lock) entries", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { PATCH } = await import("@/app/api/time-entries/[id]/review/route");
    const res = await PATCH(
      createMockRequest("/api/time-entries/entry-1/review", {
        method: "PATCH",
        body: { locked: true },
      }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TS-26: Department timesheet report
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/reports/department-timesheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("returns team hours grouped by user and day", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const entries = [
      { userId: "u1", date: new Date("2026-03-23"), hours: 4, category: "PLANNED_TASK", user: { id: "u1", name: "Alice" }, task: null },
      { userId: "u1", date: new Date("2026-03-24"), hours: 3, category: "SUPPORT", user: { id: "u1", name: "Alice" }, task: null },
      { userId: "u2", date: new Date("2026-03-23"), hours: 8, category: "PLANNED_TASK", user: { id: "u2", name: "Bob" }, task: null },
    ];
    mockTimeEntry.findMany.mockResolvedValue(entries);

    const { GET } = await import("@/app/api/reports/department-timesheet/route");
    const res = await GET(
      createMockRequest("/api/reports/department-timesheet", {
        searchParams: { weekStart: "2026-03-23" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Should have grouped data by user
    expect(body.data).toHaveProperty("byUser");
    expect(Object.keys(body.data.byUser)).toHaveLength(2);
  });

  test("ENGINEER cannot access department report", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { GET } = await import("@/app/api/reports/department-timesheet/route");
    const res = await GET(
      createMockRequest("/api/reports/department-timesheet", {
        searchParams: { weekStart: "2026-03-23" },
      })
    );

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TS-30: Time entry templates
// ═══════════════════════════════════════════════════════════════════════════════

describe("Time entry templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
  });

  test("GET /api/time-entries/templates returns user templates", async () => {
    const templates = [
      { id: "tpl-1", name: "Daily standup", userId: "u1", entries: JSON.stringify([{ hours: 0.5, category: "ADMIN" }]) },
      { id: "tpl-2", name: "Full dev day", userId: "u1", entries: JSON.stringify([{ hours: 8, category: "PLANNED_TASK" }]) },
    ];
    mockTimeEntryTemplate.findMany.mockResolvedValue(templates);

    const { GET } = await import("@/app/api/time-entries/templates/route");
    const res = await GET(createMockRequest("/api/time-entries/templates"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test("POST /api/time-entries/templates creates a template", async () => {
    mockTimeEntryTemplate.count.mockResolvedValue(3);
    const created = {
      id: "tpl-new",
      name: "Sprint planning",
      userId: "u1",
      entries: JSON.stringify([{ hours: 2, category: "ADMIN", description: "sprint planning" }]),
    };
    mockTimeEntryTemplate.create.mockResolvedValue(created);

    const { POST } = await import("@/app/api/time-entries/templates/route");
    const res = await POST(
      createMockRequest("/api/time-entries/templates", {
        method: "POST",
        body: {
          name: "Sprint planning",
          entries: [{ hours: 2, category: "ADMIN", description: "sprint planning" }],
        },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("Sprint planning");
  });

  test("POST /api/time-entries/templates/:id/apply creates entries from template", async () => {
    const template = {
      id: "tpl-1",
      name: "Daily standup",
      userId: "u1",
      entries: JSON.stringify([
        { hours: 0.5, category: "ADMIN", description: "standup" },
        { hours: 7.5, category: "PLANNED_TASK", taskId: "t1" },
      ]),
    };
    mockTimeEntryTemplate.findUnique.mockResolvedValue(template);
    mockTimeEntry.findMany.mockResolvedValue([]); // no existing entries
    mockTimeEntry.create
      .mockResolvedValueOnce({ id: "e1", hours: 0.5, category: "ADMIN" })
      .mockResolvedValueOnce({ id: "e2", hours: 7.5, category: "PLANNED_TASK" });

    const { POST } = await import("@/app/api/time-entries/templates/[id]/apply/route");
    const res = await POST(
      createMockRequest("/api/time-entries/templates/tpl-1/apply", {
        method: "POST",
        body: { date: "2026-03-25" },
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  test("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/time-entries/templates/route");
    const res = await GET(createMockRequest("/api/time-entries/templates"));

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TS-29: Daily reminder (service-level test)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Daily timesheet reminder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test("builds reminders for users with no entries today", async () => {
    // This tests the NotificationService.buildDailyTimesheetReminders method
    // which should check for users who have zero entries for today
    const { NotificationService } = await import("@/services/notification-service");
    const mockPrismaForService = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: "u1", name: "Alice" },
          { id: "u2", name: "Bob" },
        ]),
      },
      timeEntry: {
        findMany: jest.fn().mockResolvedValue([
          // Only u1 has an entry today; u2 does not
          { userId: "u1", hours: 4 },
        ]),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const service = new NotificationService(mockPrismaForService);
    const now = new Date("2026-03-25T18:00:00+08:00"); // Wednesday 18:00 Taipei

    const reminders = await service.buildDailyTimesheetReminders(
      now,
      new Set()
    );

    // u2 should get a reminder (no entries today), u1 should not
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    const reminderUserIds = reminders.map((r) => r.userId);
    expect(reminderUserIds).toContain("u2");
    expect(reminderUserIds).not.toContain("u1");
  });
});
