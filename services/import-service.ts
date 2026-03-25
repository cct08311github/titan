import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

// Valid enum values mirrored from Prisma schema
const VALID_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const VALID_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const VALID_CATEGORIES = [
  "PLANNED",
  "ADDED",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
] as const;

export interface ParsedRow {
  title: string;
  description?: string;
  assigneeEmail?: string;
  status?: string;
  priority?: string;
  category?: string;
  dueDate?: string;
  estimatedHours?: number;
}

export interface RowValidationError {
  rowIndex: number;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: RowValidationError[];
}

export class ImportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Parses an xlsx Buffer asynchronously and returns an array of raw row objects.
   * Throws if the buffer cannot be read as a valid xlsx workbook.
   */
  async parseExcel(buffer: Buffer): Promise<ParsedRow[]> {
    // Validate magic bytes: xlsx is a ZIP archive starting with PK\x03\x04
    const isXlsx =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (!isXlsx) {
      throw new Error("無效的 Excel 檔案格式：必須為 .xlsx 檔案");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // @ts-expect-error ExcelJS types expect old Buffer, but new Node Buffer<ArrayBufferLike> is compatible
      await workbook.xlsx.load(buffer);
    } catch {
      throw new Error("無效的 Excel 檔案格式");
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Excel 檔案沒有工作表");
    }

    if (worksheet.rowCount === 0) {
      throw new Error("無效的 Excel 檔案格式：工作表為空");
    }

    // Extract headers from the first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    if (headers.length === 0) {
      throw new Error("無效的 Excel 檔案格式：工作表為空");
    }

    const rows: ParsedRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header row

      const r: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          r[header] = cell.value;
        }
      });

      rows.push({
        title: String(r["title"] ?? "").trim(),
        description: r["description"] !== undefined ? String(r["description"]).trim() : "",
        assigneeEmail: r["assigneeEmail"] !== undefined ? String(r["assigneeEmail"]).trim() : "",
        status: r["status"] !== undefined ? String(r["status"]).trim() : undefined,
        priority: r["priority"] !== undefined ? String(r["priority"]).trim() : undefined,
        category: r["category"] !== undefined ? String(r["category"]).trim() : undefined,
        dueDate:
          r["dueDate"] !== undefined && r["dueDate"] !== "" && r["dueDate"] !== null
            ? String(r["dueDate"]).trim()
            : undefined,
        estimatedHours:
          r["estimatedHours"] !== undefined &&
          r["estimatedHours"] !== "" &&
          r["estimatedHours"] !== null
            ? Number(r["estimatedHours"])
            : undefined,
      });
    });

    return rows;
  }

  /**
   * Validates an array of parsed rows.
   * Returns a list of RowValidationError for any invalid rows.
   */
  validateRows(rows: ParsedRow[]): RowValidationError[] {
    const errors: RowValidationError[] = [];

    rows.forEach((row, i) => {
      if (!row.title) {
        errors.push({ rowIndex: i, message: "title 為必填欄位" });
        return;
      }

      if (row.status && !(VALID_STATUSES as readonly string[]).includes(row.status)) {
        errors.push({
          rowIndex: i,
          message: `status 無效：${row.status}（允許值：${VALID_STATUSES.join(", ")}）`,
        });
      }

      if (row.priority && !(VALID_PRIORITIES as readonly string[]).includes(row.priority)) {
        errors.push({
          rowIndex: i,
          message: `priority 無效：${row.priority}（允許值：${VALID_PRIORITIES.join(", ")}）`,
        });
      }

      if (row.category && !(VALID_CATEGORIES as readonly string[]).includes(row.category)) {
        errors.push({
          rowIndex: i,
          message: `category 無效：${row.category}（允許值：${VALID_CATEGORIES.join(", ")}）`,
        });
      }
    });

    return errors;
  }

  /**
   * Imports validated rows into the database.
   * Rows that fail validation or whose assigneeEmail cannot be resolved are skipped.
   * Returns a summary of how many tasks were created and any per-row errors.
   */
  async importTasks(rows: ParsedRow[], creatorId: string): Promise<ImportResult> {
    const errors: RowValidationError[] = [];

    // Validate all rows first
    const validationErrors = this.validateRows(rows);
    const invalidIndices = new Set(validationErrors.map((e) => e.rowIndex));
    errors.push(...validationErrors);

    // Collect valid rows
    const validRows = rows
      .map((row, i) => ({ row, index: i }))
      .filter(({ index }) => !invalidIndices.has(index));

    if (validRows.length === 0) {
      return { created: 0, errors };
    }

    // Batch-resolve all assignee emails in a single query
    const uniqueEmails = [
      ...new Set(
        validRows
          .map(({ row }) => row.assigneeEmail)
          .filter((email): email is string => !!email)
      ),
    ];

    const emailToUserId = new Map<string, string>();
    if (uniqueEmails.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { email: { in: uniqueEmails } },
        select: { id: true, email: true },
      });
      for (const u of users) {
        emailToUserId.set(u.email, u.id);
      }
    }

    // Build task data for batch creation
    const taskData = validRows.map(({ row }) => ({
      title: row.title,
      description: row.description || undefined,
      status: (row.status ?? "BACKLOG") as never,
      priority: (row.priority ?? "P2") as never,
      category: (row.category ?? "PLANNED") as never,
      primaryAssigneeId: row.assigneeEmail
        ? emailToUserId.get(row.assigneeEmail) ?? null
        : null,
      creatorId,
      dueDate: row.dueDate ? new Date(row.dueDate) : null,
      estimatedHours:
        row.estimatedHours !== undefined && !isNaN(row.estimatedHours)
          ? row.estimatedHours
          : null,
    }));

    // Batch create all tasks in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      return tx.task.createMany({ data: taskData });
    });

    return { created: result.count, errors };
  }
}
