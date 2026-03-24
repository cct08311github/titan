import { NotificationService } from "../notification-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("NotificationService", () => {
  let service: NotificationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  // Fixed "now" for deterministic date logic: 2026-03-24T00:00:00.000Z
  const NOW = new Date("2026-03-24T00:00:00.000Z");
  // Within 7-day window
  const DUE_IN_3_DAYS = new Date("2026-03-27T00:00:00.000Z");
  // Past due
  const TWO_DAYS_AGO = new Date("2026-03-22T00:00:00.000Z");
  // Outside 7-day window (8 days out)
  const DUE_IN_8_DAYS = new Date("2026-04-01T00:00:00.000Z");

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new NotificationService(prisma as never);
    // Default: no existing notifications
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
  });

  // ── TASK_DUE_SOON ─────────────────────────────────────────────────────────

  test("generates TASK_DUE_SOON for tasks due within 7 days", async () => {
    const task = {
      id: "task-1",
      title: "完成報告",
      dueDate: DUE_IN_3_DAYS,
      primaryAssigneeId: "user-a",
      backupAssigneeId: null,
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-a" }]);

    const existingKeys = new Set<string>();
    const result = await service.buildDueSoonTaskNotifications(NOW, existingKeys);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "user-a",
      type: "TASK_DUE_SOON",
      relatedId: "task-1",
      relatedType: "Task",
    });
    expect(result[0].title).toContain("完成報告");
  });

  test("generates TASK_DUE_SOON for both assignees when both are set", async () => {
    const task = {
      id: "task-2",
      title: "雙人任務",
      dueDate: DUE_IN_3_DAYS,
      primaryAssigneeId: "user-a",
      backupAssigneeId: "user-b",
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-a" },
      { id: "user-b" },
    ]);

    const result = await service.buildDueSoonTaskNotifications(NOW, new Set());

    expect(result).toHaveLength(2);
    const userIds = result.map((n) => n.userId);
    expect(userIds).toContain("user-a");
    expect(userIds).toContain("user-b");
  });

  test("excludes suspended users from TASK_DUE_SOON notifications", async () => {
    const task = {
      id: "task-suspended-1",
      title: "停權測試任務",
      dueDate: DUE_IN_3_DAYS,
      primaryAssigneeId: "user-active",
      backupAssigneeId: "user-suspended",
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    // Only active user returned — suspended user filtered by isActive: true
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-active" },
    ]);

    const result = await service.buildDueSoonTaskNotifications(NOW, new Set());

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-active");
  });

  // ── MILESTONE_DUE ─────────────────────────────────────────────────────────

  test("generates MILESTONE_DUE for milestones due within 7 days", async () => {
    const milestone = {
      id: "ms-1",
      title: "Phase 1 完成",
      plannedEnd: DUE_IN_3_DAYS,
    };
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([milestone]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-a" },
      { id: "user-b" },
    ]);

    const result = await service.buildDueSoonMilestoneNotifications(NOW, new Set());

    // One notification per user per milestone
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: "MILESTONE_DUE",
      relatedId: "ms-1",
      relatedType: "Milestone",
    });
    expect(result[0].title).toContain("Phase 1 完成");
  });

  test("does not generate MILESTONE_DUE for completed milestones", async () => {
    // prisma mock returns empty array (filtered by status in query)
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-a" }]);

    const result = await service.buildDueSoonMilestoneNotifications(NOW, new Set());

    expect(result).toHaveLength(0);
  });

  test("excludes suspended users from MILESTONE_DUE notifications", async () => {
    const milestone = {
      id: "ms-suspended-1",
      title: "停權里程碑測試",
      plannedEnd: DUE_IN_3_DAYS,
    };
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([milestone]);
    // Only active user returned — suspended user filtered by isActive: true query
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-active" },
    ]);

    const result = await service.buildDueSoonMilestoneNotifications(NOW, new Set());

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-active");
  });

  // ── TASK_OVERDUE ──────────────────────────────────────────────────────────

  test("generates TASK_OVERDUE for past-due tasks", async () => {
    const task = {
      id: "task-3",
      title: "逾期任務",
      dueDate: TWO_DAYS_AGO,
      primaryAssigneeId: "user-c",
      backupAssigneeId: null,
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-c" }]);

    const existingKeys = new Set<string>();
    const result = await service.buildOverdueTaskNotifications(NOW, existingKeys);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: "user-c",
      type: "TASK_OVERDUE",
      relatedId: "task-3",
      relatedType: "Task",
    });
    expect(result[0].title).toContain("逾期任務");
  });

  test("does not generate TASK_OVERDUE for done tasks (filtered by query)", async () => {
    // Prisma mock returns empty — query has status: { notIn: ["DONE"] }
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.buildOverdueTaskNotifications(NOW, new Set());

    expect(result).toHaveLength(0);
  });

  test("excludes suspended users from TASK_OVERDUE notifications", async () => {
    const task = {
      id: "task-suspended-2",
      title: "停權逾期任務",
      dueDate: TWO_DAYS_AGO,
      primaryAssigneeId: "user-suspended",
      backupAssigneeId: null,
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    // Suspended user not returned by active-only query
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.buildOverdueTaskNotifications(NOW, new Set());

    expect(result).toHaveLength(0);
  });

  // ── Duplicate prevention ──────────────────────────────────────────────────

  test("does not duplicate existing unread notifications", async () => {
    const task = {
      id: "task-4",
      title: "已通知任務",
      dueDate: DUE_IN_3_DAYS,
      primaryAssigneeId: "user-a",
      backupAssigneeId: null,
    };
    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-a" }]);

    // Pre-seed existing key so duplicate check fires
    const existingKeys = new Set<string>(["user-a:TASK_DUE_SOON:task-4"]);

    const result = await service.buildDueSoonTaskNotifications(NOW, existingKeys);

    expect(result).toHaveLength(0);
  });

  test("does not duplicate existing milestone notifications", async () => {
    const milestone = { id: "ms-2", title: "重複里程碑", plannedEnd: DUE_IN_3_DAYS };
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([milestone]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-a" }]);

    const existingKeys = new Set<string>(["user-a:MILESTONE_DUE:ms-2"]);
    const result = await service.buildDueSoonMilestoneNotifications(NOW, existingKeys);

    expect(result).toHaveLength(0);
  });

  // ── generateAll integration ───────────────────────────────────────────────

  test("generateAll persists notifications and returns counts", async () => {
    // Existing: none
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);

    const dueSoonTask = {
      id: "task-5",
      title: "即將到期任務",
      dueDate: DUE_IN_3_DAYS,
      primaryAssigneeId: "user-a",
      backupAssigneeId: null,
    };
    const overdueTask = {
      id: "task-6",
      title: "逾期任務",
      dueDate: TWO_DAYS_AGO,
      primaryAssigneeId: "user-b",
      backupAssigneeId: null,
    };

    // task.findMany is called multiple times (due soon, then overdue)
    (prisma.task.findMany as jest.Mock)
      .mockResolvedValueOnce([dueSoonTask])  // due soon query
      .mockResolvedValueOnce([overdueTask]); // overdue query

    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([]);
    // user.findMany is called multiple times: due-soon active check, milestone query, overdue active check
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "user-a" }])  // due soon active users
      .mockResolvedValueOnce([{ id: "user-a" }])  // milestone active users
      .mockResolvedValueOnce([{ id: "user-b" }]); // overdue active users
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    const result = await service.generateAll(NOW);

    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(2);
    expect(result.dueSoonTasks).toBe(1);
    expect(result.overdueTasks).toBe(1);
    expect(result.dueSoonMilestones).toBe(0);
  });

  test("generateAll skips createMany when no new notifications", async () => {
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.generateAll(NOW);

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });
});
