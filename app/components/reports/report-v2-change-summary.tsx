"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable, flattenToTable } from "./report-shared";

export function V2ChangeSummaryReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/change-summary?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: { items?: Record<string, unknown>[]; summary?: Record<string, unknown> };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入變更摘要..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = (data?.data?.items ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="變更摘要" description="此期間的任務/計畫變更記錄">
        {data?.meta?.total !== undefined && (
          <span className="text-xs text-muted-foreground">共 {data.meta.total} 筆</span>
        )}
      </ReportHeader>
      <GenericReportTable headers={headers} rows={rows} />
    </div>
  );
}
