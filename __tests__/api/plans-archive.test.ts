/**
 * @jest-environment node
 */
/**
 * Issue #816 -- Annual Plan archive mechanism tests
 */
import { createMockPrisma } from "@/lib/test-utils";
import { PlanService } from "@/services/plan-service";
import { ValidationError } from "@/services/errors";

describe("PlanService -- Annual Plan creation", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PlanService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlanService(prisma as never);
  });

  it("creates a plan with required fields", async () => {
    const mockPlan = { id: "p-1", year: 2026, title: "資安計畫", archivedAt: null };
    (prisma.annualPlan.create as jest.Mock).mockResolvedValue(mockPlan);

    const result = await service.createPlan({ year: 2026, title: "資安計畫", createdBy: "u-1" });
    expect(result).toEqual(mockPlan);
    expect(prisma.annualPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ year: 2026, title: "資安計畫" }) })
    );
  });

  it("throws ValidationError when title is empty", async () => {
    await expect(service.createPlan({ year: 2026, title: "   ", createdBy: "u-1" })).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when year < 2000", async () => {
    await expect(service.createPlan({ year: 1999, title: "Test", createdBy: "u-1" })).rejects.toThrow(ValidationError);
  });

  it("allows multiple plans for the same year", async () => {
    (prisma.annualPlan.create as jest.Mock)
      .mockResolvedValueOnce({ id: "p-1" })
      .mockResolvedValueOnce({ id: "p-2" });

    await service.createPlan({ year: 2026, title: "資安計畫", createdBy: "u-1" });
    await service.createPlan({ year: 2026, title: "開發計畫", createdBy: "u-1" });
    expect(prisma.annualPlan.create).toHaveBeenCalledTimes(2);
  });
});

describe("PlanService -- listPlans ordering", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PlanService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlanService(prisma as never);
  });

  it("orders by year desc then createdAt desc", async () => {
    (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue([]);
    await service.listPlans({});
    expect(prisma.annualPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ year: "desc" }, { createdAt: "desc" }] })
    );
  });

  it("filters by year when provided", async () => {
    (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue([]);
    await service.listPlans({ year: 2026 });
    expect(prisma.annualPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: 2026 } })
    );
  });
});

describe("Plan archive validation", () => {
  it("updatePlanSchema accepts archived boolean", () => {
    const { updatePlanSchema } = require("@/validators/shared/plan");
    expect(updatePlanSchema.safeParse({ archived: true }).success).toBe(true);
    expect(updatePlanSchema.safeParse({ archived: false }).success).toBe(true);
  });

  it("updatePlanSchema rejects archived non-boolean", () => {
    const { updatePlanSchema } = require("@/validators/shared/plan");
    expect(updatePlanSchema.safeParse({ archived: "yes" }).success).toBe(false);
  });

  it("createPlanSchema validates year range 2000-2100", () => {
    const { createPlanSchema } = require("@/validators/shared/plan");
    expect(createPlanSchema.safeParse({ year: 2026, title: "Test" }).success).toBe(true);
    expect(createPlanSchema.safeParse({ year: 999, title: "Test" }).success).toBe(false);
    expect(createPlanSchema.safeParse({ year: 2101, title: "Test" }).success).toBe(false);
  });
});

describe("Plan API -- has PATCH and DELETE", () => {
  it("plans/[id]/route.ts exports DELETE (manager-only hard delete)", async () => {
    const mod = await import("@/app/api/plans/[id]/route");
    expect(mod).toHaveProperty("DELETE");
  });

  it("plans/[id]/route.ts exports PATCH", async () => {
    const mod = await import("@/app/api/plans/[id]/route");
    expect(mod).toHaveProperty("PATCH");
  });
});
