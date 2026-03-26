"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Gauge, BarChart3, FileText, Flame, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading, PageError } from "@/app/components/page-states";
import { HealthAlerts } from "@/app/components/cockpit/health-alerts";
import { PlanHealthCard } from "@/app/components/cockpit/plan-health-card";
import { GoalProgressList } from "@/app/components/cockpit/goal-progress-list";
import { KPIGaugeRow } from "@/app/components/cockpit/kpi-gauge-row";
import { TaskDistributionChart } from "@/app/components/cockpit/task-distribution-chart";
import { TimeInvestmentBar } from "@/app/components/cockpit/time-investment-bar";
import { extractData } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────────────

interface Alert {
  type: "CRITICAL" | "WARNING" | "INFO";
  category: "GOAL" | "KPI" | "TASK" | "MILESTONE";
  message: string;
  targetId: string;
  targetType: string;
}

interface RootCauseTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  managerFlagged: boolean;
  assignee: string | null;
}

interface PlanResponse {
  id: string;
  title: string;
  year: number;
  progress: number;
  healthStatus: "HEALTHY" | "AT_RISK" | "CRITICAL";
  flaggedCount: number;
  rootCauseTasks: RootCauseTask[];
  goals: { id: string; title: string; month: number; completed: boolean; taskCount: number; completedTaskCount: number }[];
  kpis: { id: string; code: string; name: string; targetValue: number; actualValue: number; achievementRate: number }[];
  taskDistribution: { backlog: number; todo: number; inProgress: number; review: number; done: number; overdue: number };
  timeInvestment: { planned: number; actual: number; overtimeHours: number };
  alerts: Alert[];
  milestones: { id: string; title: string; type: string; plannedEnd: string; status: string }[];
}

// ── Root Cause Drill-down — Issue #962 ──────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = { P0: "text-red-500", P1: "text-orange-500", P2: "text-yellow-500", P3: "text-gray-500" };

function RootCauseList({ tasks }: { tasks: RootCauseTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        根因任務 ({tasks.length})
      </h3>
      <div className="space-y-1.5">
        {tasks.slice(0, 10).map((t) => {
          const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
          return (
            <div key={t.id} className="flex items-center gap-2 p-2 bg-accent/40 rounded text-sm">
              {t.managerFlagged && <Flame className="h-3.5 w-3.5 text-red-500 fill-red-500 flex-shrink-0" />}
              <span className={cn("text-[11px] font-medium w-6 flex-shrink-0", PRIORITY_COLOR[t.priority] ?? "text-gray-500")}>{t.priority}</span>
              <span className="flex-1 text-foreground truncate min-w-0">{t.title}</span>
              {t.assignee && <span className="text-[11px] text-muted-foreground flex-shrink-0">{t.assignee}</span>}
              {t.dueDate && <span className={cn("text-[11px] tabular-nums flex-shrink-0", isOverdue ? "text-red-500" : "text-muted-foreground")}>{formatDate(t.dueDate)}</span>}
            </div>
          );
        })}
        {tasks.length > 10 && <p className="text-xs text-muted-foreground">還有 {tasks.length - 10} 個根因任務...</p>}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cockpit?year=${year}`);
      if (!res.ok) {
        if (res.status === 403) { setError("您沒有權限存取管理駕駛艙"); return; }
        throw new Error(`API error: ${res.status}`);
      }
      const body = await res.json();
      const data = extractData(body);
      setPlans((data as { plans: PlanResponse[] }).plans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isManager) fetchData();
    else if (sessionStatus === "authenticated" && !isManager) { setLoading(false); setError("您沒有權限存取管理駕駛艙"); }
  }, [sessionStatus, isManager, fetchData]);

  if (sessionStatus === "loading") return <PageLoading />;
  if (!isManager) return <PageError message="權限不足 — 管理駕駛艙僅限經理及管理員存取" />;
  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  const allAlerts = plans.flatMap((p) => p.alerts);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6" data-testid="cockpit-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">管理駕駛艙</h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="/reports" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <BarChart3 className="h-4 w-4" /> 報表
          </a>
          <a href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <FileText className="h-4 w-4" /> My Day
          </a>
          <div className="h-4 w-px bg-border mx-1" />
          <button onClick={() => setYear((y) => y - 1)} className="px-2 py-1 rounded text-sm hover:bg-muted transition-colors" aria-label="前一年">&larr;</button>
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="px-2 py-1 rounded text-sm hover:bg-muted transition-colors" aria-label="後一年">&rarr;</button>
        </div>
      </div>

      {allAlerts.length > 0 && <HealthAlerts alerts={allAlerts} />}

      {plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-lg">尚無 {year} 年度計畫</p></div>
      ) : (
        plans.map((plan) => (
          <PlanHealthCard key={plan.id} plan={plan} expanded={expandedPlan === plan.id} onToggle={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)} flaggedCount={plan.flaggedCount}>
            <div className="space-y-6">
              {plan.rootCauseTasks.length > 0 && <RootCauseList tasks={plan.rootCauseTasks} />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GoalProgressList goals={plan.goals} />
                <KPIGaugeRow kpis={plan.kpis} />
                <TaskDistributionChart distribution={plan.taskDistribution} />
                <TimeInvestmentBar time={plan.timeInvestment} />
              </div>
            </div>
          </PlanHealthCard>
        ))
      )}
    </div>
  );
}
