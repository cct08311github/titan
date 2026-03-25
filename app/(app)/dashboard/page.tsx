"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Target, ClipboardList, Clock, BarChart3, Users, CalendarClock, AlertTriangle } from "lucide-react";
import { safeFixed, safePct } from "@/lib/safe-number";
import { cn } from "@/lib/utils";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { formatDate } from "@/lib/format";

// ── Types ──────────────────────────────────────────────────────────────────

interface KPIAchievement {
  id: string;
  code: string;
  title: string;
  target: number;
  actual: number;
  status: string;
  achievementRate: number;
}

interface WorkloadPerson {
  userId: string;
  name: string;
  total: number;
  planned: number;
  unplanned: number;
}

interface WorkloadData {
  byPerson: WorkloadPerson[];
  plannedRate: number;
  unplannedRate: number;
  totalHours: number;
}

interface WeeklyData {
  completedCount: number;
  overdueCount: number;
  delayCount: number;
  scopeChangeCount: number;
  totalHours: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

// ── Defensive data extractor ───────────────────────────────────────────────

/**
 * Safely extract an array of items from various API response formats:
 * - Direct array: [item, ...]
 * - Paginated: { data: { items: [...], pagination: {...} } }
 * - Legacy object: { tasks: [...] } or { items: [...] }
 */
function extractItems<T>(data: unknown, legacyKey?: string): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Paginated: { data: { items: [...] } }
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.items)) return inner.items as T[];
      if (Array.isArray(inner)) return inner as T[];
    }
    // Legacy key (e.g. "tasks")
    if (legacyKey && Array.isArray(obj[legacyKey])) return obj[legacyKey] as T[];
    // Generic items
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

// ── Today's Tasks Card ──────────────────────────────────────────────────────

function dueCountdownText(dueDate: string): { text: string; urgent: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, urgent: true };
  if (diffDays === 0) return { text: "今天截止", urgent: true };
  if (diffDays === 1) return { text: "明天截止", urgent: true };
  if (diffDays <= 3) return { text: `${diffDays} 天後截止`, urgent: true };
  if (diffDays <= 7) return { text: `${diffDays} 天後截止`, urgent: false };
  return { text: `${diffDays} 天後截止`, urgent: false };
}

function TodayTasksCard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTodayTasks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks?assignee=me&status=TODO,IN_PROGRESS");
      if (!res.ok) throw new Error("無法載入待辦任務");
      const data = await res.json();
      const all: Task[] = extractItems<Task>(data, "tasks");
      // Sort by dueDate (closest first), tasks without dueDate go last
      const withDue = all
        .filter((t) => t.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      const withoutDue = all.filter((t) => !t.dueDate);
      setTasks([...withDue, ...withoutDue].slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTodayTasks(); }, []);

  if (loading) return <PageLoading message="載入待辦..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={fetchTodayTasks} className="py-8" />;
  if (tasks.length === 0) return (
    <PageEmpty
      icon={<CalendarClock className="h-8 w-8" />}
      title="沒有待辦任務"
      description="目前沒有進行中或待辦的任務"
      className="py-8"
    />
  );

  const PRIORITY_DOT: Record<string, string> = {
    URGENT: "bg-danger",
    HIGH: "bg-warning",
    MEDIUM: "bg-yellow-400",
    LOW: "bg-muted-foreground",
  };
  const STATUS_LABEL: Record<string, string> = {
    TODO: "待辦",
    IN_PROGRESS: "進行中",
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        今日待辦
        <span className="text-xs text-muted-foreground font-normal">（最近 5 項）</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => {
          const countdown = t.dueDate ? dueCountdownText(t.dueDate) : null;
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 bg-accent/40 rounded-md hover:bg-accent/60 transition-colors"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  PRIORITY_DOT[t.priority] ?? "bg-muted-foreground"
                )}
              />
              <span className="flex-1 text-sm text-foreground truncate">{t.title}</span>
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
              {countdown ? (
                <span
                  className={cn(
                    "text-[11px] tabular-nums flex-shrink-0 flex items-center gap-1",
                    countdown.urgent ? "text-danger font-medium" : "text-muted-foreground"
                  )}
                >
                  {countdown.urgent && <AlertTriangle className="h-3 w-3" />}
                  {countdown.text}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground flex-shrink-0">無截止日</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Achievement Section ─────────────────────────────────────────────────

const KPI_STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "text-success bg-success/10",
  AT_RISK:  "text-yellow-400 bg-warning/10",
  BEHIND:   "text-danger bg-danger/10",
  ACHIEVED: "text-blue-400 bg-blue-500/10",
};
const KPI_STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "進行中",
  AT_RISK:  "風險",
  BEHIND:   "落後",
  ACHIEVED: "達成",
};

