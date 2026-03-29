/**
 * @jest-environment node
 */
/**
 * Layer 1.5 Integration Tests — Section B: Service Layer Logic
 *
 * Tests service methods in isolation using mock Prisma, verifying
 * business logic, field derivation, and edge cases.
 */
import { createMockPrisma } from "@/lib/test-utils";
import { TaskService } from "@/services/task-service";
import { UserService } from "@/services/user-service";
import { KPIService } from "@/services/kpi-service";
import { TimeEntryService } from "@/services/time-entry-service";
import { ValidationError, NotFoundError, ForbiddenError } from "@/services/errors";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

// ── B1-B2. TaskService ────────────────────────────────────────────────────
describe("B1: TaskService — createTask sets creatorId from input", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
    (prisma.task.create as jest.Mock).mockResolvedValue({
      id: "t-1",
      title: "My Task",
      status: "BACKLOG",
      priority: "P2",
      category: "PLANNED",
      creatorId: "user-99",
      primaryAssignee: null,
      backupAssignee: null,
      creator: { id: "user-99", name: "Owner" },
    });
  });

  it("persists the provided creatorId without modification", async () => {
    await service.createTask({ title: "My Task", creatorId: "user-99" });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creatorId: "user-99" }),
      })
    );
  });

  it("defaults status to BACKLOG when not specified", async () => {
    await service.createTask({ title: "My Task", creatorId: "user-99" });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "BACKLOG" }),
      })
    );
  });

  it("throws ValidationError when title is empty string", async () => {
    await expect(
      service.createTask({ title: "   ", creatorId: "user-99" })
    ).rejects.toThrow(ValidationError);
  });

  it("sets addedDate when category is ADDED", async () => {
    await service.createTask({ title: "Added Task", creatorId: "user-99", category: "ADDED" });
    const callData = (prisma.task.create as jest.Mock).mock.calls[0][0].data;
    expect(callData.addedDate).toBeInstanceOf(Date);
  });

  it("does not set addedDate for PLANNED category", async () => {
    await service.createTask({ title: "Planned Task", creatorId: "user-99", category: "PLANNED" });
    const callData = (prisma.task.create as jest.Mock).mock.calls[0][0].data;
    expect(callData.addedDate).toBeNull();
  });
});

describe("B2: TaskService — updateTaskStatus uses transaction and records activity", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  const UPDATED_TASK = {
    id: "t-1",
    status: "DONE",
    primaryAssignee: null,
    backupAssignee: null,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);

    // updateTaskStatus calls task.findUnique first to get existing status
    // Must be IN_PROGRESS for transition to DONE to be valid (TODO→DONE is not allowed)
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({ status: "IN_PROGRESS" });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          task: prisma.task,
          taskActivity: prisma.taskActivity,
        };
        return fn(tx);
      }
    );
    (prisma.task.update as jest.Mock).mockResolvedValue(UPDATED_TASK);
    (prisma.taskActivity.create as jest.Mock).mockResolvedValue({});
  });

  it("returns updated task with new status", async () => {
    const result = await service.updateTaskStatus("t-1", "DONE", "user-99");
    expect(result).toMatchObject({ status: "DONE" });
  });

  it("records a STATUS_CHANGED activity entry", async () => {
    await service.updateTaskStatus("t-1", "DONE", "user-99");
    expect(prisma.taskActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STATUS_CHANGED",
          taskId: "t-1",
          userId: "user-99",
        }),
      })
    );
  });
});

// ── B3. UserService suspend/unsuspend lifecycle ───────────────────────────
describe("B3: UserService — suspend/unsuspend lifecycle", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: UserService;

  const BASE_USER = {
    id: "u-1",
    name: "Alice",
    email: "alice@test.com",
    role: "ENGINEER",
    isActive: true,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as never);
    JwtBlacklist.clear();
  });

  it("suspendUser sets isActive to false", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: false });

    const result = await service.suspendUser("u-1");
    expect(result.isActive).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });

  it("suspendUser adds user key to JWT blacklist", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(BASE_USER);
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: false });

    await service.suspendUser("u-1");
    expect(JwtBlacklist.has("user:u-1")).toBe(true);
  });

  it("unsuspendUser sets isActive back to true", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: false });
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: true });

    const result = await service.unsuspendUser("u-1");
    expect(result.isActive).toBe(true);
  });

  it("unsuspendUser removes user key from JWT blacklist", async () => {
    JwtBlacklist.add("user:u-1");
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: false });
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...BASE_USER, isActive: true });

    await service.unsuspendUser("u-1");
    expect(JwtBlacklist.has("user:u-1")).toBe(false);
  });

  it("suspendUser throws NotFoundError for unknown user", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.suspendUser("ghost")).rejects.toThrow(NotFoundError);
  });
});

