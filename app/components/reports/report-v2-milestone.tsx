"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2MilestoneAchievementReport({ year }: { year: number }) {
  const url = `/api/reports/v2/milestone-achievement?year=${encodeURIComponent(String(year))}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { milestoneId: string; title: string; planTitle: string; dueDate: string; status: string; achievedDate?: string; onTime: boolean }[];
      summary?: { total: number; achieved: number; onTime: number; achievementRate: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入里程碑達成..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title={`里程碑達成報表 ${year}`} description="里程碑按時完成情況">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總里程碑 <strong className="text-foreground">{summary.total}</strong></span>
            <span>已達成 <strong className="text-foreground">{summary.achieved}</strong></span>
            <span>準時率 <strong className="text-foreground">{summary.onTime}/{summary.achieved}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["ID", "標題", "所屬計畫", "截止日", "狀態", "完成日", "準時"]}
        rows={items.map((i) => [
          i.milestoneId,
          i.title,
          i.planTitle,
          i.dueDate,
          i.status,
          i.achievedDate ?? "—",
          i.onTime ? "✓" : "✗",
        ])}
      />
    </div>
  );
}
