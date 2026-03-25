import { PrismaClient, TimeCategory } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KimaiRow {
  date: string; // YYYY-MM-DD
  from: string; // HH:MM
  to: string; // HH:MM
  duration: number; // hours (decimal)
  rate: number;
  project: string;
  activity: string;
  description: string;
}

export interface KimaiImportResult {
  created: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses Kimai CSV export format into structured rows.
 *
 * Expected columns: Date,From,To,Duration,Rate,Project,Activity,Description
 */
export function parseKimaiCsv(content: string): KimaiRow[] {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("空檔案：CSV 內容為空");
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("沒有資料：CSV 只有標題行，沒有資料列");
  }

  // Skip header row
  const rows: KimaiRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);

    const date = fields[0] ?? "";
    if (!DATE_REGEX.test(date)) {
      throw new Error(
        `第 ${i + 1} 行日期格式無效：'${date}'（預期 YYYY-MM-DD）`
      );
    }

    rows.push({
      date,
      from: fields[1] ?? "",
      to: fields[2] ?? "",
      duration: parseFloat(fields[3] ?? "0"),
      rate: parseFloat(fields[4] ?? "0"),
      project: fields[5] ?? "",
      activity: fields[6] ?? "",
      description: fields[7] ?? "",
    });
  }

  if (rows.length === 0) {
    throw new Error("沒有資料：CSV 只有標題行，沒有資料列");
  }

  return rows;
}

// ─── Activity → Category Mapping ────────────────────────────────────────────

const ACTIVITY_CATEGORY_MAP: Record<string, TimeCategory> = {
  coding: TimeCategory.PLANNED_TASK,
  development: TimeCategory.PLANNED_TASK,
  dev: TimeCategory.PLANNED_TASK,
  implementation: TimeCategory.PLANNED_TASK,
  review: TimeCategory.PLANNED_TASK,
  meeting: TimeCategory.ADMIN,
  admin: TimeCategory.ADMIN,
  support: TimeCategory.SUPPORT,
  incident: TimeCategory.INCIDENT,
  learning: TimeCategory.LEARNING,
  training: TimeCategory.LEARNING,
};

function mapActivityToCategory(activity: string): TimeCategory {
  const normalized = activity.toLowerCase().trim();
  return ACTIVITY_CATEGORY_MAP[normalized] ?? TimeCategory.ADMIN;
}

// ─── Import Service ─────────────────────────────────────────────────────────

export class KimaiImportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Import parsed Kimai rows into TITAN time entries.
   *
   * For each row:
   * 1. Try to find a matching TITAN task by project name (case-insensitive)
   * 2. If no match, create as free time (taskId=null, category=ADMIN)
   * 3. Map Kimai activity to TITAN TimeCategory
   */
  async importRows(
    rows: KimaiRow[],
    userId: string
  ): Promise<KimaiImportResult> {
    const result: KimaiImportResult = { created: 0, errors: [] };

    await this.prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Try to match project to an existing task
          const task = await tx.task.findFirst({
            where: {
              title: { contains: row.project, mode: "insensitive" },
            },
          });

          const category = task
            ? mapActivityToCategory(row.activity)
            : TimeCategory.ADMIN;

          const description = task
            ? `[Kimai] ${row.activity}: ${row.description}`.trim()
            : `[Kimai] ${row.project} - ${row.activity}: ${row.description}`.trim();

          await tx.timeEntry.create({
            data: {
              userId,
              taskId: task?.id ?? null,
              date: new Date(row.date),
              hours: row.duration,
              category,
              description,
              startTime: row.from
                ? new Date(`${row.date}T${row.from}:00`)
                : null,
              endTime: row.to ? new Date(`${row.date}T${row.to}:00`) : null,
            },
          });

          result.created++;
        } catch (err) {
          result.errors.push({
            rowIndex: i,
            message:
              err instanceof Error ? err.message : "匯入失敗：未知錯誤",
          });
        }
      }
    });

    return result;
  }
}
