"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2OverdueAnalysisReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/overdue-analysis?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { taskId: string; title: string; assignee: string; dueDate: string; overdueDays: number; status: string }[];
      summary?: { total: number; avgOverdueDays: number; severityBreakdown?: Record<string, number> };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入逾期分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="逾期分析" description="逾期任務明細與統計">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>逾期任務 <strong className="text-foreground">{summary.total}</strong></span>
            <span>平均逾期 <strong className="text-foreground">{summary.avgOverdueDays} 天</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["任務 ID", "標題", "負責人", "截止日", "逾期天數", "狀態"]}
        rows={items.map((i) => [i.taskId, i.title, i.assignee, i.dueDate, i.overdueDays, i.status])}
      />
    </div>
  );
}
