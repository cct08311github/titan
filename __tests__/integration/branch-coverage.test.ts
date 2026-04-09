/**
 * @jest-environment node
 */
/**
 * Branch Coverage Improvement Tests — Issue #370
 *
 * Targets the top 5 services with lowest branch coverage:
 *   1. ReportService (30.9%)
 *   2. ExportService (42.85%)
 *   3. TaskService (54.38%)
 *   4. DocumentService (61.53%)
 *   5. DeliverableService (66.66%)
 */
import { createMockPrisma } from "@/lib/test-utils";
import { ReportService } from "@/services/report-service";
import { ExportService } from "@/services/export-service";
import { TaskService } from "@/services/task-service";
import { DocumentService } from "@/services/document-service";
import { DeliverableService } from "@/services/deliverable-service";
import { NotFoundError, ValidationError } from "@/services/errors";

// ═══════════════════════════════════════════════════════════════════════════
// 1. ReportService — branch coverage targets
// ═══════════════════════════════════════════════════════════════════════════

describe("ReportService — branch coverage", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReportService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReportService(prisma as never);

    // Default: return empty arrays for all queries
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.monthlyGoal.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.kPI.findMany as jest.Mock).mockResolvedValue([]);
  });

  // ── Weekly report ─────────────────────────────────────────────────────

  describe("getWeeklyReport", () => {
    it("uses refDate when dateRange.startDate is absent", async () => {
      const refDate = new Date("2026-03-20");
      const result = await service.getWeeklyReport({ isManager: true, refDate });
      expect(result.period.start).toBeInstanceOf(Date);
      expect(result.completedCount).toBe(0);
    });

    it("uses dateRange.startDate when provided", async () => {
      const startDate = new Date("2026-03-16");
      const result = await service.getWeeklyReport({
        isManager: true,
        dateRange: { startDate, endDate: new Date("2026-03-22") },
      });
      expect(result.period.start).toBeInstanceOf(Date);
    });

    it("defaults to current date when neither refDate nor dateRange provided", async () => {
      const result = await service.getWeeklyReport({ isManager: true });
      expect(result.period.start).toBeInstanceOf(Date);
    });

    it("filters by userId for non-manager (engineer)", async () => {
      await service.getWeeklyReport({ isManager: false, userId: "u1" });
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ primaryAssigneeId: "u1" }),
        })
      );
    });

    it("does not filter by userId for manager", async () => {
      await service.getWeeklyReport({ isManager: true });
      const call = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.primaryAssigneeId).toBeUndefined();
    });

    it("computes sumHoursByCategory correctly", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 3, category: "PLANNED_TASK", user: { id: "u1", name: "A" } },
        { hours: 2, category: "PLANNED_TASK", user: { id: "u1", name: "A" } },
        { hours: 1, category: "INCIDENT", user: { id: "u2", name: "B" } },
      ]);
      const result = await service.getWeeklyReport({ isManager: true });
      expect(result.totalHours).toBe(6);
      expect(result.hoursByCategory.PLANNED_TASK).toBe(5);
      expect(result.hoursByCategory.INCIDENT).toBe(1);
    });

    it("counts delay and scope change correctly", async () => {
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([
        { changeType: "DELAY", task: { id: "t1", title: "T" }, changedByUser: { id: "u1", name: "A" } },
        { changeType: "SCOPE_CHANGE", task: { id: "t2", title: "T2" }, changedByUser: { id: "u1", name: "A" } },
        { changeType: "DELAY", task: { id: "t3", title: "T3" }, changedByUser: { id: "u1", name: "A" } },
      ]);
      const result = await service.getWeeklyReport({ isManager: true });
      expect(result.delayCount).toBe(2);
      expect(result.scopeChangeCount).toBe(1);
    });

    it("handles Sunday as refDate (day === 0)", async () => {
      // Sunday: getDay() === 0, should still compute week bounds correctly
      const sunday = new Date("2026-03-22"); // Sunday
      const result = await service.getWeeklyReport({ isManager: true, refDate: sunday });
      expect(result.period.start.getDay()).toBe(1); // Monday
    });
  });

  // ── Monthly report ────────────────────────────────────────────────────

  describe("getMonthlyReport", () => {
    it("defaults year/month to current when not provided", async () => {
      const result = await service.getMonthlyReport({ isManager: true });
      expect(result.period.year).toBe(new Date().getFullYear());
      expect(result.period.month).toBe(new Date().getMonth() + 1);
    });

    it("uses provided year/month", async () => {
      const result = await service.getMonthlyReport({ isManager: true, year: 2025, month: 6 });
      expect(result.period.year).toBe(2025);
      expect(result.period.month).toBe(6);
    });

    it("filters by userId for non-manager", async () => {
      await service.getMonthlyReport({ isManager: false, userId: "u1" });
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "u1" }),
        })
      );
    });

    it("calculates completionRate when tasks exist", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { status: "DONE" },
        { status: "DONE" },
        { status: "IN_PROGRESS" },
        { status: "TODO" },
      ]);
      const result = await service.getMonthlyReport({ isManager: true });
      expect(result.completionRate).toBe(50);
    });

    it("returns 0 completionRate when no tasks", async () => {
      const result = await service.getMonthlyReport({ isManager: true });
      expect(result.completionRate).toBe(0);
      expect(result.totalTasks).toBe(0);
    });

    it("counts delay and scope changes", async () => {
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([
        { changeType: "DELAY" },
        { changeType: "SCOPE_CHANGE" },
      ]);
      const result = await service.getMonthlyReport({ isManager: true });
      expect(result.delayCount).toBe(1);
      expect(result.scopeChangeCount).toBe(1);
    });
  });

  // ── KPI report ────────────────────────────────────────────────────────

  describe("getKPIReport", () => {
    it("defaults to current year when not provided", async () => {
      const result = await service.getKPIReport();
      expect(result.year).toBe(new Date().getFullYear());
    });

    it("uses provided year", async () => {
      const result = await service.getKPIReport(2025);
      expect(result.year).toBe(2025);
    });

    it("calculates avgAchievement and achievedCount", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: "k1", target: 100, actual: 100, autoCalc: false, taskLinks: [], weight: 1 },
        { id: "k2", target: 100, actual: 50, autoCalc: false, taskLinks: [], weight: 1 },
      ]);
      const result = await service.getKPIReport(2026);
      expect(result.totalCount).toBe(2);
      expect(result.achievedCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Workload report ───────────────────────────────────────────────────

  describe("getWorkloadReport", () => {
    it("defaults date range to current month when not provided", async () => {
      const result = await service.getWorkloadReport({ isManager: true });
      expect(result.period.start).toBeInstanceOf(Date);
    });

    it("uses provided dateRange", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-01-31");
      const result = await service.getWorkloadReport({
        isManager: true,
        dateRange: { startDate, endDate },
      });
      expect(result.period.start).toEqual(startDate);
    });

    it("computes planned/unplanned hours correctly", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 8, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: null },
        { hours: 3, category: "ADDED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: null },
        { hours: 2, category: "INCIDENT", userId: "u2", user: { id: "u2", name: "B" }, task: null },
        { hours: 1, category: "SUPPORT", userId: "u2", user: { id: "u2", name: "B" }, task: null },
        { hours: 2, category: "ADMIN", userId: "u1", user: { id: "u1", name: "A" }, task: null },
      ]);
      const result = await service.getWorkloadReport({ isManager: true });
      expect(result.totalHours).toBe(16);
      expect(result.plannedHours).toBe(8);
      expect(result.unplannedHours).toBe(6); // ADDED_TASK + INCIDENT + SUPPORT
      expect(result.plannedRate).toBeGreaterThan(0);
      expect(result.unplannedRate).toBeGreaterThan(0);
    });

    it("returns 0 rates when totalHours is 0", async () => {
      const result = await service.getWorkloadReport({ isManager: true });
      expect(result.plannedRate).toBe(0);
      expect(result.unplannedRate).toBe(0);
    });

    it("groups byPerson correctly with multiple entries per user", async () => {
      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        { hours: 4, category: "PLANNED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: null },
        { hours: 2, category: "ADDED_TASK", userId: "u1", user: { id: "u1", name: "A" }, task: null },
        { hours: 3, category: "INCIDENT", userId: "u2", user: { id: "u2", name: "B" }, task: null },
      ]);
      const result = await service.getWorkloadReport({ isManager: true });
      expect(result.byPerson).toHaveLength(2);
      const personA = result.byPerson.find((p) => p.userId === "u1");
      expect(personA?.total).toBe(6);
      expect(personA?.planned).toBe(4);
      expect(personA?.unplanned).toBe(2);
    });

    it("filters by userId for non-manager", async () => {
      await service.getWorkloadReport({ isManager: false, userId: "u1" });
      expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "u1" }),
        })
      );
    });

    it("computes unplannedBySource with addedSource", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { addedSource: "客戶要求" },
        { addedSource: "客戶要求" },
        { addedSource: null },
      ]);
      const result = await service.getWorkloadReport({ isManager: true });
      expect(result.unplannedBySource["客戶要求"]).toBe(2);
      expect(result.unplannedBySource["未填寫"]).toBe(1);
    });
  });

  // ── Delay/change report ───────────────────────────────────────────────

  describe("getDelayChangeReport", () => {
    it("defaults date range to current month", async () => {
      const result = await service.getDelayChangeReport({ isManager: true });
      expect(result.period.start).toBeInstanceOf(Date);
    });

    it("uses provided dateRange", async () => {
      const startDate = new Date("2026-02-01");
      const endDate = new Date("2026-02-28");
      const result = await service.getDelayChangeReport({
        isManager: true,
        dateRange: { startDate, endDate },
      });
      expect(result.period.start).toEqual(startDate);
    });

    it("groups changes by date correctly", async () => {
      const date1 = new Date("2026-03-10T10:00:00Z");
      const date2 = new Date("2026-03-10T14:00:00Z");
      const date3 = new Date("2026-03-11T09:00:00Z");
      (prisma.taskChange.findMany as jest.Mock).mockResolvedValue([
        { changeType: "DELAY", changedAt: date1, task: { id: "t1", title: "T1" }, changedByUser: { id: "u1", name: "A" } },
        { changeType: "SCOPE_CHANGE", changedAt: date2, task: { id: "t2", title: "T2" }, changedByUser: { id: "u1", name: "A" } },
        { changeType: "DELAY", changedAt: date3, task: { id: "t3", title: "T3" }, changedByUser: { id: "u2", name: "B" } },
      ]);
      const result = await service.getDelayChangeReport({ isManager: true });
      expect(result.delayCount).toBe(2);
      expect(result.scopeChangeCount).toBe(1);
      expect(result.total).toBe(3);
      expect(result.byDate).toHaveLength(2);
      expect(result.byDate[0].date).toBe("2026-03-10");
      expect(result.byDate[0].delayCount).toBe(1);
      expect(result.byDate[0].scopeChangeCount).toBe(1);
      expect(result.byDate[0].total).toBe(2);
      expect(result.byDate[1].date).toBe("2026-03-11");
    });

    it("returns empty byDate for no changes", async () => {
      const result = await service.getDelayChangeReport({ isManager: true });
      expect(result.byDate).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ExportService — branch coverage targets
// ═══════════════════════════════════════════════════════════════════════════

describe("ExportService — branch coverage", () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  describe("generateExcel", () => {
    it("generates a valid buffer from data and columns", async () => {
      const columns = [
        { header: "ID", key: "id" },
        { header: "Name", key: "name" },
      ];
      const data = [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ];
      const buffer = await service.generateExcel(data, columns);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("handles empty data array", async () => {
      const columns = [{ header: "ID", key: "id" }];
      const buffer = await service.generateExcel([], columns);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it("handles missing keys in data (falls back to empty string)", async () => {
      const columns = [
        { header: "ID", key: "id" },
        { header: "Missing", key: "missingField" },
      ];
      const data = [{ id: "1" }];
      const buffer = await service.generateExcel(data, columns);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe("generatePDF", () => {
    it("produces HTML with table structure", () => {
      const data = [{ id: "1", name: "Alice" }];
      const html = service.generatePDF(data, "Test Report");
      expect(html).toContain("<html");
      expect(html).toContain("Test Report");
      expect(html).toContain("<table>");
      expect(html).toContain("Alice");
    });

    it("escapes HTML special characters", () => {
      const data = [{ value: '<script>alert("xss")</script>' }];
      const html = service.generatePDF(data, "XSS Test");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("handles empty data array (no rows)", () => {
      const html = service.generatePDF([], "Empty Report");
      expect(html).toContain("Empty Report");
      expect(html).toContain("<tbody>");
    });
  });

  describe("exportWeeklyReport", () => {
    it("formats completed tasks with assignee name", () => {
      const result = service.exportWeeklyReport({
        weekStart: "2026-03-16",
        weekEnd: "2026-03-22",
        completedTasks: [
          { id: "t1", title: "Task 1", primaryAssignee: { name: "Alice" }, updatedAt: new Date("2026-03-20") },
          { id: "t2", title: "Task 2", primaryAssignee: null, updatedAt: new Date("2026-03-21") },
        ],
        totalHours: 40,
        hoursByCategory: { PLANNED_TASK: 30, INCIDENT: 10 },
      });
      expect(result.title).toContain("Weekly Report");
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].assignee).toBe("Alice");
      expect(result.rows[1].assignee).toBe("");
    });

    it("handles non-Date updatedAt values", () => {
      const result = service.exportWeeklyReport({
        weekStart: "2026-03-16",
        weekEnd: "2026-03-22",
        completedTasks: [
          { id: "t1", title: "Task 1", primaryAssignee: null, updatedAt: "2026-03-20" as unknown as Date },
        ],
        totalHours: 0,
        hoursByCategory: {},
      });
      expect(result.rows[0].completedAt).toBe("2026-03-20");
    });
  });

  describe("exportMonthlyReport", () => {
    it("formats tasks with due dates", () => {
      const result = service.exportMonthlyReport({
        year: 2026,
        month: 3,
        totalTasks: 2,
        doneTasks: 1,
        completionRate: 50,
        tasks: [
          { id: "t1", title: "Task 1", status: "DONE", priority: "P1", dueDate: new Date("2026-03-15") },
          { id: "t2", title: "Task 2", status: "IN_PROGRESS", priority: "P2", dueDate: null },
        ],
      });
      expect(result.title).toContain("Monthly Report: 2026-03");
      expect(result.rows[0].dueDate).toBe("2026-03-15");
      expect(result.rows[1].dueDate).toBe("");
    });

    it("pads single-digit months", () => {
      const result = service.exportMonthlyReport({
        year: 2026,
        month: 1,
        totalTasks: 0,
        doneTasks: 0,
        completionRate: 0,
        tasks: [],
      });
      expect(result.title).toContain("2026-01");
    });

    it("handles non-Date dueDate values", () => {
      const result = service.exportMonthlyReport({
        year: 2026,
        month: 3,
        totalTasks: 1,
        doneTasks: 0,
        completionRate: 0,
        tasks: [
          { id: "t1", title: "T1", status: "TODO", priority: "P2", dueDate: "2026-03-20" as unknown as Date },
        ],
      });
      expect(result.rows[0].dueDate).toBe("2026-03-20");
    });
  });

  describe("exportKPIReport", () => {
    it("formats KPI data correctly", () => {
      const result = service.exportKPIReport({
        year: 2026,
        avgAchievement: 85.5,
        achievedCount: 3,
        totalCount: 5,
        kpis: [
          { id: "k1", code: "KPI-001", title: "Uptime", target: 99, actual: 99.5, achievementRate: 100.5 },
        ],
      });
      expect(result.title).toBe("KPI Report: 2026");
      expect(result.rows[0].code).toBe("KPI-001");
    });
  });

  describe("exportWorkloadReport", () => {
    it("formats workload data by person", () => {
      const result = service.exportWorkloadReport({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        totalHours: 160,
        plannedHours: 120,
        unplannedHours: 40,
        byPerson: [
          { userId: "u1", name: "Alice", total: 80, planned: 60, unplanned: 20 },
          { userId: "u2", name: "Bob", total: 80, planned: 60, unplanned: 20 },
        ],
      });
      expect(result.title).toContain("Workload Report");
      expect(result.rows).toHaveLength(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. TaskService — branch coverage targets (uncovered lines 194-209)
// ═══════════════════════════════════════════════════════════════════════════

describe("TaskService — updateTask branch coverage", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  const EXISTING_TASK = {
    id: "t1",
    title: "Original Title",
    description: "Original Desc",
    status: "TODO",
    priority: "P2",
    dueDate: new Date("2026-04-01"),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(EXISTING_TASK);
    (prisma.task.update as jest.Mock).mockResolvedValue({ ...EXISTING_TASK });
    (prisma.taskChange.create as jest.Mock).mockResolvedValue({});
  });

  it("throws NotFoundError when task does not exist", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.updateTask("nonexistent", { title: "X" })).rejects.toThrow(NotFoundError);
  });

  it("updates only provided fields", async () => {
    await service.updateTask("t1", { title: "New Title" });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "New Title" }),
      })
    );
  });

  it("detects delay when dueDate changes later and changedBy is provided", async () => {
    const mockTxTaskChange = { create: jest.fn().mockResolvedValue({}) };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ taskChange: mockTxTaskChange })
    );
    await service.updateTask("t1", {
      dueDate: "2026-05-01",
      changedBy: "u1",
      changeReason: "客戶延期",
    });
    expect(mockTxTaskChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeType: "DELAY" }),
      })
    );
  });

  it("detects scope change when title changes significantly and changedBy is provided", async () => {
    const mockTxTaskChange = { create: jest.fn().mockResolvedValue({}) };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ taskChange: mockTxTaskChange })
    );
    // Title change must be > 40% different to trigger scope change
    await service.updateTask("t1", {
      title: "ZZZZZZZZZZZZZZZ",
      changedBy: "u1",
      changeReason: "需求變更",
    });
    expect(mockTxTaskChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeType: "SCOPE_CHANGE" }),
      })
    );
  });

  it("detects scope change when description changes and changedBy is provided", async () => {
    const mockTxTaskChange = { create: jest.fn().mockResolvedValue({}) };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ taskChange: mockTxTaskChange })
    );
    await service.updateTask("t1", {
      description: "Completely New Description",
      changedBy: "u1",
    });
    expect(mockTxTaskChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeType: "SCOPE_CHANGE" }),
      })
    );
  });

  it("does NOT detect delay/scope when changedBy is not provided", async () => {
    const mockTxTaskChange = { create: jest.fn() };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ taskChange: mockTxTaskChange })
    );
    await service.updateTask("t1", {
      dueDate: "2026-05-01",
      title: "Changed",
    });
    expect(mockTxTaskChange.create).not.toHaveBeenCalled();
  });

  it("handles setting dueDate to null (clearing)", async () => {
    await service.updateTask("t1", {
      dueDate: null,
      changedBy: "u1",
    });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: null }),
      })
    );
  });

  it("handles all optional update fields", async () => {
    await service.updateTask("t1", {
      title: "T",
      description: "D",
      status: "IN_PROGRESS",
      priority: "P1",
      category: "ADDED",
      primaryAssigneeId: "u2",
      backupAssigneeId: null,
      monthlyGoalId: "mg1",
      dueDate: "2026-06-01",
      startDate: "2026-03-01",
      estimatedHours: 10,
      tags: ["tag1"],
      addedReason: "urgent",
      addedSource: "customer",
      progressPct: 50,
    });
    const callData = (prisma.task.update as jest.Mock).mock.calls[0][0].data;
    expect(callData.title).toBe("T");
    expect(callData.status).toBe("IN_PROGRESS");
    expect(callData.primaryAssigneeId).toBe("u2");
    expect(callData.backupAssigneeId).toBeNull();
    expect(callData.progressPct).toBe(50);
  });

  it("handles startDate being set to null", async () => {
    await service.updateTask("t1", { startDate: null });
    const callData = (prisma.task.update as jest.Mock).mock.calls[0][0].data;
    expect(callData.startDate).toBeNull();
  });

  it("handles estimatedHours being set to null", async () => {
    await service.updateTask("t1", { estimatedHours: null });
    const callData = (prisma.task.update as jest.Mock).mock.calls[0][0].data;
    expect(callData.estimatedHours).toBeNull();
  });
});

