"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Flame,
  Calendar,
  Clock,
  AlertTriangle,
  Users,
  Target,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { extractData } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { safeFixed } from "@/lib/safe-number";

// ── Skeleton loader ─────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-muted rounded", className)} />
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── Shared types ────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  flagReason?: string | null;
  managerFlagged?: boolean;
  estimatedHours?: number | null;
  actualHours?: number | null;
  primaryAssignee?: { id: string; name: string; avatar?: string | null } | null;
}

interface Alert {
  type: string;
  message: string;
}

interface MemberWorkload {
  id: string;
  name: string;
  avatar: string | null;
  activeTasks: number;
  overdueTasks: number;
  flaggedTasks: number;
}

interface PlanSummary {
  id: string;
  title: string;
  progressPct: number;
  flaggedCount: number;
}

interface MonthlyGoalItem {
  id: string;
  title: string;
  progressPct: number;
  status: string;
}

interface TimeSuggestion {
  taskId: string;
  title: string;
  estimatedHours: number | null;
  suggestion: string;
}

interface EngineerData {
  role: "ENGINEER";
  flaggedTasks: TaskItem[];
  dueTodayTasks: TaskItem[];
  inProgressTasks: TaskItem[];
  todayHours: number;
  dailyTarget: number;
  timeSuggestions: TimeSuggestion[];
  monthlyGoals: MonthlyGoalItem[];
}

interface ManagerData {
  role: "MANAGER";
  flaggedTasks: TaskItem[];
  overdueTasks: TaskItem[];
  memberWorkload: MemberWorkload[];
  todayHours: number;
  alerts: Alert[];
  planSummaries: PlanSummary[];
}

type MyDayData = EngineerData | ManagerData;

// ── Task Row ────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  P0: "bg-red-500",
  P1: "bg-orange-500",
  P2: "bg-yellow-400",
  P3: "bg-gray-400",
};

