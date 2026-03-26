"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, BarChart3, Printer, FileSpreadsheet, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { safeFixed, safePct } from "@/lib/safe-number";
import { formatDate } from "@/lib/format";

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      data-print-hide
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-accent transition-colors"
    >
      <Printer className="h-3.5 w-3.5" />
      列印 PDF
    </button>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "weekly" | "monthly" | "time-distribution" | "completion" | "kpi" | "workload" | "trends" | "audit";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "weekly", label: "週報" },
  { id: "monthly", label: "月報" },
  { id: "time-distribution", label: "工時分佈" },
  { id: "completion", label: "完成率" },
  { id: "kpi", label: "KPI 報表" },
  { id: "workload", label: "計畫外負荷" },
  { id: "trends", label: "趨勢分析" },
  { id: "audit", label: "稽核報表" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{children}</h3>;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ProgressBar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function exportJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Weekly Report ──────────────────────────────────────────────────────────

interface WeeklyData {
  period: { start: string; end: string };
  completedCount: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  overdueCount: number;
  delayCount: number;
  scopeChangeCount: number;
  completedTasks: Array<{ id: string; title: string; primaryAssignee?: { name: string } | null }>;
  overdueTasks: Array<{ id: string; title: string; dueDate: string; primaryAssignee?: { name: string } | null }>;
}

function WeeklyReport() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/reports/weekly")
      .then((r) => { if (!r.ok) throw new Error("週報載入失敗"); return r.json(); })
      .then((body) => setData(extractData<WeeklyData>(body)))
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoading message="載入週報..." />;
  if (error) return <PageError message={error} onRetry={load} />;
  if (!data || !data.period) return <PageEmpty title="無週報資料" description="本週尚無相關數據" />;

  const start = formatDate(data.period.start);
  const end = formatDate(data.period.end);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{start} — {end}</p>
        <button
          onClick={async () => {
            const { exportWeeklyExcel } = await import("@/lib/excel-export");
            await exportWeeklyExcel(data);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          匯出 Excel
        </button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-xl shadow-card p-4">
        <SectionTitle>本週摘要</SectionTitle>
        <StatRow label="完成任務數" value={data.completedCount} />
        <StatRow label="總工時 (h)" value={safeFixed(data.totalHours, 1)} />
        <StatRow label="逾期任務數" value={data.overdueCount} />
        <StatRow label="延遲次數" value={data.delayCount} />
        <StatRow label="範疇變更次數" value={data.scopeChangeCount} />
      </div>

      {/* Hours by category */}
      {Object.keys(data.hoursByCategory).length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-4">
          <SectionTitle>工時分類</SectionTitle>
          <div className="space-y-2">
            {Object.entries(data.hoursByCategory).map(([cat, hours]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-mono text-xs">{cat}</span>
                <span className="tabular-nums">{safeFixed(hours, 1)} h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {data.completedTasks.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-4">
          <SectionTitle>本週完成任務</SectionTitle>
          <div className="space-y-1.5">
            {data.completedTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{t.title}</span>
                {t.primaryAssignee && (
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {t.primaryAssignee.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue tasks */}
      {data.overdueTasks.length > 0 && (
        <div className="bg-card border-l-[3px] border-l-danger shadow-card rounded-lg p-4">
          <SectionTitle>逾期任務</SectionTitle>
          <div className="space-y-1.5">
            {data.overdueTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{t.title}</span>
                <span className="text-xs text-danger flex-shrink-0 ml-2 tabular-nums">
                  {formatDate(t.dueDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monthly Report ─────────────────────────────────────────────────────────

interface MonthlyData {
  period: { year: number; month: number };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  delayCount: number;
  scopeChangeCount: number;
  monthlyGoals: Array<{ id: string; title: string; tasks: Array<{ status: string }> }>;
}

function MonthlyReport() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/monthly?month=${month}`)
      .then((r) => { if (!r.ok) throw new Error("月報載入失敗"); return r.json(); })
      .then((body) => setData(extractData<MonthlyData>(body)))
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-accent border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {data && (
          <button
            onClick={async () => {
              const { exportMonthlyExcel } = await import("@/lib/excel-export");
              await exportMonthlyExcel(data);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors ml-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            匯出 Excel
          </button>
        )}
      </div>

      {loading ? (
        <PageLoading message="載入月報..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : !data || !data.period ? (
        <PageEmpty title="無月報資料" description="本月尚無相關數據" />
      ) : (
        <>
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>
              {data.period.year} 年 {data.period.month} 月摘要
            </SectionTitle>
            <StatRow label="總任務數" value={data.totalTasks} />
            <StatRow label="完成任務數" value={data.completedTasks} />
            <StatRow label="完成率" value={`${data.completionRate}%`} />
            <StatRow label="總工時 (h)" value={safeFixed(data.totalHours, 1)} />
            <StatRow label="延遲次數" value={data.delayCount} />
            <StatRow label="範疇變更次數" value={data.scopeChangeCount} />
          </div>

          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>任務完成率</SectionTitle>
            <div className="space-y-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">完成進度</span>
                <span className="tabular-nums font-medium">{data.completionRate}%</span>
              </div>
              <ProgressBar
                pct={data.completionRate}
                color={data.completionRate >= 80 ? "bg-success" : data.completionRate >= 50 ? "bg-primary" : "bg-warning"}
              />
            </div>
          </div>

          {data.monthlyGoals.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-4">
              <SectionTitle>月度目標</SectionTitle>
              <div className="space-y-3">
                {data.monthlyGoals.map((g) => {
                  const done = g.tasks.filter((t) => t.status === "DONE").length;
                  const total = g.tasks.length;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{g.title}</span>
                        <span className="tabular-nums text-muted-foreground text-xs">{done}/{total}</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Time Distribution Report (R-2 #837) ───────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  PLANNED_TASK: "計畫任務",
  ADDED_TASK: "新增任務",
  INCIDENT: "事件處理",
  SUPPORT: "支援",
  ADMIN: "行政",
  LEARNING: "學習",
};

interface TimeDistributionApiData {
  users: string[];
  categories: string[];
  series: Record<string, number[]>;
}

function TimeDistributionReport() {
  const [data, setData] = useState<TimeDistributionApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [DistChart, setDistChart] = useState<React.ComponentType<{
    data: TimeDistributionApiData;
  }> | null>(null);

  // Lazy-load ECharts component
  useEffect(() => {
    import("@/app/components/timesheet-distribution-chart").then((mod) => {
      setDistChart(() => mod.TimesheetDistributionChart);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/reports/time-distribution")
      .then((r) => { if (!r.ok) throw new Error("工時分佈載入失敗"); return r.json(); })
      .then((body) => {
        const d = extractData<TimeDistributionApiData>(body);
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <PageLoading message="載入工時分佈..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : !data || data.users.length === 0 ? (
        <PageEmpty
          icon={<Users className="h-8 w-8" />}
          title="無工時分佈資料"
          description="所選期間尚無工時數據"
        />
      ) : (
        <>
          {/* Chart */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>人員工時分佈（堆疊長條圖）</SectionTitle>
            {DistChart ? (
              <DistChart data={data} />
            ) : (
              <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
                載入圖表元件...
              </div>
            )}
          </div>

          {/* Summary table */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>人員工時明細</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">人員</th>
                    {data.categories.map((cat) => (
                      <th key={cat} className="text-right text-xs font-medium text-muted-foreground px-3 py-2">
                        {CATEGORY_LABELS[cat] ?? cat}
                      </th>
                    ))}
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user, ui) => {
                    const total = data.categories.reduce(
                      (s, cat) => s + (data.series[cat]?.[ui] ?? 0),
                      0,
                    );
                    return (
                      <tr key={user} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2 text-foreground">{user}</td>
                        {data.categories.map((cat) => (
                          <td key={cat} className="px-3 py-2 text-right tabular-nums">
                            {safeFixed(data.series[cat]?.[ui] ?? 0, 1)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {safeFixed(total, 1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Completion Rate Report (R-1 #836) ─────────────────────────────────────

interface CompletionDataPoint {
  label: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
}

function CompletionRateReport() {
  const [granularity, setGranularity] = useState<"week" | "month">("month");
  const [data, setData] = useState<CompletionDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [CompletionChart, setCompletionChart] = useState<React.ComponentType<{
    data: CompletionDataPoint[];
    granularity: "week" | "month";
  }> | null>(null);

  // Lazy-load ECharts component
  useEffect(() => {
    import("@/app/components/completion-rate-chart").then((mod) => {
      setCompletionChart(() => mod.CompletionRateChart);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/completion-rate?granularity=${granularity}`)
      .then((r) => { if (!r.ok) throw new Error("完成率報表載入失敗"); return r.json(); })
      .then((body) => {
        const d = extractData<{ data: CompletionDataPoint[] }>(body);
        setData(d?.data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [granularity]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>統計粒度</span>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as "week" | "month")}
            className="h-9 bg-card border border-border text-sm rounded-lg px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer"
          >
            <option value="week">週統計</option>
            <option value="month">月統計</option>
          </select>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <PageLoading message="載入完成率報表..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : data.length === 0 ? (
        <PageEmpty
          icon={<TrendingUp className="h-8 w-8" />}
          title="無完成率資料"
          description="所選期間尚無任務數據"
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {data.reduce((s, d) => s + d.totalCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">總任務數</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums text-success">
                {data.reduce((s, d) => s + d.completedCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">已完成</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {(() => {
                  const total = data.reduce((s, d) => s + d.totalCount, 0);
                  const done = data.reduce((s, d) => s + d.completedCount, 0);
                  return total > 0 ? Math.round((done / total) * 100) : 0;
                })()}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">整體完成率</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>
              {granularity === "week" ? "每週" : "每月"}任務完成率趨勢
            </SectionTitle>
            {CompletionChart ? (
              <CompletionChart data={data} granularity={granularity} />
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">
                載入圖表元件...
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>明細</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">期間</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">總任務</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">已完成</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2">完成率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.label} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-foreground">{d.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.totalCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-success">{d.completedCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{d.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI Report ─────────────────────────────────────────────────────────────

interface KPIReportData {
  year: number;
  avgAchievement: number;
  achievedCount: number;
  totalCount: number;
  kpis: Array<{
    id: string;
    code: string;
    title: string;
    target: number;
    actual: number;
    weight: number;
    status: string;
    achievementRate: number;
  }>;
}

const KPI_STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "進行中",
  AT_RISK: "風險",
  BEHIND: "落後",
  ACHIEVED: "達成",
};

function KPIReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<KPIReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/kpi?year=${year}`)
      .then((r) => { if (!r.ok) throw new Error("KPI 報表載入失敗"); return r.json(); })
      .then((body) => setData(extractData<KPIReportData>(body)))
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="w-24 bg-accent border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {data && (
          <button
            onClick={async () => {
              const { exportKPIExcel } = await import("@/lib/excel-export");
              await exportKPIExcel(data);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors ml-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            匯出 Excel
          </button>
        )}
      </div>

      {loading ? (
        <PageLoading message="載入 KPI 報表..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : !data ? (
        <PageEmpty
          icon={<BarChart3 className="h-8 w-8" />}
          title="無 KPI 報表資料"
          description="本年度尚無 KPI 資料"
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">{data.totalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">KPI 總數</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums text-success">{data.achievedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">已達成</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-2xl font-semibold tabular-nums">{data.avgAchievement}%</p>
              <p className="text-xs text-muted-foreground mt-1">平均達成率</p>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>各 KPI 達成狀況</SectionTitle>
            <div className="space-y-4">
              {data.kpis.map((kpi) => (
                <div key={kpi.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{kpi.code}</span>
                      <span className="text-sm text-foreground truncate">{kpi.title}</span>
                      {kpi.status && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {KPI_STATUS_LABEL[kpi.status] ?? kpi.status}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums flex-shrink-0 ml-2">
                      {safePct(kpi.achievementRate, 0)}%
                    </span>
                  </div>
                  <ProgressBar
                    pct={kpi.achievementRate}
                    color={
                      kpi.achievementRate >= 100
                        ? "bg-success"
                        : kpi.achievementRate >= 60
                        ? "bg-primary"
                        : "bg-warning"
                    }
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    實績 {kpi.actual} / 目標 {kpi.target}　權重 {kpi.weight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Workload Report ────────────────────────────────────────────────────────

interface WorkloadData {
  period: { start: string; end: string };
  totalHours: number;
  plannedHours: number;
  unplannedHours: number;
  plannedRate: number;
  unplannedRate: number;
  hoursByCategory: Record<string, number>;
  byPerson: Array<{
    userId: string;
    name: string;
    total: number;
    planned: number;
    unplanned: number;
  }>;
  unplannedBySource: Record<string, number>;
}

function WorkloadReport() {
  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/workload?startDate=${startDate}`)
      .then((r) => { if (!r.ok) throw new Error("負荷報表載入失敗"); return r.json(); })
      .then((body) => setData(extractData<WorkloadData>(body)))
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [startDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>起始日</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-accent border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {data && (
          <button
            onClick={async () => {
              const { exportWorkloadExcel } = await import("@/lib/excel-export");
              await exportWorkloadExcel(data);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent/80 rounded-md transition-colors ml-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            匯出 Excel
          </button>
        )}
      </div>

      {loading ? (
        <PageLoading message="載入負荷報表..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : !data || !data.period ? (
        <PageEmpty title="無負荷報表資料" description="所選期間尚無工時數據" />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums">{safeFixed(data.totalHours, 1)}</p>
              <p className="text-xs text-muted-foreground mt-1">總工時 (h)</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums text-success">{data.plannedRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">計畫投入率</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums text-warning">{data.unplannedRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">計畫外負荷率</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums">{safeFixed(data.unplannedHours, 1)}</p>
              <p className="text-xs text-muted-foreground mt-1">計畫外工時 (h)</p>
            </div>
          </div>

          {/* Planned vs Unplanned */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>計畫 vs 計畫外</SectionTitle>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">計畫內 ({safeFixed(data.plannedHours, 1)} h)</span>
                  <span className="tabular-nums text-success">{data.plannedRate}%</span>
                </div>
                <ProgressBar pct={data.plannedRate} color="bg-success" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">計畫外 ({safeFixed(data.unplannedHours, 1)} h)</span>
                  <span className="tabular-nums text-warning">{data.unplannedRate}%</span>
                </div>
                <ProgressBar pct={data.unplannedRate} color="bg-warning" />
              </div>
            </div>
          </div>

          {/* Per person */}
          {data.byPerson.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-4">
              <SectionTitle>個人負荷分析</SectionTitle>
              <div className="space-y-4">
                {data.byPerson.map((p) => {
                  const unplannedPct = p.total > 0 ? (p.unplanned / p.total) * 100 : 0;
                  return (
                    <div key={p.userId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          計畫外 {safePct(unplannedPct, 0)}% | 共 {safeFixed(p.total, 1)} h
                        </span>
                      </div>
                      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                        {p.total > 0 && (
                          <>
                            <div
                              className="bg-success"
                              style={{ width: `${(p.planned / p.total) * 100}%` }}
                            />
                            <div
                              className="bg-warning"
                              style={{ width: `${(p.unplanned / p.total) * 100}%` }}
                            />
                          </>
                        )}
                        {p.total === 0 && <div className="bg-accent w-full" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unplanned source */}
          {Object.keys(data.unplannedBySource).length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-4">
              <SectionTitle>計畫外任務來源</SectionTitle>
              <div className="space-y-2">
                {Object.entries(data.unplannedBySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <div key={src} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{src}</span>
                      <span className="tabular-nums font-medium">{count} 件</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Trends Report ────────────────────────────────────────────────────────

type TrendMetric = "kpi" | "workload" | "delays";

const TREND_METRICS: { id: TrendMetric; label: string; unit: string }[] = [
  { id: "kpi", label: "KPI 達成率", unit: "%" },
  { id: "workload", label: "計畫外比例", unit: "%" },
  { id: "delays", label: "逾期任務數", unit: "件" },
];

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function TrendsReport() {
  const currentYear = new Date().getFullYear();
  const [metric, setMetric] = useState<TrendMetric>("kpi");
  const [years, setYears] = useState<number[]>([currentYear - 1, currentYear]);
  const [data, setData] = useState<Record<number, Array<{ month: number; value: number }>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/trends?metric=${metric}&years=${years.join(",")}`);
      if (!res.ok) throw new Error("趨勢資料載入失敗");
      const body = await res.json();
      setData(extractData<Record<number, Array<{ month: number; value: number }>>>(body) ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [metric, years]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const toggleYear = (y: number) => {
    setYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y].sort()
    );
  };

  const metricInfo = TREND_METRICS.find((m) => m.id === metric)!;
  const maxVal = Math.max(
    1,
    ...Object.values(data).flatMap((arr) => arr.map((d) => d.value))
  );

  const YEAR_COLORS: Record<number, string> = {
    [currentYear - 2]: "bg-muted-foreground",
    [currentYear - 1]: "bg-info",
    [currentYear]: "bg-primary",
    [currentYear + 1]: "bg-success",
  };

  if (loading) return <PageLoading message="載入趨勢資料..." />;
  if (error) return <PageError message={error} onRetry={fetchTrends} />;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">指標</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as TrendMetric)}
            className="h-9 bg-card border border-border text-sm rounded-lg px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer"
            aria-label="選擇趨勢指標"
          >
            {TREND_METRICS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">年度</span>
          {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={cn(
                "h-8 px-3 text-xs font-medium rounded-lg border transition-all",
                years.includes(y)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Chart table */}
      <div className="bg-card rounded-xl shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-16">月份</th>
              {years.map((y) => (
                <th key={y} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", YEAR_COLORS[y] ?? "bg-muted-foreground")} />
                    {y}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((label, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{label}</td>
                {years.map((y) => {
                  const val = data[y]?.[i]?.value ?? 0;
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <td key={y} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className={cn("h-full rounded-full transition-all", YEAR_COLORS[y] ?? "bg-muted-foreground")}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground w-12 text-right">
                          {val}{metricInfo.unit}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Audit Report ──────────────────────────────────────────────────────────

function AuditReport() {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const [fromDate, setFromDate] = useState(
    `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [toDate, setToDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [data, setData] = useState<{
    period: { from: string; to: string };
    summary: { totalHours: number; plannedHours: number; incidentHours: number; plannedRate: number; incidentRate: number };
    timeEntries: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/audit?from=${fromDate}&to=${toDate}`)
      .then((r) => { if (!r.ok) throw new Error("稽核資料載入失敗"); return r.json(); })
      .then((body) => setData(extractData(body)))
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  async function exportAudit() {
    if (!data) return;
    if (data.timeEntries.length === 0 && data.tasks.length === 0) {
      alert("所選期間無資料可匯出");
      return;
    }
    const { exportAuditPackage } = await import("@/lib/excel-export");
    await exportAuditPackage({ ...data, from: fromDate, to: toDate });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>起始日</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-accent border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>截止日</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-accent border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {data && (
          <button
            onClick={exportAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors ml-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            匯出稽核包
          </button>
        )}
      </div>

      {loading ? (
        <PageLoading message="載入稽核資料..." />
      ) : error ? (
        <PageError message={error} onRetry={load} />
      ) : !data ? (
        <PageEmpty title="無稽核資料" description="請選擇日期範圍" />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums">{safeFixed(data.summary.totalHours, 1)}</p>
              <p className="text-xs text-muted-foreground mt-1">總工時 (h)</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums text-success">{data.summary.plannedRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">計畫投入率</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums text-red-500">{data.summary.incidentRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">事件佔比</p>
            </div>
            <div className="bg-card rounded-xl shadow-card p-4 text-center">
              <p className="text-xl font-semibold tabular-nums">{data.tasks.length}</p>
              <p className="text-xs text-muted-foreground mt-1">任務數</p>
            </div>
          </div>

          {/* Time entries count */}
          <div className="bg-card rounded-xl shadow-card p-4">
            <SectionTitle>稽核包內容預覽</SectionTitle>
            <StatRow label="工時紀錄筆數" value={data.timeEntries.length} />
            <StatRow label="任務清單筆數" value={data.tasks.length} />
            <StatRow label="期間" value={`${formatDate(fromDate)} — ${formatDate(toDate)}`} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  weekly: WeeklyReport,
  monthly: MonthlyReport,
  "time-distribution": TimeDistributionReport,
  completion: CompletionRateReport,
  kpi: KPIReport,
  workload: WorkloadReport,
  trends: TrendsReport,
  audit: AuditReport,
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("weekly");
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Print header — only visible when printing */}
      <div className="print-header hidden">
        <h1>TITAN — {activeTab === "weekly" ? "週報" : activeTab === "monthly" ? "月報" : activeTab === "kpi" ? "KPI 報表" : "計畫外負荷"}</h1>
        <p>列印日期：{formatDate(new Date())}</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">報表</h1>
          <p className="text-sm text-muted-foreground mt-1">週報、月報、KPI、計畫外負荷分析</p>
        </div>
        <PrintButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-accent/50 rounded-lg mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2 px-3 text-xs sm:text-sm rounded-md transition-colors",
              activeTab === tab.id
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ActiveComponent />
    </div>
  );
}
