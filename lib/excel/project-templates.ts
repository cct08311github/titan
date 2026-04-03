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

// ── Quarterly Report ─────────────────────────────────────────────────────

interface QuarterlyReportRow extends ProjectExportRow {
  riskLevel: string | null;
}

export async function generateQuarterlyReport(
  projects: QuarterlyReportRow[],
  quarter: number,
  year: number
): Promise<Buffer> {
  // Filter projects that overlap with the quarter date range
  const quarterStart = new Date(year, (quarter - 1) * 3, 1);
  const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59);
  const filtered = projects.filter(p => {
    const start = p.plannedStart ? new Date(p.plannedStart) : null;
    const end = p.plannedEnd ? new Date(p.plannedEnd) : null;
    // Include if project's date range overlaps with the quarter
    if (!start && !end) return true; // no dates = include
    if (start && start > quarterEnd) return false;
    if (end && end < quarterStart) return false;
    return true;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "TITAN PMO";
  wb.created = new Date();

  const RISK_LABELS: Record<string, string> = {
    LOW: "低", MEDIUM: "中", HIGH: "高", CRITICAL: "極高",
  };

  // ── Sheet 1: 摘要 ──────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("摘要");

  // Row 1: Title
  ws1.mergeCells("A1:F1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = "○○銀行 IT 項目管理季報";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(1).height = 36;

  // Row 2: Subtitle
  ws1.mergeCells("A2:F2");
  const subtitleCell = ws1.getCell("A2");
  subtitleCell.value = `${year} Q${quarter}`;
  subtitleCell.font = { size: 12, color: { argb: "FF808080" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(2).height = 24;

  // Row 4-7: Summary stats
  const completed = filtered.filter((p) => ["COMPLETED", "CLOSED"].includes(p.status)).length;
  const totalBudget = filtered.reduce((s, p) => s + (p.budgetTotal ?? 0), 0);
  const totalActual = filtered.reduce((s, p) => s + (p.budgetActual ?? 0), 0);
  const executionRate = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const avgBenefit = filtered.length > 0
    ? Math.round(filtered.reduce((s, p) => s + (p.benefitScore ?? 0), 0) / filtered.length)
    : 0;

  const summaryStats: [string, string | number][] = [
    ["項目總數", filtered.length],
    ["已完成", completed],
    ["預算執行率", `${executionRate}%`],
    ["平均效益分", avgBenefit],
  ];

  ws1.getColumn(1).width = 20;
  ws1.getColumn(2).width = 20;

  summaryStats.forEach(([label, value], i) => {
    const row = ws1.getRow(4 + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  // Row 9: Status distribution table
  const statusRow = 9;
  ws1.getRow(statusRow).getCell(1).value = "狀態分佈";
  ws1.getRow(statusRow).getCell(1).font = { bold: true, size: 11 };

  const statusHeaderRow = ws1.getRow(statusRow + 1);
  statusHeaderRow.getCell(1).value = "狀態";
  statusHeaderRow.getCell(2).value = "數量";
  statusHeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
  });

  const statusCounts: Record<string, number> = {};
  filtered.forEach((p) => {
    const label = STATUS_LABELS[p.status] ?? p.status;
    statusCounts[label] = (statusCounts[label] ?? 0) + 1;
  });
  let currentRow = statusRow + 2;
  Object.entries(statusCounts).forEach(([label, count]) => {
    const row = ws1.getRow(currentRow++);
    row.getCell(1).value = label;
    row.getCell(2).value = count;
  });

  // High risk project list
  currentRow += 1;
  ws1.getRow(currentRow).getCell(1).value = "高風險項目清單";
  ws1.getRow(currentRow).getCell(1).font = { bold: true, size: 11 };
  currentRow++;

  const highRiskProjects = filtered.filter(
    (p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL"
  );

  if (highRiskProjects.length > 0) {
    const riskHeaderRow = ws1.getRow(currentRow++);
    ["編號", "名稱", "風險等級", "狀態", "進度%"].forEach((h, i) => {
      riskHeaderRow.getCell(i + 1).value = h;
      riskHeaderRow.getCell(i + 1).fill = HEADER_FILL;
      riskHeaderRow.getCell(i + 1).font = HEADER_FONT;
      riskHeaderRow.getCell(i + 1).alignment = HEADER_ALIGNMENT;
    });
    ws1.getColumn(3).width = 14;
    ws1.getColumn(4).width = 14;
    ws1.getColumn(5).width = 10;

    highRiskProjects.forEach((p) => {
      const row = ws1.getRow(currentRow++);
      row.getCell(1).value = p.code;
      row.getCell(2).value = p.name;
      row.getCell(3).value = RISK_LABELS[p.riskLevel ?? ""] ?? p.riskLevel ?? "";
      row.getCell(4).value = STATUS_LABELS[p.status] ?? p.status;
      row.getCell(5).value = p.progressPct;
    });
  } else {
    ws1.getRow(currentRow).getCell(1).value = "無高風險項目";
    ws1.getRow(currentRow).getCell(1).font = { color: { argb: "FF808080" }, italic: true };
  }

  // ── Sheet 2: 項目明細 (reuse full sheet logic) ────────────────────────
  buildFullSheet(wb, filtered, year);

  // ── Sheet 3: 效益追蹤 ─────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("效益追蹤");
  ws3.columns = [
    { header: "編號", key: "code", width: 14 },
    { header: "名稱", key: "name", width: 30 },
    { header: "效益分", key: "benefitScore", width: 10 },
    { header: "預估人天", key: "mdTotalEstimated", width: 12 },
    { header: "實際人天", key: "mdActualTotal", width: 12 },
    { header: "差異", key: "diff", width: 10 },
    { header: "預算", key: "budgetTotal", width: 14 },
    { header: "實際花費", key: "budgetActual", width: 14 },
  ];

  const ws3HeaderRow = ws3.getRow(1);
  ws3HeaderRow.height = 28;
  ws3HeaderRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = { bottom: { style: "thin", color: { argb: "FF000000" } } };
  });

  filtered.forEach((p) => {
    const est = p.mdTotalEstimated ?? 0;
    const act = p.mdActualTotal ?? 0;
    const diff = act - est;
    const row = ws3.addRow({
      code: p.code,
      name: p.name,
      benefitScore: p.benefitScore,
      mdTotalEstimated: p.mdTotalEstimated,
      mdActualTotal: p.mdActualTotal,
      diff,
      budgetTotal: p.budgetTotal,
      budgetActual: p.budgetActual,
    });

    // Color diff: negative=green, positive=red
    const diffCell = row.getCell("diff");
    if (diff < 0) {
      diffCell.font = { color: { argb: "FF008000" } };
    } else if (diff > 0) {
      diffCell.font = { color: { argb: "FFCC0000" } };
    }
  });

  ws3.getColumn("benefitScore").numFmt = "#,##0";
  ws3.getColumn("mdTotalEstimated").numFmt = "#,##0";
  ws3.getColumn("mdActualTotal").numFmt = "#,##0";
  ws3.getColumn("diff").numFmt = "#,##0";
  ws3.getColumn("budgetTotal").numFmt = "#,##0";
  ws3.getColumn("budgetActual").numFmt = "#,##0";

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Single Project Report ────────────────────────────────────────────────

interface ProjectReportData {
  code: string;
  name: string;
  year: number;
  category: string | null;
  requestDept: string;
  status: string;
  priority: string;
  owner: { name: string };
  plannedStart: Date | string | null;
  plannedEnd: Date | string | null;
  actualStart: Date | string | null;
  actualEnd: Date | string | null;
  progressPct: number;
  riskLevel: string | null;
  progressNote: string | null;

  // Man-days (10 stages)
  mdProjectMgmt: number | null;
  mdRequirements: number | null;
  mdDesign: number | null;
  mdDevelopment: number | null;
  mdTesting: number | null;
  mdDeployment: number | null;
  mdDocumentation: number | null;
  mdTraining: number | null;
  mdMaintenance: number | null;
  mdOther: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;

  // Budget
  budgetInternal: number | null;
  budgetExternal: number | null;
  budgetHardware: number | null;
  budgetLicense: number | null;
  budgetOther: number | null;
  budgetTotal: number | null;
  budgetActual: number | null;
  vendor: string | null;
  vendorAmount: number | null;

  // Benefit
  benefitScore: number | null;

  // Post-review
  postReviewSchedule: number | null;
  postReviewQuality: number | null;
  postReviewBudget: number | null;
  postReviewSatisfy: number | null;
  postReviewScore: number | null;
  lessonsLearned: string | null;
  improvements: string | null;

  // Related
  risks: Array<{
    code: string;
    title: string;
    probability: string;
    impact: string;
    status: string;
    mitigation: string | null;
  }>;
  issues: Array<{
    code: string;
    title: string;
    severity: string;
    status: string;
    resolution: string | null;
  }>;
}

export async function generateProjectReport(
  project: ProjectReportData
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TITAN PMO";
  wb.created = new Date();

  // ── Sheet 1: 基本資訊 ─────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("基本資訊");
  ws1.getColumn(1).width = 18;
  ws1.getColumn(2).width = 40;

  const kvPairs: [string, string | number | null][] = [
    ["項目編號", project.code],
    ["名稱", project.name],
    ["年度", project.year],
    ["類別", project.category],
    ["需求部門", project.requestDept],
    ["負責人", project.owner.name],
    ["狀態", STATUS_LABELS[project.status] ?? project.status],
    ["優先級", PRIORITY_LABELS[project.priority] ?? project.priority],
    ["計劃開始", toDateStr(project.plannedStart)],
    ["計劃結束", toDateStr(project.plannedEnd)],
    ["實際開始", toDateStr(project.actualStart)],
    ["實際結束", toDateStr(project.actualEnd)],
    ["進度%", project.progressPct],
    ["風險等級", project.riskLevel ?? ""],
    ["效益分", project.benefitScore],
    ["最新進展", project.progressNote],
  ];

  kvPairs.forEach(([label, value], i) => {
    const row = ws1.getRow(i + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    row.getCell(2).value = value ?? "";
  });

  // ── Sheet 2: 人天明細 ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("人天明細");
  ws2.getColumn(1).width = 18;
  ws2.getColumn(2).width = 14;
  ws2.getColumn(3).width = 14;
  ws2.getColumn(4).width = 14;

  const headerRow2 = ws2.getRow(1);
  ["階段", "預估", "實際", "差異"].forEach((h, i) => {
    headerRow2.getCell(i + 1).value = h;
    headerRow2.getCell(i + 1).fill = HEADER_FILL;
    headerRow2.getCell(i + 1).font = HEADER_FONT;
    headerRow2.getCell(i + 1).alignment = HEADER_ALIGNMENT;
  });
  headerRow2.height = 28;

  const mdStages: [string, number | null][] = [
    ["專案管理", project.mdProjectMgmt],
    ["需求分析", project.mdRequirements],
    ["系統設計", project.mdDesign],
    ["開發", project.mdDevelopment],
    ["測試", project.mdTesting],
    ["部署", project.mdDeployment],
    ["文件", project.mdDocumentation],
    ["教育訓練", project.mdTraining],
    ["維護", project.mdMaintenance],
    ["其他", project.mdOther],
  ];

  const totalActualMD = project.mdActualTotal ?? 0;
  const totalEstMD = project.mdTotalEstimated ?? 0;
  // We only have total actual, so put stages as estimated only
  mdStages.forEach(([label, estimated]) => {
    const est = estimated ?? 0;
    const row = ws2.addRow([label, est, "", ""]);
    row.getCell(2).numFmt = "#,##0";
  });

  // Total row
  const totalMDRow = ws2.addRow(["合計", totalEstMD, totalActualMD, totalActualMD - totalEstMD]);
  totalMDRow.font = { bold: true };
  totalMDRow.eachCell((cell) => {
    cell.border = { top: { style: "double", color: { argb: "FF000000" } } };
  });
  // Color diff
  const diffVal = totalActualMD - totalEstMD;
  const diffCell = totalMDRow.getCell(4);
  if (diffVal < 0) {
    diffCell.font = { bold: true, color: { argb: "FF008000" } };
  } else if (diffVal > 0) {
    diffCell.font = { bold: true, color: { argb: "FFCC0000" } };
  }

  // ── Sheet 3: 預算明細 ─────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("預算明細");
  ws3.getColumn(1).width = 18;
  ws3.getColumn(2).width = 18;

  const budgetHeaderRow = ws3.getRow(1);
  ["類別", "金額"].forEach((h, i) => {
    budgetHeaderRow.getCell(i + 1).value = h;
    budgetHeaderRow.getCell(i + 1).fill = HEADER_FILL;
    budgetHeaderRow.getCell(i + 1).font = HEADER_FONT;
    budgetHeaderRow.getCell(i + 1).alignment = HEADER_ALIGNMENT;
  });
  budgetHeaderRow.height = 28;

  const budgetItems: [string, number | null][] = [
    ["內部人力", project.budgetInternal],
    ["外包費用", project.budgetExternal],
    ["硬體設備", project.budgetHardware],
    ["軟體授權", project.budgetLicense],
    ["其他", project.budgetOther],
  ];

  budgetItems.forEach(([label, amount]) => {
    const row = ws3.addRow([label, amount ?? 0]);
    row.getCell(2).numFmt = "#,##0";
  });

  const budgetTotalRow = ws3.addRow(["預算合計", project.budgetTotal ?? 0]);
  budgetTotalRow.font = { bold: true };
  budgetTotalRow.getCell(2).numFmt = "#,##0";
  budgetTotalRow.eachCell((cell) => {
    cell.border = { top: { style: "double", color: { argb: "FF000000" } } };
  });

  const actualRow = ws3.addRow(["實際花費", project.budgetActual ?? 0]);
  actualRow.getCell(2).numFmt = "#,##0";

  // Vendor info
  if (project.vendor) {
    ws3.addRow([]);
    const vendorLabelRow = ws3.addRow(["廠商資訊", ""]);
    vendorLabelRow.getCell(1).font = { bold: true, size: 11 };
    ws3.addRow(["廠商名稱", project.vendor]);
    ws3.addRow(["廠商金額", project.vendorAmount ?? 0]);
    ws3.getRow(ws3.rowCount).getCell(2).numFmt = "#,##0";
  }

  // ── Sheet 4: 風險與議題 ───────────────────────────────────────────────
  const ws4 = wb.addWorksheet("風險與議題");

  // Risks section
  ws4.getRow(1).getCell(1).value = "風險清單";
  ws4.getRow(1).getCell(1).font = { bold: true, size: 12 };

  if (project.risks.length > 0) {
    const riskHeaders = ["編號", "標題", "可能性", "影響", "狀態", "緩解措施"];
    const riskHeaderRow = ws4.getRow(2);
    riskHeaders.forEach((h, i) => {
      riskHeaderRow.getCell(i + 1).value = h;
      riskHeaderRow.getCell(i + 1).fill = HEADER_FILL;
      riskHeaderRow.getCell(i + 1).font = HEADER_FONT;
      riskHeaderRow.getCell(i + 1).alignment = HEADER_ALIGNMENT;
    });
    riskHeaderRow.height = 28;

    ws4.getColumn(1).width = 12;
    ws4.getColumn(2).width = 28;
    ws4.getColumn(3).width = 10;
    ws4.getColumn(4).width = 10;
    ws4.getColumn(5).width = 10;
    ws4.getColumn(6).width = 36;

    project.risks.forEach((r) => {
      ws4.addRow([r.code, r.title, r.probability, r.impact, r.status, r.mitigation ?? ""]);
    });
  } else {
    ws4.getRow(2).getCell(1).value = "無風險紀錄";
    ws4.getRow(2).getCell(1).font = { color: { argb: "FF808080" }, italic: true };
  }

  // Issues section
  const issueStartRow = ws4.rowCount + 2;
  ws4.getRow(issueStartRow).getCell(1).value = "議題清單";
  ws4.getRow(issueStartRow).getCell(1).font = { bold: true, size: 12 };

  if (project.issues.length > 0) {
    const issueHeaders = ["編號", "標題", "嚴重度", "狀態", "解決方案"];
    const issueHeaderRow = ws4.getRow(issueStartRow + 1);
    issueHeaders.forEach((h, i) => {
      issueHeaderRow.getCell(i + 1).value = h;
      issueHeaderRow.getCell(i + 1).fill = HEADER_FILL;
      issueHeaderRow.getCell(i + 1).font = HEADER_FONT;
      issueHeaderRow.getCell(i + 1).alignment = HEADER_ALIGNMENT;
    });
    issueHeaderRow.height = 28;

    project.issues.forEach((iss) => {
      ws4.addRow([iss.code, iss.title, iss.severity, iss.status, iss.resolution ?? ""]);
    });
  } else {
    ws4.getRow(issueStartRow + 1).getCell(1).value = "無議題紀錄";
    ws4.getRow(issueStartRow + 1).getCell(1).font = { color: { argb: "FF808080" }, italic: true };
  }

  // ── Sheet 5: 後評價 ───────────────────────────────────────────────────
  const ws5 = wb.addWorksheet("後評價");
  ws5.getColumn(1).width = 18;
  ws5.getColumn(2).width = 14;

  const postHeaderRow = ws5.getRow(1);
  ["維度", "得分 (0-25)"].forEach((h, i) => {
    postHeaderRow.getCell(i + 1).value = h;
    postHeaderRow.getCell(i + 1).fill = HEADER_FILL;
    postHeaderRow.getCell(i + 1).font = HEADER_FONT;
    postHeaderRow.getCell(i + 1).alignment = HEADER_ALIGNMENT;
  });
  postHeaderRow.height = 28;

  const dimensions: [string, number | null][] = [
    ["時程", project.postReviewSchedule],
    ["品質", project.postReviewQuality],
    ["預算", project.postReviewBudget],
    ["滿意度", project.postReviewSatisfy],
  ];

  dimensions.forEach(([label, score]) => {
    ws5.addRow([label, score ?? ""]);
  });

  const totalPostRow = ws5.addRow(["總分", project.postReviewScore ?? ""]);
  totalPostRow.font = { bold: true };
  totalPostRow.eachCell((cell) => {
    cell.border = { top: { style: "double", color: { argb: "FF000000" } } };
  });

  // Lessons learned & improvements
  ws5.addRow([]);
  const llRow = ws5.addRow(["經驗教訓", project.lessonsLearned ?? ""]);
  llRow.getCell(1).font = { bold: true };
  llRow.getCell(2).alignment = { wrapText: true };
  ws5.getColumn(2).width = 50;

  const impRow = ws5.addRow(["改善建議", project.improvements ?? ""]);
  impRow.getCell(1).font = { bold: true };
  impRow.getCell(2).alignment = { wrapText: true };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
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
