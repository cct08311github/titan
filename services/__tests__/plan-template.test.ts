import { PlanService } from "../plan-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError } from "../errors";

describe("PlanService.copyTemplate", () => {
  let service: PlanService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const sourcePlan = {
    id: "plan-2025",
    year: 2025,
    title: "2025年度計畫",
    description: "2025 的描述",
    implementationPlan: "執行計畫說明",
    progressPct: 85,
    copiedFromYear: null,
    createdBy: "user-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-12-31"),
    monthlyGoals: [
      {
        id: "goal-1",
        annualPlanId: "plan-2025",
        month: 1,
        title: "Q1 目標",
        description: "一月份目標說明",
        status: "COMPLETED",
        progressPct: 100,
        tasks: [
          { id: "task-1", title: "Task A", status: "DONE" },
          { id: "task-2", title: "Task B", status: "DONE" },
        ],
      },
      {
        id: "goal-2",
        annualPlanId: "plan-2025",
        month: 6,
        title: "Q2 目標",
        description: null,
        status: "IN_PROGRESS",
        progressPct: 50,
        tasks: [],
      },
    ],
    milestones: [
      {
        id: "ms-1",
        annualPlanId: "plan-2025",
        title: "里程碑一",
        description: "里程碑說明",
        plannedStart: new Date("2025-03-01"),
        plannedEnd: new Date("2025-06-30"),
        actualStart: new Date("2025-03-05"),
        actualEnd: new Date("2025-06-25"),
        status: "COMPLETED",
        order: 0,
      },
      {
        id: "ms-2",
        annualPlanId: "plan-2025",
        title: "里程碑二",
        description: null,
        plannedStart: null,
        plannedEnd: new Date("2025-12-31"),
        actualStart: null,
        actualEnd: null,
        status: "PENDING",
        order: 1,
      },
    ],
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlanService(prisma as never);
  });

  test("copies plan structure from previous year", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(sourcePlan);
    const newPlan = { id: "plan-2026", year: 2026, title: "2025年度計畫", monthlyGoals: [], milestones: [] };
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue(newPlan);

    const result = await service.copyTemplate("plan-2025", 2026, "user-2");

    expect(prisma.annualPlan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-2025" } })
    );
    expect(prisma.annualPlan.create).toHaveBeenCalled();
    expect(result).toEqual(newPlan);
  });

  test("copies monthly goals without tasks", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(sourcePlan);
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue({ id: "plan-2026", year: 2026 });

    await service.copyTemplate("plan-2025", 2026, "user-2");

    const createCall = (prisma.annualPlan.create as jest.Mock).mock.calls[0][0];
    const goalsCreate = createCall.data.monthlyGoals.create;

    // Goals should be copied
    expect(goalsCreate).toHaveLength(2);
    expect(goalsCreate[0]).toMatchObject({ month: 1, title: "Q1 目標", description: "一月份目標說明" });
    expect(goalsCreate[1]).toMatchObject({ month: 6, title: "Q2 目標" });

    // Tasks must NOT be included
    expect(goalsCreate[0].tasks).toBeUndefined();
    expect(goalsCreate[1].tasks).toBeUndefined();
  });

  test("copies milestones with reset dates", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(sourcePlan);
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue({ id: "plan-2026", year: 2026 });

    await service.copyTemplate("plan-2025", 2026, "user-2");

    const createCall = (prisma.annualPlan.create as jest.Mock).mock.calls[0][0];
    const milestonesCreate = createCall.data.milestones.create;

    expect(milestonesCreate).toHaveLength(2);
    expect(milestonesCreate[0]).toMatchObject({ title: "里程碑一", order: 0 });
    expect(milestonesCreate[1]).toMatchObject({ title: "里程碑二", order: 1 });

    // Actual dates must be reset (null)
    expect(milestonesCreate[0].actualStart).toBeNull();
    expect(milestonesCreate[0].actualEnd).toBeNull();
    expect(milestonesCreate[1].actualStart).toBeNull();
    expect(milestonesCreate[1].actualEnd).toBeNull();
  });

  test("sets new year on copied plan", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(sourcePlan);
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue({ id: "plan-2026", year: 2026 });

    await service.copyTemplate("plan-2025", 2026, "user-2");

    const createCall = (prisma.annualPlan.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.year).toBe(2026);
    expect(createCall.data.copiedFromYear).toBe(2025);
    expect(createCall.data.createdBy).toBe("user-2");
  });

  test("does not copy actual progress data", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(sourcePlan);
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue({ id: "plan-2026", year: 2026 });

    await service.copyTemplate("plan-2025", 2026, "user-2");

    const createCall = (prisma.annualPlan.create as jest.Mock).mock.calls[0][0];

    // Plan-level progress must reset
    expect(createCall.data.progressPct).toBeUndefined();

    // Monthly goals: status resets to NOT_STARTED, progressPct resets to 0
    const goalsCreate = createCall.data.monthlyGoals.create;
    goalsCreate.forEach((g: { status: string; progressPct: number }) => {
      expect(g.status).toBe("NOT_STARTED");
      expect(g.progressPct).toBe(0);
    });

    // Milestones: status resets to PENDING
    const milestonesCreate = createCall.data.milestones.create;
    milestonesCreate.forEach((m: { status: string }) => {
      expect(m.status).toBe("PENDING");
    });
  });

  test("throws NotFoundError if source plan not found", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.copyTemplate("nonexistent", 2026, "user-2")).rejects.toThrow(NotFoundError);
  });
});
