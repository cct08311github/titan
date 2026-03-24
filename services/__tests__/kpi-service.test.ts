import { KPIService } from "../kpi-service";
import { createMockPrisma } from "../../lib/test-utils";
import { ValidationError } from "../errors";

describe("KPIService", () => {
  let service: KPIService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
  });

  test("listKPIs returns for year", async () => {
    const mockKPIs = [{ id: "kpi-1", year: 2026, title: "KPI 1" }];
    (prisma.kPI.findMany as jest.Mock).mockResolvedValue(mockKPIs);

    const result = await service.listKPIs({ year: 2026 });

    expect(prisma.kPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ year: 2026 }),
      })
    );
    expect(result).toEqual(mockKPIs);
  });

  test("createKPI requires title and target", async () => {
    await expect(
      service.createKPI({
        title: "",
        target: 95,
        year: 2026,
        code: "KPI-2026-01",
        createdBy: "user-1",
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      service.createKPI({
        title: "KPI",
        target: null as unknown as number,
        year: 2026,
        code: "KPI-2026-01",
        createdBy: "user-1",
      })
    ).rejects.toThrow(ValidationError);
  });

  test("linkTask links task to KPI", async () => {
    const mockLink = { id: "link-1", kpiId: "kpi-1", taskId: "task-1" };
    (prisma.kPITaskLink.create as jest.Mock).mockResolvedValue(mockLink);

    const result = await service.linkTask("kpi-1", "task-1");

    expect(prisma.kPITaskLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kpiId: "kpi-1", taskId: "task-1" }),
      })
    );
    expect(result).toEqual(mockLink);
  });

  test("unlinkTask removes link", async () => {
    (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.unlinkTask("kpi-1", "task-1");

    expect(prisma.kPITaskLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kpiId: "kpi-1", taskId: "task-1" }),
      })
    );
  });

  test("calculateAchievement auto-calculates from linked tasks", async () => {
    const mockKPI = {
      id: "kpi-1",
      autoCalc: true,
      taskLinks: [
        { task: { progressPct: 100, status: "DONE" }, weight: 1 },
        { task: { progressPct: 50, status: "IN_PROGRESS" }, weight: 1 },
      ],
    };
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(mockKPI);
    (prisma.kPI.update as jest.Mock).mockResolvedValue({ ...mockKPI, actual: 75 });

    const result = await service.calculateAchievement("kpi-1");

    expect(prisma.kPI.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "kpi-1" },
        data: expect.objectContaining({ actual: 75 }),
      })
    );
    expect(result.actual).toBe(75);
  });
});
