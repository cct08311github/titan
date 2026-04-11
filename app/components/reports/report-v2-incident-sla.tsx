"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable } from "./report-shared";

export function V2IncidentSlaReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/incident-sla?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { incidentId: string; title: string; priority: string; openedAt: string; resolvedAt?: string; slaTarget: number; actualHours: number; slaMet: boolean }[];
      summary?: { total: number; slaMet: number; slaBreached: number; slaRate: number };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入事件 SLA..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="事件 SLA 報表" description="事件處理時效達標率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總事件 <strong className="text-foreground">{summary.total}</strong></span>
            <span>SLA 達標 <strong className="text-foreground">{summary.slaMet}</strong></span>
            <span>達標率 <strong className="text-foreground">{summary.slaRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["事件 ID", "標題", "優先級", "開立時間", "解決時間", "SLA(h)", "實際(h)", "達標"]}
        rows={items.map((i) => [
          i.incidentId,
          i.title,
          i.priority,
          i.openedAt,
          i.resolvedAt ?? "未解決",
          i.slaTarget,
          i.actualHours,
          i.slaMet ? "✓" : "✗",
        ])}
      />
    </div>
  );
}
