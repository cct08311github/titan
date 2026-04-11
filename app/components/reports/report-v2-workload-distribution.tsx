"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2WorkloadDistributionReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/workload-distribution?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; department: string; taskCount: number; hoursBurden: number; score: number; level: string }[];
      summary?: { avgScore: number; overloadedCount: number; underloadedCount: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入工作量分佈 v2..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="工作量分佈 v2" description="詳細工作負荷分析">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>平均負荷分數 <strong className="text-foreground">{summary.avgScore}</strong></span>
            <span>過載人數 <strong className="text-foreground">{summary.overloadedCount}</strong></span>
            <span>低負荷人數 <strong className="text-foreground">{summary.underloadedCount}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "部門", "任務數", "工時負擔(h)", "負荷分數", "負荷等級"]}
        rows={items.map((i) => [i.userId, i.userName, i.department, i.taskCount, i.hoursBurden, i.score, i.level])}
      />
    </div>
  );
}
