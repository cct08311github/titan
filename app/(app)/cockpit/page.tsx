"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Gauge } from "lucide-react";
import { PageLoading, PageError } from "@/app/components/page-states";
import { HealthAlerts } from "@/app/components/cockpit/health-alerts";
import { PlanHealthCard } from "@/app/components/cockpit/plan-health-card";
import { GoalProgressList } from "@/app/components/cockpit/goal-progress-list";
import { KPIGaugeRow } from "@/app/components/cockpit/kpi-gauge-row";
import { TaskDistributionChart } from "@/app/components/cockpit/task-distribution-chart";
import { TimeInvestmentBar } from "@/app/components/cockpit/time-investment-bar";
import { extractData } from "@/lib/api-client";

// ── Types matching API response ─────────────────────────────────────────

interface Alert {
  type: "CRITICAL" | "WARNING" | "INFO";
  category: "GOAL" | "KPI" | "TASK" | "MILESTONE";
  message: string;
  targetId: string;
  targetType: string;
}

interface PlanResponse {
  id: string;
  title: string;
  year: number;
  progress: number;
  healthStatus: "HEALTHY" | "AT_RISK" | "CRITICAL";
  goals: {
    id: string;
    title: string;
    month: number;
    completed: boolean;
    taskCount: number;
    completedTaskCount: number;
  }[];
  kpis: {
    id: string;
    code: string;
    name: string;
    targetValue: number;
    actualValue: number;
    achievementRate: number;
  }[];
  taskDistribution: {
    backlog: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    overdue: number;
  };
  timeInvestment: {
    planned: number;
    actual: number;
    overtimeHours: number;
  };
  alerts: Alert[];
  milestones: {
    id: string;
    title: string;
    type: string;
    plannedEnd: string;
    status: string;
  }[];
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const isManager =
    session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cockpit?year=${year}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError("您沒有權限存取管理駕駛艙");
          return;
        }
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
    if (sessionStatus === "authenticated" && isManager) {
      fetchData();
    } else if (sessionStatus === "authenticated" && !isManager) {
      setLoading(false);
      setError("您沒有權限存取管理駕駛艙");
    }
  }, [sessionStatus, isManager, fetchData]);

  // RBAC guard
  if (sessionStatus === "loading") return <PageLoading />;
  if (!isManager) {
    return (
      <PageError message="權限不足 — 管理駕駛艙僅限經理及管理員存取" />
    );
  }
  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} />;

  // Collect all alerts across plans
  const allAlerts = plans.flatMap((p) => p.alerts);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6" data-testid="cockpit-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">管理駕駛艙</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="px-2 py-1 rounded text-sm hover:bg-muted transition-colors"
            aria-label="前一年"
          >
            &larr;
          </button>
          <span className="text-sm font-medium tabular-nums">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="px-2 py-1 rounded text-sm hover:bg-muted transition-colors"
            aria-label="後一年"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Alerts */}
      {allAlerts.length > 0 && <HealthAlerts alerts={allAlerts} />}

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">尚無 {year} 年度計畫</p>
        </div>
      ) : (
        plans.map((plan) => (
          <PlanHealthCard
            key={plan.id}
            plan={plan}
            expanded={expandedPlan === plan.id}
            onToggle={() =>
              setExpandedPlan(expandedPlan === plan.id ? null : plan.id)
            }
          >
            {/* Expanded detail grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GoalProgressList goals={plan.goals} />
              <KPIGaugeRow kpis={plan.kpis} />
              <TaskDistributionChart distribution={plan.taskDistribution} />
              <TimeInvestmentBar time={plan.timeInvestment} />
            </div>
          </PlanHealthCard>
        ))
      )}
    </div>
  );
}
