"use client";

/**
 * TimesheetPivotTable — Issue #832 (T-5)
 *
 * Displays a person x category pivot table for weekly/monthly timesheet summaries.
 * Shows row totals (per person), column totals (per category), overtime row,
 * and grand total.
 */

import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  PLANNED_TASK: "原始規劃",
  ADDED_TASK: "追加任務",
  INCIDENT: "突發事件",
  SUPPORT: "用戶支援",
  ADMIN: "行政庶務",
  LEARNING: "學習成長",
};

export interface PivotRow {
  userId: string;
  userName: string;
  cells: Record<string, number>;
  total: number;
  overtimeTotal: number;
}

export interface TimesheetPivotData {
  period: { start: string; end: string; label: string };
  rows: PivotRow[];
  categories: string[];
  categoryTotals: Record<string, number>;
  grandTotal: number;
  grandOvertimeTotal: number;
}

function formatHours(h: number): string {
  if (h === 0) return "-";
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

interface TimesheetPivotTableProps {
  data: TimesheetPivotData;
  loading?: boolean;
}

export function TimesheetPivotTable({ data, loading }: TimesheetPivotTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        載入中...
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        此期間無工時紀錄
      </div>
    );
  }

  const { rows, categories, categoryTotals, grandTotal, grandOvertimeTotal } = data;

  return (
    <div className="overflow-x-auto" data-testid="pivot-table">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[120px]">
              人員
            </th>
            {categories.map((cat) => (
              <th
                key={cat}
                className="text-right px-3 py-2 font-medium text-muted-foreground min-w-[80px]"
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </th>
            ))}
            <th className="text-right px-3 py-2 font-semibold text-foreground min-w-[80px] border-l border-border">
              合計
            </th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground min-w-[80px]">
              加班
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.userId}
              className={cn(
                "border-b border-border/50 hover:bg-accent/30 transition-colors",
                idx % 2 === 1 && "bg-muted/10"
              )}
            >
              <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card z-10">
                {row.userName}
              </td>
              {categories.map((cat) => (
                <td key={cat} className="text-right px-3 py-2 tabular-nums text-foreground">
                  {formatHours(row.cells[cat] ?? 0)}
                </td>
              ))}
              <td className="text-right px-3 py-2 tabular-nums font-semibold text-foreground border-l border-border">
                {formatHours(row.total)}
              </td>
              <td className={cn(
                "text-right px-3 py-2 tabular-nums",
                row.overtimeTotal > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"
              )}>
                {formatHours(row.overtimeTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/30 font-semibold">
            <td className="px-3 py-2 text-foreground sticky left-0 bg-muted/30 z-10">
              合計
            </td>
            {categories.map((cat) => (
              <td key={cat} className="text-right px-3 py-2 tabular-nums text-foreground">
                {formatHours(categoryTotals[cat] ?? 0)}
              </td>
            ))}
            <td className="text-right px-3 py-2 tabular-nums text-foreground border-l border-border">
              {formatHours(grandTotal)}
            </td>
            <td className={cn(
              "text-right px-3 py-2 tabular-nums",
              grandOvertimeTotal > 0 ? "text-amber-500" : "text-muted-foreground"
            )}>
              {formatHours(grandOvertimeTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
