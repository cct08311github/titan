import * as XLSX from "xlsx";
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
   * Parses an xlsx Buffer and returns an array of raw row objects.
   * Throws if the buffer cannot be read as a valid xlsx workbook.
   */
  parseExcel(buffer: Buffer): ParsedRow[] {
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

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    } catch {
      throw new Error("無效的 Excel 檔案格式");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Excel 檔案沒有工作表");
    }

    // Verify the workbook has valid sheet data (not just noise parsed as empty)
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet["!ref"];
    if (!ref) {
      throw new Error("無效的 Excel 檔案格式：工作表為空");
    }

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    return raw.map((r): ParsedRow => ({
      title: String(r["title"] ?? "").trim(),
      description: r["description"] !== undefined ? String(r["description"]).trim() : "",
      assigneeEmail: r["assigneeEmail"] !== undefined ? String(r["assigneeEmail"]).trim() : "",
      status: r["status"] !== undefined ? String(r["status"]).trim() : undefined,
      priority: r["priority"] !== undefined ? String(r["priority"]).trim() : undefined,
      category: r["category"] !== undefined ? String(r["category"]).trim() : undefined,
      dueDate: r["dueDate"] !== undefined && r["dueDate"] !== "" ? String(r["dueDate"]).trim() : undefined,
      estimatedHours:
        r["estimatedHours"] !== undefined && r["estimatedHours"] !== ""
          ? Number(r["estimatedHours"])
          : undefined,
    }));
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
    let created = 0;

    // Validate all rows first
    const validationErrors = this.validateRows(rows);
    const invalidIndices = new Set(validationErrors.map((e) => e.rowIndex));
    errors.push(...validationErrors);

    for (let i = 0; i < rows.length; i++) {
      if (invalidIndices.has(i)) continue;

      const row = rows[i];

      // Resolve assignee by email (optional)
      let primaryAssigneeId: string | null = null;
      if (row.assigneeEmail) {
        const user = await this.prisma.user.findUnique({
          where: { email: row.assigneeEmail },
          select: { id: true },
        });
        if (user) {
          primaryAssigneeId = user.id;
        }
        // If email provided but not found, we skip assignment silently (no hard error)
      }

      try {
        await this.prisma.task.create({
          data: {
            title: row.title,
            description: row.description || undefined,
            status: (row.status ?? "BACKLOG") as never,
            priority: (row.priority ?? "P2") as never,
            category: (row.category ?? "PLANNED") as never,
            primaryAssigneeId,
            creatorId,
            dueDate: row.dueDate ? new Date(row.dueDate) : null,
            estimatedHours:
              row.estimatedHours !== undefined && !isNaN(row.estimatedHours)
                ? row.estimatedHours
                : null,
          },
        });
        created++;
      } catch (err) {
        errors.push({
          rowIndex: i,
          message: err instanceof Error ? err.message : "建立任務失敗",
        });
      }
    }

    return { created, errors };
  }
}
