"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable, flattenToTable } from "./report-shared";

export function MonthlyReport({ from }: { from: string }) {
  // Derive YYYY-MM from the from date
  const month = from.substring(0, 7);
  const url = `/api/reports/monthly?month=${encodeURIComponent(month)}`;
  const { data, loading, error, reload } = useReportData<{
    month?: string;
    summary?: Record<string, unknown>;
    tasks?: Record<string, unknown>[];
    timesheets?: Record<string, unknown>[];
  }>(url);

  if (loading) return <ReportLoading message="載入月報..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const tasks = (data?.tasks ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(tasks);

  return (
    <div>
      <ReportHeader title={`月報 ${month}`} description="月度工作摘要" />
      {data?.summary && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(data.summary).map(([k, v]) => (
            <div key={k}>
              <div className="text-muted-foreground">{k}</div>
              <div className="font-medium">{String(v ?? "")}</div>
            </div>
          ))}
        </div>
      )}
      {headers.length > 0 && <GenericReportTable headers={headers} rows={rows} />}
    </div>
  );
}
