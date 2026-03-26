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

// ── Issue #861: Custom query export ──────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  title: "標題",
  description: "描述",
  category: "分類",
  status: "狀態",
  priority: "優先級",
  dueDate: "截止日期",
  createdAt: "建立日期",
  updatedAt: "更新日期",
  estimatedHours: "預估工時",
  actualHours: "實際工時",
  assignee: "負責人",
};

const CATEGORY_LABELS: Record<string, string> = {
  PLANNED: "原始規劃",
  ADDED: "追加任務",
  INCIDENT: "突發事件",
  SUPPORT: "用戶支援",
  ADMIN: "行政庶務",
  LEARNING: "學習成長",
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "待辦",
  TODO: "待執行",
  IN_PROGRESS: "進行中",
  REVIEW: "審查中",
  DONE: "已完成",
};

export async function exportCustomQueryExcel(data: {
  fields: string[];
  tasks: Array<Record<string, unknown>>;
}) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("自訂查詢結果");

  const headers = data.fields.map((f) => FIELD_LABELS[f] ?? f);
  sheet.addRow(headers);
  applyHeaderStyle(sheet.getRow(1));

  for (const task of data.tasks) {
    const row = data.fields.map((f) => {
      const val = task[f];
      if (val === null || val === undefined) return "";
      if (f === "category") return CATEGORY_LABELS[String(val)] ?? String(val);
      if (f === "status") return STATUS_LABELS[String(val)] ?? String(val);
      if (f === "dueDate" || f === "createdAt" || f === "updatedAt") {
        return val ? formatDateTW(String(val)) : "";
      }
      if (f === "assignee" && typeof val === "object" && val !== null && "name" in val) {
        return (val as { name: string }).name;
      }
      return String(val);
    });
    sheet.addRow(row);
  }

  autoFitColumns(sheet);

  const blob = await workbookToBlob(wb);
  downloadBlob(blob, `TITAN_自訂查詢_${todayStamp()}.xlsx`);
}

export async function exportCustomQueryCsv(data: {
  fields: string[];
  tasks: Array<Record<string, unknown>>;
}) {
  const headers = data.fields.map((f) => FIELD_LABELS[f] ?? f);
  const rows = [headers.join(",")];

  for (const task of data.tasks) {
    const row = data.fields.map((f) => {
      const val = task[f];
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    rows.push(row.join(","));
  }

  const csv = rows.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `TITAN_自訂查詢_${todayStamp()}.csv`);
}