function KPIAchievementSection() {
  const [kpis, setKpis] = useState<KPIAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchKPIs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kpi?year=${new Date().getFullYear()}`);
      if (!res.ok) throw new Error("無法載入 KPI");
      const data: Array<{
        id: string; code: string; title: string; target: number; actual: number; status: string;
        taskLinks: Array<{ weight: number; task: { status: string; progressPct: number } }>;
        autoCalc: boolean;
      }> = await res.json();
      const mapped: KPIAchievement[] = (Array.isArray(data) ? data : []).map((k) => {
        let rate = 0;
        if (k.autoCalc && k.taskLinks.length > 0) {
          const totalW = k.taskLinks.reduce((s, l) => s + l.weight, 0);
          const weighted = k.taskLinks.reduce((s, l) => {
            const prog = l.task.status === "DONE" ? 100 : l.task.progressPct;
            return s + (prog * l.weight) / 100;
          }, 0);
          rate = totalW > 0 ? Math.min((weighted / totalW) * k.target, 100) : 0;
        } else {
          rate = k.target > 0 ? Math.min((k.actual / k.target) * 100, 100) : 0;
        }
        return { id: k.id, code: k.code, title: k.title, target: k.target, actual: k.actual, status: k.status, achievementRate: rate };
      });
      setKpis(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKPIs(); }, []);

  if (loading) return <PageLoading message="載入 KPI..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={fetchKPIs} className="py-8" />;
  if (kpis.length === 0) return (
    <PageEmpty
      icon={<Target className="h-8 w-8" />}
      title="尚無 KPI"
      description="本年度尚未建立 KPI 指標"
      className="py-8"
    />
  );

  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        KPI 達成狀況（{new Date().getFullYear()} 年度）
      </h2>
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const barColor =
            kpi.achievementRate >= 100 ? "bg-success" :
            kpi.achievementRate >= 60  ? "bg-primary" :
            kpi.achievementRate >= 30  ? "bg-warning" : "bg-danger";
          return (
            <div key={kpi.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{kpi.code}</span>
                  <span className="text-sm text-foreground truncate">{kpi.title}</span>
                  {kpi.status && (
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                      KPI_STATUS_COLOR[kpi.status] ?? "text-muted-foreground bg-accent")}>
                      {KPI_STATUS_LABEL[kpi.status] ?? kpi.status}
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{safePct(kpi.achievementRate, 0, "0")}%</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums ml-1.5">
                    {kpi.actual} / {kpi.target}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", barColor)}
                  style={{ width: `${Math.min(kpi.achievementRate, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl shadow-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", accent && "text-danger")}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Manager Dashboard ──────────────────────────────────────────────────────

function ManagerDashboard() {
  const [workload, setWorkload] = useState<WorkloadData | null>(null);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [wlRaw, wr] = await Promise.all([
        fetch("/api/reports/workload").then((r) => { if (!r.ok) throw new Error("工作負載載入失敗"); return r.json(); }),
        fetch("/api/reports/weekly").then((r) => { if (!r.ok) throw new Error("週報載入失敗"); return r.json(); }),
      ]);
      // Defensive: handle paginated or direct response
      const wl: WorkloadData = wlRaw?.data ?? wlRaw;
      setWorkload(wl && typeof wl === "object" ? wl : null);
      const weeklyData: WeeklyData = wr?.data ?? wr;
      setWeekly(weeklyData && typeof weeklyData === "object" ? weeklyData : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={load} />;

  // Check if there is truly no data at all
  const hasNoData =
    (weekly?.completedCount ?? 0) === 0 &&
    (weekly?.totalHours ?? 0) === 0 &&
    (weekly?.overdueCount ?? 0) === 0 &&
    (workload?.totalHours ?? 0) === 0 &&
    (!workload?.byPerson || workload.byPerson.length === 0);

  if (hasNoData) {
    return (
      <div className="space-y-6">
        <PageEmpty
          icon={<BarChart3 className="h-8 w-8" />}
          title="尚無團隊數據"
          description="目前沒有任務完成紀錄與工時資料。當團隊成員開始記錄工時與完成任務後，此處將自動顯示團隊整體狀況。"
          className="py-16"
        />
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-medium mb-3">快速開始指南</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">建立年度計畫</p>
                <p className="text-xs text-muted-foreground">前往「計畫」頁面建立年度計畫與月度目標</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">指派任務給團隊成員</p>
                <p className="text-xs text-muted-foreground">在看板或任務列表中建立任務並指派負責人</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-primary">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">記錄工時</p>
                <p className="text-xs text-muted-foreground">請團隊成員在「工時」頁面每日登錄工時，即可在此追蹤進度</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxPersonHours =
    workload?.byPerson?.length
      ? Math.max(...workload.byPerson.map((p) => p.total), 1)
      : 1;

  return (
    <div className="space-y-6">
      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="本週完成任務" value={weekly?.completedCount ?? "—"} />
        <StatCard label="本週總工時 (h)" value={safeFixed(weekly?.totalHours, 1, "—")} />
        <StatCard
          label="逾期任務"
          value={weekly?.overdueCount ?? "—"}
          accent={(weekly?.overdueCount ?? 0) > 0}
        />
        <StatCard label="本月計畫外比例" value={workload ? `${workload.unplannedRate}%` : "—"} />
      </div>

      {/* ── Team workload ── */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-medium mb-4">團隊工時分佈（本月）</h2>
        {workload?.byPerson?.length ? (
          <div className="space-y-3">
            {workload.byPerson.slice(0, 5).map((p) => {
              const pct = (p.total / maxPersonHours) * 100;
              const unplannedPct = p.total > 0 ? (p.unplanned / p.total) * 100 : 0;
              return (
                <div key={p.userId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {safeFixed(p.total, 1)} h
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                  {unplannedPct > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      計畫外 {safePct(unplannedPct, 0)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <PageEmpty
            icon={<Users className="h-6 w-6" />}
            title="本月尚無工時紀錄"
            description="團隊成員開始記錄工時後，此處將顯示每人的工時分佈與計畫外比例"
            className="py-8"
          />
        )}
      </div>

      {/* ── 投入率 ── */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-medium mb-4">投入率分析（計畫任務 vs 加入任務）</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">計畫內投入</span>
              <span className="tabular-nums font-medium text-success">
                {workload?.plannedRate ?? 0}%
              </span>
            </div>
            <ProgressBar pct={workload?.plannedRate ?? 0} color="bg-success" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">計畫外投入</span>
              <span className="tabular-nums font-medium text-warning">
                {workload?.unplannedRate ?? 0}%
              </span>
            </div>
            <ProgressBar pct={workload?.unplannedRate ?? 0} color="bg-warning" />
          </div>
        </div>
      </div>

      {/* ── This month ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="本週延遲次數" value={weekly?.delayCount ?? "—"} accent={(weekly?.delayCount ?? 0) > 0} />
        <StatCard label="本週範疇變更" value={weekly?.scopeChangeCount ?? "—"} />
        <StatCard
          label="計畫外負荷率"
          value={workload ? `${workload.unplannedRate}%` : "—"}
          sub="(ADDED+INCIDENT+SUPPORT)"
        />
        <StatCard
          label="計畫投入率"
          value={workload ? `${workload.plannedRate}%` : "—"}
          sub="(PLANNED_TASK)"
        />
      </div>
    </div>
  );
}

// ── Engineer Dashboard ─────────────────────────────────────────────────────

function EngineerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [taskRes, wr] = await Promise.all([
        fetch("/api/tasks?assignee=me&status=TODO,IN_PROGRESS").then((r) => { if (!r.ok) throw new Error("任務載入失敗"); return r.json(); }),
        fetch("/api/reports/weekly").then((r) => { if (!r.ok) throw new Error("週報載入失敗"); return r.json(); }),
      ]);
      // Defensive: support paginated response { data: { items, pagination } } and legacy formats
      setTasks(extractItems<Task>(taskRes, "tasks"));
      const weeklyData: WeeklyData = wr?.data ?? wr;
      setWeekly(weeklyData && typeof weeklyData === "object" ? weeklyData : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={load} />;

  // Check if engineer has no data at all
  const hasNoData = tasks.length === 0 && (weekly?.totalHours ?? 0) === 0;

  if (hasNoData) {
    return (
      <div className="space-y-6">
        <PageEmpty
          icon={<ClipboardList className="h-8 w-8" />}
          title="尚無待處理任務"
          description="目前沒有進行中的任務與工時紀錄。當主管指派任務給您後，此處將顯示您的工作狀況。"
          className="py-16"
        />
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-medium mb-3">開始使用</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">記錄每日工時</p>
                <p className="text-xs text-muted-foreground">前往「工時」頁面登錄您的每日工作時數，協助團隊追蹤進度</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ClipboardList className="h-3 w-3 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">查看看板</p>
                <p className="text-xs text-muted-foreground">在「看板」頁面查看與管理您被指派的任務</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const weeklyPct = Math.min(((weekly?.totalHours ?? 0) / 40) * 100, 100);
  const today = new Date().toDateString();
  const overdue = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE"
  );

  const PRIORITY_LABEL: Record<string, string> = {
    URGENT: "緊急",
    HIGH: "高",
    MEDIUM: "中",
    LOW: "低",
  };
  const PRIORITY_COLOR: Record<string, string> = {
    URGENT: "text-danger",
    HIGH: "text-warning",
    MEDIUM: "text-yellow-400",
    LOW: "text-muted-foreground",
  };
  const STATUS_LABEL: Record<string, string> = {
    TODO: "待辦",
    IN_PROGRESS: "進行中",
    DONE: "完成",
    BLOCKED: "封鎖",
  };

  return (
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="進行中任務" value={tasks.length} />
        <StatCard label="逾期任務" value={overdue.length} accent={overdue.length > 0} />
        <StatCard
          label="本週工時 (h)"
          value={`${safeFixed(weekly?.totalHours, 1)} / 40`}
          sub={`進度 ${safePct(weeklyPct, 0)}%`}
        />
      </div>

      {/* ── Weekly hours bar ── */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">本週工時進度</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {safeFixed(weekly?.totalHours, 1)} / 40 h
          </span>
        </div>
        <ProgressBar
          pct={weeklyPct}
          color={weeklyPct >= 90 ? "bg-success" : weeklyPct >= 60 ? "bg-primary" : "bg-warning"}
        />
      </div>

      {/* ── My tasks today ── */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-medium mb-4">我的任務（待辦 + 進行中）</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">目前沒有待處理的任務</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-3 bg-accent/40 rounded-md hover:bg-accent/60 transition-colors"
              >
                <span
                  className={cn(
                    "text-[11px] font-medium w-8 flex-shrink-0",
                    PRIORITY_COLOR[t.priority] ?? "text-muted-foreground"
                  )}
                >
                  {PRIORITY_LABEL[t.priority] ?? t.priority}
                </span>
                <span className="flex-1 text-sm text-foreground truncate">{t.title}</span>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
                {t.dueDate && (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums flex-shrink-0",
                      new Date(t.dueDate) < new Date()
                        ? "text-danger"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatDate(t.dueDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Overdue ── */}
      {overdue.length > 0 && (
        <div className="bg-card border-l-[3px] border-l-danger shadow-card rounded-lg p-5">
          <h2 className="text-sm font-medium text-danger mb-3">逾期任務</h2>
          <div className="space-y-2">
            {overdue.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{t.title}</span>
                <span className="text-danger tabular-nums text-xs flex-shrink-0 ml-2">
                  {t.dueDate ? formatDate(t.dueDate) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const isManager = session?.user?.role === "MANAGER";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">儀表板</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isManager ? "主管視角 — 團隊整體狀況" : "工程師視角 — 我的工作狀況"}
        </p>
      </div>

      {status === "loading" ? (
        <PageLoading />
      ) : isManager ? (
        <ManagerDashboard />
      ) : (
        <EngineerDashboard />
      )}

      {/* ── Today's Tasks Card (both views) ── */}
      {status !== "loading" && (
        <div className="mt-8">
          <TodayTasksCard />
        </div>
      )}

      {/* ── KPI Achievement Cards ── */}
      {status !== "loading" && (
        <div className="mt-8">
          <KPIAchievementSection />
        </div>
      )}
    </div>
  );
}
