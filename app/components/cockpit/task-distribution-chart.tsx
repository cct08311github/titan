"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, string> = {
  done: "DONE", review: "REVIEW", inProgress: "IN_PROGRESS", todo: "TODO", backlog: "BACKLOG",
};

export interface TaskDistribution {
  backlog: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
}

interface TaskDistributionChartProps {
  distribution: TaskDistribution;
}

const segments: { key: keyof TaskDistribution; label: string; color: string }[] = [
  { key: "done", label: "完成", color: "bg-green-500" },
  { key: "review", label: "審查中", color: "bg-blue-500" },
  { key: "inProgress", label: "進行中", color: "bg-yellow-500" },
  { key: "todo", label: "待辦", color: "bg-slate-400" },
  { key: "backlog", label: "Backlog", color: "bg-slate-300 dark:bg-slate-600" },
];

export function TaskDistributionChart({ distribution }: TaskDistributionChartProps) {
  const total =
    distribution.backlog +
    distribution.todo +
    distribution.inProgress +
    distribution.review +
    distribution.done;

  return (
    <div data-testid="task-distribution-chart">
      <h3 className="text-sm font-semibold text-foreground mb-3">任務分佈</h3>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">尚無任務</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden gap-px">
            {segments.map(({ key, color }) => {
              const count = distribution[key];
              if (count === 0) return null;
              const pct = (count / total) * 100;
              return (
                <div
                  key={key}
                  className={cn("h-full transition-all", color)}
                  style={{ width: `${pct}%` }}
                  title={`${key}: ${count}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {segments.map(({ key, label, color }) => {
              const count = distribution[key];
              if (count === 0) return null;
              return (
                <Link key={key} href={`/kanban?status=${STATUS_MAP[key] ?? key}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span className={cn("w-2.5 h-2.5 rounded-sm", color)} />
                  <span>{label}</span>
                  <span className="font-medium text-foreground tabular-nums">{count}</span>
                </Link>
              );
            })}
            {distribution.overdue > 0 && (
              <Link href="/kanban?overdue=true" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-500 transition-colors">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500 ring-1 ring-red-300" />
                <span>逾期</span>
                <span className="font-medium tabular-nums">{distribution.overdue}</span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
