import { MilestoneService } from "../milestone-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("MilestoneService — type field (G-2, Issue #843)", () => {
  let service: MilestoneService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MilestoneService(prisma as never);
  });

  test("createMilestone defaults type to CUSTOM", async () => {
    const input = {
      annualPlanId: "plan-1",
      title: "Release",
      plannedEnd: new Date("2026-06-01"),
    };
    (prisma.milestone.create as jest.Mock).mockResolvedValue({ id: "ms-1", ...input, type: "CUSTOM" });

    const result = await service.createMilestone(input);

    expect(prisma.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CUSTOM" }),
      })
    );
    expect(result.type).toBe("CUSTOM");
  });

  test("createMilestone accepts LAUNCH type", async () => {
    const input = {
      annualPlanId: "plan-1",
      title: "Go Live",
      type: "LAUNCH" as const,
      plannedEnd: new Date("2026-09-01"),
    };
    (prisma.milestone.create as jest.Mock).mockResolvedValue({ id: "ms-2", ...input });

    const result = await service.createMilestone(input);

    expect(prisma.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "LAUNCH" }),
      })
    );
    expect(result.type).toBe("LAUNCH");
  });

  test("createMilestone accepts AUDIT type", async () => {
    const input = {
      annualPlanId: "plan-1",
      title: "ISO Audit",
      type: "AUDIT" as const,
      plannedEnd: new Date("2026-11-15"),
    };
    (prisma.milestone.create as jest.Mock).mockResolvedValue({ id: "ms-3", ...input });

    const result = await service.createMilestone(input);

    expect(prisma.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "AUDIT" }),
      })
    );
    expect(result.type).toBe("AUDIT");
  });

  test("updateMilestone can change type", async () => {
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue({ id: "ms-1", type: "CUSTOM" });
    (prisma.milestone.update as jest.Mock).mockResolvedValue({ id: "ms-1", type: "LAUNCH" });

    const result = await service.updateMilestone("ms-1", { type: "LAUNCH" });

    expect(prisma.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "LAUNCH" }),
      })
    );
    expect(result.type).toBe("LAUNCH");
  });
});
