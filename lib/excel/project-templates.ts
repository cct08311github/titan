/**
 * Excel export templates for PMO projects — Issue #1176
 *
 * Two templates:
 * - 'full': detailed project list with conditional formatting
 * - 'summary': simplified for stakeholders
 */

import ExcelJS from "exceljs";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectExportRow {
  code: string;
  name: string;
  category: string | null;
  requestDept: string;
  status: string;
  priority: string;
  benefitScore: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;
  budgetTotal: number | null;
  progressPct: number;
  owner: { name: string };
  plannedEnd: Date | string | null;
  plannedStart: Date | string | null;
  progressNote: string | null;
  nextSteps: string | null;
}

type ExportType = "full" | "summary";

// ── Status labels ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "提案",
  EVALUATING: "評估中",
  APPROVED: "已核准",
  SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析",
  DESIGN: "系統設計",
  DEVELOPMENT: "開發中",
  TESTING: "測試中",
  DEPLOYMENT: "部署中",
  WARRANTY: "保固期",
  COMPLETED: "已完成",
  POST_REVIEW: "後評價",
  CLOSED: "已關閉",
  ON_HOLD: "暫停",
  CANCELLED: "已取消",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 緊急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toDateStr(d: Date | string | null): string {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString();
  return s.split("T")[0];
}

function isOverdue(plannedEnd: Date | string | null, status: string): boolean {
  if (!plannedEnd) return false;
  if (["COMPLETED", "CLOSED", "CANCELLED"].includes(status)) return false;
  const endDate = typeof plannedEnd === "string" ? new Date(plannedEnd) : plannedEnd;
  return endDate < new Date();
}

// ── Header style ──────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  vertical: "middle",
  horizontal: "center",
  wrapText: true,
};

// ── Full template ─────────────────────────────────────────────────────────

function buildFullSheet(wb: ExcelJS.Workbook, projects: ProjectExportRow[]) {
  const ws = wb.addWorksheet("項目清單（完整）", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
  });

  // Columns
  ws.columns = [
    { header: "編號", key: "code", width: 14 },
    { header: "名稱", key: "name", width: 30 },
    { header: "類別", key: "category", width: 12 },
    { header: "需求部門", key: "requestDept", width: 14 },
    { header: "狀態", key: "status", width: 12 },
    { header: "優先級", key: "priority", width: 10 },
    { header: "效益分", key: "benefitScore", width: 10 },
    { header: "預估人天", key: "mdTotalEstimated", width: 12 },
    { header: "實際人天", key: "mdActualTotal", width: 12 },
    { header: "預算", key: "budgetTotal", width: 14 },
    { header: "進度%", key: "progressPct", width: 10 },
    { header: "負責人", key: "owner", width: 12 },
    { header: "計劃完成", key: "plannedEnd", width: 14 },
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Data rows
  projects.forEach((p) => {
    const row = ws.addRow({
      code: p.code,
      name: p.name,
      category: p.category ?? "",
      requestDept: p.requestDept,
      status: STATUS_LABELS[p.status] ?? p.status,
      priority: PRIORITY_LABELS[p.priority] ?? p.priority,
      benefitScore: p.benefitScore,
      mdTotalEstimated: p.mdTotalEstimated,
      mdActualTotal: p.mdActualTotal,
      budgetTotal: p.budgetTotal,
      progressPct: p.progressPct,
      owner: p.owner.name,
      plannedEnd: toDateStr(p.plannedEnd),
    });

    // Conditional: overdue rows get red background
    if (isOverdue(p.plannedEnd, p.status)) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDE8E8" },
        };
      });
    }

    // P0 = red text on priority cell
    if (p.priority === "P0") {
      const priorityCell = row.getCell("priority");
      priorityCell.font = { color: { argb: "FFCC0000" }, bold: true };
    }
  });

  // Auto-sum row
  if (projects.length > 0) {
    const lastDataRow = projects.length + 1;
    const sumRow = ws.addRow({
      code: "",
      name: `合計 (${projects.length} 項)`,
      category: "",
      requestDept: "",
      status: "",
      priority: "",
      benefitScore: null,
      mdTotalEstimated: null,
      mdActualTotal: null,
      budgetTotal: null,
      progressPct: null,
      owner: "",
      plannedEnd: "",
    });

    // SUM formulas for numeric columns
    const sumCols: Record<string, string> = {
      benefitScore: "G",
      mdTotalEstimated: "H",
      mdActualTotal: "I",
      budgetTotal: "J",
    };

    for (const [key, col] of Object.entries(sumCols)) {
      const cell = sumRow.getCell(key);
      cell.value = {
        formula: `SUM(${col}2:${col}${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
    }

    // AVG for progressPct
    const progressCell = sumRow.getCell("progressPct");
    progressCell.value = {
      formula: `AVERAGE(K2:K${lastDataRow})`,
    } as ExcelJS.CellFormulaValue;

    sumRow.font = { bold: true };
    sumRow.eachCell((cell) => {
      cell.border = {
        top: { style: "double", color: { argb: "FF000000" } },
      };
    });
  }

  // Number format
  ws.getColumn("benefitScore").numFmt = "#,##0";
  ws.getColumn("mdTotalEstimated").numFmt = "#,##0";
  ws.getColumn("mdActualTotal").numFmt = "#,##0";
  ws.getColumn("budgetTotal").numFmt = "#,##0";
  ws.getColumn("progressPct").numFmt = "0";

  return ws;
}

// ── Summary template ──────────────────────────────────────────────────────

function buildSummarySheet(wb: ExcelJS.Workbook, projects: ProjectExportRow[]) {
  const ws = wb.addWorksheet("項目摘要（主管）", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
  });

  ws.columns = [
    { header: "編號", key: "code", width: 14 },
    { header: "名稱", key: "name", width: 30 },
    { header: "需求部門", key: "requestDept", width: 14 },
    { header: "狀態", key: "status", width: 12 },
    { header: "進度%", key: "progressPct", width: 10 },
    { header: "預計完成", key: "plannedEnd", width: 14 },
    { header: "最新進展", key: "progressNote", width: 40 },
    { header: "下一步", key: "nextSteps", width: 40 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  projects.forEach((p) => {
    const row = ws.addRow({
      code: p.code,
      name: p.name,
      requestDept: p.requestDept,
      status: STATUS_LABELS[p.status] ?? p.status,
      progressPct: p.progressPct,
      plannedEnd: toDateStr(p.plannedEnd),
      progressNote: p.progressNote ?? "",
      nextSteps: p.nextSteps ?? "",
    });

    if (isOverdue(p.plannedEnd, p.status)) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDE8E8" },
        };
      });
    }
  });

  ws.getColumn("progressPct").numFmt = "0";
  ws.getColumn("progressNote").alignment = { wrapText: true };
  ws.getColumn("nextSteps").alignment = { wrapText: true };

  return ws;
}

// ── Main export function ──────────────────────────────────────────────────

export async function generateProjectExcel(
  projects: ProjectExportRow[],
  type: ExportType
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TITAN PMO";
  wb.created = new Date();

  if (type === "full") {
    buildFullSheet(wb, projects);
  } else {
    buildSummarySheet(wb, projects);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
