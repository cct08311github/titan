import { GoalService } from "../goal-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("GoalService", () => {
  let service: GoalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new GoalService(prisma as never);
  });

  test("listGoals returns goals for plan", async () => {
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

  test("getGoal returns goal with tasks", async () => {
    const mockGoal = { id: "goal-1", tasks: [] };
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(mockGoal);

    const result = await service.getGoal("goal-1");

    expect(result).toEqual(mockGoal);
  });

  test("createGoal validates required fields", async () => {
    await expect(
      service.createGoal({ annualPlanId: "", month: 1, title: "Goal" })
    ).rejects.toThrow(ValidationError);

    await expect(
      service.createGoal({ annualPlanId: "plan-1", month: 0, title: "Goal" })
    ).rejects.toThrow(ValidationError);
  });

  test("updateGoal throws NotFoundError when not found", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateGoal("nonexistent", { title: "X" })
    ).rejects.toThrow(NotFoundError);
  });

  test("deleteGoal removes goal", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });

    await service.deleteGoal("goal-1");

    expect(prisma.monthlyGoal.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1" } })
    );
  });
});
