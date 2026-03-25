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

// ─── KPI Import Types ────────────────────────────────────────────────────────

const VALID_KPI_STATUSES = ["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"] as const;

export interface ParsedKPIRow {
  code: string;
  title: string;
  description?: string;
  year: number;
  target: number;
  actual?: number;
  weight?: number;
  status?: string;
}

// ─── Plan Import Types ───────────────────────────────────────────────────────

export interface ParsedPlanRow {
  year: number;
  title: string;
  description?: string;
  implementationPlan?: string;
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

  // ─── KPI Import ──────────────────────────────────────────────────────────────

  /**
   * Parses an xlsx Buffer into KPI rows.
   * Expected headers: code | title | description | year | target | actual | weight | status
   */
  async parseKPIExcel(buffer: Buffer): Promise<ParsedKPIRow[]> {
    const rawRows = await this.parseGenericRows(buffer);
    return rawRows.map((r) => ({
      code: String(r["code"] ?? "").trim(),
      title: String(r["title"] ?? "").trim(),
      description: r["description"] ? String(r["description"]).trim() : undefined,
      year: Number(r["year"]) || new Date().getFullYear(),
      target: Number(r["target"]) || 0,
      actual: r["actual"] !== undefined && r["actual"] !== "" ? Number(r["actual"]) : undefined,
      weight: r["weight"] !== undefined && r["weight"] !== "" ? Number(r["weight"]) : undefined,
      status: r["status"] ? String(r["status"]).trim() : undefined,
    }));
  }

  /**
   * Validates and imports KPI rows into the database.
   */
  async importKPIs(rows: ParsedKPIRow[], creatorId: string): Promise<ImportResult> {
    const errors: RowValidationError[] = [];

    rows.forEach((row, i) => {
      if (!row.code) {
        errors.push({ rowIndex: i, message: "code 為必填欄位" });
      }
      if (!row.title) {
        errors.push({ rowIndex: i, message: "title 為必填欄位" });
      }
      if (!row.year || row.year < 2000 || row.year > 2100) {
        errors.push({ rowIndex: i, message: "year 無效（需介於 2000-2100）" });
      }
      if (row.target <= 0) {
        errors.push({ rowIndex: i, message: "target 必須大於 0" });
      }
      if (row.status && !(VALID_KPI_STATUSES as readonly string[]).includes(row.status)) {
        errors.push({
          rowIndex: i,
          message: `status 無效：${row.status}（允許值：${VALID_KPI_STATUSES.join(", ")}）`,
        });
      }
    });

    const invalidIndices = new Set(errors.map((e) => e.rowIndex));
    const validRows = rows.filter((_, i) => !invalidIndices.has(i));

    if (validRows.length === 0) {
      return { created: 0, errors };
    }

    const kpiData = validRows.map((row) => ({
      code: row.code,
      title: row.title,
      description: row.description ?? null,
      year: row.year,
      target: row.target,
      actual: row.actual ?? 0,
      weight: row.weight ?? 1,
      status: (row.status ?? "ACTIVE") as "DRAFT" | "ACTIVE" | "ACHIEVED" | "MISSED" | "CANCELLED",
      createdBy: creatorId,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      return tx.kPI.createMany({ data: kpiData, skipDuplicates: true });
    });

    return { created: result.count, errors };
  }

  // ─── Plan Import ─────────────────────────────────────────────────────────────

  /**
   * Parses an xlsx Buffer into Plan rows.
   * Expected headers: year | title | description | implementationPlan
   */
  async parsePlanExcel(buffer: Buffer): Promise<ParsedPlanRow[]> {
    const rawRows = await this.parseGenericRows(buffer);
    return rawRows.map((r) => ({
      year: Number(r["year"]) || new Date().getFullYear(),
      title: String(r["title"] ?? "").trim(),
      description: r["description"] ? String(r["description"]).trim() : undefined,
      implementationPlan: r["implementationPlan"]
        ? String(r["implementationPlan"]).trim()
        : undefined,
    }));
  }

  /**
   * Validates and imports Plan rows into the database.
   */
  async importPlans(rows: ParsedPlanRow[], creatorId: string): Promise<ImportResult> {
    const errors: RowValidationError[] = [];

    rows.forEach((row, i) => {
      if (!row.title) {
        errors.push({ rowIndex: i, message: "title 為必填欄位" });
      }
      if (!row.year || row.year < 2000 || row.year > 2100) {
        errors.push({ rowIndex: i, message: "year 無效（需介於 2000-2100）" });
      }
    });

    const invalidIndices = new Set(errors.map((e) => e.rowIndex));
    const validRows = rows.filter((_, i) => !invalidIndices.has(i));

    if (validRows.length === 0) {
      return { created: 0, errors };
    }

    const planData = validRows.map((row) => ({
      year: row.year,
      title: row.title,
      description: row.description ?? null,
      implementationPlan: row.implementationPlan ?? null,
      createdBy: creatorId,
    }));

    // Use individual creates to handle unique constraint on year gracefully
    let created = 0;
    for (const data of planData) {
      try {
        await this.prisma.annualPlan.create({ data });
        created++;
      } catch (err) {
        // Unique constraint violation on year — skip duplicate
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Unique constraint")) {
          errors.push({
            rowIndex: planData.indexOf(data),
            message: `年度 ${data.year} 的計畫已存在`,
          });
        } else {
          throw err;
        }
      }
    }

    return { created, errors };
  }

  // ─── Generic Row Parser ────────────────────────────────────────────────────

  /**
   * Parses an xlsx buffer into an array of key-value objects using header row.
   * Shared by all import methods.
   */
  private async parseGenericRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
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
    if (!worksheet || worksheet.rowCount === 0) {
      throw new Error("無效的 Excel 檔案格式：工作表為空");
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    if (headers.length === 0) {
      throw new Error("無效的 Excel 檔案格式：工作表為空");
    }

    const rows: Record<string, unknown>[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const r: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) r[header] = cell.value;
      });
      rows.push(r);
    });

    return rows;
  }
}
