"use client";

import { useReportData, ReportLoading, ReportError, ReportHeader } from "./report-shared";

export function TimeDistributionReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/time-distribution?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const { data, loading, error, reload } = useReportData<{
    users?: string[];
    series?: Record<string, number[]>;
    from?: string;
    to?: string;
  }>(url);

  if (loading) return <ReportLoading message="載入工時分佈..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const users = data?.users ?? [];
  const series = data?.series ?? {};
  const categories = Object.keys(series);

  return (
    <div>
      <ReportHeader title="工時分佈" description={`${from} ~ ${to} 各類工時分佈`} />
      {users.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">此期間無工時資料</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">成員</th>
                {categories.map((c) => (
                  <th key={c} className="text-right px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">{c}</th>
                ))}
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">合計</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => {
                const vals = categories.map((c) => series[c]?.[idx] ?? 0);
                const total = vals.reduce((s, v) => s + v, 0);
                return (
                  <tr key={user} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2">{user}</td>
                    {vals.map((v, j) => (
                      <td key={j} className="text-right px-4 py-2 tabular-nums">{v}</td>
                    ))}
                    <td className="text-right px-4 py-2 tabular-nums font-medium">{Math.round(total * 10) / 10}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
