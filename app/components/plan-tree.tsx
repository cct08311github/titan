"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Target, Calendar, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type MonthlyGoal = {
  id: string;
  month: number;
  title: string;
  status: GoalStatus;
  progressPct: number;
  _count?: { tasks: number };
};

type AnnualPlan = {
  id: string;
  year: number;
  title: string;
  progressPct: number;
  monthlyGoals: MonthlyGoal[];
  _count?: { monthlyGoals: number };
};

const goalStatusConfig: Record<GoalStatus, { icon: React.ElementType; color: string; label: string }> = {
  NOT_STARTED: { icon: Circle, color: "text-muted-foreground", label: "未開始" },
  IN_PROGRESS: { icon: Clock, color: "text-blue-400", label: "進行中" },
  COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", label: "已完成" },
  CANCELLED: { icon: XCircle, color: "text-muted-foreground", label: "已取消" },
};

const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

interface PlanTreeProps {
  plans: AnnualPlan[];
  onSelectGoal?: (goalId: string) => void;
  onSelectPlan?: (planId: string) => void;
}

export function PlanTree({ plans, onSelectGoal, onSelectPlan }: PlanTreeProps) {
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set(plans.map((p) => p.id)));

  function togglePlan(planId: string) {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        尚無年度計畫，請先建立
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => {
        const expanded = expandedPlans.has(plan.id);
        return (
          <div key={plan.id} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Plan header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => togglePlan(plan.id)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <Target className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{plan.year}</span>
                  <button
                    onClick={() => onSelectPlan?.(plan.id)}
                    className="text-sm font-medium text-foreground hover:text-foreground truncate transition-colors text-left"
                  >
                    {plan.title}
                  </button>
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${plan.progressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                    {Math.round(plan.progressPct)}%
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {plan.monthlyGoals.length} 個月度目標
              </span>
            </div>

            {/* Monthly goals */}
            {expanded && plan.monthlyGoals.length > 0 && (
              <div className="border-t border-border">
                {plan.monthlyGoals.map((goal, idx) => {
                  const sConfig = goalStatusConfig[goal.status];
                  const StatusIcon = sConfig.icon;
                  return (
                    <div
                      key={goal.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer",
                        idx < plan.monthlyGoals.length - 1 && "border-b border-border/50"
                      )}
                      onClick={() => onSelectGoal?.(goal.id)}
                    >
                      {/* Indent */}
                      <div className="w-4 flex-shrink-0" />
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground w-7 flex-shrink-0 font-mono">
                        {monthNames[goal.month]}
                      </span>
                      <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", sConfig.color)} />
                      <span className="flex-1 text-sm text-foreground truncate">{goal.title}</span>
                      {/* Mini progress */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${goal.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">
                          {Math.round(goal.progressPct)}%
                        </span>
                      </div>
                      {goal._count && (
                        <span className="text-[10px] text-muted-foreground w-10 text-right flex-shrink-0">
                          {goal._count.tasks} 項
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {expanded && plan.monthlyGoals.length === 0 && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                此計畫尚無月度目標
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
