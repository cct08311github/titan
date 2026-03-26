import { NotificationService } from "../notification-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("NotificationService — preference filtering (S-2, Issue #846)", () => {
  let service: NotificationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new NotificationService(prisma as never);

    // Base mocks to avoid undefined errors in parallel calls
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  test("generateAll respects disabled preferences", async () => {
    const now = new Date("2026-03-20T10:00:00Z");

    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-1", type: "TASK_DUE_SOON", enabled: false },
    ]);

    // task.findMany called twice (dueSoon + overdue) — return matching task for both
    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        dueDate: new Date("2026-03-25"),
        primaryAssigneeId: "user-1",
        backupAssigneeId: null,
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-1" }]);

    const result = await service.generateAll(now);

    // Filtered out by preference
    expect(result.dueSoonTasks).toBe(0);
    expect(result.created).toBe(0);
  });

  test("generateAll allows notifications when preference is enabled", async () => {
    const now = new Date("2026-03-20T10:00:00Z");

    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-1", type: "TASK_DUE_SOON", enabled: true },
    ]);

    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        dueDate: new Date("2026-03-25"),
        primaryAssigneeId: "user-1",
        backupAssigneeId: null,
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-1" }]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await service.generateAll(now);

    expect(result.dueSoonTasks).toBe(1);
    expect(result.created).toBe(1);
  });

  test("generateAll defaults to enabled when no preference exists", async () => {
    const now = new Date("2026-03-20T10:00:00Z");

    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        dueDate: new Date("2026-03-25"),
        primaryAssigneeId: "user-1",
        backupAssigneeId: null,
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-1" }]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await service.generateAll(now);

    expect(result.dueSoonTasks).toBe(1);
  });

  test("generateAll filters per-user independently", async () => {
    const now = new Date("2026-03-20T10:00:00Z");

    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
      { userId: "user-1", type: "TASK_DUE_SOON", enabled: false },
      { userId: "user-2", type: "TASK_DUE_SOON", enabled: true },
    ]);

    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        dueDate: new Date("2026-03-25"),
        primaryAssigneeId: "user-1",
        backupAssigneeId: "user-2",
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await service.generateAll(now);

    // user-1 filtered out, user-2 kept
    expect(result.dueSoonTasks).toBe(1);
  });
});
