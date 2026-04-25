"use client";

/**
 * WeeklyPivotReport — Issue #1539-3 (from #1538 audit)
 *
 * Person × Category pivot table view of the weekly timesheet summary.
 * Replaces the "週報摘要" tab that previously lived inside /timesheet
 * (which was visible only to managers but cluttered the engineer-facing
 * timesheet page). Now lives where reporting belongs.
 */

import { useReportData, ReportLoading, ReportError, ReportHeader } from "./report-shared";
import { TimesheetPivotTable, type TimesheetPivotData } from "../timesheet-pivot-table";

export function WeeklyPivotReport({ from }: { from: string }) {
  const url = `/api/reports/weekly?view=pivot&weekStart=${encodeURIComponent(from)}`;
  const { data, loading, error, reload } = useReportData<TimesheetPivotData>(url);

  if (loading) return <ReportLoading message="載入週報摘要..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  return (
    <div>
      <ReportHeader
        title="週報摘要"
        description={data?.period?.label ? `期間：${data.period.label}` : "人員 × 類別 Pivot"}
      />
      <TimesheetPivotTable
        data={data ?? { period: { start: "", end: "", label: "" }, rows: [], categories: [], categoryTotals: {}, grandTotal: 0, grandOvertimeTotal: 0 }}
      />
    </div>
  );
}
