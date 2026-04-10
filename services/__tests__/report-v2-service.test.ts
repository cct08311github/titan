/**
 * Tests for ReportV2Service (Issue #984)
 */
import { ReportV2Service } from "../report-v2-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("ReportV2Service", () => {
  let service: ReportV2Service;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReportV2Service(prisma as never);
  });

  describe("getUtilization", () => {
    it("returns utilization report with avgUtilization and user breakdown", async () => {
      const mockUsers = [
        { id: "user-1", name: "Alice" },
        { id: "user-2", name: "Bob" },
      ];
      const mockTimeEntries = [
        { userId: "user-1", hours: 40 },
        { userId: "user-1", hours: 20 },
        { userId: "user-2", hours: 10 },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue(mockTimeEntries);

      const result = await service.getUtilization("2026-03-01", "2026-03-07");

      expect(result.users).toHaveLength(2);
      const alice = result.users.find((u) => u.userId === "user-1");
      expect(alice?.totalHours).toBe(60);
      expect(result.avgUtilization).toBeGreaterThan(0);
      expect(result.period.start).toBeInstanceOf(Date);
    });

    it("returns zero utilization when no time entries", async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "user-1", name: "Alice" }]);
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUtilization();

      expect(result.users[0].totalHours).toBe(0);
      expect(result.users[0].utilizationRate).toBe(0);
    });
  });

  describe("getUnplannedTrend", () => {
    it("groups time entries by month and calculates unplanned rates", async () => {
      const mockEntries = [
        { date: new Date("2026-03-05"), hours: 8, category: "ADDED_TASK" },
        { date: new Date("2026-03-10"), hours: 4, category: "PLANNED" },
        { date: new Date("2026-03-15"), hours: 2, category: "INCIDENT" },
      ];

      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await service.getUnplannedTrend("2026-03-01", "2026-03-31");

      expect(result.months).toHaveLength(1);
      const march = result.months[0];
      expect(march.month).toBe("2026-03");
      expect(march.totalHours).toBe(14);
      expect(march.unplannedHours).toBe(10); // ADDED_TASK + INCIDENT
      expect(march.unplannedRate).toBeGreaterThan(0);
    });

    it("returns empty months array when no entries exist", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUnplannedTrend();

      expect(result.months).toHaveLength(0);
      expect(result.avgUnplannedRate).toBe(0);
    });
  });

  describe("getWorkloadDistribution", () => {
    it("groups time entries by user and category", async () => {
      const mockEntries = [
        { userId: "user-1", hours: 5, category: "PLANNED", user: { id: "user-1", name: "Alice" } },
        { userId: "user-1", hours: 3, category: "INCIDENT", user: { id: "user-1", name: "Alice" } },
        { userId: "user-2", hours: 8, category: "PLANNED", user: { id: "user-2", name: "Bob" } },
      ];

      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

      const result = await service.getWorkloadDistribution("2026-03-01", "2026-03-31");

      expect(result.users).toHaveLength(2);
      const alice = result.users.find((u) => u.userId === "user-1");
      expect(alice?.total).toBe(8);
      expect(alice?.byCategory["PLANNED"]).toBe(5);
      expect(alice?.byCategory["INCIDENT"]).toBe(3);
    });
  });
});
