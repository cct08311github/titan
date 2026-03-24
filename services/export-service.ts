import ExcelJS from "exceljs";

export interface ExportColumn {
  header: string;
  key: string;
}

export interface ExportResult {
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

export class ExportService {
  /**
   * Generates an XLSX buffer from an array of data objects and column definitions.
   */
  async generateExcel(data: Record<string, unknown>[], columns: ExportColumn[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");

    worksheet.columns = columns.map((c) => ({ header: c.header, key: c.key }));

    for (const row of data) {
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        rowData[col.key] = row[col.key] ?? "";
      }
      worksheet.addRow(rowData);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generates a printable HTML string from data and a template title.
   * The returned HTML includes @media print styles so it can be saved/printed as PDF.
   */
  generatePDF(data: Record<string, unknown>[], template: string): string {
    const keys = data.length > 0 ? Object.keys(data[0]) : [];

    const headerCells = keys.map((k) => `<th>${escapeHtml(String(k))}</th>`).join("");
    const bodyRows = data
      .map((row) => {
        const cells = keys.map((k) => `<td>${escapeHtml(String(row[k] ?? ""))}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(template)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { font-size: 1.4rem; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 0.875rem; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    @media print {
      body { margin: 0; }
      button, nav { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(template)}</h1>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</body>
</html>`;
  }

  // ── Report-specific formatters ─────────────────────────────────────────────

  exportWeeklyReport(input: {
    weekStart: string;
    weekEnd: string;
    completedTasks: Array<{
      id: string;
      title: string;
      primaryAssignee?: { name: string } | null;
      updatedAt: Date;
    }>;
    totalHours: number;
    hoursByCategory: Record<string, number>;
  }): ExportResult {
    const columns: ExportColumn[] = [
      { header: "Task ID", key: "id" },
      { header: "Title", key: "title" },
      { header: "Assignee", key: "assignee" },
      { header: "Completed At", key: "completedAt" },
    ];

    const rows = input.completedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      assignee: t.primaryAssignee?.name ?? "",
      completedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString().split("T")[0] : String(t.updatedAt),
    }));

    return {
      title: `Weekly Report: ${input.weekStart} – ${input.weekEnd}`,
      columns,
      rows,
    };
  }

  exportMonthlyReport(input: {
    year: number;
    month: number;
    totalTasks: number;
    doneTasks: number;
    completionRate: number;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate?: Date | null;
    }>;
  }): ExportResult {
    const columns: ExportColumn[] = [
      { header: "Task ID", key: "id" },
      { header: "Title", key: "title" },
      { header: "Status", key: "status" },
      { header: "Priority", key: "priority" },
      { header: "Due Date", key: "dueDate" },
    ];

    const rows = input.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString().split("T")[0] : (t.dueDate ?? ""),
    }));

    const monthStr = String(input.month).padStart(2, "0");
    return {
      title: `Monthly Report: ${input.year}-${monthStr}`,
      columns,
      rows,
    };
  }

  exportKPIReport(input: {
    year: number;
    avgAchievement: number;
    achievedCount: number;
    totalCount: number;
    kpis: Array<{
      id: string;
      code: string;
      title: string;
      target: number;
      actual: number;
      achievementRate: number;
    }>;
  }): ExportResult {
    const columns: ExportColumn[] = [
      { header: "Code", key: "code" },
      { header: "Title", key: "title" },
      { header: "Target", key: "target" },
      { header: "Actual", key: "actual" },
      { header: "Achievement Rate (%)", key: "achievementRate" },
    ];

    const rows = input.kpis.map((k) => ({
      code: k.code,
      title: k.title,
      target: k.target,
      actual: k.actual,
      achievementRate: k.achievementRate,
    }));

    return {
      title: `KPI Report: ${input.year}`,
      columns,
      rows,
    };
  }

  exportWorkloadReport(input: {
    startDate: string;
    endDate: string;
    totalHours: number;
    plannedHours: number;
    unplannedHours: number;
    byPerson: Array<{
      userId: string;
      name: string;
      total: number;
      planned: number;
      unplanned: number;
    }>;
  }): ExportResult {
    const columns: ExportColumn[] = [
      { header: "Member", key: "name" },
      { header: "Total Hours", key: "total" },
      { header: "Planned Hours", key: "planned" },
      { header: "Unplanned Hours", key: "unplanned" },
    ];

    const rows = input.byPerson.map((p) => ({
      name: p.name,
      total: p.total,
      planned: p.planned,
      unplanned: p.unplanned,
    }));

    return {
      title: `Workload Report: ${input.startDate} – ${input.endDate}`,
      columns,
      rows,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