describe("TaskService — deleteTask branch coverage", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
    (prisma.task.delete as jest.Mock).mockResolvedValue({});
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
    // deleteTask wraps delete + auditLog in $transaction; execute the callback with a tx proxy
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ task: prisma.task, auditLog: prisma.auditLog })
    );
  });

  it("logs task title when task exists", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: "t1", title: "My Task" });
    await service.deleteTask("t1", "u1", "127.0.0.1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detail: "Deleted task: My Task",
        }),
      })
    );
  });

  it("logs task id when task not found (already deleted)", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
    await service.deleteTask("t1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          detail: "Deleted task: t1",
        }),
      })
    );
  });
});

describe("TaskService — listTasks filter branches", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: TaskService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("applies all filters when provided", async () => {
    await service.listTasks({
      assignee: "u1",
      status: "IN_PROGRESS",
      priority: "P1",
      category: "PLANNED",
      monthlyGoalId: "mg1",
    });
    const call = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.status).toBe("IN_PROGRESS");
    expect(call.where.priority).toBe("P1");
    expect(call.where.category).toBe("PLANNED");
    expect(call.where.monthlyGoalId).toBe("mg1");
  });

  it("applies no filters when none provided", async () => {
    await service.listTasks({});
    const call = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
    // T1340: listTasks now defaults to filtering out sample data
    expect(call.where).toEqual({ isSample: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. DocumentService — branch coverage targets (uncovered lines 61, 68-72)
// ═══════════════════════════════════════════════════════════════════════════

describe("DocumentService — branch coverage", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: DocumentService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DocumentService(prisma as never);
  });

  describe("getDocument", () => {
    it("throws NotFoundError when document not found", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getDocument("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createDocument", () => {
    it("throws ValidationError when title is empty", async () => {
      await expect(
        service.createDocument({ title: "  ", content: "C", slug: "s", createdBy: "u1", updatedBy: "u1" })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when slug is empty", async () => {
      await expect(
        service.createDocument({ title: "Title", content: "C", slug: "  ", createdBy: "u1", updatedBy: "u1" })
      ).rejects.toThrow(ValidationError);
    });

    it("creates document when inputs are valid", async () => {
      (prisma.document.create as jest.Mock).mockResolvedValue({ id: "d1", title: "Title" });
      const result = await service.createDocument({
        title: "Title",
        content: "Content",
        slug: "title",
        createdBy: "u1",
        updatedBy: "u1",
      });
      expect(result.id).toBe("d1");
    });
  });

  describe("updateDocument", () => {
    const EXISTING_DOC = { id: "d1", title: "Old Title", content: "Old Content", version: 1 };

    it("throws NotFoundError when document not found", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.updateDocument("nonexistent", { updatedBy: "u1" })).rejects.toThrow(NotFoundError);
    });

    it("creates version snapshot when content changes", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(EXISTING_DOC);

      const mockTx = {
        documentVersion: { create: jest.fn().mockResolvedValue({}) },
        document: { update: jest.fn().mockResolvedValue({ ...EXISTING_DOC, content: "New Content", version: 2 }) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

      await service.updateDocument("d1", { content: "New Content", updatedBy: "u1" });
      expect(mockTx.documentVersion.create).toHaveBeenCalled();
      expect(mockTx.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2 }),
        })
      );
    });

    it("does NOT create version when content is same", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(EXISTING_DOC);

      const mockTx = {
        documentVersion: { create: jest.fn() },
        document: { update: jest.fn().mockResolvedValue(EXISTING_DOC) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

      await service.updateDocument("d1", { content: "Old Content", updatedBy: "u1" });
      expect(mockTx.documentVersion.create).not.toHaveBeenCalled();
    });

    it("creates version snapshot when title changes (even without content change)", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(EXISTING_DOC);

      const mockTx = {
        documentVersion: { create: jest.fn().mockResolvedValue({}) },
        document: { update: jest.fn().mockResolvedValue({ ...EXISTING_DOC, title: "New Title", version: 2 }) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

      await service.updateDocument("d1", { title: "New Title", slug: "new-title", updatedBy: "u1" });
      expect(mockTx.documentVersion.create).toHaveBeenCalled();
    });
  });

  describe("deleteDocument", () => {
    it("throws NotFoundError when document not found", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteDocument("nonexistent")).rejects.toThrow(NotFoundError);
    });

    it("deletes existing document", async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({ id: "d1" });
      (prisma.document.delete as jest.Mock).mockResolvedValue({ id: "d1" });
      await service.deleteDocument("d1");
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    });
  });

  describe("listDocuments", () => {
    it("applies parentId filter", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
      await service.listDocuments({ parentId: "p1" });
      expect(prisma.document.findMany).toHaveBeenCalled();
    });

    it("applies search filter", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
      await service.listDocuments({ search: "test" });
      expect(prisma.document.findMany).toHaveBeenCalled();
    });

    it("handles null parentId filter", async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
      await service.listDocuments({ parentId: null });
      expect(prisma.document.findMany).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DeliverableService — branch coverage targets (uncovered lines 78, 104)
// ═══════════════════════════════════════════════════════════════════════════

describe("DeliverableService — branch coverage", () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: DeliverableService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DeliverableService(prisma as never);
  });

  describe("createDeliverable", () => {
    it("throws ValidationError when title is empty", async () => {
      await expect(
        service.createDeliverable({ title: "  ", type: "DOCUMENT" })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when type is empty", async () => {
      await expect(
        service.createDeliverable({ title: "Valid Title", type: "  " })
      ).rejects.toThrow(ValidationError);
    });

    it("creates deliverable with all optional fields", async () => {
      (prisma.deliverable.create as jest.Mock).mockResolvedValue({ id: "d1" });
      await service.createDeliverable({
        title: "Doc 1",
        type: "DOCUMENT",
        taskId: "t1",
        kpiId: "k1",
        annualPlanId: "ap1",
        monthlyGoalId: "mg1",
        attachmentUrl: "http://example.com/file.pdf",
      });
      expect(prisma.deliverable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: "t1",
            kpiId: "k1",
          }),
        })
      );
    });

    it("sets optional fields to null when not provided", async () => {
      (prisma.deliverable.create as jest.Mock).mockResolvedValue({ id: "d1" });
      await service.createDeliverable({ title: "Doc", type: "REPORT" });
      const callData = (prisma.deliverable.create as jest.Mock).mock.calls[0][0].data;
      expect(callData.taskId).toBeNull();
      expect(callData.kpiId).toBeNull();
      expect(callData.attachmentUrl).toBeNull();
    });
  });

  describe("updateDeliverable", () => {
    const EXISTING = { id: "d1", title: "Old Title", status: "NOT_STARTED" };

    it("throws NotFoundError when not found", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.updateDeliverable("x", { title: "T" })).rejects.toThrow(NotFoundError);
    });

    it("updates acceptedAt with Date conversion", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(EXISTING);
      (prisma.deliverable.update as jest.Mock).mockResolvedValue(EXISTING);
      await service.updateDeliverable("d1", { acceptedAt: "2026-03-20T00:00:00Z" });
      const callData = (prisma.deliverable.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.acceptedAt).toBeInstanceOf(Date);
    });

    it("sets acceptedAt to null when cleared", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(EXISTING);
      (prisma.deliverable.update as jest.Mock).mockResolvedValue(EXISTING);
      await service.updateDeliverable("d1", { acceptedAt: null });
      const callData = (prisma.deliverable.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.acceptedAt).toBeNull();
    });

    it("updates attachmentUrl to null when cleared", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(EXISTING);
      (prisma.deliverable.update as jest.Mock).mockResolvedValue(EXISTING);
      await service.updateDeliverable("d1", { attachmentUrl: null });
      const callData = (prisma.deliverable.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.attachmentUrl).toBeNull();
    });

    it("updates all fields at once", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(EXISTING);
      (prisma.deliverable.update as jest.Mock).mockResolvedValue(EXISTING);
      await service.updateDeliverable("d1", {
        title: "New",
        status: "DELIVERED",
        attachmentUrl: "http://new.url",
        acceptedBy: "u1",
        acceptedAt: "2026-03-25T00:00:00Z",
      });
      const callData = (prisma.deliverable.update as jest.Mock).mock.calls[0][0].data;
      expect(callData.title).toBe("New");
      expect(callData.status).toBe("DELIVERED");
      expect(callData.acceptedBy).toBe("u1");
    });
  });

  describe("listDeliverables", () => {
    beforeEach(() => {
      (prisma.deliverable.findMany as jest.Mock).mockResolvedValue([]);
    });

    it("applies all filter fields", async () => {
      await service.listDeliverables({
        taskId: "t1",
        kpiId: "k1",
        annualPlanId: "ap1",
        monthlyGoalId: "mg1",
        status: "DELIVERED",
        type: "DOCUMENT",
      });
      const call = (prisma.deliverable.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.taskId).toBe("t1");
      expect(call.where.type).toBe("DOCUMENT");
    });

    it("applies no filters when empty", async () => {
      await service.listDeliverables({});
      const call = (prisma.deliverable.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({});
    });
  });

  describe("getDeliverable", () => {
    it("throws NotFoundError when not found", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getDeliverable("nonexistent")).rejects.toThrow(NotFoundError);
    });

    it("returns deliverable when found", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue({ id: "d1", title: "Found" });
      const result = await service.getDeliverable("d1");
      expect(result.title).toBe("Found");
    });
  });

  describe("deleteDeliverable", () => {
    it("throws NotFoundError when not found", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteDeliverable("x")).rejects.toThrow(NotFoundError);
    });

    it("deletes existing deliverable", async () => {
      (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue({ id: "d1" });
      (prisma.deliverable.delete as jest.Mock).mockResolvedValue({ id: "d1" });
      await service.deleteDeliverable("d1");
      expect(prisma.deliverable.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    });
  });
});
