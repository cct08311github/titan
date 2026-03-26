"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { safeFixed } from "@/lib/safe-number";

type WeekHeaderProps = {
  weekDates: string[];
  weeklyTotal: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
};

export function WeekHeader({
  weekDates,
  weeklyTotal,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
}: WeekHeaderProps) {
  return (
    <div className="flex items-center justify-between" data-testid="week-nav">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="p-1.5 hover:bg-accent rounded-md transition-colors"
          data-testid="prev-week-btn"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={onThisWeek}
          className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="this-week-btn"
        >
          本週
        </button>
        <button
          onClick={onNextWeek}
          className="p-1.5 hover:bg-accent rounded-md transition-colors"
          data-testid="next-week-btn"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="text-sm font-medium text-foreground" data-testid="week-range-label">
        {weekDates[0]} — {weekDates[6]}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums" data-testid="weekly-total">
        週合計：{safeFixed(weeklyTotal, 1)}h
      </div>
    </div>
  );
}
