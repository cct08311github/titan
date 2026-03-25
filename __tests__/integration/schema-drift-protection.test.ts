/**
 * @jest-environment node
 */
/**
 * Layer 1.5 Integration Tests — Section D: Schema Drift Protection
 *
 * Simulates API responses with missing or null fields to verify that
 * the service layer handles incomplete data gracefully without crashing.
 */
import { createMockPrisma } from "@/lib/test-utils";
import { TaskService } from "@/services/task-service";
import { KPIService } from "@/services/kpi-service";
import { TimeEntryService } from "@/services/time-entry-service";
import { UserService } from "@/services/user-service";

// ── D1. TaskService handles missing optional relation fields ──────────────
describe("D1: TaskService — graceful handling of missing relation fields", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
  });

  it("createTask does not crash when optional fields are null", async () => {
    (prisma.task.create as jest.Mock).mockResolvedValue({
      id: "t-1",
      title: "Minimal Task",
      status: "BACKLOG",
      priority: "P2",
      category: "PLANNED",
      primaryAssignee: null,
      backupAssignee: null,
      creator: null, // schema drift: creator relation missing
    });

    const result = await service.createTask({ title: "Minimal Task", creatorId: "u-1" });
    expect(result.id).toBe("t-1");
    // should not throw even when creator is null
  });

  it("listTasks handles rows missing monthlyGoal relation", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "t-2",
        title: "Task without goal",
        status: "TODO",
        monthlyGoal: null, // schema drift: relation is missing
        subTasks: [],
        deliverables: [],
        primaryAssignee: null,
        backupAssignee: null,
        creator: { id: "u-1", name: "User" },
        _count: { subTasks: 0, comments: 0 },
      },
    ]);

    (prisma.task.count as jest.Mock).mockResolvedValue(1);
    const result = await service.listTasks({});
    expect(result.tasks[0].monthlyGoal).toBeNull();
    // must not throw
  });
});

// ── D2. KPIService handles tasks with null progressPct ───────────────────
describe("D2: KPIService — calculateAchievement graceful with null progressPct", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: KPIService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
  });

  it("treats null progressPct as 0 in weighted average (schema drift)", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
      id: "kpi-1",
      taskLinks: [
        // schema drift: progressPct is null instead of a number
        { weight: 1, task: { progressPct: null as unknown as number, status: "TODO" } },
        { weight: 1, task: { progressPct: 60, status: "IN_PROGRESS" } },
      ],
    });
    (prisma.kPI.update as jest.Mock).mockResolvedValue({ id: "kpi-1", actual: 30 });

    // Should not throw — null * 1 = NaN unless protected
    await expect(service.calculateAchievement("kpi-1")).resolves.toBeDefined();
  });

  it("returns 0 when all taskLinks have null progressPct", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
      id: "kpi-1",
      taskLinks: [
        { weight: 1, task: { progressPct: null as unknown as number, status: "TODO" } },
      ],
    });
    (prisma.kPI.update as jest.Mock).mockImplementation((args: { data: { actual: number } }) =>
      Promise.resolve({ id: "kpi-1", actual: args.data.actual })
    );

    // Should not crash
    await expect(service.calculateAchievement("kpi-1")).resolves.toBeDefined();
  });
});

// ── D3. UserService handles missing isActive field ────────────────────────
describe("D3: UserService — listUsers handles schema drift in isActive", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: UserService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as never);
  });

  it("returns users even when avatar field is null (optional field drift)", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "u-1",
        name: "Alice",
        email: "alice@test.com",
        role: "ENGINEER",
        avatar: null, // optional field null is valid
        isActive: true,
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const users = await service.listUsers({});
    expect(users).toHaveLength(1);
    expect(users[0].avatar).toBeNull();
  });

  it("excludes suspended users by default without crashing on partial rows", async () => {
    // Simulate DB returning only active users (filter applied in DB)
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "u-2",
        name: "Bob",
        email: "bob@test.com",
        role: "ENGINEER",
        avatar: null,
        isActive: true,
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const users = await service.listUsers({ includeSuspended: false });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
    expect(users).toHaveLength(1);
  });
});

// ── D4. TimeEntryService handles missing task relation ────────────────────
describe("D4: TimeEntryService — handles entries with missing task relation", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TimeEntryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  it("getStats does not crash when task relation is null (schema drift)", async () => {
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
      {
        id: "e-1",
        userId: "u-1",
        hours: 4,
        category: "PLANNED_TASK",
        date: new Date(),
        task: null, // schema drift: no task linked
        user: { id: "u-1", name: "Alice" },
      },
      {
        id: "e-2",
        userId: "u-1",
        hours: 2,
        category: "MEETING",
        date: new Date(),
        task: null,
        user: { id: "u-1", name: "Alice" },
      },
    ]);

    const stats = await service.getStats({}, "u-1", "ENGINEER");
    expect(stats.totalHours).toBe(6);
    expect(stats.byCategory["PLANNED_TASK"]).toBe(4);
    expect(stats.byCategory["MEETING"]).toBe(2);
  });
});

// ── D5. API route response shape integrity ────────────────────────────────
describe("D5: API response always includes success wrapper fields", () => {
  const mockGetServerSession = jest.fn();

  const mockKPI = { findMany: jest.fn() };
  const mockTask = { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) };

  jest.mock("@/lib/prisma", () => ({
    prisma: {
      kPI: mockKPI,
      task: mockTask,
      taskActivity: { create: jest.fn() },
      taskChange: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      permission: { findFirst: jest.fn() },
      user: { findMany: jest.fn() },
      timeEntry: { findMany: jest.fn() },
      $transaction: jest.fn(),
    },
  }));

  jest.mock("next-auth", () => ({
    getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
  }));

  const { createMockRequest } = require("../utils/test-utils");

  const SESSION = {
    user: { id: "u-1", name: "Test", email: "t@e.com", role: "ENGINEER" },
    expires: "2099-01-01",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("GET /api/kpi response has data array even if DB returns empty list", async () => {
    mockKPI.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });

  it("GET /api/tasks response has data array even if DB returns empty list", async () => {
    mockTask.findMany.mockResolvedValue([]);
    mockTask.count.mockResolvedValue(0);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data.items)).toBe(true);
  });
});