// ── B4. TimeEntryService — hours calculation ──────────────────────────────
describe("B4: TimeEntryService — hours validation and calculation", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TimeEntryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  it("throws ValidationError when hours is zero", async () => {
    await expect(
      service.createTimeEntry({
        userId: "u-1",
        date: "2024-01-15",
        hours: 0,
        category: "PLANNED_TASK",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when hours is negative", async () => {
    await expect(
      service.createTimeEntry({
        userId: "u-1",
        date: "2024-01-15",
        hours: -2,
        category: "PLANNED_TASK",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("creates entry with valid hours", async () => {
    (prisma.timeEntry.create as jest.Mock).mockResolvedValue({
      id: "e-1",
      userId: "u-1",
      hours: 8,
      category: "PLANNED_TASK",
      date: new Date("2024-01-15"),
      task: null,
      user: { id: "u-1", name: "Alice" },
    });

    const result = await service.createTimeEntry({
      userId: "u-1",
      date: "2024-01-15",
      hours: 8,
      category: "PLANNED_TASK",
    });
    expect(result.hours).toBe(8);
  });

  it("getStats aggregates total hours across entries", async () => {
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
      { id: "e-1", userId: "u-1", hours: 4, category: "PLANNED_TASK", date: new Date(), task: null, user: { id: "u-1", name: "Alice" } },
      { id: "e-2", userId: "u-1", hours: 2, category: "MEETING", date: new Date(), task: null, user: { id: "u-1", name: "Alice" } },
      { id: "e-3", userId: "u-1", hours: 1.5, category: "PLANNED_TASK", date: new Date(), task: null, user: { id: "u-1", name: "Alice" } },
    ]);

    const stats = await service.getStats({}, "u-1", "ENGINEER");
    expect(stats.totalHours).toBe(7.5);
    expect(stats.byCategory["PLANNED_TASK"]).toBe(5.5);
    expect(stats.byCategory["MEETING"]).toBe(2);
  });
});

// ── B5. KPIService — achievement rate calculation with edge cases ──────────
describe("B5: KPIService — calculateAchievement with edge cases", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: KPIService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
  });

  it("calculates weighted average achievement correctly", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
      id: "kpi-1",
      autoCalc: true,
      target: 100,
      actual: 0,
      taskLinks: [
        { weight: 2, task: { progressPct: 80, status: "IN_PROGRESS" } },
        { weight: 1, task: { progressPct: 50, status: "TODO" } },
      ],
    });
    (prisma.kPI.update as jest.Mock).mockResolvedValue({ id: "kpi-1", actual: 70 });

    await service.calculateAchievement("kpi-1");

    // (80/100*2 + 50/100*1) / (2+1) * 100 = (1.6+0.5)/3 * 100 = 70
    expect(prisma.kPI.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { actual: 70 } })
    );
  });

  it("returns 0 when no task links exist (divide-by-zero guard)", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
      id: "kpi-1",
      taskLinks: [],
    });
    (prisma.kPI.update as jest.Mock).mockResolvedValue({ id: "kpi-1", actual: 0 });

    await service.calculateAchievement("kpi-1");
    expect(prisma.kPI.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { actual: 0 } })
    );
  });

  it("throws NotFoundError for unknown KPI id", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.calculateAchievement("ghost-kpi")).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError when creating KPI with empty title", async () => {
    await expect(
      service.createKPI({
        year: 2024,
        code: "KPI-X",
        title: "   ",
        target: 100,
        createdBy: "mgr-1",
      })
    ).rejects.toThrow(ValidationError);
  });
});
