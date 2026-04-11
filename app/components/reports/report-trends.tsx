"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function TrendsReport({ year }: { year: number }) {
  const years = `${year - 1},${year}`;
  const url = `/api/reports/trends?metric=kpi&years=${years}`;
  const { data, loading, error, reload } = useReportData<{
    metric?: string;
    years?: number[];
    points?: { period: string; value: number; year: number }[];
  }>(url);

  if (loading) return <ReportLoading message="載入跨年趨勢..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const points = data?.points ?? [];

  return (
    <div>
      <ReportHeader title="跨年趨勢" description={`KPI 跨年度對比：${years}`} />
      <GenericReportTable
        headers={["期間", "年度", "數值"]}
        rows={points.map((p) => [p.period, p.year, p.value])}
      />
    </div>
  );
}
