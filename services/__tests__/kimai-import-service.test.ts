/**
 * KimaiImportService tests — Issue #1309
 *
 * Covers: importRows with valid data, invalid rows, no matching task
 */

import { KimaiImportService, parseKimaiCsv, KimaiRow } from "../kimai-import-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("parseKimaiCsv", () => {
  test("parses valid CSV into rows", () => {
    const csv = [
      "Date,From,To,Duration,Rate,Project,Activity,Description",
      "2026-03-01,09:00,10:00,1.0,0,ProjectA,coding,Fixed bug",
    ].join("\n");

    const rows = parseKimaiCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-03-01",
      from: "09:00",
      to: "10:00",
      duration: 1.0,
      project: "ProjectA",
      activity: "coding",
      description: "Fixed bug",
    });
  });

  test("throws on empty content", () => {
    expect(() => parseKimaiCsv("")).toThrow("空檔案");
  });

  test("throws on invalid date format", () => {
    const csv = [
      "Date,From,To,Duration,Rate,Project,Activity,Description",
      "01/03/2026,09:00,10:00,1.0,0,ProjectA,coding,desc",
    ].join("\n");
    expect(() => parseKimaiCsv(csv)).toThrow("日期格式無效");
  });
});

describe("KimaiImportService.importRows", () => {
  let service: KimaiImportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const validRow: KimaiRow = {
    date: "2026-03-01",
    from: "09:00",
    to: "10:00",
    duration: 1.0,
    rate: 0,
    project: "ProjectA",
    activity: "coding",
    description: "Fixed bug",
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KimaiImportService(prisma as never);
  });

  test("importRows creates time entry when matching task found", async () => {
    const mockTask = { id: "task-1" };
    (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);
    (prisma.timeEntry.create as jest.Mock).mockResolvedValue({ id: "te-1" });

    const result = await service.importRows([validRow], "user-1");

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "task-1",
          userId: "user-1",
          hours: 1.0,
          category: "PLANNED_TASK",
        }),
      })
    );
  });

  test("importRows creates ADMIN entry when no matching task", async () => {
    (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.timeEntry.create as jest.Mock).mockResolvedValue({ id: "te-2" });

    const result = await service.importRows([validRow], "user-1");

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(prisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: null,
          category: "ADMIN",
        }),
      })
    );
  });

  test("importRows records error for failing row but continues others", async () => {
    (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.timeEntry.create as jest.Mock)
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValueOnce({ id: "te-3" });

    const rows: KimaiRow[] = [
      validRow,
      { ...validRow, date: "2026-03-02", description: "Second entry" },
    ];
    const result = await service.importRows(rows, "user-1");

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      rowIndex: 0,
      message: "DB write failed",
    });
  });

  test("importRows returns zero created for empty rows", async () => {
    const result = await service.importRows([], "user-1");
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });
});
