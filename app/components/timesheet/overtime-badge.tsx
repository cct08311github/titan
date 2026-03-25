"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";
import { formatLocalDate } from "@/lib/utils/date";
import {
  OVERTIME_CONFIG,
  getOvertimeInfo,
  type OvertimeLevel,
} from "@/lib/overtime";
import { extractItems } from "@/lib/api-client";
import { type TimeEntry } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type OvertimeBadgeProps = {
  weekStart: Date;
};

type MonthlyEntry = {
  date: string;
  hours: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OvertimeBadge({ weekStart }: OvertimeBadgeProps) {
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [dailyBreakdown, setDailyBreakdown] = useState<Record<string, number>>({});
  const [showPopover, setShowPopover] = useState(false);
  const [loading, setLoading] = useState(true);

  // Determine the month from the weekStart (use the Monday's month)
  const year = weekStart.getFullYear();
  const month = weekStart.getMonth(); // 0-based

  // Load monthly entries
  const loadMonthlyData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0); // last day of month
      const params = new URLSearchParams({
        startDate: formatLocalDate(monthStart),
        endDate: formatLocalDate(monthEnd),
      });
      const res = await fetch(`/api/time-entries/stats?${params}`);
      if (!res.ok) {
        // Fallback: try fetching entries directly
        const entriesRes = await fetch(
          `/api/time-entries?weekStart=${formatLocalDate(monthStart)}&endDate=${formatLocalDate(monthEnd)}`
        );
        if (entriesRes.ok) {
          const body = await entriesRes.json();
          const entries = extractItems<MonthlyEntry>(body);
          const total = entries.reduce((sum, e) => sum + e.hours, 0);
          setMonthlyHours(total);

          // Build daily breakdown
          const breakdown: Record<string, number> = {};
          for (const e of entries) {
            const dateKey = e.date.split("T")[0];
            breakdown[dateKey] = (breakdown[dateKey] ?? 0) + e.hours;
          }
          setDailyBreakdown(breakdown);
        }
        return;
      }
      const body = await res.json();
      const data = body.data ?? body;
      if (data?.totalHours != null) {
        setMonthlyHours(data.totalHours);
      }
      // If breakdown is available, use it
      if (data?.dailyBreakdown) {
        setDailyBreakdown(data.dailyBreakdown);
      }
    } catch {
      // Silently fail — badge shows 0
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadMonthlyData();
  }, [loadMonthlyData]);

  const overtimeInfo = useMemo(
    () => getOvertimeInfo(monthlyHours, year, month),
    [monthlyHours, year, month]
  );

  if (loading) return null;

  const badgeColors: Record<OvertimeLevel, string> = {
    safe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    danger: "border-red-500/30 bg-red-500/10 text-red-500",
  };

  const monthLabel = `${year}/${String(month + 1).padStart(2, "0")}`;

  function getBadgeText(): string {
    const hours = safeFixed(overtimeInfo.overtimeHours, 1);
    if (overtimeInfo.level === "danger") {
      return `本月加班：${hours}h / ${OVERTIME_CONFIG.LIMIT}h（已超過法定上限）`;
    }
    if (overtimeInfo.level === "warning") {
      return `本月加班：${hours}h / ${OVERTIME_CONFIG.LIMIT}h（接近上限）`;
    }
    return `本月加班：${hours}h`;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowPopover((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer",
          badgeColors[overtimeInfo.level]
        )}
        data-testid="overtime-badge"
        data-overtime-level={overtimeInfo.level}
      >
        {overtimeInfo.level === "warning" && (
          <span role="img" aria-label="warning">&#x26A0;&#xFE0F;</span>
        )}
        {overtimeInfo.level === "danger" && (
          <span role="img" aria-label="alert">&#x1F6A8;</span>
        )}
        {getBadgeText()}
      </button>

      {/* Popover — daily overtime breakdown */}
      {showPopover && (
        <div
          className="absolute top-full mt-1 right-0 z-50 w-64 bg-card border border-border rounded-lg shadow-lg p-3"
          data-testid="overtime-popover"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">
              {monthLabel} 加班明細
            </span>
            <button
              onClick={() => setShowPopover(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {Object.keys(dailyBreakdown).length > 0 ? (
              Object.entries(dailyBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, hours]) => {
                  const dailyOvertime = Math.max(0, hours - 8);
                  if (dailyOvertime === 0) return null;
                  return (
                    <div key={date} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{date}</span>
                      <span className={cn(
                        "tabular-nums font-medium",
                        dailyOvertime > 0 ? "text-amber-500" : "text-foreground"
                      )}>
                        +{safeFixed(dailyOvertime, 1)}h
                      </span>
                    </div>
                  );
                })
                .filter(Boolean)
            ) : (
              <p className="text-xs text-muted-foreground/60 text-center py-2">
                無加班紀錄
              </p>
            )}
          </div>

          {/* Summary bar */}
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">月總工時</span>
              <span className="font-medium text-foreground tabular-nums">
                {safeFixed(monthlyHours, 1)}h
              </span>
            </div>
            <div className="flex justify-between text-xs mt-0.5">
              <span className="text-muted-foreground">加班時數</span>
              <span className={cn(
                "font-semibold tabular-nums",
                badgeColors[overtimeInfo.level].split(" ").pop()
              )}>
                {safeFixed(overtimeInfo.overtimeHours, 1)}h / {OVERTIME_CONFIG.LIMIT}h
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overtimeInfo.level === "danger" ? "bg-red-500"
                    : overtimeInfo.level === "warning" ? "bg-amber-500"
                      : "bg-emerald-500"
                )}
                style={{
                  width: `${Math.min(100, (overtimeInfo.overtimeHours / OVERTIME_CONFIG.LIMIT) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
