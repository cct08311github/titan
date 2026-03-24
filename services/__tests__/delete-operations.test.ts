import { KPIService } from "../kpi-service";
import { PlanService } from "../plan-service";
import { GoalService } from "../goal-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError } from "../errors";

// ---------------------------------------------------------------------------
// KPIService.deleteKPI
// ---------------------------------------------------------------------------
describe("KPIService.deleteKPI", () => {
  let service: KPIService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
  });

  test("deletes KPI and its task links", async () => {
    const mockKPI = { id: "kpi-1", year: 2026, title: "KPI 1" };
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(mockKPI);
    (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.kPI.delete as jest.Mock).mockResolvedValue(mockKPI);

    const result = await service.deleteKPI("kpi-1");

    expect(prisma.kPITaskLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kpiId: "kpi-1" } })
    );
    expect(prisma.kPI.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "kpi-1" } })
    );
    expect(result).toEqual(mockKPI);
  });

  test("throws NotFoundError for invalid id", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteKPI("nonexistent")).rejects.toThrow(NotFoundError);
    expect(prisma.kPITaskLink.deleteMany).not.toHaveBeenCalled();
    expect(prisma.kPI.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PlanService.deletePlan
// ---------------------------------------------------------------------------
describe("PlanService.deletePlan", () => {
  let service: PlanService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlanService(prisma as never);
  });

  test("deletes plan and cascades to goals", async () => {
    const mockPlan = { id: "plan-1", year: 2026, title: "Plan 2026" };
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
    (prisma.annualPlan.delete as jest.Mock).mockResolvedValue(mockPlan);

    const result = await service.deletePlan("plan-1");

    expect(prisma.annualPlan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } })
    );
    expect(prisma.annualPlan.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } })
    );
    expect(result).toEqual(mockPlan);
  });

  test("throws NotFoundError for invalid id", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deletePlan("nonexistent")).rejects.toThrow(NotFoundError);
    expect(prisma.annualPlan.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GoalService.deleteGoal
// ---------------------------------------------------------------------------
describe("GoalService.deleteGoal", () => {
  let service: GoalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new GoalService(prisma as never);
  });

  test("deletes goal and reassigns orphan tasks", async () => {
    const mockGoal = { id: "goal-1", annualPlanId: "plan-1", month: 3 };
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(mockGoal);
    (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue(mockGoal);

    const result = await service.deleteGoal("goal-1");

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthlyGoalId: "goal-1" },
        data: { monthlyGoalId: null },
      })
    );
    expect(prisma.monthlyGoal.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1" } })
    );
    expect(result).toEqual(mockGoal);
  });

  test("throws NotFoundError for invalid id", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteGoal("nonexistent")).rejects.toThrow(NotFoundError);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.monthlyGoal.delete).not.toHaveBeenCalled();
  });
});
