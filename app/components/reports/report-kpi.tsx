"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function KpiReport({ year }: { year: number }) {
  const url = `/api/reports/kpi?year=${encodeURIComponent(String(year))}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { kpiId: string; title: string; category: string; target: number; actual: number; achievement: number; unit: string }[];
    year?: number;
    summary?: { total: number; achieved: number; achievementRate: number };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 報表..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title={`KPI 報表 ${year}`} description="年度 KPI 達成概況">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總項目 <strong className="text-foreground">{summary.total}</strong></span>
            <span>已達成 <strong className="text-foreground">{summary.achieved}</strong></span>
            <span>達成率 <strong className="text-foreground">{summary.achievementRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["KPI ID", "標題", "類別", "目標", "實際", "達成率(%)", "單位"]}
        rows={items.map((i) => [i.kpiId, i.title, i.category, i.target, i.actual, i.achievement, i.unit])}
      />
    </div>
  );
}
