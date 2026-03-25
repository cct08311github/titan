/**
 * TDD-8: ReportService tests
 *
 * Tests for:
 * - getWeeklyReport: date bounds, user filters, hours/category aggregation
 * - getMonthlyReport: completion rate, monthly goals, changes
 * - getWorkloadReport: planned vs unplanned hours, byPerson breakdown
 * - getKPIReport: achievement calc, average, filters
 *
 * Fixes #562
 */
import { ReportService } from "../report-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("ReportService", () => {
  let service: ReportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReportService(prisma as never);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getWeeklyReport
  // ═══════════════════════════════════════════════════════════════════════

  describe("getWeeklyReport", () => {
    beforeEach(() => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([]);
    });

    it("returns weekly report with correct period bounds", async () => {
      const refDate = new Date("2026-03-25"); // Wednesday
      const result = await service.getWeeklyReport({
        isManager: true,
        refDate,
      });

      expect(result.period.start).toBeDefined();
      expect(result.period.end).toBeDefined();
      // Monday of that week = March 23, 2026
      expect(result.period.start.getDay()).toBe(1); // Monday
    });

    it("filters by userId for non-managers", async () => {
      const result = await service.getWeeklyReport({
        isManager: false,
        userId: "user-1",
        refDate: new Date("2026-03-25"),
      });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            primaryAssigneeId: "user-1",
          }),
        })
      );
      expect(result.completedCount).toBe(0);
    });

    it("shows all tasks for manager (no userId filter)", async () => {
      await service.getWeeklyReport({
        isManager: true,
        refDate: new Date("2026-03-25"),
      });

      const firstCallArgs = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(firstCallArgs.where).not.toHaveProperty("primaryAssigneeId");
    });

    it("aggregates hours by category", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 4, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" } },
        { hours: 2, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" } },
        { hours: 3, category: "INCIDENT", userId: "u1", user: { id: "u1", name: "A" } },
      ]);

      const result = await service.getWeeklyReport({ isManager: true });

      expect(result.totalHours).toBe(9);
      expect(result.hoursByCategory.PLANNED_TASK).toBe(6);
      expect(result.hoursByCategory.INCIDENT).toBe(3);
    });

    it("counts delay and scope changes correctly", async () => {
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([
        { changeType: "DELAY", changedAt: new Date() },
        { changeType: "DELAY", changedAt: new Date() },
        { changeType: "SCOPE_CHANGE", changedAt: new Date() },
      ]);

      const result = await service.getWeeklyReport({ isManager: true });

      expect(result.delayCount).toBe(2);
      expect(result.scopeChangeCount).toBe(1);
    });

    it("returns completed and overdue task counts", async () => {
      // First call: completed tasks, second call: overdue tasks
      (prisma.task.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }]) // completed
        .mockResolvedValueOnce([{ id: "t3" }]); // overdue

      const result = await service.getWeeklyReport({ isManager: true });

      expect(result.completedCount).toBe(2);
      expect(result.overdueCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getMonthlyReport
  // ═══════════════════════════════════════════════════════════════════════

  describe("getMonthlyReport", () => {
    beforeEach(() => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([]);
    });

    it("returns monthly report with specified year and month", async () => {
      const result = await service.getMonthlyReport({
        isManager: true,
        year: 2026,
        month: 3,
      });

      expect(result.period.year).toBe(2026);
      expect(result.period.month).toBe(3);
    });

    it("calculates completion rate correctly", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: "t1", status: "DONE" },
        { id: "t2", status: "DONE" },
        { id: "t3", status: "IN_PROGRESS" },
        { id: "t4", status: "BACKLOG" },
      ]);

      const result = await service.getMonthlyReport({
        isManager: true,
        year: 2026,
        month: 3,
      });

      expect(result.totalTasks).toBe(4);
      expect(result.completedTasks).toBe(2);
      expect(result.completionRate).toBe(50);
    });

    it("returns 0 completion rate when no tasks exist", async () => {
      const result = await service.getMonthlyReport({
        isManager: true,
        year: 2026,
        month: 1,
      });

      expect(result.completionRate).toBe(0);
    });

    it("includes monthly goals in report", async () => {
      (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([
        { id: "g1", title: "Goal 1", tasks: [] },
      ]);

      const result = await service.getMonthlyReport({
        isManager: true,
        year: 2026,
        month: 3,
      });

      expect(result.monthlyGoals).toHaveLength(1);
    });

    it("uses current date when year/month not specified", async () => {
      const result = await service.getMonthlyReport({ isManager: true });

      const now = new Date();
      expect(result.period.year).toBe(now.getFullYear());
      expect(result.period.month).toBe(now.getMonth() + 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getWorkloadReport
  // ═══════════════════════════════════════════════════════════════════════

  describe("getWorkloadReport", () => {
    beforeEach(() => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    });

    it("separates planned vs unplanned hours", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 8, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: { id: "t1", title: "T", category: "PLANNED" } },
        { hours: 3, category: "ADDED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: { id: "t2", title: "T2", category: "ADDED" } },
        { hours: 2, category: "INCIDENT", userId: "u1", user: { id: "u1", name: "A" }, task: { id: "t3", title: "T3", category: "INCIDENT" } },
      ]);

      const result = await service.getWorkloadReport({ isManager: true });

      expect(result.totalHours).toBe(13);
      expect(result.plannedHours).toBe(8);
      expect(result.unplannedHours).toBe(5);
    });

    it("calculates planned and unplanned rates", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 8, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: { id: "t1", title: "T", category: "PLANNED" } },
        { hours: 2, category: "INCIDENT", userId: "u1", user: { id: "u1", name: "A" }, task: { id: "t2", title: "T2", category: "INCIDENT" } },
      ]);

      const result = await service.getWorkloadReport({ isManager: true });

      expect(result.plannedRate).toBe(80);
      expect(result.unplannedRate).toBe(20);
    });

    it("returns 0 rates when no hours", async () => {
      const result = await service.getWorkloadReport({ isManager: true });

      expect(result.plannedRate).toBe(0);
      expect(result.unplannedRate).toBe(0);
      expect(result.totalHours).toBe(0);
    });

    it("groups hours by person", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 4, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "Alice" }, task: {} },
        { hours: 2, category: "INCIDENT", userId: "u1", user: { id: "u1", name: "Alice" }, task: {} },
        { hours: 6, category: "PLANNED_TASK", userId: "u2", user: { id: "u2", name: "Bob" }, task: {} },
      ]);

      const result = await service.getWorkloadReport({ isManager: true });

      expect(result.byPerson).toHaveLength(2);
      const alice = result.byPerson.find((p) => p.userId === "u1");
      expect(alice?.total).toBe(6);
      expect(alice?.planned).toBe(4);
      expect(alice?.unplanned).toBe(2);
    });

    it("groups unplanned tasks by source", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: "t1", category: "ADDED", addedSource: "客戶要求" },
        { id: "t2", category: "INCIDENT", addedSource: "客戶要求" },
        { id: "t3", category: "SUPPORT", addedSource: null },
      ]);

      const result = await service.getWorkloadReport({ isManager: true });

      expect(result.unplannedBySource["客戶要求"]).toBe(2);
      expect(result.unplannedBySource["未填寫"]).toBe(1);
    });

    it("applies date range filter", async () => {
      const start = new Date("2026-01-01");
      const end = new Date("2026-01-31");

      await service.getWorkloadReport({
        isManager: true,
        dateRange: { startDate: start, endDate: end },
      });

      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: start, lte: end },
          }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getKPIReport
  // ═══════════════════════════════════════════════════════════════════════

  describe("getKPIReport", () => {
    it("returns KPI report with achievement calculations", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: "k1", target: 100, actual: 100, autoCalc: false, taskLinks: [] },
        { id: "k2", target: 100, actual: 50, autoCalc: false, taskLinks: [] },
        { id: "k3", target: 100, actual: 80, autoCalc: false, taskLinks: [] },
      ]);

      const result = await service.getKPIReport(2026);

      expect(result.year).toBe(2026);
      expect(result.totalCount).toBe(3);
      expect(result.achievedCount).toBe(1); // only k1 >= 100
      expect(result.avgAchievement).toBeGreaterThan(0);
    });

    it("uses current year when not specified", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getKPIReport();

      expect(result.year).toBe(new Date().getFullYear());
    });

    it("returns 0 avg achievement for empty KPI list", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getKPIReport(2026);

      expect(result.avgAchievement).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.achievedCount).toBe(0);
    });

    it("calculates auto-calc KPI achievement from task links", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        {
          id: "k1",
          target: 100,
          actual: 0,
          autoCalc: true,
          taskLinks: [
            { weight: 1, task: { id: "t1", title: "A", status: "DONE", progressPct: 100 } },
          ],
        },
      ]);

      const result = await service.getKPIReport(2026);

      expect(result.totalCount).toBe(1);
      expect(result.achievedCount).toBe(1); // 100% achievement
    });
  });
});
