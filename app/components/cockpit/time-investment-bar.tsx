"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TimeInvestment {
  planned: number;
  actual: number;
  overtimeHours: number;
}

interface TimeInvestmentBarProps {
  time: TimeInvestment;
}

export function TimeInvestmentBar({ time }: TimeInvestmentBarProps) {
  const max = Math.max(time.planned, time.actual, 1);
  const plannedPct = (time.planned / max) * 100;
  const actualPct = (time.actual / max) * 100;
  const isOvertime = time.actual > time.planned && time.planned > 0;

  return (
    <div data-testid="time-investment-bar">
      <h3 className="text-sm font-semibold text-foreground mb-3">工時投入</h3>

      <div className="space-y-3">
        {/* Planned */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">預估工時</span>
            <span className="font-medium tabular-nums">{Math.round(time.planned)}h</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${plannedPct}%` }}
            />
          </div>
        </div>

        {/* Actual */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">實際工時</span>
            <span className={cn(
              "font-medium tabular-nums",
              isOvertime && "text-red-600 dark:text-red-400",
            )}>
              {Math.round(time.actual)}h
              {isOvertime && (
                <span className="text-xs ml-1">(+{Math.round(time.overtimeHours)}h)</span>
              )}
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isOvertime ? "bg-red-500" : "bg-green-500",
              )}
              style={{ width: `${actualPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Utilization rate — link to timesheet */}
      {time.planned > 0 && (
        <Link href="/timesheet" className="block text-xs text-muted-foreground mt-2 hover:text-primary transition-colors">
          投入率 {Math.round((time.actual / time.planned) * 100)}% →
        </Link>
      )}
    </div>
  );
}
