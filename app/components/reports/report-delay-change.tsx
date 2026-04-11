"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function DelayChangeReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/delay-change?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { taskId: string; title: string; originalDue: string; newDue: string; delayDays: number; reason?: string }[];
    summary?: { totalDelayed: number; avgDelayDays: number };
  }>(url);

  if (loading) return <ReportLoading message="載入延遲分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="延遲變化分析" description="此期間發生延遲的任務明細">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>延遲任務 <strong className="text-foreground">{summary.totalDelayed}</strong></span>
            <span>平均延遲 <strong className="text-foreground">{summary.avgDelayDays} 天</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["任務 ID", "標題", "原截止", "新截止", "延遲天數", "原因"]}
        rows={items.map((i) => [i.taskId, i.title, i.originalDue, i.newDue, i.delayDays, i.reason ?? ""])}
      />
    </div>
  );
}
