"use client";

import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/app/api/cockpit/route";
import { useState } from "react";

interface TaskDistribution {
  backlog: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
}

interface TimeInvestment {
  planned: number;
  actual: number;
  overtimeHours: number;
}

interface KPISummary {
  id: string;
  code: string;
  name: string;
  targetValue: number;
  actualValue: number;
  achievementRate: number;
}

export interface PlanData {
  id: string;
  title: string;
  year: number;
  progress: number;
  healthStatus: HealthStatus;
  taskDistribution: TaskDistribution;
  timeInvestment: TimeInvestment;
  kpis: KPISummary[];
}

interface PlanHealthCardProps {
  plan: PlanData;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

const healthConfig = {
  HEALTHY: {
    icon: CheckCircle2,
    label: "健康",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    dot: "bg-green-500",
  },
  AT_RISK: {
    icon: AlertTriangle,
    label: "注意",
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    dot: "bg-yellow-500",
  },
  CRITICAL: {
    icon: XCircle,
    label: "危險",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    dot: "bg-red-500",
  },
};

export function PlanHealthCard({ plan, expanded, onToggle, children }: PlanHealthCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded ?? false);
  const config = healthConfig[plan.healthStatus];
  const Icon = config.icon;

  const totalTasks =
    plan.taskDistribution.backlog +
    plan.taskDistribution.todo +
    plan.taskDistribution.inProgress +
    plan.taskDistribution.review +
    plan.taskDistribution.done;

  const kpiOnTrack = plan.kpis.filter((k) => k.achievementRate >= 80).length;
  const kpiBehind = plan.kpis.filter((k) => k.achievementRate < 50).length;

  const handleToggle = () => {
    if (onToggle) onToggle();
    else setIsExpanded(!isExpanded);
  };

  const show = onToggle ? expanded : isExpanded;

  return (
    <div
      data-testid="plan-health-card"
      className={cn("rounded-xl border p-5 transition-colors", config.bg, config.border)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn("h-5 w-5", config.dot.replace("bg-", "text-"))} />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{plan.title}</h2>
            <p className="text-sm text-muted-foreground">{plan.year} 年度計畫</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", config.badge)}>
            {config.label}
          </span>
          <button
            onClick={handleToggle}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label={show ? "收合" : "展開"}
          >
            {show ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">整體進度</span>
          <span className="font-medium">{Math.round(plan.progress)}%</span>
        </div>
        <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", config.dot)}
            style={{ width: `${Math.min(100, plan.progress)}%` }}
          />
        </div>
      </div>

      {/* Mini stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="任務完成" value={`${plan.taskDistribution.done}/${totalTasks}`} />
        <MiniStat label="逾期任務" value={String(plan.taskDistribution.overdue)} warn={plan.taskDistribution.overdue > 0} />
        <MiniStat label="KPI 達標" value={`${kpiOnTrack}/${plan.kpis.length}`} />
        <MiniStat label="累計工時" value={`${Math.round(plan.timeInvestment.actual)}h`} />
      </div>

      {/* Expandable children */}
      {show && children && <div className="mt-5 pt-5 border-t border-current/10">{children}</div>}
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn("text-lg font-semibold", warn ? "text-red-600 dark:text-red-400" : "text-foreground")}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
