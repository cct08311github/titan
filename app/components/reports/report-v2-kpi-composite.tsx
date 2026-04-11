"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2KpiCompositeReport({ year }: { year: number }) {
  const url = `/api/reports/v2/kpi-composite?year=${encodeURIComponent(String(year))}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      year?: number;
      categories?: { category: string; kpiCount: number; avgAchievement: number; topKpi?: string }[];
      overall?: { achievementRate: number; trend: string };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 綜合..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const categories = d?.categories ?? [];
  const overall = d?.overall;

  return (
    <div>
      <ReportHeader title={`KPI 綜合報表 ${year}`} description="各類別 KPI 達成率綜合統計">
        {overall && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>整體達成率 <strong className="text-foreground">{overall.achievementRate}%</strong></span>
            <span>趨勢 <strong className="text-foreground">{overall.trend}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["類別", "KPI 數", "平均達成(%)", "最佳 KPI"]}
        rows={categories.map((c) => [c.category, c.kpiCount, c.avgAchievement, c.topKpi ?? ""])}
      />
    </div>
  );
}
