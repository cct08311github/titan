"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2KpiCorrelationReport({ year }: { year: number }) {
  const url = `/api/reports/v2/kpi-correlation?year=${encodeURIComponent(String(year))}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      year?: number;
      pairs?: { kpi1: string; kpi2: string; correlation: number; strength: string }[];
    };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 相關性..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const pairs = data?.data?.pairs ?? [];

  return (
    <div>
      <ReportHeader title={`KPI 相關性分析 ${year}`} description="KPI 指標間的相關係數" />
      <GenericReportTable
        headers={["KPI 1", "KPI 2", "相關係數", "強度"]}
        rows={pairs.map((p) => [p.kpi1, p.kpi2, p.correlation, p.strength])}
      />
    </div>
  );
}