function TaskRow({ task }: { task: TaskItem }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";

  return (
    <div className="flex items-center gap-2 p-2.5 bg-accent/40 rounded-md hover:bg-accent/60 transition-colors">
      {task.managerFlagged && (
        <Flame className="h-3.5 w-3.5 text-red-500 fill-red-500 flex-shrink-0" />
      )}
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", PRIORITY_DOT[task.priority] ?? "bg-gray-400")} />
      <span className="flex-1 text-sm text-foreground truncate min-w-0">{task.title}</span>
      {task.primaryAssignee && (
        <span className="text-[11px] text-muted-foreground flex-shrink-0">{task.primaryAssignee.name}</span>
      )}
      {task.dueDate && (
        <span className={cn("text-[11px] tabular-nums flex-shrink-0", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
          {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
          {formatDate(task.dueDate)}
        </span>
      )}
    </div>
  );
}

// ── Engineer My Day ─────────────────────────────────────────────────────

function EngineerMyDay({ data }: { data: EngineerData }) {
  const hoursPct = Math.min((data.todayHours / data.dailyTarget) * 100, 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
      {/* Left column — Task sections */}
      <div className="space-y-4">
        {/* Flagged tasks (red top) */}
        {data.flaggedTasks.length > 0 && (
          <div className="bg-card rounded-xl shadow-card p-5 border-l-[3px] border-l-red-500">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
              <Flame className="h-4 w-4 fill-current" />
              主管標記任務
            </h2>
            <div className="space-y-2">
              {data.flaggedTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}

        {/* Due today (yellow) */}
        <div className="bg-card rounded-xl shadow-card p-5">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-yellow-500" />
            今日到期
            <span className="text-xs text-muted-foreground font-normal">({data.dueTodayTasks.length})</span>
          </h2>
          {data.dueTodayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">今天沒有到期任務</p>
          ) : (
            <div className="space-y-2">
              {data.dueTodayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>

        {/* In progress */}
        <div className="bg-card rounded-xl shadow-card p-5">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            進行中
            <span className="text-xs text-muted-foreground font-normal">({data.inProgressTasks.length})</span>
          </h2>
          {data.inProgressTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">目前沒有進行中的任務</p>
          ) : (
            <div className="space-y-2">
              {data.inProgressTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>

        {/* Time suggestions */}
        {data.timeSuggestions.length > 0 && (
          <div className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              時間建議
            </h2>
            <div className="space-y-2">
              {data.timeSuggestions.map((s) => (
                <div key={s.taskId} className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded text-sm text-purple-700 dark:text-purple-300">
                  <ArrowRight className="h-3 w-3 flex-shrink-0" />
                  <span>{s.suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right column — Info panels */}
      <div className="space-y-4">
        {/* Today hours summary */}
        <div className="bg-card rounded-xl shadow-card p-5">
          <h2 className="text-sm font-medium mb-3">今日工時</h2>
          <div className="text-2xl font-semibold tabular-nums">
            {safeFixed(data.todayHours, 1)}h <span className="text-sm text-muted-foreground font-normal">/ {data.dailyTarget}h</span>
          </div>
          <div className="mt-2 h-2 bg-accent rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                hoursPct >= 90 ? "bg-green-500" : hoursPct >= 50 ? "bg-blue-500" : "bg-yellow-500"
              )}
              style={{ width: `${hoursPct}%` }}
            />
          </div>
          {data.todayHours === 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              尚未記錄任何工時
            </p>
          )}
        </div>

        {/* Monthly goals */}
        {data.monthlyGoals.length > 0 && (
          <div className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              本月目標
            </h2>
            <div className="space-y-3">
              {data.monthlyGoals.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground truncate">{g.title}</span>
                    <span className="tabular-nums text-muted-foreground ml-2">{Math.round(g.progressPct)}%</span>
                  </div>
                  <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        g.progressPct >= 80 ? "bg-green-500" : g.progressPct >= 40 ? "bg-blue-500" : "bg-yellow-500"
                      )}
                      style={{ width: `${Math.min(g.progressPct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manager My Day ──────────────────────────────────────────────────────

function ManagerMyDay({ data }: { data: ManagerData }) {
  return (
    <div className="space-y-6">
      {/* Alerts bar */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                alert.type === "CRITICAL"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
              )}
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* Left — Team health + flagged items */}
        <div className="space-y-4">
          {/* Team health snapshot */}
          <div className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              團隊健康快照
            </h2>
            {data.memberWorkload.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無團隊成員資料</p>
            ) : (
              <div className="space-y-3">
                {data.memberWorkload.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 bg-accent/40 rounded-md">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {m.avatar ? (
                        <img src={m.avatar} alt={m.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        m.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>進行中 {m.activeTasks}</span>
                        {m.overdueTasks > 0 && <span className="text-red-500">逾期 {m.overdueTasks}</span>}
                        {m.flaggedTasks > 0 && <span className="text-red-500">標記 {m.flaggedTasks}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flagged items */}
          {data.flaggedTasks.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-5 border-l-[3px] border-l-red-500">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                <Flame className="h-4 w-4 fill-current" />
                已標記任務
                <span className="text-xs font-normal">({data.flaggedTasks.length})</span>
              </h2>
              <div className="space-y-2">
                {data.flaggedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}

          {/* Overdue tasks */}
          {data.overdueTasks.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-5 border-l-[3px] border-l-orange-500">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                逾期任務
                <span className="text-xs font-normal">({data.overdueTasks.length})</span>
              </h2>
              <div className="space-y-2">
                {data.overdueTasks.slice(0, 10).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
                {data.overdueTasks.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-1">還有 {data.overdueTasks.length - 10} 個逾期任務...</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — Workload + plan summaries */}
        <div className="space-y-4">
          {/* Plan summaries */}
          {data.planSummaries.length > 0 && (
            <div className="bg-card rounded-xl shadow-card p-5">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                年度計畫
              </h2>
              <div className="space-y-3">
                {data.planSummaries.map((p) => (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground truncate">{p.title}</span>
                      <span className="tabular-nums text-muted-foreground ml-2">{Math.round(p.progressPct)}%</span>
                    </div>
                    <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(p.progressPct, 100)}%` }}
                      />
                    </div>
                    {p.flaggedCount > 0 && (
                      <p className="text-[11px] text-red-500 flex items-center gap-1">
                        <Flame className="h-3 w-3 fill-current" />
                        {p.flaggedCount} 個標記任務
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-card rounded-xl shadow-card p-5">
            <h2 className="text-sm font-medium mb-3">快速前往</h2>
            <div className="grid grid-cols-2 gap-2">
              <a href="/cockpit" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/60 hover:bg-accent transition-colors text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                駕駛艙
              </a>
              <a href="/kanban" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/60 hover:bg-accent transition-colors text-sm">
                <Target className="h-4 w-4 text-primary" />
                看板
              </a>
              <a href="/reports" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/60 hover:bg-accent transition-colors text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                報表
              </a>
              <a href="/timesheet" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/60 hover:bg-accent transition-colors text-sm">
                <Clock className="h-4 w-4 text-primary" />
                工時
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────
type DashboardTab = "my-day" | "team";

const TAB_STORAGE_KEY = "titan-dashboard-tab";

function getStoredTab(): DashboardTab | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(TAB_STORAGE_KEY);
    if (val === "my-day" || val === "team") return val;
  } catch { /* ignore */ }
  return null;
}

function storeTab(tab: DashboardTab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch { /* ignore */ }
}

// ── Dashboard Tabs ────────────────────────────────────────────────────────

function DashboardTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}) {
  const tabs: { key: DashboardTab; label: string }[] = [
    { key: "my-day", label: "我的一天" },
    { key: "team", label: "團隊全局" },
  ];

  return (
    <div className="flex gap-1 border-b border-border mb-6" data-testid="dashboard-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "px-4 py-2 text-sm transition-colors relative -mb-px",
            activeTab === tab.key
              ? "font-semibold text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<MyDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  // Issue #990: Tab state — Manager defaults to "team", Engineer always "my-day"
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const stored = getStoredTab();
    if (stored) return stored;
    return "team"; // will be forced to "my-day" for engineers in the effect
  });

  // Force engineers to my-day
  useEffect(() => {
    if (status === "authenticated" && !isManager) {
      setActiveTab("my-day");
    } else if (status === "authenticated" && isManager) {
      const stored = getStoredTab();
      if (stored) setActiveTab(stored);
    }
  }, [status, isManager]);

  const fetchMyDay = useCallback(async (view?: DashboardTab) => {
    setLoading(true);
    setError(null);
    try {
      const viewParam = view ?? activeTab;
      const url = isManager ? `/api/my-day?view=${viewParam}` : "/api/my-day";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`載入失敗 (${res.status})`);
      const body = await res.json();
      setData(extractData<MyDayData>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [activeTab, isManager]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchMyDay();
    }
  }, [status, fetchMyDay]);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    storeTab(tab);
    fetchMyDay(tab);
  };

  const [greeting, setGreeting] = useState("");
  const userName = session?.user?.name ?? "";

  // Set greeting on client only to avoid hydration mismatch
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const subtitle = activeTab === "team"
    ? "團隊全局 — 今日需關注事項"
    : "我的一天 — 今日工作安排";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting}，{userName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {/* Tabs — only shown for Manager/Admin */}
      {isManager && (
        <DashboardTabs activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Progressive loading with skeletons */}
      {status === "loading" || loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
          <div className="space-y-4">
            <SectionSkeleton rows={2} />
            <SectionSkeleton rows={3} />
          </div>
          <div className="space-y-4">
            <SectionSkeleton rows={1} />
            <SectionSkeleton rows={2} />
          </div>
        </div>
      ) : error ? (
        <PageError message={error} onRetry={() => fetchMyDay()} />
      ) : !data ? (
        <PageEmpty title="尚無資料" description="無法載入 My Day 資料" />
      ) : data.role === "MANAGER" ? (
        <ManagerMyDay data={data} />
      ) : (
        <EngineerMyDay data={data} />
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "早安";
  if (hour < 18) return "午安";
  return "晚安";
}
