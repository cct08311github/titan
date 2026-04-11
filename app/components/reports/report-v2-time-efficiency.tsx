"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2TimeEfficiencyReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/time-efficiency?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; estimatedHours: number; actualHours: number; efficiency: number; completedTasks: number }[];
      summary?: { avgEfficiency: number; totalEstimated: number; totalActual: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入時間效率..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="時間效率分析" description="預估 vs 實際工時效率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>平均效率 <strong className="text-foreground">{summary.avgEfficiency}%</strong></span>
            <span>預估總計 <strong className="text-foreground">{summary.totalEstimated}h</strong></span>
            <span>實際總計 <strong className="text-foreground">{summary.totalActual}h</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "預估工時(h)", "實際工時(h)", "效率(%)", "完成任務"]}
        rows={items.map((i) => [i.userId, i.userName, i.estimatedHours, i.actualHours, i.efficiency, i.completedTasks])}
      />
    </div>
  );
}
