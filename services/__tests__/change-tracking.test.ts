import { ChangeTrackingService } from "../change-tracking-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("ChangeTrackingService", () => {
  let service: ChangeTrackingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const mockUser = { id: "user-1", name: "Alice" };
  const baseTask = {
    id: "task-1",
    title: "Original Title",
    description: "Original description",
    dueDate: new Date("2026-04-01"),
    status: "TODO",
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ChangeTrackingService(prisma as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  describe("detectDelay", () => {
    test("detectDelay creates DELAY record when dueDate changes", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const mockChange = {
        id: "change-1",
        taskId: "task-1",
        changeType: "DELAY",
        reason: "Due date extended",
        oldValue: oldDate.toISOString(),
        newValue: newDate.toISOString(),
        changedBy: "user-1",
        changedAt: new Date(),
      };

      (prisma.taskChange.create as jest.Mock).mockResolvedValue(mockChange);

      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: oldDate,
        newDueDate: newDate,
        changedBy: "user-1",
        reason: "Due date extended",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-1",
          changeType: "DELAY",
          reason: "Due date extended",
          oldValue: oldDate.toISOString(),
          newValue: newDate.toISOString(),
          changedBy: "user-1",
        }),
        include: expect.objectContaining({
          changedByUser: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockChange);
    });

    test("no record created when dueDate does not change", async () => {
      const sameDate = new Date("2026-04-01");

      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: sameDate,
        newDueDate: sameDate,
        changedBy: "user-1",
        reason: "No change",
      });

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("no record created when new dueDate is earlier (not a delay)", async () => {
      const oldDate = new Date("2026-04-15");
      const newDate = new Date("2026-04-01"); // earlier — not a delay

      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: oldDate,
        newDueDate: newDate,
        changedBy: "user-1",
        reason: "Moved up",
      });

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("detectScopeChange", () => {
    test("detectScopeChange creates SCOPE_CHANGE when description changes", async () => {
      const mockChange = {
        id: "change-2",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        reason: "Scope updated",
        oldValue: "Original description",
        newValue: "Updated description with more details",
        changedBy: "user-1",
        changedAt: new Date(),
      };

      (prisma.taskChange.create as jest.Mock).mockResolvedValue(mockChange);

      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Same Title",
        newTitle: "Same Title",
        oldDescription: "Original description",
        newDescription: "Updated description with more details",
        changedBy: "user-1",
        reason: "Scope updated",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-1",
          changeType: "SCOPE_CHANGE",
          reason: "Scope updated",
          changedBy: "user-1",
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(mockChange);
    });

    test("detectScopeChange creates SCOPE_CHANGE when title changes significantly", async () => {
      const mockChange = {
        id: "change-3",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        reason: "Title changed",
        oldValue: "Build login page",
        newValue: "Build authentication system with OAuth",
        changedBy: "user-1",
        changedAt: new Date(),
      };

      (prisma.taskChange.create as jest.Mock).mockResolvedValue(mockChange);

      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Build login page",
        newTitle: "Build authentication system with OAuth",
        oldDescription: "Same description",
        newDescription: "Same description",
        changedBy: "user-1",
        reason: "Title changed",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-1",
          changeType: "SCOPE_CHANGE",
          changedBy: "user-1",
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(mockChange);
    });

    test("no record created when status changes (not a delay/change)", async () => {
      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Same Title",
        newTitle: "Same Title",
        oldDescription: "Same description",
        newDescription: "Same description",
        changedBy: "user-1",
        reason: "Status updated",
      });

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("getChangeHistory", () => {
    test("getChangeHistory returns all changes for a task", async () => {
      const mockChanges = [
        {
          id: "change-1",
          taskId: "task-1",
          changeType: "DELAY",
          reason: "Due date extended",
          changedAt: new Date("2026-03-20"),
          changedByUser: { id: "user-1", name: "Alice" },
        },
        {
          id: "change-2",
          taskId: "task-1",
          changeType: "SCOPE_CHANGE",
          reason: "Description changed",
          changedAt: new Date("2026-03-22"),
          changedByUser: { id: "user-1", name: "Alice" },
        },
      ];

      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue(mockChanges);

      const result = await service.getChangeHistory("task-1");

      expect(prisma.taskChange.findMany).toHaveBeenCalledWith({
        where: { taskId: "task-1" },
        include: {
          changedByUser: { select: { id: true, name: true } },
        },
        orderBy: { changedAt: "desc" },
      });
      expect(result).toEqual(mockChanges);
      expect(result).toHaveLength(2);
    });

    test("getChangeHistory returns empty array when no changes", async () => {
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getChangeHistory("task-99");

      expect(result).toEqual([]);
    });
  });

  describe("getDelayCount", () => {
    test("getDelayCount returns count for date range", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(5);

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-31");

      const result = await service.getDelayCount({ start, end });

      expect(prisma.taskChange.count).toHaveBeenCalledWith({
        where: {
          changeType: "DELAY",
          changedAt: { gte: start, lte: end },
        },
      });
      expect(result).toBe(5);
    });

    test("getDelayCount filters by taskId when provided", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(2);

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-31");

      const result = await service.getDelayCount({ start, end, taskId: "task-1" });

      expect(prisma.taskChange.count).toHaveBeenCalledWith({
        where: {
          changeType: "DELAY",
          changedAt: { gte: start, lte: end },
          taskId: "task-1",
        },
      });
      expect(result).toBe(2);
    });
  });

  describe("getChangeCount", () => {
    test("getChangeCount returns count for date range", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(3);

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-31");

      const result = await service.getChangeCount({ start, end });

      expect(prisma.taskChange.count).toHaveBeenCalledWith({
        where: {
          changeType: "SCOPE_CHANGE",
          changedAt: { gte: start, lte: end },
        },
      });
      expect(result).toBe(3);
    });

    test("getChangeCount filters by taskId when provided", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(1);

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-31");

      const result = await service.getChangeCount({ start, end, taskId: "task-1" });

      expect(prisma.taskChange.count).toHaveBeenCalledWith({
        where: {
          changeType: "SCOPE_CHANGE",
          changedAt: { gte: start, lte: end },
          taskId: "task-1",
        },
      });
      expect(result).toBe(1);
    });
  });

  describe("detectAndRecordAll", () => {
    test("records both delay and scope change in one transaction", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const delayRecord = {
        id: "change-delay",
        taskId: "task-1",
        changeType: "DELAY",
        changedAt: new Date(),
      };
      const scopeRecord = {
        id: "change-scope",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock)
        .mockResolvedValueOnce(delayRecord)
        .mockResolvedValueOnce(scopeRecord);

      const result = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: oldDate,
          newDueDate: newDate,
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Build login page",
          newTitle: "Build authentication system with OAuth",
          oldDescription: "Same description",
          newDescription: "Same description",
          changedBy: "user-1",
        }
      );

      expect(prisma.taskChange.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    test("records only delay when no scope change", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const delayRecord = {
        id: "change-delay",
        taskId: "task-1",
        changeType: "DELAY",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(delayRecord);

      const result = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: oldDate,
          newDueDate: newDate,
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Same Title",
          newTitle: "Same Title",
          oldDescription: "Same description",
          newDescription: "Same description",
          changedBy: "user-1",
        }
      );

      expect(prisma.taskChange.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    test("records only scope change when no delay", async () => {
      const sameDate = new Date("2026-04-01");
      const scopeRecord = {
        id: "change-scope",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(scopeRecord);

      const result = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: sameDate,
          newDueDate: sameDate,
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Build login page",
          newTitle: "Build authentication system with OAuth",
          oldDescription: "Same description",
          newDescription: "Same description",
          changedBy: "user-1",
        }
      );

      expect(prisma.taskChange.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    test("returns empty array when no changes detected", async () => {
      const sameDate = new Date("2026-04-01");

      const result = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: sameDate,
          newDueDate: sameDate,
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Same Title",
          newTitle: "Same Title",
          oldDescription: "Same description",
          newDescription: "Same description",
          changedBy: "user-1",
        }
      );

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    test("handles null delayInput gracefully", async () => {
      const scopeRecord = {
        id: "change-scope",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(scopeRecord);

      const result = await service.detectAndRecordAll(null, {
        taskId: "task-1",
        oldTitle: "Build login page",
        newTitle: "Build authentication system with OAuth",
        oldDescription: "Same description",
        newDescription: "Same description",
        changedBy: "user-1",
      });

      expect(result).toHaveLength(1);
    });

    test("handles null scopeInput gracefully", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const delayRecord = {
        id: "change-delay",
        taskId: "task-1",
        changeType: "DELAY",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(delayRecord);

      const result = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: oldDate,
          newDueDate: newDate,
          changedBy: "user-1",
        },
        null
      );

      expect(result).toHaveLength(1);
    });

    test("handles both null inputs — no records created", async () => {
      const result = await service.detectAndRecordAll(null, null);

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    test("records scope change when description changes (not title)", async () => {
      const scopeRecord = {
        id: "change-scope",
        taskId: "task-1",
        changeType: "SCOPE_CHANGE",
        changedAt: new Date(),
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(scopeRecord);

      const result = await service.detectAndRecordAll(null, {
        taskId: "task-1",
        oldTitle: "Same Title",
        newTitle: "Same Title",
        oldDescription: "Old description",
        newDescription: "New description changed",
        changedBy: "user-1",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changeType: "SCOPE_CHANGE",
            oldValue: "Old description",
            newValue: "New description changed",
          }),
        })
      );
      expect(result).toHaveLength(1);
    });

    test("uses custom reason when provided", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const delayRecord = { id: "change-delay", taskId: "task-1", changeType: "DELAY" };
      (prisma.taskChange.create as jest.Mock).mockResolvedValueOnce(delayRecord);

      await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: oldDate,
          newDueDate: newDate,
          changedBy: "user-1",
          reason: "Client requested extension",
        },
        null
      );

      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: "Client requested extension" }),
        })
      );
    });
  });

  describe("detectDelay - additional edge cases", () => {
    test("returns null when oldDueDate is null", async () => {
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: null,
        newDueDate: new Date("2026-04-15"),
        changedBy: "user-1",
      });

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("returns null when newDueDate is null", async () => {
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: new Date("2026-04-01"),
        newDueDate: null,
        changedBy: "user-1",
      });

      expect(prisma.taskChange.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("uses default reason when not provided", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const mockChange = { id: "change-1", taskId: "task-1", changeType: "DELAY" };
      (prisma.taskChange.create as jest.Mock).mockResolvedValue(mockChange);

      await service.detectDelay({
        taskId: "task-1",
        oldDueDate: oldDate,
        newDueDate: newDate,
        changedBy: "user-1",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: "Due date extended" }),
        })
      );
    });
  });
});
