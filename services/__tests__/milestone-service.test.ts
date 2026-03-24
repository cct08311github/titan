import { MilestoneService } from "../milestone-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("MilestoneService", () => {
  let service: MilestoneService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MilestoneService(prisma as never);
  });

  test("listMilestones returns milestones for a plan", async () => {
    const mockMilestones = [
      { id: "ms-1", annualPlanId: "plan-1", title: "Q1 Launch" },
    ];
    (prisma.milestone.findMany as jest.Mock).mockResolvedValue(mockMilestones);

    const result = await service.listMilestones({ planId: "plan-1" });

    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ annualPlanId: "plan-1" }),
      })
    );
    expect(result).toEqual(mockMilestones);
  });

  test("getMilestone returns milestone by id", async () => {
    const mockMilestone = { id: "ms-1", title: "Q1 Launch", annualPlanId: "plan-1" };
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue(mockMilestone);

    const result = await service.getMilestone("ms-1");

    expect(result).toEqual(mockMilestone);
  });

  test("getMilestone throws NotFoundError for invalid id", async () => {
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getMilestone("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("createMilestone creates with required fields", async () => {
    const input = {
      annualPlanId: "plan-1",
      title: "Q1 Launch",
      plannedEnd: new Date("2025-03-31"),
    };
    const mockMilestone = { id: "ms-1", ...input };
    (prisma.milestone.create as jest.Mock).mockResolvedValue(mockMilestone);

    const result = await service.createMilestone(input);

    expect(prisma.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          annualPlanId: "plan-1",
          title: "Q1 Launch",
        }),
      })
    );
    expect(result).toEqual(mockMilestone);
  });

  test("createMilestone validates plannedStart < plannedEnd", async () => {
    const input = {
      annualPlanId: "plan-1",
      title: "Bad Milestone",
      plannedStart: new Date("2025-04-01"),
      plannedEnd: new Date("2025-03-01"),
    };

    await expect(service.createMilestone(input)).rejects.toThrow(ValidationError);
  });

  test("updateMilestone updates only provided fields", async () => {
    const existing = { id: "ms-1", title: "Old Title" };
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue(existing);
    const updated = { id: "ms-1", title: "New Title" };
    (prisma.milestone.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateMilestone("ms-1", { title: "New Title" });

    expect(prisma.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ms-1" },
        data: expect.objectContaining({ title: "New Title" }),
      })
    );
    expect(result).toEqual(updated);
  });

  test("updateMilestone can set actualStart/actualEnd", async () => {
    const existing = { id: "ms-1", title: "Milestone" };
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue(existing);
    const actualStart = new Date("2025-01-10");
    const actualEnd = new Date("2025-03-25");
    const updated = { id: "ms-1", actualStart, actualEnd };
    (prisma.milestone.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateMilestone("ms-1", { actualStart, actualEnd });

    expect(prisma.milestone.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualStart, actualEnd }),
      })
    );
    expect(result).toEqual(updated);
  });

  test("deleteMilestone removes milestone", async () => {
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue({ id: "ms-1" });
    (prisma.milestone.delete as jest.Mock).mockResolvedValue({ id: "ms-1" });

    await service.deleteMilestone("ms-1");

    expect(prisma.milestone.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ms-1" } })
    );
  });

  test("deleteMilestone throws NotFoundError for invalid id", async () => {
    (prisma.milestone.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteMilestone("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
