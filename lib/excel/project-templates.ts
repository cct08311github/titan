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
  budgetActual: number | null;
  progressPct: number;
  owner: { name: string };
  plannedStart: Date | string | null;
  plannedEnd: Date | string | null;
  riskLevel: string | null;
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

function buildFullSheet(wb: ExcelJS.Workbook, projects: ProjectExportRow[], year?: number) {
  const ws = wb.addWorksheet("項目清單（完整）", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
  });

  const totalCols = 17; // A–Q
  const lastColLetter = "Q";

  // ── Row 1: Title ──────────────────────────────────────────────────────
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = "○○銀行 IT 項目管理報表";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  // ── Row 2: Subtitle ───────────────────────────────────────────────────
  const reportDate = new Date().toISOString().split("T")[0];
  const reportYear = year ?? new Date().getFullYear();
  ws.mergeCells(`A2:${lastColLetter}2`);
  const subtitleCell = ws.getCell("A2");
  subtitleCell.value = `報表產出日期：${reportDate} 資料範圍：${reportYear} 年度`;
  subtitleCell.font = { size: 10, color: { argb: "FF808080" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 22;

  // ── Row 3: Column headers ─────────────────────────────────────────────
  ws.columns = [
    { header: "", key: "code", width: 14 },
    { header: "", key: "name", width: 30 },
    { header: "", key: "category", width: 12 },
    { header: "", key: "requestDept", width: 14 },
    { header: "", key: "status", width: 12 },
    { header: "", key: "priority", width: 10 },
    { header: "", key: "benefitScore", width: 10 },
    { header: "", key: "mdTotalEstimated", width: 12 },
    { header: "", key: "mdActualTotal", width: 12 },
    { header: "", key: "budgetTotal", width: 14 },
    { header: "", key: "budgetActual", width: 14 },
    { header: "", key: "progressPct", width: 10 },
    { header: "", key: "owner", width: 12 },
    { header: "", key: "plannedStart", width: 14 },
    { header: "", key: "plannedEnd", width: 14 },
    { header: "", key: "riskLevel", width: 10 },
    { header: "", key: "progressNote", width: 36 },
  ];

  const headers = [
    "編號", "名稱", "類別", "需求部門", "狀態", "優先級",
    "效益分", "預估人天", "實際人天", "預算", "實際花費",
    "進度%", "負責人", "計劃開始", "計劃完成", "風險等級", "最新進展",
  ];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // ── Data rows ─────────────────────────────────────────────────────────

  const RISK_LABELS: Record<string, string> = {
    LOW: "低", MEDIUM: "中", HIGH: "高", CRITICAL: "極高",
  };

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
      budgetActual: p.budgetActual,
      progressPct: p.progressPct,
      owner: p.owner.name,
      plannedStart: toDateStr(p.plannedStart),
      plannedEnd: toDateStr(p.plannedEnd),
      riskLevel: p.riskLevel ? (RISK_LABELS[p.riskLevel] ?? p.riskLevel) : "",
      progressNote: p.progressNote ?? "",
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

  // ── Auto-sum row ──────────────────────────────────────────────────────
  if (projects.length > 0) {
    const firstDataRow = 4; // rows 1-2 title/subtitle, row 3 header
    const lastDataRow = firstDataRow + projects.length - 1;
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
      budgetActual: null,
      progressPct: null,
      owner: "",
      plannedStart: "",
      plannedEnd: "",
      riskLevel: "",
      progressNote: "",
    });

    // SUM formulas for numeric columns
    const sumCols: Record<string, string> = {
      benefitScore: "G",
      mdTotalEstimated: "H",
      mdActualTotal: "I",
      budgetTotal: "J",
      budgetActual: "K",
    };

    for (const [key, col] of Object.entries(sumCols)) {
      const cell = sumRow.getCell(key);
      cell.value = {
        formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})`,
      } as ExcelJS.CellFormulaValue;
    }

    // AVG for progressPct
    const progressCell = sumRow.getCell("progressPct");
    progressCell.value = {
      formula: `AVERAGE(L${firstDataRow}:L${lastDataRow})`,
    } as ExcelJS.CellFormulaValue;

    sumRow.font = { bold: true };
    sumRow.eachCell((cell) => {
      cell.border = {
        top: { style: "double", color: { argb: "FF000000" } },
      };
    });
  }

  // ── Number / date formats ─────────────────────────────────────────────
  ws.getColumn("benefitScore").numFmt = "#,##0";
  ws.getColumn("mdTotalEstimated").numFmt = "#,##0";
  ws.getColumn("mdActualTotal").numFmt = "#,##0";
  ws.getColumn("budgetTotal").numFmt = "#,##0";
  ws.getColumn("budgetActual").numFmt = "#,##0";
  ws.getColumn("progressPct").numFmt = "0";
  ws.getColumn("plannedStart").numFmt = "YYYY-MM-DD";
  ws.getColumn("progressNote").alignment = { wrapText: true };

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
