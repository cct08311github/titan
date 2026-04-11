"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2OvertimeAnalysisReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/overtime-analysis?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; regularHours: number; overtimeHours: number; holidayHours: number; total: number }[];
      summary?: { totalOvertime: number; avgOvertimePerPerson: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入加班分析 v2..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="加班分析 v2" description="詳細加班工時分析">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總加班時數 <strong className="text-foreground">{summary.totalOvertime}h</strong></span>
            <span>人均加班 <strong className="text-foreground">{summary.avgOvertimePerPerson}h</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "正常工時(h)", "加班工時(h)", "假日工時(h)", "合計(h)"]}
        rows={items.map((i) => [i.userId, i.userName, i.regularHours, i.overtimeHours, i.holidayHours, i.total])}
      />
    </div>
  );
}
