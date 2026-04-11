"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function TimesheetComplianceReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/timesheet-compliance?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { userId: string; userName: string; submittedWeeks: number; totalWeeks: number; complianceRate: number }[];
    summary?: { avgComplianceRate: number; fullyCompliant: number; total: number };
  }>(url);

  if (loading) return <ReportLoading message="載入工時合規..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="工時合規報表" description="工時填報合規統計">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>完全合規 <strong className="text-foreground">{summary.fullyCompliant}/{summary.total}</strong></span>
            <span>平均合規率 <strong className="text-foreground">{summary.avgComplianceRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "已提交週數", "總週數", "合規率(%)"]}
        rows={items.map((i) => [i.userId, i.userName, i.submittedWeeks, i.totalWeeks, i.complianceRate])}
      />
    </div>
  );
}
