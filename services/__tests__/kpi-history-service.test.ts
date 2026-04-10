/**
 * Tests for KPIHistoryService (Issue #863)
 */
import { KPIHistoryService } from "../kpi-history-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("KPIHistoryService", () => {
  let service: KPIHistoryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    // Add kPIHistory and kPI mocks (not in default createMockPrisma)
    (prisma as unknown as Record<string, unknown>).kPIHistory = {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    };
    (prisma as unknown as Record<string, unknown>).kPI = {
      update: jest.fn(),
    };
    service = new KPIHistoryService(prisma as never);
  });

  describe("upsertHistory", () => {
    it("upserts a KPI history entry and syncs KPI.actual", async () => {
      const mockHistory = {
        id: "hist-1",
        kpiId: "kpi-1",
        period: "2026-03",
        actual: 85,
        source: "manual",
        updatedBy: "user-1",
      };
      const latestHistory = { actual: 85 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPIHistory.upsert as jest.Mock).mockResolvedValue(mockHistory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPIHistory.findFirst as jest.Mock).mockResolvedValue(latestHistory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPI.update as jest.Mock).mockResolvedValue({ id: "kpi-1", actual: 85 });

      const result = await service.upsertHistory({
        kpiId: "kpi-1",
        period: "2026-03",
        actual: 85,
        source: "manual",
        updatedBy: "user-1",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prisma as any).kPIHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kpiId_period: { kpiId: "kpi-1", period: "2026-03" } },
          create: expect.objectContaining({ actual: 85 }),
          update: expect.objectContaining({ actual: 85 }),
        })
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prisma as any).kPI.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "kpi-1" },
          data: { actual: 85 },
        })
      );
      expect(result).toEqual(mockHistory);
    });

    it("does not update KPI.actual if no history found after upsert", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPIHistory.upsert as jest.Mock).mockResolvedValue({ id: "hist-1" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPIHistory.findFirst as jest.Mock).mockResolvedValue(null);

      await service.upsertHistory({
        kpiId: "kpi-1",
        period: "2026-04",
        actual: 50,
        updatedBy: "user-2",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prisma as any).kPI.update).not.toHaveBeenCalled();
    });
  });

  describe("getHistory", () => {
    it("returns history ordered by period descending", async () => {
      const mockHistory = [
        { id: "hist-2", period: "2026-03", actual: 85, user: { id: "u1", name: "Alice" } },
        { id: "hist-1", period: "2026-02", actual: 70, user: { id: "u1", name: "Alice" } },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((prisma as any).kPIHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await service.getHistory("kpi-1");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((prisma as any).kPIHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kpiId: "kpi-1" },
          orderBy: { period: "desc" },
          include: { user: { select: { id: true, name: true } } },
        })
      );
      expect(result).toEqual(mockHistory);
    });
  });
});
