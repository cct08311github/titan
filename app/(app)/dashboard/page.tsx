"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

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
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", accent && "text-red-400")}>
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

  useEffect(() => {
    async function load() {
      try {
        const [wl, wr] = await Promise.all([
          fetch("/api/reports/workload").then((r) => r.json()),
          fetch("/api/reports/weekly").then((r) => r.json()),
        ]);
        setWorkload(wl);
        setWeekly(wr);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        載入中...
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="本週完成任務" value={weekly?.completedCount ?? "—"} />
        <StatCard label="本週總工時 (h)" value={weekly ? weekly.totalHours.toFixed(1) : "—"} />
        <StatCard
          label="逾期任務"
          value={weekly?.overdueCount ?? "—"}
          accent={(weekly?.overdueCount ?? 0) > 0}
        />
        <StatCard label="本月計畫外比例" value={workload ? `${workload.unplannedRate}%` : "—"} />
      </div>

      {/* ── Team workload ── */}
      <div className="bg-card border border-border rounded-lg p-5">
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
                      {p.total.toFixed(1)} h
                    </span>
                  </div>
                  <ProgressBar pct={pct} />
                  {unplannedPct > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      計畫外 {unplannedPct.toFixed(0)}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">本月尚無工時紀錄</p>
        )}
      </div>

      {/* ── 投入率 ── */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-medium mb-4">投入率分析（計畫任務 vs 加入任務）</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">計畫內投入</span>
              <span className="tabular-nums font-medium text-green-400">
                {workload?.plannedRate ?? 0}%
              </span>
            </div>
            <ProgressBar pct={workload?.plannedRate ?? 0} color="bg-green-500" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">計畫外投入</span>
              <span className="tabular-nums font-medium text-orange-400">
                {workload?.unplannedRate ?? 0}%
              </span>
            </div>
            <ProgressBar pct={workload?.unplannedRate ?? 0} color="bg-orange-500" />
          </div>
        </div>
      </div>

      {/* ── This month ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

  useEffect(() => {
    async function load() {
      try {
        const [taskRes, wr] = await Promise.all([
          fetch("/api/tasks?assignee=me&status=TODO,IN_PROGRESS").then((r) => r.json()),
          fetch("/api/reports/weekly").then((r) => r.json()),
        ]);
        setTasks(Array.isArray(taskRes) ? taskRes : taskRes.tasks ?? []);
        setWeekly(wr);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        載入中...
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
    URGENT: "text-red-400",
    HIGH: "text-orange-400",
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="進行中任務" value={tasks.length} />
        <StatCard label="逾期任務" value={overdue.length} accent={overdue.length > 0} />
        <StatCard
          label="本週工時 (h)"
          value={`${(weekly?.totalHours ?? 0).toFixed(1)} / 40`}
          sub={`進度 ${weeklyPct.toFixed(0)}%`}
        />
      </div>

      {/* ── Weekly hours bar ── */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">本週工時進度</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {(weekly?.totalHours ?? 0).toFixed(1)} / 40 h
          </span>
        </div>
        <ProgressBar
          pct={weeklyPct}
          color={weeklyPct >= 90 ? "bg-green-500" : weeklyPct >= 60 ? "bg-primary" : "bg-yellow-500"}
        />
      </div>

      {/* ── My tasks today ── */}
      <div className="bg-card border border-border rounded-lg p-5">
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
                        ? "text-red-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {new Date(t.dueDate).toLocaleDateString("zh-TW")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Overdue ── */}
      {overdue.length > 0 && (
        <div className="bg-card border border-red-500/30 rounded-lg p-5">
          <h2 className="text-sm font-medium text-red-400 mb-3">逾期任務</h2>
          <div className="space-y-2">
            {overdue.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">{t.title}</span>
                <span className="text-red-400 tabular-nums text-xs flex-shrink-0 ml-2">
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString("zh-TW") : ""}
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
        <h1 className="text-2xl font-medium tracking-[-0.04em]">儀表板</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isManager ? "主管視角 — 團隊整體狀況" : "工程師視角 — 我的工作狀況"}
        </p>
      </div>

      {status === "loading" ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          載入中...
        </div>
      ) : isManager ? (
        <ManagerDashboard />
      ) : (
        <EngineerDashboard />
      )}
    </div>
  );
}
