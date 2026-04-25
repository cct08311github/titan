"use client";

/**
 * MonthlyPivotReport — Issue #1539-3 (from #1538 audit)
 *
 * Person × Category pivot table view of the monthly timesheet summary.
 * Replaces the "月報摘要" tab that previously lived inside /timesheet.
 */

import { useReportData, ReportLoading, ReportError, ReportHeader } from "./report-shared";
import { TimesheetPivotTable, type TimesheetPivotData } from "../timesheet-pivot-table";

export function MonthlyPivotReport({ from }: { from: string }) {
  // Derive YYYY-MM from the from date
  const month = from.substring(0, 7);
  const url = `/api/reports/monthly?view=pivot&month=${encodeURIComponent(month)}`;
  const { data, loading, error, reload } = useReportData<TimesheetPivotData>(url);

  if (loading) return <ReportLoading message="載入月報摘要..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  return (
    <div>
      <ReportHeader
        title={`月報摘要 ${month}`}
        description={data?.period?.label ? `期間：${data.period.label}` : "人員 × 類別 Pivot"}
      />
      <TimesheetPivotTable
        data={data ?? { period: { start: "", end: "", label: "" }, rows: [], categories: [], categoryTotals: {}, grandTotal: 0, grandOvertimeTotal: 0 }}
      />
    </div>
  );
}
