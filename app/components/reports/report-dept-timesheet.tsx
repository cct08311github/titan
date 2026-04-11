"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function DepartmentTimesheetReport({ from }: { from: string }) {
  // Use the from date as weekStart
  const weekStart = from;
  const url = `/api/reports/department-timesheet?weekStart=${encodeURIComponent(weekStart)}`;
  const { data, loading, error, reload } = useReportData<{
    departments?: { department: string; members: number; totalHours: number; avgHours: number }[];
    weekStart?: string;
    weekEnd?: string;
  }>(url);

  if (loading) return <ReportLoading message="載入部門工時表..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const depts = data?.departments ?? [];

  return (
    <div>
      <ReportHeader title="部門工時表" description={`週次：${data?.weekStart ?? weekStart} ~ ${data?.weekEnd ?? ""}`} />
      <GenericReportTable
        headers={["部門", "成員人數", "總工時(h)", "平均工時(h)"]}
        rows={depts.map((d) => [d.department, d.members, d.totalHours, d.avgHours])}
      />
    </div>
  );
}
