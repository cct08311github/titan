import ExcelJS from "exceljs";
import { ExportService } from "../export-service";

describe("ExportService", () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  // ── generateExcel ─────────────────────────────────────────────────────────

  test("generateExcel creates valid xlsx buffer", async () => {
    const data = [
      { name: "Alice", hours: 8, tasks: 3 },
      { name: "Bob", hours: 6, tasks: 2 },
    ];
    const columns = [
      { header: "Name", key: "name" },
      { header: "Hours", key: "hours" },
      { header: "Tasks", key: "tasks" },
    ];

    const buffer = await service.generateExcel(data, columns);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // XLSX files start with PK (zip magic bytes)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  test("generateExcel includes all report columns", async () => {
    const data = [{ col1: "val1", col2: 42, col3: true }];
    const columns = [
      { header: "Column One", key: "col1" },
      { header: "Column Two", key: "col2" },
      { header: "Column Three", key: "col3" },
    ];

    const buffer = await service.generateExcel(data, columns);

    // Parse with exceljs to verify content
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    // First row should be headers
    const headerRow = worksheet.getRow(1);
    expect(headerRow.getCell(1).value).toBe("Column One");
    expect(headerRow.getCell(2).value).toBe("Column Two");
    expect(headerRow.getCell(3).value).toBe("Column Three");

    // Second row should be data
    const dataRow = worksheet.getRow(2);
    expect(dataRow.getCell(1).value).toBe("val1");
    expect(dataRow.getCell(2).value).toBe(42);
  });

  // ── generatePDF ───────────────────────────────────────────────────────────

  test("generatePDF creates valid HTML string", () => {
    const data = [
      { name: "Alice", hours: 8 },
      { name: "Bob", hours: 6 },
    ];
    const template = "Weekly Report";

    const html = service.generatePDF(data, template);

    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain(template);
    expect(html).toContain("@media print");
  });

  // ── exportWeeklyReport ────────────────────────────────────────────────────

  test("exportWeeklyReport returns formatted data", () => {
    const input = {
      weekStart: "2026-03-16",
      weekEnd: "2026-03-22",
      completedTasks: [
        { id: "t-1", title: "Task One", primaryAssignee: { name: "Alice" }, updatedAt: new Date("2026-03-17") },
      ],
      totalHours: 32,
      hoursByCategory: { PLANNED_TASK: 24, ADDED_TASK: 8 },
    };

    const result = service.exportWeeklyReport(input);

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("columns");
    expect(Array.isArray(result.rows)).toBe(true);
    expect(Array.isArray(result.columns)).toBe(true);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toHaveProperty("title", "Task One");
  });

  // ── exportMonthlyReport ───────────────────────────────────────────────────

  test("exportMonthlyReport returns formatted data", () => {
    const input = {
      year: 2026,
      month: 3,
      totalTasks: 20,
      doneTasks: 15,
      completionRate: 75,
      tasks: [
        { id: "t-1", title: "Monthly Task", status: "DONE", priority: "HIGH", dueDate: new Date("2026-03-20") },
      ],
    };

    const result = service.exportMonthlyReport(input);

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("columns");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toHaveProperty("title", "Monthly Task");
    expect(result.rows[0]).toHaveProperty("status", "DONE");
  });

  // ── exportKPIReport ───────────────────────────────────────────────────────

  test("exportKPIReport returns formatted data", () => {
    const input = {
      year: 2026,
      avgAchievement: 82.5,
      achievedCount: 3,
      totalCount: 4,
      kpis: [
        { id: "kpi-1", code: "KPI-2026-01", title: "Revenue", target: 100, actual: 85, achievementRate: 85 },
        { id: "kpi-2", code: "KPI-2026-02", title: "Satisfaction", target: 95, actual: 96, achievementRate: 100 },
      ],
    };

    const result = service.exportKPIReport(input);

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("columns");
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toHaveProperty("code", "KPI-2026-01");
    expect(result.rows[0]).toHaveProperty("achievementRate", 85);
  });

  // ── exportWorkloadReport ──────────────────────────────────────────────────

  test("exportWorkloadReport returns formatted data", () => {
    const input = {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      totalHours: 160,
      plannedHours: 120,
      unplannedHours: 40,
      byPerson: [
        { userId: "u-1", name: "Alice", total: 80, planned: 60, unplanned: 20 },
        { userId: "u-2", name: "Bob", total: 80, planned: 60, unplanned: 20 },
      ],
    };

    const result = service.exportWorkloadReport(input);

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("columns");
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toHaveProperty("name", "Alice");
    expect(result.rows[0]).toHaveProperty("total", 80);
    expect(result.rows[0]).toHaveProperty("planned", 60);
    expect(result.rows[0]).toHaveProperty("unplanned", 20);
  });
});
