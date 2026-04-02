"use client";

/**
 * Reports v2 Page — Issue #964
 *
 * Layout: left sidebar nav + right content area
 * 4 P0 Reports:
 *   1. 團隊利用率 — hours worked / (workdays × 8h) per person, heatmap
 *   2. 任務速率 — completed tasks per week, trend line (ECharts)
 *   3. KPI 達成率趨勢 — monthly per KPI with forecast line
 *   4. 計畫外工作趨勢 — unplanned % per month
 * Each report has date range picker and CSV export.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Target,
  Download,
  Calendar,
  BarChart3,
  FolderKanban,
  Clock,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { safeFixed, safePct } from "@/lib/safe-number";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportId = "utilization" | "velocity" | "kpi-trend" | "unplanned" | "time-summary" | "overtime" | "audit-summary" | "login-activity";

interface ReportNav {
  id: ReportId;
  label: string;
  icon: typeof Users;
  description: string;
}

interface ReportCategory {
  label: string;
  icon: typeof Users;
  reports: ReportNav[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    label: "組織績效",
    icon: BarChart3,
    reports: [
      { id: "utilization", label: "團隊利用率", icon: Users, description: "工時投入 / 可用工時" },
      { id: "velocity", label: "任務速率", icon: TrendingUp, description: "每週完成任務數趨勢" },
    ],
  },
  {
    label: "項目管理",
    icon: FolderKanban,
    reports: [
      { id: "unplanned", label: "計畫外工作趨勢", icon: AlertTriangle, description: "計畫外占比月趨勢" },
    ],
  },
  {
    label: "KPI",
    icon: Target,
    reports: [
      { id: "kpi-trend", label: "KPI 達成率趨勢", icon: Target, description: "月度 KPI 達成率 + 預測" },
    ],
  },
  {
    label: "工時",
    icon: Clock,
    reports: [
      { id: "time-summary", label: "工時摘要", icon: Clock, description: "個人/團隊工時統計" },
      { id: "overtime", label: "加班分析", icon: TrendingUp, description: "正常/加班/假日工時佔比" },
    ],
  },
  {
    label: "稽核",
    icon: Shield,
    reports: [
      { id: "audit-summary", label: "操作日誌統計", icon: Shield, description: "按操作類型統計" },
      { id: "login-activity", label: "登入活動", icon: Users, description: "登入成功/失敗統計" },
    ],
  },
];

// Flat list for backward compat
const REPORTS: ReportNav[] = REPORT_CATEGORIES.flatMap((c) => c.reports);

// ─── Date helpers ────────────────────────────────────────────────────────────

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const bom = "\uFEFF";
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Utilization Report ──────────────────────────────────────────────────────

interface UtilizationRow {
  userId: string;
  userName: string;
  totalHours: number;
  availableHours: number;
  utilizationPct: number;
}

function UtilizationReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<UtilizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/time-distribution?from=${from}&to=${to}&view=utilization`
      );
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const d = extractData<{ members?: UtilizationRow[]; users?: UtilizationRow[] }>(body);
      setData(d?.members ?? d?.users ?? []);
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

interface VelocityPoint {
  week: string;
  label: string;
  completed: number;
}

function VelocityReport({ from, to }: { from: string; to: string }) {
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

function KPITrendReport({ from, to }: { from: string; to: string }) {
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
        // Transform flat kpis to single-month view
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

interface UnplannedPoint {
  month: string;
  label: string;
  totalTasks: number;
  unplannedTasks: number;
  unplannedPct: number;
}

function UnplannedTrendReport({ from, to }: { from: string; to: string }) {
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
        // Transform single-period to single point
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

// ─── Time Summary Report (Issue #1161) ───────────────────────────────────────

// ─── Time Summary Report — HR Grade (Issue #1161) ───────────────────────────

interface TimeSummaryUser { userName: string; email: string; planned: number; added: number; incident: number; support: number; admin: number; learning: number; total: number; workdays: number; target: number; utilizationPct: number; }

function TimeSummaryReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<TimeSummaryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/time-summary?from=${from}&to=${to}&mode=by-user`)
      .then(r => r.json()).then(d => setData(d.data?.users ?? d.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data.length) return <div className="text-center text-muted-foreground py-12">此期間無工時資料<br/><span className="text-xs">團隊成員開始登記工時後，摘要將自動產生</span></div>;

  // Aggregate totals
  const totals = data.reduce((acc, r) => ({ planned: acc.planned + r.planned, added: acc.added + r.added, incident: acc.incident + r.incident, support: acc.support + r.support, admin: acc.admin + r.admin, learning: acc.learning + r.learning, total: acc.total + r.total, target: acc.target + r.target }), { planned: 0, added: 0, incident: 0, support: 0, admin: 0, learning: 0, total: 0, target: 0 });

  const handleExport = () => exportCSV(
    ["姓名","Email","計畫工時","追加","事件","支援","行政","學習","合計","工作天","目標(h)","達成率(%)"],
    data.map(r => [r.userName, r.email, r.planned, r.added, r.incident, r.support, r.admin, r.learning, r.total, r.workdays, r.target, r.utilizationPct].map(String)),
    `time-summary-${from}-${to}.csv`
  );

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div><h3 className="font-semibold">工時摘要</h3><p className="text-xs text-muted-foreground">按成員彙總各分類工時、目標達成率</p></div>
        <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent"><Download className="h-3.5 w-3.5" />CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-muted/30">
            <th className="text-left py-2 px-2">姓名</th>
            <th className="text-right py-2 px-1" title="計畫任務">計畫</th>
            <th className="text-right py-2 px-1" title="追加任務">追加</th>
            <th className="text-right py-2 px-1" title="事件處理">事件</th>
            <th className="text-right py-2 px-1" title="用戶支援">支援</th>
            <th className="text-right py-2 px-1" title="行政庶務">行政</th>
            <th className="text-right py-2 px-1" title="學習成長">學習</th>
            <th className="text-right py-2 px-2 font-bold">合計</th>
            <th className="text-right py-2 px-1">工作天</th>
            <th className="text-right py-2 px-1">目標(h)</th>
            <th className="text-right py-2 px-2">達成率</th>
          </tr></thead>
          <tbody>
            {data.map((r, i) => {
              const pct = r.utilizationPct;
              const pctColor = pct >= 100 ? "text-green-600" : pct >= 80 ? "text-foreground" : pct >= 60 ? "text-amber-600" : "text-red-600";
              return (
                <tr key={i} className="border-b border-border/30 hover:bg-accent/30">
                  <td className="py-1.5 px-2 font-medium">{r.userName}</td>
                  <td className="text-right py-1.5 px-1">{r.planned || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.added || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.incident || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.support || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.admin || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.learning || "-"}</td>
                  <td className="text-right py-1.5 px-2 font-bold">{r.total}h</td>
                  <td className="text-right py-1.5 px-1">{r.workdays}</td>
                  <td className="text-right py-1.5 px-1">{r.target}h</td>
                  <td className={`text-right py-1.5 px-2 font-bold ${pctColor}`}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="border-t-2 border-border font-bold bg-muted/20">
            <td className="py-2 px-2">全團隊</td>
            <td className="text-right py-2 px-1">{totals.planned}</td>
            <td className="text-right py-2 px-1">{totals.added}</td>
            <td className="text-right py-2 px-1">{totals.incident}</td>
            <td className="text-right py-2 px-1">{totals.support}</td>
            <td className="text-right py-2 px-1">{totals.admin}</td>
            <td className="text-right py-2 px-1">{totals.learning}</td>
            <td className="text-right py-2 px-2">{totals.total}h</td>
            <td className="text-right py-2 px-1" colSpan={2}>{totals.target}h</td>
            <td className="text-right py-2 px-2">{totals.target > 0 ? Math.round(totals.total / totals.target * 100) : 0}%</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Overtime Report — HR Compliance Grade (Issue #1161) ─────────────────────

interface OvertimeUser { userName: string; email: string; normal: number; weekdayOT: number; holidayOT: number; totalOT: number; totalHours: number; otRatio: number; monthlyOTLimit: number; overLimit: boolean; }

function OvertimeReport({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<OvertimeUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/overtime?from=${from}&to=${to}&mode=compliance`)
      .then(r => r.json()).then(d => setData(d.data?.users ?? d.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data.length) return <div className="text-center text-muted-foreground py-12">此期間無加班資料</div>;

  const overLimitCount = data.filter(r => r.overLimit).length;
  const totalOT = data.reduce((s, r) => s + r.totalOT, 0);

  const handleExport = () => exportCSV(
    ["姓名","Email","正常工時","平日加班","假日加班","加班合計","總工時","加班佔比(%)","月加班上限(h)","超標"],
    data.map(r => [r.userName, r.email, r.normal, r.weekdayOT, r.holidayOT, r.totalOT, r.totalHours, r.otRatio, r.monthlyOTLimit, r.overLimit ? "是" : "否"].map(String)),
    `overtime-${from}-${to}.csv`
  );

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h3 className="font-semibold">加班分析</h3>
          <p className="text-xs text-muted-foreground">正常/平日加班/假日加班明細，含法規上限警示</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent"><Download className="h-3.5 w-3.5" />CSV</button>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="border border-border rounded-lg p-3 text-center"><div className="text-lg font-bold">{totalOT}h</div><div className="text-[10px] text-muted-foreground">團隊加班總計</div></div>
        <div className="border border-border rounded-lg p-3 text-center"><div className="text-lg font-bold">{data.length > 0 ? Math.round(totalOT / data.length * 10) / 10 : 0}h</div><div className="text-[10px] text-muted-foreground">人均加班</div></div>
        <div className={`border rounded-lg p-3 text-center ${overLimitCount > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-border"}`}><div className={`text-lg font-bold ${overLimitCount > 0 ? "text-red-600" : ""}`}>{overLimitCount}</div><div className="text-[10px] text-muted-foreground">超標人數</div></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-muted/30">
            <th className="text-left py-2 px-2">姓名</th>
            <th className="text-right py-2 px-2">正常</th>
            <th className="text-right py-2 px-2">平日 OT</th>
            <th className="text-right py-2 px-2">假日 OT</th>
            <th className="text-right py-2 px-2 font-bold">OT 合計</th>
            <th className="text-right py-2 px-2">總工時</th>
            <th className="text-right py-2 px-2">OT 佔比</th>
            <th className="text-right py-2 px-2">月上限</th>
            <th className="text-center py-2 px-2">狀態</th>
          </tr></thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className={`border-b border-border/30 hover:bg-accent/30 ${r.overLimit ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                <td className="py-1.5 px-2 font-medium">{r.userName}</td>
                <td className="text-right py-1.5 px-2">{r.normal}h</td>
                <td className="text-right py-1.5 px-2 text-amber-600 dark:text-amber-400">{r.weekdayOT}h</td>
                <td className="text-right py-1.5 px-2 text-red-600 dark:text-red-400">{r.holidayOT}h</td>
                <td className="text-right py-1.5 px-2 font-bold">{r.totalOT}h</td>
                <td className="text-right py-1.5 px-2">{r.totalHours}h</td>
                <td className="text-right py-1.5 px-2">{r.otRatio}%</td>
                <td className="text-right py-1.5 px-2">{r.monthlyOTLimit}h</td>
                <td className="text-center py-1.5 px-2">{r.overLimit ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">超標</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">正常</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Audit Summary Report (Issue #1161) ─────────────────────────────────────

interface AuditEntry { id: string; timestamp: string; user: { name: string; email: string; role: string } | null; action: string; module: string; resourceType: string; resourceId: string | null; detail: string | null; ipAddress: string | null; userAgent: string | null; }

function AuditSummaryReport({ from, to }: { from: string; to: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, mode: "detail", limit: String(pageSize), offset: String(page * pageSize) });
    if (actionFilter) params.set("action", actionFilter);
    fetch(`/api/reports/audit-summary?${params}`)
      .then(r => r.json()).then(d => { setEntries(d.data?.entries ?? []); setTotal(d.data?.total ?? 0); })
      .catch(() => { setEntries([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [from, to, actionFilter, page]);

  const handleExport = () => {
    exportCSV(
      ["時間","操作者","Email","角色","操作","模組","資源類型","資源ID","詳情","IP","User-Agent"],
      entries.map(e => [e.timestamp, e.user?.name ?? "匿名", e.user?.email ?? "-", e.user?.role ?? "-", e.action, e.module, e.resourceType, e.resourceId ?? "-", (e.detail ?? "").replace(/,/g, ";"), e.ipAddress ?? "-", (e.userAgent ?? "").replace(/,/g, ";")]),
      `audit-detail-${from}-${to}.csv`
    );
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">稽核日誌明細</h3>
          <span className="text-xs text-muted-foreground">共 {total} 筆</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }} placeholder="篩選操作類型..." className="text-xs px-2 py-1 border border-border rounded-md w-40 bg-background text-foreground placeholder:text-muted-foreground" />
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : !entries.length ? <div className="text-center text-muted-foreground py-12">此期間無稽核紀錄</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/30"><th className="text-left py-2 px-2 whitespace-nowrap">時間</th><th className="text-left py-2 px-2">操作者</th><th className="text-left py-2 px-2">角色</th><th className="text-left py-2 px-2">操作</th><th className="text-left py-2 px-2">模組</th><th className="text-left py-2 px-2">資源</th><th className="text-left py-2 px-2">IP</th><th className="text-left py-2 px-2 max-w-[200px]">詳情</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30">
                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleString("zh-TW")}</td>
                    <td className="py-1.5 px-2">{e.user?.name ?? <span className="text-muted-foreground">匿名</span>}</td>
                    <td className="py-1.5 px-2"><span className={`text-[10px] px-1.5 py-0.5 rounded ${e.user?.role === "MANAGER" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{e.user?.role ?? "-"}</span></td>
                    <td className="py-1.5 px-2 font-mono">{e.action}</td>
                    <td className="py-1.5 px-2">{e.module}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px]">{e.resourceType}{e.resourceId ? `:${e.resourceId.slice(0,8)}` : ""}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px]">{e.ipAddress ?? "-"}</td>
                    <td className="py-1.5 px-2 text-[10px] max-w-[200px] truncate" title={e.detail ?? ""}>{e.detail ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
            <span>{page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} / {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-30">上一頁</button>
              <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-30">下一頁</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Login Activity Report — Compliance Grade (Issue #1161) ─────────────────

interface LoginEntry { id: string; timestamp: string; user: { name: string; email: string; role: string } | null; action: string; detail: string | null; ipAddress: string | null; userAgent: string | null; }

function LoginActivityReport({ from, to }: { from: string; to: string }) {
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, mode: "detail", limit: String(pageSize), offset: String(page * pageSize) });
    if (resultFilter) params.set("result", resultFilter);
    fetch(`/api/reports/login-activity?${params}`)
      .then(r => r.json()).then(d => { setEntries(d.data?.entries ?? []); setTotal(d.data?.total ?? 0); })
      .catch(() => { setEntries([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [from, to, resultFilter, page]);

  const handleExport = () => {
    exportCSV(
      ["時間","操作者","Email","角色","事件","詳情","IP","User-Agent"],
      entries.map(e => [e.timestamp, e.user?.name ?? "匿名", e.user?.email ?? "-", e.user?.role ?? "-", e.action, (e.detail ?? "").replace(/,/g, ";"), e.ipAddress ?? "-", (e.userAgent ?? "").replace(/,/g, ";")]),
      `login-activity-${from}-${to}.csv`
    );
  };

  const actionLabel = (a: string) => {
    const m: Record<string, string> = { LOGIN_SUCCESS: "登入成功", LOGIN_FAILURE: "登入失敗", MOBILE_LOGIN_SUCCESS: "行動登入成功", MOBILE_LOGIN_FAILURE: "行動登入失敗", LOGOUT: "登出", MOBILE_LOGOUT: "行動登出", SESSION_TIMEOUT: "Session 逾時", ACCOUNT_LOCKED: "帳號鎖定", PASSWORD_CHANGE: "密碼變更" };
    return m[a] ?? a;
  };
  const actionColor = (a: string) => a.includes("SUCCESS") ? "text-green-600" : a.includes("FAILURE") || a === "ACCOUNT_LOCKED" ? "text-red-600" : "text-amber-600";

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">登入活動明細</h3>
          <span className="text-xs text-muted-foreground">共 {total} 筆</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(0); }} className="text-xs px-2 py-1 border border-border rounded-md bg-background text-foreground">
            <option value="">全部</option><option value="success">成功</option><option value="failure">失敗</option>
          </select>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent"><Download className="h-3.5 w-3.5" />CSV</button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : !entries.length ? <div className="text-center text-muted-foreground py-12">此期間無登入紀錄</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/30"><th className="text-left py-2 px-2 whitespace-nowrap">時間</th><th className="text-left py-2 px-2">操作者</th><th className="text-left py-2 px-2">Email</th><th className="text-left py-2 px-2">事件</th><th className="text-left py-2 px-2">IP</th><th className="text-left py-2 px-2 max-w-[200px]">詳情</th><th className="text-left py-2 px-2 max-w-[150px]">裝置</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30">
                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleString("zh-TW")}</td>
                    <td className="py-1.5 px-2">{e.user?.name ?? <span className="text-muted-foreground">匿名</span>}</td>
                    <td className="py-1.5 px-2 text-[10px]">{e.user?.email ?? "-"}</td>
                    <td className={`py-1.5 px-2 font-medium ${actionColor(e.action)}`}>{actionLabel(e.action)}</td>
                    <td className="py-1.5 px-2 font-mono text-[10px]">{e.ipAddress ?? "-"}</td>
                    <td className="py-1.5 px-2 text-[10px] max-w-[200px] truncate" title={e.detail ?? ""}>{e.detail ?? "-"}</td>
                    <td className="py-1.5 px-2 text-[10px] max-w-[150px] truncate" title={e.userAgent ?? ""}>{e.userAgent ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
            <span>{page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} / {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-30">上一頁</button>
              <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-30">下一頁</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportsV2Page() {
  const [activeReport, setActiveReport] = useState<ReportId>("utilization");
  const [dateRange, setDateRange] = useState(defaultDateRange);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Left sidebar nav — grouped by category (Issue #1004) */}
      <nav
        className="lg:w-60 flex-shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:border-r lg:border-border lg:pr-4"
        aria-label="報表導覽"
        data-testid="reports-left-nav"
      >
        <div className="hidden lg:block mb-3">
          <h1 className="text-lg font-semibold tracking-tight">報表</h1>
          <p className="text-xs text-muted-foreground mt-0.5">管理分析與趨勢</p>
        </div>

        {REPORT_CATEGORIES.map((category) => {
          const CatIcon = category.icon;
          return (
            <div key={category.label} className="mb-2">
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <CatIcon className="h-3.5 w-3.5" />
                {category.label}
              </div>
              {category.reports.length === 0 ? (
                <div className="px-3 py-1 text-[10px] text-muted-foreground/60 italic hidden lg:block">
                  即將推出
                </div>
              ) : (
                category.reports.map(({ id, label, icon: Icon, description }) => (
                  <button
                    key={id}
                    onClick={() => setActiveReport(id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors whitespace-nowrap lg:whitespace-normal w-full",
                      activeReport === id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                    aria-current={activeReport === id ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm">{label}</div>
                      <div className="text-[10px] text-muted-foreground hidden lg:block">{description}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          );
        })}
      </nav>

      {/* Right content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="lg:hidden">
          <h1 className="text-lg font-semibold tracking-tight">報表</h1>
        </div>

        {/* Date range picker */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            aria-label="開始日期"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="結束日期"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Report content */}
        <div className="border border-border rounded-xl bg-card p-4 sm:p-6 min-h-[400px]">
          {activeReport === "utilization" && (
            <UtilizationReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "velocity" && (
            <VelocityReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "kpi-trend" && (
            <KPITrendReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "unplanned" && (
            <UnplannedTrendReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "time-summary" && (
            <TimeSummaryReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "overtime" && (
            <OvertimeReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "audit-summary" && (
            <AuditSummaryReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "login-activity" && (
            <LoginActivityReport from={dateRange.from} to={dateRange.to} />
          )}
        </div>
      </div>
    </div>
  );
}
