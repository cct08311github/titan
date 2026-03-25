import { KPIService } from "../kpi-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("KPIService", () => {
  let service: KPIService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
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

  test("listKPIs defaults to current year when no year provided", async () => {
    const mockKPIs: unknown[] = [];
    (prisma.kPI.findMany as jest.Mock).mockResolvedValue(mockKPIs);

    const result = await service.listKPIs({});

    expect(prisma.kPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ year: new Date().getFullYear() }),
      })
    );
    expect(result).toEqual(mockKPIs);
  });

  describe("getKPI", () => {
    test("returns kpi when found", async () => {
      const mockKPI = { id: "kpi-1", year: 2026, title: "KPI 1", taskLinks: [], deliverables: [] };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(mockKPI);

      const result = await service.getKPI("kpi-1");

      expect(prisma.kPI.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "kpi-1" } })
      );
      expect(result).toEqual(mockKPI);
    });

    test("throws NotFoundError when kpi not found", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getKPI("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createKPI", () => {
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

    test("createKPI creates kpi with all fields", async () => {
      const mockKPI = { id: "kpi-1", year: 2026, code: "KPI-2026-01", title: "KPI Title", target: 95, weight: 2, autoCalc: true };
      (prisma.kPI.create as jest.Mock).mockResolvedValue(mockKPI);

      const result = await service.createKPI({
        title: "KPI Title",
        target: 95,
        year: 2026,
        code: "KPI-2026-01",
        createdBy: "user-1",
        weight: 2,
        autoCalc: true,
        description: "A KPI",
      });

      expect(prisma.kPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "KPI Title",
            target: 95,
            year: 2026,
            code: "KPI-2026-01",
            createdBy: "user-1",
            weight: 2,
            autoCalc: true,
            description: "A KPI",
          }),
        })
      );
      expect(result).toEqual(mockKPI);
    });

    test("createKPI applies default weight and autoCalc", async () => {
      const mockKPI = { id: "kpi-2", year: 2026, weight: 1, autoCalc: false };
      (prisma.kPI.create as jest.Mock).mockResolvedValue(mockKPI);

      await service.createKPI({
        title: "KPI 2",
        target: 80,
        year: 2026,
        code: "KPI-2026-02",
        createdBy: "user-1",
      });

      expect(prisma.kPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weight: 1, autoCalc: false, description: null }),
        })
      );
    });
  });

  describe("updateKPI", () => {
    test("throws NotFoundError when kpi not found", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateKPI("nonexistent", { title: "X" })).rejects.toThrow(NotFoundError);
    });

    test("updates all provided fields", async () => {
      const existingKPI = { id: "kpi-1", title: "Old", year: 2026 };
      const updatedKPI = { id: "kpi-1", title: "New Title", actual: 80, weight: 2, status: "ON_TRACK", autoCalc: true };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(existingKPI);
      (prisma.kPI.update as jest.Mock).mockResolvedValue(updatedKPI);

      const result = await service.updateKPI("kpi-1", {
        title: "New Title",
        description: "New desc",
        target: 100,
        actual: 80,
        weight: 2,
        status: "ON_TRACK",
        autoCalc: true,
      });

      expect(prisma.kPI.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "kpi-1" },
          data: expect.objectContaining({
            title: "New Title",
            description: "New desc",
            target: 100,
            actual: 80,
            weight: 2,
            status: "ON_TRACK",
            autoCalc: true,
          }),
        })
      );
      expect(result).toEqual(updatedKPI);
    });

    test("updateKPI with no fields still succeeds", async () => {
      const existingKPI = { id: "kpi-1", title: "Old", year: 2026 };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(existingKPI);
      (prisma.kPI.update as jest.Mock).mockResolvedValue(existingKPI);

      await service.updateKPI("kpi-1", {});

      expect(prisma.kPI.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "kpi-1" }, data: {} })
      );
    });
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

  test("linkTask with custom weight", async () => {
    const mockLink = { id: "link-1", kpiId: "kpi-1", taskId: "task-1", weight: 3 };
    (prisma.kPITaskLink.create as jest.Mock).mockResolvedValue(mockLink);

    await service.linkTask("kpi-1", "task-1", 3);

    expect(prisma.kPITaskLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ weight: 3 }),
      })
    );
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

  describe("deleteKPI", () => {
    test("throws NotFoundError when kpi not found", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteKPI("nonexistent")).rejects.toThrow(NotFoundError);
    });

    test("deletes kpi and its task links in transaction", async () => {
      const existingKPI = { id: "kpi-1", title: "KPI 1" };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(existingKPI);
      (prisma.kPI.delete as jest.Mock).mockResolvedValue(existingKPI);
      (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.deleteKPI("kpi-1");

      expect(prisma.kPITaskLink.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { kpiId: "kpi-1" } })
      );
      expect(prisma.kPI.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "kpi-1" } })
      );
    });
  });

  describe("calculateAchievement", () => {
    test("auto-calculates from linked tasks", async () => {
      const mockKPI = {
        id: "kpi-1",
        autoCalc: true,
        target: 100,
        actual: 0,
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

    test("throws NotFoundError when kpi not found", async () => {
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.calculateAchievement("nonexistent")).rejects.toThrow(NotFoundError);
    });

    test("calculates 0 when no task links", async () => {
      const mockKPI = { id: "kpi-1", taskLinks: [] };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(mockKPI);
      (prisma.kPI.update as jest.Mock).mockResolvedValue({ ...mockKPI, actual: 0 });

      await service.calculateAchievement("kpi-1");

      expect(prisma.kPI.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actual: 0 }),
        })
      );
    });

    test("calculates weighted average correctly", async () => {
      const mockKPI = {
        id: "kpi-1",
        autoCalc: true,
        target: 100,
        actual: 0,
        taskLinks: [
          { task: { progressPct: 100, status: "DONE" }, weight: 2 },
          { task: { progressPct: 0, status: "TODO" }, weight: 1 },
        ],
      };
      (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(mockKPI);
      (prisma.kPI.update as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ ...mockKPI, actual: data.actual })
      );

      const result = await service.calculateAchievement("kpi-1");

      // (100*2 + 0*1) / (2+1) = 200/3 ≈ 66.67
      expect(result.actual).toBeCloseTo(200 / 3, 5);
    });
  });
});
