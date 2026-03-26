import { PlanService } from "../plan-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("PlanService", () => {
  let service: PlanService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlanService(prisma as never);
  });

  test("listPlans returns plans for year", async () => {
    const mockPlans = [{ id: "plan-1", year: 2026, title: "Plan 2026" }];
    (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue(mockPlans);

    const result = await service.listPlans({ year: 2026 });

    expect(prisma.annualPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ year: 2026 }),
      })
    );
    // listPlans now auto-computes progressPct from goals
    expect(result).toEqual(mockPlans.map((p) => ({ ...p, progressPct: 0 })));
  });

  test("getPlan returns with goals and milestones", async () => {
    const mockPlan = {
      id: "plan-1",
      year: 2026,
      monthlyGoals: [],
      milestones: [],
    };
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

    const result = await service.getPlan("plan-1");

    expect(prisma.annualPlan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } })
    );
    expect(result).toEqual(mockPlan);
  });

  test("createPlan requires title and year", async () => {
    await expect(
      service.createPlan({ title: "", year: 2026, createdBy: "user-1" })
    ).rejects.toThrow(ValidationError);

    await expect(
      service.createPlan({ title: "Plan", year: 0, createdBy: "user-1" })
    ).rejects.toThrow(ValidationError);
  });

  test("createPlan creates milestones", async () => {
    const mockPlan = { id: "plan-1", year: 2026, title: "Plan", milestones: [] };
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue(mockPlan);

    const result = await service.createPlan({
      title: "Plan",
      year: 2026,
      createdBy: "user-1",
      milestones: [{ title: "M1", plannedEnd: new Date("2026-03-31") }],
    });

    expect(prisma.annualPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          milestones: expect.objectContaining({ create: expect.any(Array) }),
        }),
      })
    );
    expect(result).toEqual(mockPlan);
  });

  test("updatePlan updates fields", async () => {
    const existing = { id: "plan-1", year: 2026, title: "Old" };
    const updated = { id: "plan-1", year: 2026, title: "New" };
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.annualPlan.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updatePlan("plan-1", { title: "New" });

    expect(prisma.annualPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } })
    );
    expect(result).toEqual(updated);
  });

  test("deletePlan checks for linked goals", async () => {
    (prisma.annualPlan.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deletePlan("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
