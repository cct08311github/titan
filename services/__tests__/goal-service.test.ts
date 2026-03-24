import { GoalService } from "../goal-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("GoalService", () => {
  let service: GoalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new GoalService(prisma as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  describe("listGoals", () => {
    test("returns goals for plan", async () => {
      const mockGoals = [{ id: "goal-1", annualPlanId: "plan-1", month: 1 }];
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue(mockGoals);

      const result = await service.listGoals({ planId: "plan-1" });

      expect(prisma.monthlyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ annualPlanId: "plan-1" }),
        })
      );
      expect(result).toEqual(mockGoals);
    });

    test("filters by month when provided", async () => {
      const mockGoals = [{ id: "goal-1", annualPlanId: "plan-1", month: 3 }];
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue(mockGoals);

      const result = await service.listGoals({ planId: "plan-1", month: 3 });

      expect(prisma.monthlyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ annualPlanId: "plan-1", month: 3 }),
        })
      );
      expect(result).toEqual(mockGoals);
    });

    test("returns all goals when no filter", async () => {
      const mockGoals: unknown[] = [];
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue(mockGoals);

      await service.listGoals({});

      expect(prisma.monthlyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });

  describe("getGoal", () => {
    test("returns goal with tasks", async () => {
      const mockGoal = { id: "goal-1", tasks: [] };
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(mockGoal);

      const result = await service.getGoal("goal-1");

      expect(result).toEqual(mockGoal);
    });

    test("throws NotFoundError when goal not found", async () => {
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getGoal("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createGoal", () => {
    test("validates required fields - empty planId", async () => {
      await expect(
        service.createGoal({ annualPlanId: "", month: 1, title: "Goal" })
      ).rejects.toThrow(ValidationError);
    });

    test("validates required fields - invalid month (0)", async () => {
      await expect(
        service.createGoal({ annualPlanId: "plan-1", month: 0, title: "Goal" })
      ).rejects.toThrow(ValidationError);
    });

    test("validates required fields - invalid month (13)", async () => {
      await expect(
        service.createGoal({ annualPlanId: "plan-1", month: 13, title: "Goal" })
      ).rejects.toThrow(ValidationError);
    });

    test("validates required fields - empty title", async () => {
      await expect(
        service.createGoal({ annualPlanId: "plan-1", month: 6, title: "" })
      ).rejects.toThrow(ValidationError);
    });

    test("creates goal with all fields", async () => {
      const mockGoal = { id: "goal-1", annualPlanId: "plan-1", month: 6, title: "June Goal" };
      (prisma.monthlyGoal.create as jest.Mock).mockResolvedValue(mockGoal);

      const result = await service.createGoal({
        annualPlanId: "plan-1",
        month: 6,
        title: "June Goal",
        description: "A monthly goal",
      });

      expect(prisma.monthlyGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            annualPlanId: "plan-1",
            month: 6,
            title: "June Goal",
            description: "A monthly goal",
          }),
        })
      );
      expect(result).toEqual(mockGoal);
    });

    test("creates goal with null description by default", async () => {
      const mockGoal = { id: "goal-1", annualPlanId: "plan-1", month: 1, title: "Jan Goal" };
      (prisma.monthlyGoal.create as jest.Mock).mockResolvedValue(mockGoal);

      await service.createGoal({ annualPlanId: "plan-1", month: 1, title: "Jan Goal" });

      expect(prisma.monthlyGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        })
      );
    });
  });

  describe("updateGoal", () => {
    test("throws NotFoundError when not found", async () => {
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateGoal("nonexistent", { title: "X" })
      ).rejects.toThrow(NotFoundError);
    });

    test("updates all provided fields", async () => {
      const existingGoal = { id: "goal-1", annualPlanId: "plan-1", month: 3, title: "Old Title" };
      const updatedGoal = { ...existingGoal, title: "New Title", status: "COMPLETED", progressPct: 100 };
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(existingGoal);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue(updatedGoal);

      const result = await service.updateGoal("goal-1", {
        title: "New Title",
        description: "Updated desc",
        status: "COMPLETED",
        progressPct: 100,
      });

      expect(prisma.monthlyGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "goal-1" },
          data: expect.objectContaining({
            title: "New Title",
            description: "Updated desc",
            status: "COMPLETED",
            progressPct: 100,
          }),
        })
      );
      expect(result).toEqual(updatedGoal);
    });

    test("updates with empty object still succeeds", async () => {
      const existingGoal = { id: "goal-1", annualPlanId: "plan-1", month: 3, title: "Goal" };
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(existingGoal);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue(existingGoal);

      await service.updateGoal("goal-1", {});

      expect(prisma.monthlyGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "goal-1" }, data: {} })
      );
    });
  });

  describe("deleteGoal", () => {
    test("throws NotFoundError when goal not found", async () => {
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteGoal("nonexistent")).rejects.toThrow(NotFoundError);
    });

    test("removes goal and unlinks its tasks", async () => {
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
      (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });
      (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.deleteGoal("goal-1");

      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { monthlyGoalId: "goal-1" },
          data: { monthlyGoalId: null },
        })
      );
      expect(prisma.monthlyGoal.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "goal-1" } })
      );
    });
  });
});
