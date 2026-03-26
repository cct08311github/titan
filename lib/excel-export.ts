/**
 * Excel export utilities using exceljs — Issue #857
 *
 * Generates .xlsx files in the browser. Each export function returns
 * a Blob that can be downloaded via createObjectURL.
 */

import ExcelJS from "exceljs";

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDateTW(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF374151" } },
    };
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len, 50);
    });
    col.width = maxLen + 4;
  });
}

async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Public API ───────────────────────────────────────────────────────────

export async function exportWeeklyExcel(data: {
  period: { start: string; end: string };
  completedCount: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  overdueCount: number;
  completedTasks: Array<{ id: string; title: string; primaryAssignee?: { name: string } | null }>;
}) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: 任務清單
  const s1 = wb.addWorksheet("本週任務清單");
  s1.addRow(["標題", "負責人"]);
  applyHeaderStyle(s1.getRow(1));
  data.completedTasks.forEach((t) => {
    s1.addRow([t.title, t.primaryAssignee?.name ?? ""]);
  });
  autoFitColumns(s1);

  // Sheet 2: 工時彙總
  const s2 = wb.addWorksheet("工時分類彙總");
  s2.addRow(["分類", "工時 (h)"]);
  applyHeaderStyle(s2.getRow(1));
  Object.entries(data.hoursByCategory).forEach(([cat, hours]) => {
    s2.addRow([cat, hours]);
  });
  s2.addRow(["合計", data.totalHours]);
  autoFitColumns(s2);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_週報_${todayStamp()}.xlsx`);
}

export async function exportMonthlyExcel(data: {
  period: { year: number; month: number };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
}) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: 封面
  const s1 = wb.addWorksheet("封面");
  s1.mergeCells("A1:C1");
  const titleCell = s1.getCell("A1");
  titleCell.value = `${data.period.year} 年 ${data.period.month} 月 工作月報`;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };
  s1.addRow([]);
  s1.addRow(["指標", "數值"]);
  applyHeaderStyle(s1.getRow(3));
  s1.addRow(["總任務數", data.totalTasks]);
  s1.addRow(["完成任務數", data.completedTasks]);
  s1.addRow(["完成率", `${data.completionRate}%`]);
  s1.addRow(["總工時", `${data.totalHours} h`]);
  autoFitColumns(s1);

  // Sheet 2: 工時明細
  const s2 = wb.addWorksheet("工時分類");
  s2.addRow(["分類", "工時 (h)"]);
  applyHeaderStyle(s2.getRow(1));
  Object.entries(data.hoursByCategory).forEach(([cat, hours]) => {
    s2.addRow([cat, hours]);
  });
  s2.addRow(["合計", data.totalHours]);
  autoFitColumns(s2);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_月報_${todayStamp()}.xlsx`);
}

export async function exportKPIExcel(data: {
  year: number;
  kpis: Array<{
    code: string;
    title: string;
    target: number;
    actual: number;
    weight: number;
    status: string;
    achievementRate: number;
  }>;
}) {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("KPI 達成率一覽表");
  s1.addRow(["代碼", "名稱", "目標", "實績", "達成率", "權重", "狀態"]);
  applyHeaderStyle(s1.getRow(1));
  data.kpis.forEach((k) => {
    s1.addRow([k.code, k.title, k.target, k.actual, `${k.achievementRate}%`, k.weight, k.status]);
  });
  autoFitColumns(s1);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_KPI報表_${todayStamp()}.xlsx`);
}

export async function exportWorkloadExcel(data: {
  period: { start: string; end: string };
  totalHours: number;
  plannedHours: number;
  unplannedHours: number;
  plannedRate: number;
  unplannedRate: number;
  hoursByCategory: Record<string, number>;
}) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: 計畫外事件清單
  const s1 = wb.addWorksheet("計畫外負荷分析");
  s1.addRow(["指標", "數值"]);
  applyHeaderStyle(s1.getRow(1));
  s1.addRow(["總工時", `${data.totalHours} h`]);
  s1.addRow(["計畫內工時", `${data.plannedHours} h`]);
  s1.addRow(["計畫外工時", `${data.unplannedHours} h`]);
  s1.addRow(["計畫投入率", `${data.plannedRate}%`]);
  s1.addRow(["計畫外負荷率", `${data.unplannedRate}%`]);
  autoFitColumns(s1);

  // Sheet 2: 分類
  const s2 = wb.addWorksheet("工時分類");
  s2.addRow(["分類", "工時 (h)"]);
  applyHeaderStyle(s2.getRow(1));
  Object.entries(data.hoursByCategory).forEach(([cat, hours]) => {
    s2.addRow([cat, hours]);
  });
  autoFitColumns(s2);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_計畫外負荷_${todayStamp()}.xlsx`);
}

export async function exportTrendsExcel(data: {
  months: Array<{
    month: string;
    totalHours: number;
    completedTasks: number;
    avgCompletionRate: number;
  }>;
}) {
  const wb = new ExcelJS.Workbook();
  const s1 = wb.addWorksheet("月度趨勢數據");
  s1.addRow(["月份", "總工時", "完成任務數", "平均完成率"]);
  applyHeaderStyle(s1.getRow(1));
  data.months.forEach((m) => {
    s1.addRow([m.month, m.totalHours, m.completedTasks, `${m.avgCompletionRate}%`]);
  });
  autoFitColumns(s1);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_趨勢分析_${todayStamp()}.xlsx`);
}

export async function exportAuditPackage(data: {
  timeEntries: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  from: string;
  to: string;
}) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: 工時投入分析
  const s1 = wb.addWorksheet("工時投入分析");
  s1.addRow(["日期", "任務", "工時 (h)", "分類", "備註"]);
  applyHeaderStyle(s1.getRow(1));
  data.timeEntries.forEach((e) => {
    s1.addRow([
      e.date ? formatDateTW(String(e.date)) : "",
      e.taskTitle ?? "",
      e.hours ?? 0,
      e.category ?? "",
      e.description ?? "",
    ]);
  });
  autoFitColumns(s1);

  // Sheet 2: 任務完成清單
  const s2 = wb.addWorksheet("任務完成清單");
  s2.addRow(["標題", "分類", "狀態", "負責人", "截止日期"]);
  applyHeaderStyle(s2.getRow(1));
  data.tasks.forEach((t) => {
    s2.addRow([
      t.title ?? "",
      t.category ?? "",
      t.status ?? "",
      t.assignee ?? "",
      t.dueDate ? formatDateTW(String(t.dueDate)) : "",
    ]);
  });
  autoFitColumns(s2);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_稽核包_${todayStamp()}.xlsx`);
}
