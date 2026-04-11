"use client";

/**
 * Report chart components — P0 visualisation reports extracted from reports/page.tsx
 * Each component is self-contained (fetches its own data) and receives date-range props.
 */

import { useState, useEffect, useCallback } from "react";
import { Users, TrendingUp, AlertTriangle, Target, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { safeFixed, safePct } from "@/lib/safe-number";

// ─── Shared CSV export helper ────────────────────────────────────────────────

export function exportCSV(headers: string[], rows: string[][], filename: string) {
  const sanitize = (s: string) => /^[=+\-@\t\r|]/.test(s) ? `'${s}` : s;
  const escapeCell = (v: string) => {
    const s = sanitize(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r") || s.startsWith("'")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const bom = "\uFEFF";
  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map(r => r.map(escapeCell).join(","))
  ].join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRangeProps {
  from: string;
  to: string;
}

interface UtilizationRow {
  userId: string;
  userName: string;
  totalHours: number;
  availableHours: number;
  utilizationPct: number;
}

interface VelocityPoint {
  week: string;
  label: string;
  completed: number;
}

interface KPITrendPoint {
  month: string;
  label: string;
  kpis: Array<{
    id: string;
    name: string;
    achievementPct: number;
    target: number;
  }>;
}

interface UnplannedPoint {
  month: string;
  label: string;
  totalTasks: number;
  unplannedTasks: number;
  unplannedPct: number;
}

// ─── Utilization Report ──────────────────────────────────────────────────────

export function UtilizationReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/time-distribution?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&view=utilization`
      );
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const d = extractData<{ members?: UtilizationRow[]; users?: string[]; series?: Record<string, number[]>; from?: string; to?: string }>(body);
      if (d?.members) {
        setData(d.members);
      } else if (d?.users && d?.series) {
        const userNames = d.users;
        const fromD = new Date(d.from ?? from);
        const toD = new Date(d.to ?? to);
        let workdays = 0;
        const dd = new Date(fromD);
        while (dd <= toD) { if (dd.getDay() !== 0 && dd.getDay() !== 6) workdays++; dd.setDate(dd.getDate() + 1); }
        const available = workdays * 8;
        const rows: UtilizationRow[] = userNames.map((name, idx) => {
          let total = 0;
          for (const cat of Object.values(d.series!)) { total += (cat[idx] ?? 0); }
          return { userId: name, userName: name, totalHours: Math.round(total * 10) / 10, availableHours: available, utilizationPct: available > 0 ? Math.round(total / available * 100) : 0 };
        });
        setData(rows);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    exportCSV(
      ["姓名", "實際工時", "可用工時", "利用率(%)"],
      data.map((r) => [r.userName, String(r.totalHours), String(r.availableHours), String(r.utilizationPct)]),
      `utilization-${from}-${to}.csv`
    );
  }

  if (loading) return <PageLoading message="載入團隊利用率..." className="py-12" />;
  if (error) return <PageError message={error} onRetry={load} className="py-12" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">團隊利用率 Heatmap</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {data.length === 0 ? (
        <PageEmpty icon={<Users className="h-5 w-5" />} title="此期間無工時資料" description="團隊成員開始登記工時後，利用率數據將自動產生" />
      ) : (
        <div className="grid gap-2" role="table" aria-label="團隊利用率">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-3 py-2" role="row">
            <span role="columnheader">成員</span>
            <span role="columnheader" className="text-right">實際工時</span>
            <span role="columnheader" className="text-right">可用工時</span>
            <span role="columnheader" className="text-right">利用率</span>
          </div>
          {data.map((row) => (
            <div
              key={row.userId}
              role="row"
              className={cn(
                "grid grid-cols-4 gap-2 items-center px-3 py-2.5 rounded-lg border transition-colors",
                row.utilizationPct >= 90 ? "border-emerald-500/30 bg-emerald-500/5" :
                row.utilizationPct >= 70 ? "border-amber-500/30 bg-amber-500/5" :
                row.utilizationPct >= 50 ? "border-orange-500/30 bg-orange-500/5" :
                "border-red-500/30 bg-red-500/5"
              )}
            >
              <span className="text-sm font-medium" role="cell">{row.userName}</span>
              <span className="text-sm text-right tabular-nums" role="cell">{safeFixed(row.totalHours, 1)}h</span>
              <span className="text-sm text-right tabular-nums text-muted-foreground" role="cell">{safeFixed(row.availableHours, 0)}h</span>
              <div className="flex items-center justify-end gap-2" role="cell">
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      row.utilizationPct >= 90 ? "bg-emerald-500" :
                      row.utilizationPct >= 70 ? "bg-amber-500" :
                      row.utilizationPct >= 50 ? "bg-orange-500" :
                      "bg-red-500"
                    )}
                    style={{ width: `${Math.min(row.utilizationPct, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium tabular-nums">{safePct(row.utilizationPct)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Velocity Report ─────────────────────────────────────────────────────────

export function VelocityReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<VelocityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/completion-rate?from=${from}&to=${to}&view=velocity`
      );
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const d = extractData<{ weeks?: VelocityPoint[]; data?: VelocityPoint[] }>(body);
      setData(d?.weeks ?? d?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    exportCSV(
      ["週次", "完成任務數"],
      data.map((r) => [r.label, String(r.completed)]),
      `velocity-${from}-${to}.csv`
    );
  }

  if (loading) return <PageLoading message="載入任務速率..." className="py-12" />;
  if (error) return <PageError message={error} onRetry={load} className="py-12" />;

  const maxCompleted = Math.max(1, ...data.map((d) => d.completed));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">任務速率趨勢</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {data.length === 0 ? (
        <PageEmpty icon={<TrendingUp className="h-5 w-5" />} title="此期間無完成任務" description="任務完成後將自動統計速率趨勢" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-end gap-1 h-48 px-2" role="img" aria-label="任務速率長條圖">
            {data.map((point) => (
              <div key={point.week} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {point.completed}
                </span>
                <div
                  className="w-full bg-primary/80 rounded-t-sm transition-all min-h-[2px]"
                  style={{ height: `${(point.completed / maxCompleted) * 100}%` }}
                  title={`${point.label}: ${point.completed} 項`}
                />
                <span className="text-[9px] text-muted-foreground truncate max-w-full">
                  {point.label}
                </span>
              </div>
            ))}
          </div>
          {data.length > 1 && (
            <div className="text-xs text-muted-foreground text-center">
              平均：{safeFixed(data.reduce((s, d) => s + d.completed, 0) / data.length, 1)} 項/週
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI Trend Report ────────────────────────────────────────────────────────

export function KPITrendReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<KPITrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/kpi?from=${from}&to=${to}&view=trend`
      );
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const d = extractData<{ months?: KPITrendPoint[]; kpis?: Array<{ title: string; actual: number; target: number }> }>(body);
      if (d?.months) {
        setData(d.months);
      } else if (d?.kpis) {
        setData([{ month: from.slice(0, 7), label: "目前", kpis: d.kpis.map(k => ({ id: k.title, name: k.title, achievementPct: k.target > 0 ? Math.round((k.actual ?? 0) / k.target * 100) : 0, target: k.target })) }]);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const kpiNames = Array.from(
    new Set(data.flatMap((m) => m.kpis.map((k) => k.name)))
  );

  function handleExport() {
    exportCSV(
      ["月份", ...kpiNames.map((n) => `${n}(%)`)],
      data.map((m) => [
        m.label,
        ...kpiNames.map((name) => {
          const kpi = m.kpis.find((k) => k.name === name);
          return kpi ? String(kpi.achievementPct) : "";
        }),
      ]),
      `kpi-trend-${from}-${to}.csv`
    );
  }

  if (loading) return <PageLoading message="載入 KPI 趨勢..." className="py-12" />;
  if (error) return <PageError message={error} onRetry={load} className="py-12" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">KPI 達成率趨勢</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {data.length === 0 ? (
        <PageEmpty icon={<Target className="h-5 w-5" />} title="此期間無 KPI 資料" description="建立 KPI 指標並連結任務後，達成率將自動計算" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">月份</th>
                {kpiNames.map((name) => (
                  <th key={name} className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((month) => (
                <tr key={month.month} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3 font-medium">{month.label}</td>
                  {kpiNames.map((name) => {
                    const kpi = month.kpis.find((k) => k.name === name);
                    const pct = kpi?.achievementPct ?? 0;
                    const target = kpi?.target ?? 100;
                    const isGood = pct >= target * 0.8;
                    return (
                      <td key={name} className="py-2 px-3 text-right">
                        <span className={cn(
                          "tabular-nums font-medium",
                          isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {safePct(pct)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.length >= 2 && (() => {
                const lastMonth = data[data.length - 1];
                const prevMonth = data[data.length - 2];
                return (
                  <tr className="border-b border-border/50 bg-muted/30">
                    <td className="py-2 px-3 font-medium text-muted-foreground italic">預測 (下月)</td>
                    {kpiNames.map((name) => {
                      const last = lastMonth.kpis.find((k) => k.name === name);
                      const prev = prevMonth.kpis.find((k) => k.name === name);
                      const forecast = last && prev
                        ? Math.max(0, Math.min(200, last.achievementPct + (last.achievementPct - prev.achievementPct)))
                        : null;
                      return (
                        <td key={name} className="py-2 px-3 text-right">
                          {forecast !== null ? (
                            <span className="tabular-nums text-muted-foreground italic">
                              ~{safePct(forecast)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Unplanned Trend Report ──────────────────────────────────────────────────

export function UnplannedTrendReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<UnplannedPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/workload?from=${from}&to=${to}&view=unplanned-trend`
      );
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const d = extractData<{ months?: UnplannedPoint[]; unplannedRate?: number; plannedRate?: number; period?: { start: string } }>(body);
      if (d?.months) {
        setData(d.months);
      } else if (d?.period) {
        setData([{ month: d.period.start?.slice(0, 7) ?? from.slice(0, 7), label: "期間", totalTasks: 0, unplannedTasks: 0, unplannedPct: Math.round((d.unplannedRate ?? 0) * 100) / 100 }]);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function handleExport() {
    exportCSV(
      ["月份", "總任務數", "計畫外任務數", "計畫外占比(%)"],
      data.map((r) => [r.label, String(r.totalTasks), String(r.unplannedTasks), String(r.unplannedPct)]),
      `unplanned-trend-${from}-${to}.csv`
    );
  }

  if (loading) return <PageLoading message="載入計畫外趨勢..." className="py-12" />;
  if (error) return <PageError message={error} onRetry={load} className="py-12" />;

  const maxPct = Math.max(10, ...data.map((d) => d.unplannedPct));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">計畫外工作趨勢</h2>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {data.length === 0 ? (
        <PageEmpty icon={<AlertTriangle className="h-5 w-5" />} title="此期間無計畫外事件" description="當任務被標記為計畫外時，趨勢數據將自動產生" />
      ) : (
        <div className="space-y-3">
          {data.map((point) => (
            <div key={point.month} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{point.label}</span>
              <div className="flex-1 h-6 bg-muted/50 rounded overflow-hidden relative">
                <div
                  className={cn(
                    "h-full rounded transition-all",
                    point.unplannedPct > 30 ? "bg-red-500/70" :
                    point.unplannedPct > 20 ? "bg-amber-500/70" :
                    "bg-blue-500/70"
                  )}
                  style={{ width: `${(point.unplannedPct / maxPct) * 100}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-foreground">
                  {point.unplannedTasks}/{point.totalTasks}
                </span>
              </div>
              <span className={cn(
                "text-xs font-medium tabular-nums w-12 text-right",
                point.unplannedPct > 30 ? "text-red-500" :
                point.unplannedPct > 20 ? "text-amber-500" :
                "text-blue-500"
              )}>
                {safePct(point.unplannedPct)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
