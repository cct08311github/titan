import ExcelJS from "exceljs";
import { ImportService, ParsedRow } from "../import-service";
import { createMockPrisma } from "../../lib/test-utils";

/**
 * Helper: build an in-memory .xlsx buffer with the given rows using exceljs.
 * The first element of `rows` is treated as the header row.
 */
async function buildXlsxBuffer(rows: (string | number | undefined)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Tasks");
  for (const row of rows) {
    worksheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

const HEADER = [
  "title",
  "description",
  "assigneeEmail",
  "status",
  "priority",
  "category",
  "dueDate",
  "estimatedHours",
];

describe("ImportService", () => {
  let service: ImportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ImportService(prisma as never);
  });

  // ------------------------------------------------------------------ parseExcel

  describe("parseExcel", () => {
    test("parseExcel extracts rows correctly", async () => {
      const buf = await buildXlsxBuffer([
        HEADER,
        ["Task A", "Desc A", "alice@example.com", "TODO", "P1", "PLANNED", "2026-04-01", 3],
        ["Task B", "", "bob@example.com", "IN_PROGRESS", "P2", "ADDED", "", 0],
      ]);

      const rows = await service.parseExcel(buf);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        title: "Task A",
        description: "Desc A",
        assigneeEmail: "alice@example.com",
        status: "TODO",
        priority: "P1",
        category: "PLANNED",
        dueDate: "2026-04-01",
        estimatedHours: 3,
      });
      expect(rows[1].title).toBe("Task B");
    });

    test("parseExcel rejects invalid file format", async () => {
      const notXlsx = Buffer.from("this is not an xlsx file");
      await expect(service.parseExcel(notXlsx)).rejects.toThrow();
    });
  });

  // ------------------------------------------------------------------ validateRows

  describe("validateRows", () => {
    test("validateRows checks required fields", () => {
      const rows: ParsedRow[] = [
        { title: "", description: "", assigneeEmail: "", status: "TODO", priority: "P1", category: "PLANNED" },
      ];

      const errors = service.validateRows(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].rowIndex).toBe(0);
      expect(errors[0].message).toMatch(/title/i);
    });

    test("validateRows rejects invalid status", () => {
      const rows: ParsedRow[] = [
        { title: "Valid", description: "", assigneeEmail: "", status: "INVALID_STATUS", priority: "P1", category: "PLANNED" },
      ];

      const errors = service.validateRows(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toMatch(/status/i);
    });

    test("validateRows rejects invalid priority", () => {
      const rows: ParsedRow[] = [
        { title: "Valid", description: "", assigneeEmail: "", status: "TODO", priority: "P99", category: "PLANNED" },
      ];

      const errors = service.validateRows(rows);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toMatch(/priority/i);
    });

    test("validateRows returns empty array for valid rows", () => {
      const rows: ParsedRow[] = [
        { title: "Good Task", description: "Desc", assigneeEmail: "a@b.com", status: "TODO", priority: "P2", category: "PLANNED" },
      ];

      const errors = service.validateRows(rows);

      expect(errors).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------ importTasks

  describe("importTasks", () => {
    const validRows: ParsedRow[] = [
      { title: "Task 1", description: "", assigneeEmail: "a@b.com", status: "TODO", priority: "P1", category: "PLANNED" },
      { title: "Task 2", description: "", assigneeEmail: "b@c.com", status: "BACKLOG", priority: "P2", category: "ADDED" },
    ];

    test("importTasks creates tasks in batch", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });
      (prisma.task.create as jest.Mock).mockResolvedValue({ id: "task-1" });

      await service.importTasks(validRows, "creator-1");

      expect(prisma.task.create).toHaveBeenCalledTimes(validRows.length);
    });

    test("importTasks returns count and errors", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });
      (prisma.task.create as jest.Mock).mockResolvedValue({ id: "task-1" });

      const result = await service.importTasks(validRows, "creator-1");

      expect(result).toMatchObject({ created: 2, errors: [] });
    });

    test("importTasks skips invalid rows and reports them", async () => {
      const mixedRows: ParsedRow[] = [
        { title: "Good Task", description: "", assigneeEmail: "", status: "TODO", priority: "P2", category: "PLANNED" },
        { title: "", description: "", assigneeEmail: "", status: "TODO", priority: "P2", category: "PLANNED" }, // invalid: no title
      ];

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.task.create as jest.Mock).mockResolvedValue({ id: "task-1" });

      const result = await service.importTasks(mixedRows, "creator-1");

      expect(result.created).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].rowIndex).toBe(1);
    });
  });
});
