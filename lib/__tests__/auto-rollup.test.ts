import { AutoRollupService } from "../auto-rollup";
import { createMockPrisma } from "../test-utils";

describe("AutoRollupService", () => {
  let service: AutoRollupService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AutoRollupService(prisma as never);
  });

  // ── recalculateGoalProgress ──────────────────────────────────────────

  describe("recalculateGoalProgress", () => {
    test("calculates progress as done/total * 100", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
        { status: "DONE" },
        { status: "IN_PROGRESS" },
        { status: "TODO" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateGoalProgress("goal-1");

      expect(result).toBe(50);
      expect(prisma.monthlyGoal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: { progressPct: 50 },
      });
    });

    test("returns 0 when no tasks exist", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateGoalProgress("goal-1");

      expect(result).toBe(0);
      expect(prisma.monthlyGoal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: { progressPct: 0 },
      });
    });

    test("returns 100 when all tasks are done", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
        { status: "DONE" },
        { status: "DONE" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateGoalProgress("goal-1");

      expect(result).toBe(100);
    });

    test("handles single task precision", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
        { status: "TODO" },
        { status: "TODO" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateGoalProgress("goal-1");

      expect(result).toBe(33.33);
    });
  });

  // ── recalculatePlanProgress ──────────────────────────────────────────

  describe("recalculatePlanProgress", () => {
    test("calculates average of all goals progressPct", async () => {
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([
        { progressPct: 100 },
        { progressPct: 50 },
        { progressPct: 0 },
      ]);
      (prisma.annualPlan.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculatePlanProgress("plan-1");

      expect(result).toBe(50);
      expect(prisma.annualPlan.update).toHaveBeenCalledWith({
        where: { id: "plan-1" },
        data: { progressPct: 50 },
      });
    });

    test("returns 0 when no goals exist", async () => {
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.annualPlan.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculatePlanProgress("plan-1");

      expect(result).toBe(0);
    });

    test("handles fractional averages", async () => {
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([
        { progressPct: 33.33 },
        { progressPct: 66.67 },
      ]);
      (prisma.annualPlan.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculatePlanProgress("plan-1");

      expect(result).toBe(50);
    });
  });

  // ── recalculateKPIActual ─────────────────────────────────────────────

  describe("recalculateKPIActual", () => {
    test("calculates weighted average scaled to KPI target", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 99.9,
        autoCalc: true,
        taskLinks: [
          { weight: 1, task: { status: "DONE", progressPct: 100 } },
          { weight: 1, task: { status: "IN_PROGRESS", progressPct: 50 } },
        ],
      });
      (prisma.kPI.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateKPIActual("kpi-1");

      // avg progress = (100*1 + 50*1) / 2 = 75
      // actual = 75/100 * 99.9 = 74.925 → 74.93
      expect(result).toBe(74.93);
      expect(prisma.kPI.update).toHaveBeenCalledWith({
        where: { id: "kpi-1" },
        data: { actual: 74.93 },
      });
    });

    test("treats DONE tasks as 100% regardless of progressPct", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: true,
        taskLinks: [
          { weight: 1, task: { status: "DONE", progressPct: 30 } }, // should be 100
        ],
      });
      (prisma.kPI.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateKPIActual("kpi-1");

      expect(result).toBe(100);
    });

    test("skips non-autoCalc KPIs", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: false,
        taskLinks: [
          { weight: 1, task: { status: "DONE", progressPct: 100 } },
        ],
      });

      const result = await service.recalculateKPIActual("kpi-1");

      expect(result).toBe(0);
      expect(prisma.kPI.update).not.toHaveBeenCalled();
    });

    test("returns 0 when KPI not found", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.recalculateKPIActual("kpi-nonexist");

      expect(result).toBe(0);
    });

    test("returns 0 when no task links", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: true,
        taskLinks: [],
      });

      const result = await service.recalculateKPIActual("kpi-1");

      expect(result).toBe(0);
    });

    test("handles weighted task links correctly", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: true,
        taskLinks: [
          { weight: 3, task: { status: "DONE", progressPct: 100 } },
          { weight: 1, task: { status: "IN_PROGRESS", progressPct: 0 } },
        ],
      });
      (prisma.kPI.update as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateKPIActual("kpi-1");

      // avg = (100*3 + 0*1) / 4 = 75, actual = 75/100 * 100 = 75
      expect(result).toBe(75);
    });

    test("handles zero total weight", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: true,
        taskLinks: [
          { weight: 0, task: { status: "DONE", progressPct: 100 } },
        ],
      });

      const result = await service.recalculateKPIActual("kpi-1");

      expect(result).toBe(0);
    });
  });

  // ── executeRollup ────────────────────────────────────────────────────

  describe("executeRollup", () => {
    test("rolls up task → goal → plan → KPI", async () => {
      // Task has a goal and KPI link
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        monthlyGoalId: "goal-1",
        kpiLinks: [{ kpiId: "kpi-1" }],
      });

      // Goal has a plan
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({
        annualPlanId: "plan-1",
      });

      // Mock the downstream calls
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
        { status: "TODO" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([
        { progressPct: 50 },
      ]);
      (prisma.annualPlan.update as jest.Mock).mockResolvedValue({});
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({
        id: "kpi-1",
        target: 100,
        autoCalc: true,
        taskLinks: [
          { weight: 1, task: { status: "DONE", progressPct: 100 } },
        ],
      });
      (prisma.kPI.update as jest.Mock).mockResolvedValue({});

      await service.executeRollup("task-1");

      // Goal progress recalculated
      expect(prisma.monthlyGoal.update).toHaveBeenCalled();
      // Plan progress recalculated
      expect(prisma.annualPlan.update).toHaveBeenCalled();
      // KPI recalculated
      expect(prisma.kPI.update).toHaveBeenCalled();
    });

    test("no-ops when task not found", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await service.executeRollup("nonexist");

      expect(prisma.monthlyGoal.update).not.toHaveBeenCalled();
      expect(prisma.annualPlan.update).not.toHaveBeenCalled();
      expect(prisma.kPI.update).not.toHaveBeenCalled();
    });

    test("skips goal rollup when task has no monthlyGoalId", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        monthlyGoalId: null,
        kpiLinks: [],
      });

      await service.executeRollup("task-1");

      expect(prisma.monthlyGoal.update).not.toHaveBeenCalled();
      expect(prisma.annualPlan.update).not.toHaveBeenCalled();
    });

    test("skips KPI rollup when task has no kpiLinks", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        monthlyGoalId: "goal-1",
        kpiLinks: [],
      });

      // Goal without a plan
      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({
        annualPlanId: null,
      });
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      await service.executeRollup("task-1");

      expect(prisma.kPI.update).not.toHaveBeenCalled();
    });

    test("skips plan rollup when goal has no annualPlanId", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        monthlyGoalId: "goal-1",
        kpiLinks: [],
      });

      (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({
        annualPlanId: null,
      });
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
      ]);
      (prisma.monthlyGoal.update as jest.Mock).mockResolvedValue({});

      await service.executeRollup("task-1");

      expect(prisma.annualPlan.update).not.toHaveBeenCalled();
    });

    test("handles multiple KPI links", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        monthlyGoalId: null,
        kpiLinks: [{ kpiId: "kpi-1" }, { kpiId: "kpi-2" }],
      });

      (prisma.kPI.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: "kpi-1",
          target: 100,
          autoCalc: true,
          taskLinks: [{ weight: 1, task: { status: "DONE", progressPct: 100 } }],
        })
        .mockResolvedValueOnce({
          id: "kpi-2",
          target: 50,
          autoCalc: true,
          taskLinks: [{ weight: 1, task: { status: "IN_PROGRESS", progressPct: 60 } }],
        });
      (prisma.kPI.update as jest.Mock).mockResolvedValue({});

      await service.executeRollup("task-1");

      expect(prisma.kPI.update).toHaveBeenCalledTimes(2);
    });
  });
});
