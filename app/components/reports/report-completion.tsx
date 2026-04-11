"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function CompletionRateReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/completion-rate?granularity=month&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    points?: { month: string; total: number; completed: number; rate: number }[];
    summary?: { totalTasks: number; completedTasks: number; averageRate: number };
  }>(url);

  if (loading) return <ReportLoading message="載入完成率..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const points = data?.points ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="任務完成率趨勢" description="每月任務完成比率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總任務 <strong className="text-foreground">{summary.totalTasks}</strong></span>
            <span>已完成 <strong className="text-foreground">{summary.completedTasks}</strong></span>
            <span>平均完成率 <strong className="text-foreground">{summary.averageRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["月份", "總任務", "已完成", "完成率(%)"]}
        rows={points.map((p) => [p.month, p.total, p.completed, p.rate])}
      />
    </div>
  );
}
