"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable, flattenToTable } from "./report-shared";

export function WeeklyReport({ from }: { from: string }) {
  const weekStart = from;
  const url = `/api/reports/weekly?weekStart=${encodeURIComponent(weekStart)}`;
  const { data, loading, error, reload } = useReportData<{
    weekStart?: string;
    weekEnd?: string;
    summary?: Record<string, unknown>;
    tasks?: Record<string, unknown>[];
  }>(url);

  if (loading) return <ReportLoading message="載入週報..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const tasks = (data?.tasks ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(tasks);

  return (
    <div>
      <ReportHeader title="週報" description={`週次：${data?.weekStart ?? weekStart} ~ ${data?.weekEnd ?? ""}`} />
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
