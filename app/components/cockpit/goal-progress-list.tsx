"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoalSummary {
  id: string;
  title: string;
  month: number;
  completed: boolean;
  taskCount: number;
  completedTaskCount: number;
}

interface GoalProgressListProps {
  goals: GoalSummary[];
  currentMonth?: number;
}

const monthLabels = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export function GoalProgressList({ goals, currentMonth }: GoalProgressListProps) {
  const month = currentMonth ?? new Date().getMonth() + 1;

  // Sort by month
  const sorted = [...goals].sort((a, b) => a.month - b.month);

  return (
    <div data-testid="goal-progress-list">
      <h3 className="text-sm font-semibold text-foreground mb-3">月度目標</h3>
      <div className="space-y-2">
        {sorted.map((goal) => {
          const pct = goal.taskCount > 0
            ? Math.round((goal.completedTaskCount / goal.taskCount) * 100)
            : 0;
          const isPast = goal.month < month;
          const isCurrent = goal.month === month;

          return (
            <div
              key={goal.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isCurrent && "bg-primary/5 ring-1 ring-primary/20",
                !isCurrent && "hover:bg-muted/50",
              )}
            >
              {/* Check icon */}
              {goal.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <Circle className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isPast ? "text-red-400" : "text-muted-foreground/40",
                )} />
              )}

              {/* Month badge */}
              <span className={cn(
                "text-xs font-medium w-8 text-center flex-shrink-0",
                isCurrent && "text-primary font-bold",
              )}>
                {monthLabels[goal.month - 1]}
              </span>

              {/* Title */}
              <span className={cn(
                "flex-1 truncate",
                goal.completed && "text-muted-foreground line-through",
              )}>
                {goal.title}
              </span>

              {/* Progress */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      goal.completed ? "bg-green-500" : pct > 60 ? "bg-blue-500" : pct > 30 ? "bg-yellow-500" : "bg-red-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                  {goal.completedTaskCount}/{goal.taskCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
