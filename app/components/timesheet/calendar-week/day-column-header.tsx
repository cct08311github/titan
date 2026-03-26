"use client";

import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";
import { formatLocalDate } from "@/lib/utils/date";
import { DAY_LABELS, getDayDate } from "./copy-day-menu";

type DayColumnHeaderProps = {
  dateStr: string;
  dayIndex: number;
  weekStart: Date;
  dailyTotal: number;
  onContextMenu: (dayIndex: number, e: React.MouseEvent) => void;
};

export function DayColumnHeader({
  dateStr,
  dayIndex,
  weekStart,
  dailyTotal,
  onContextMenu,
}: DayColumnHeaderProps) {
  const d = getDayDate(weekStart, dayIndex);
  const isWeekend = dayIndex >= 5;
  const isToday = formatLocalDate(new Date()) === dateStr;

  return (
    <div
      className={cn(
        "p-2 text-center border-r border-border last:border-r-0 cursor-context-menu",
        isWeekend && "bg-muted/30",
        isToday && "bg-accent/20"
      )}
      onContextMenu={(e) => onContextMenu(dayIndex, e)}
      data-testid={`day-header-${dayIndex}`}
    >
      <div className={cn("text-xs font-medium", isToday && "text-foreground")}>
        週{DAY_LABELS[dayIndex]}
      </div>
      <div className={cn(
        "text-[10px] tabular-nums",
        isToday ? "text-foreground font-medium" : "text-muted-foreground"
      )}>
        {d.getMonth() + 1}/{d.getDate()}
      </div>
      <div
        className={cn(
          "text-[10px] tabular-nums mt-0.5",
          dailyTotal > 8
            ? "text-amber-500 font-medium"
            : "text-muted-foreground/60"
        )}
        data-testid={`day-total-${dayIndex}`}
      >
        {dailyTotal > 0 ? `${safeFixed(dailyTotal, 1)}h` : "--"}
      </div>
    </div>
  );
}
