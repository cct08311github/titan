"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2PermissionAuditReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/permission-audit?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; role: string; action: string; resource: string; timestamp: string; result: string }[];
      summary?: { totalEvents: number; deniedCount: number; uniqueUsers: number };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入權限稽核..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="權限稽核報表" description="權限存取事件記錄">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總事件 <strong className="text-foreground">{summary.totalEvents}</strong></span>
            <span>拒絕次數 <strong className="text-foreground">{summary.deniedCount}</strong></span>
            <span>涉及用戶 <strong className="text-foreground">{summary.uniqueUsers}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["用戶 ID", "姓名", "角色", "操作", "資源", "時間", "結果"]}
        rows={items.map((i) => [i.userId, i.userName, i.role, i.action, i.resource, i.timestamp, i.result])}
      />
    </div>
  );
}
