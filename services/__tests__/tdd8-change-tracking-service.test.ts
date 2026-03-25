/**
 * TDD-8: ChangeTrackingService tests
 *
 * Tests for:
 * - detectDelay: DELAY type creation, date comparison logic
 * - detectScopeChange: SCOPE_CHANGE type, title significance threshold
 * - detectAndRecordAll: combined detection in single transaction
 * - getChangeHistory: ordered history retrieval
 * - getDelayCount / getChangeCount: date-range filtered counts
 *
 * Fixes #562
 */
import { ChangeTrackingService } from "../change-tracking-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("ChangeTrackingService", () => {
  let service: ChangeTrackingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ChangeTrackingService(prisma as never);
    // Make $transaction execute the callback with prisma as the tx
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // detectDelay
  // ═══════════════════════════════════════════════════════════════════════

  describe("detectDelay", () => {
    it("creates DELAY record when new due date is later", async () => {
      const oldDate = new Date("2026-04-01");
      const newDate = new Date("2026-04-15");
      const mockChange = {
        id: "c1",
        taskId: "task-1",
        changeType: "DELAY",
        reason: "Due date extended",
        oldValue: oldDate.toISOString(),
        newValue: newDate.toISOString(),
        changedBy: "user-1",
      };
      (prisma.taskChange.create as jest.Mock).mockResolvedValue(mockChange);

      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: oldDate,
        newDueDate: newDate,
        changedBy: "user-1",
      });

      expect(result).toBeTruthy();
      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: "task-1",
            changeType: "DELAY",
            oldValue: oldDate.toISOString(),
            newValue: newDate.toISOString(),
          }),
        })
      );
    });

    it("returns null when new date is earlier (not a delay)", async () => {
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: new Date("2026-04-15"),
        newDueDate: new Date("2026-04-01"),
        changedBy: "user-1",
      });

      expect(result).toBeNull();
      expect(prisma.taskChange.create).not.toHaveBeenCalled();
    });

    it("returns null when dates are equal", async () => {
      const sameDate = new Date("2026-04-01");
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: sameDate,
        newDueDate: new Date(sameDate.getTime()),
        changedBy: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns null when oldDueDate is null", async () => {
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: null,
        newDueDate: new Date("2026-04-15"),
        changedBy: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns null when newDueDate is null", async () => {
      const result = await service.detectDelay({
        taskId: "task-1",
        oldDueDate: new Date("2026-04-01"),
        newDueDate: null,
        changedBy: "user-1",
      });

      expect(result).toBeNull();
    });

    it("uses custom reason when provided", async () => {
      (prisma.taskChange.create as jest.Mock).mockResolvedValue({ id: "c1" });

      await service.detectDelay({
        taskId: "task-1",
        oldDueDate: new Date("2026-04-01"),
        newDueDate: new Date("2026-04-15"),
        changedBy: "user-1",
        reason: "Customer requested extension",
      });

      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: "Customer requested extension",
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // detectScopeChange
  // ═══════════════════════════════════════════════════════════════════════

  describe("detectScopeChange", () => {
    it("creates SCOPE_CHANGE when title is significantly different", async () => {
      (prisma.taskChange.create as jest.Mock).mockResolvedValue({
        id: "c1",
        changeType: "SCOPE_CHANGE",
      });

      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Build login page",
        newTitle: "Completely redesign authentication system",
        oldDescription: null,
        newDescription: null,
        changedBy: "user-1",
      });

      expect(result).toBeTruthy();
      expect(prisma.taskChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changeType: "SCOPE_CHANGE",
          }),
        })
      );
    });

    it("creates SCOPE_CHANGE when description changes", async () => {
      (prisma.taskChange.create as jest.Mock).mockResolvedValue({
        id: "c1",
        changeType: "SCOPE_CHANGE",
      });

      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Same Title",
        newTitle: "Same Title",
        oldDescription: "Original scope",
        newDescription: "Completely different scope with new requirements",
        changedBy: "user-1",
      });

      expect(result).toBeTruthy();
    });

    it("returns null when title and description are unchanged", async () => {
      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Same Title",
        newTitle: "Same Title",
        oldDescription: "Same description",
        newDescription: "Same description",
        changedBy: "user-1",
      });

      expect(result).toBeNull();
      expect(prisma.taskChange.create).not.toHaveBeenCalled();
    });

    it("returns null for minor title changes (below threshold)", async () => {
      const result = await service.detectScopeChange({
        taskId: "task-1",
        oldTitle: "Build login page",
        newTitle: "Build login pages",
        oldDescription: null,
        newDescription: null,
        changedBy: "user-1",
      });

      // Minor title change (one character) should not trigger scope change
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // detectAndRecordAll
  // ═══════════════════════════════════════════════════════════════════════

  describe("detectAndRecordAll", () => {
    it("records both delay and scope change in single transaction", async () => {
      (prisma.taskChange.create as jest.Mock).mockResolvedValue({ id: "c1" });

      const results = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: new Date("2026-04-01"),
          newDueDate: new Date("2026-05-01"),
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Build login page",
          newTitle: "Completely redesign authentication system",
          oldDescription: null,
          newDescription: null,
          changedBy: "user-1",
        }
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.taskChange.create).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });

    it("records only delay when scope is unchanged", async () => {
      (prisma.taskChange.create as jest.Mock).mockResolvedValue({ id: "c1" });

      const results = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: new Date("2026-04-01"),
          newDueDate: new Date("2026-05-01"),
          changedBy: "user-1",
        },
        null
      );

      expect(prisma.taskChange.create).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
    });

    it("returns empty array when neither delay nor scope change detected", async () => {
      const results = await service.detectAndRecordAll(
        {
          taskId: "task-1",
          oldDueDate: null,
          newDueDate: null,
          changedBy: "user-1",
        },
        {
          taskId: "task-1",
          oldTitle: "Same",
          newTitle: "Same",
          oldDescription: null,
          newDescription: null,
          changedBy: "user-1",
        }
      );

      expect(results).toHaveLength(0);
      expect(prisma.taskChange.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getChangeHistory
  // ═══════════════════════════════════════════════════════════════════════

  describe("getChangeHistory", () => {
    it("returns changes ordered by changedAt desc", async () => {
      const changes = [
        { id: "c2", changedAt: new Date("2026-03-25") },
        { id: "c1", changedAt: new Date("2026-03-20") },
      ];
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue(changes);

      const result = await service.getChangeHistory("task-1");

      expect(result).toHaveLength(2);
      expect(prisma.taskChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { taskId: "task-1" },
          orderBy: { changedAt: "desc" },
        })
      );
    });

    it("returns empty array for task with no changes", async () => {
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getChangeHistory("task-1");

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getDelayCount / getChangeCount
  // ═══════════════════════════════════════════════════════════════════════

  describe("getDelayCount", () => {
    it("counts DELAY records in date range", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(3);

      const result = await service.getDelayCount({
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
      });

      expect(result).toBe(3);
      expect(prisma.taskChange.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            changeType: "DELAY",
          }),
        })
      );
    });

    it("filters by taskId when provided", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(1);

      await service.getDelayCount({
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
        taskId: "task-1",
      });

      expect(prisma.taskChange.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            taskId: "task-1",
          }),
        })
      );
    });
  });

  describe("getChangeCount", () => {
    it("counts SCOPE_CHANGE records in date range", async () => {
      (prisma.taskChange.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getChangeCount({
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
      });

      expect(result).toBe(5);
      expect(prisma.taskChange.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            changeType: "SCOPE_CHANGE",
          }),
        })
      );
    });
  });
});
