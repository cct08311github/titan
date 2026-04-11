"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function WorkloadReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/workload?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { userId: string; userName: string; assignedTasks: number; completedTasks: number; pendingTasks: number; overdueTasks: number }[];
    summary?: { totalAssigned: number; totalCompleted: number };
  }>(url);

  if (loading) return <ReportLoading message="載入工作量分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="工作量分析" description="個人任務負荷分佈">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總指派 <strong className="text-foreground">{summary.totalAssigned}</strong></span>
            <span>已完成 <strong className="text-foreground">{summary.totalCompleted}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "指派任務", "已完成", "待處理", "逾期"]}
        rows={items.map((i) => [i.userId, i.userName, i.assignedTasks, i.completedTasks, i.pendingTasks, i.overdueTasks])}
      />
    </div>
  );
}
