"use client";

/**
 * CalendarMonthView — Issue #966
 *
 * Month grid calendar for the timesheet page:
 * - Days as cells, each shows total hours + color coding
 *   (green ≤8h, yellow >8h, red >10h, gray 0)
 * - Click day → navigate to day view for that date
 * - Manager: team member selector dropdown
 * - Month navigation: ◀ 上月 | 本月 | 下月 ▶
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  totalHours: number;
  entryCount: number;
}

interface CalendarMonthViewProps {
  /** Callback when user clicks a day — navigates to day view */
  onDayClick: (date: Date) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0 = Sunday, convert to Monday-start: Mon=0..Sun=6
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isWeekend(year: number, month: number, day: number): boolean {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

function hourColor(hours: number): string {
  if (hours <= 0) return "bg-muted/30 text-muted-foreground/40";
  if (hours <= 8) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (hours <= 10) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}

function hourBadgeColor(hours: number): string {
  if (hours <= 0) return "text-muted-foreground/30";
  if (hours <= 8) return "text-emerald-600 dark:text-emerald-400";
  if (hours <= 10) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

// ─── Component ───────────────────────────────────────────────────────────────

export function CalendarMonthView({ onDayClick }: CalendarMonthViewProps) {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [dayData, setDayData] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month);
  const monthStr = getMonthStr(currentMonth);
  const monthDisplay = `${year} 年 ${month + 1} 月`;

  // Navigate months
  const prevMonth = useCallback(() => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const goToThisMonth = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  // Fetch time entries for the month
  const fetchMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Use the first and last day of month as weekStart range
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      params.set("weekStart", startDate);
      if (selectedUserId) params.set("userId", selectedUserId);

      const res = await fetch(`/api/time-entries?${params}`);
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      const entries = extractItems<{
        id: string;
        date: string;
        hours: number;
      }>(body);

      // Aggregate by date
      const map = new Map<string, DayData>();
      for (const entry of entries) {
        const dateStr = entry.date.split("T")[0];
        const existing = map.get(dateStr);
        if (existing) {
          existing.totalHours += entry.hours;
          existing.entryCount += 1;
        } else {
          map.set(dateStr, {
            date: dateStr,
            totalHours: entry.hours,
            entryCount: 1,
          });
        }
      }
      setDayData(map);
    } catch {
      // Silent fail — empty calendar
      setDayData(new Map());
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedUserId]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  // Fetch users for manager dropdown
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const items = extractItems<{ id: string; name: string }>(body);
        setUsers(items.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => { toast.warning("使用者清單載入失敗"); });
  }, [isManager]);

  // Build calendar grid (6 rows × 7 cols)
  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];

    // Leading empty cells
    for (let i = 0; i < firstDayOffset; i++) {
      cells.push({ day: null, dateStr: null });
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: formatDateStr(year, month, d) });
    }

    // Trailing empty cells to fill last row
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayOffset]);

  // Monthly total
  const monthlyTotal = Array.from(dayData.values()).reduce(
    (sum, d) => sum + d.totalHours,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="上個月"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {monthDisplay}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="下個月"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToThisMonth}
            className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
          >
            <Calendar className="h-3 w-3 inline mr-1" />
            本月
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Manager: team member selector */}
          {isManager && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                aria-label="選擇成員"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-background border border-border rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                <option value="">我的工時</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Monthly total */}
          <span className="text-xs text-muted-foreground">
            月計：
            <span className={cn("font-medium ml-0.5", hourBadgeColor(monthlyTotal / Math.max(1, daysInMonth) * 5))}>
              {monthlyTotal.toFixed(1)}h
            </span>
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className={cn("transition-opacity", loading && "opacity-50")}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center text-xs font-medium py-1.5",
                i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground"
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (cell.day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const data = cell.dateStr ? dayData.get(cell.dateStr) : null;
            const hours = data?.totalHours ?? 0;
            const today = isToday(year, month, cell.day);
            const weekend = isWeekend(year, month, cell.day);

            return (
              <button
                key={cell.dateStr}
                onClick={() => onDayClick(new Date(year, month, cell.day!))}
                className={cn(
                  "group aspect-square rounded-lg border transition-all hover:ring-2 hover:ring-ring/30 flex flex-col items-center justify-center gap-0.5 p-1",
                  hourColor(hours),
                  today && "ring-2 ring-primary/50",
                  weekend && hours <= 0 && "bg-muted/10 border-border/30"
                )}
                aria-label={`${cell.dateStr}: ${hours}h`}
                title={`${cell.dateStr} — ${hours.toFixed(1)}h（${data?.entryCount ?? 0} 筆）`}
              >
                <span
                  className={cn(
                    "text-xs font-medium leading-none",
                    today && "text-primary font-bold",
                    weekend && hours <= 0 && "text-muted-foreground/40"
                  )}
                >
                  {cell.day}
                </span>
                {hours > 0 ? (
                  <span className={cn("text-[10px] font-semibold tabular-nums leading-none", hourBadgeColor(hours))}>
                    {hours.toFixed(1)}
                  </span>
                ) : !weekend ? (
                  <span className="text-[10px] text-muted-foreground/30 group-hover:text-primary/60 transition-colors">+</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted/30" />
          <span>0h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500/15" />
          <span>≤8h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500/15" />
          <span>&gt;8h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500/15" />
          <span>&gt;10h</span>
        </div>
      </div>
    </div>
  );
}
