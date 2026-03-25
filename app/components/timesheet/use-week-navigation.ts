"use client";

import { useState, useCallback, useMemo } from "react";
import { formatLocalDate } from "@/lib/utils/date";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getSundayOfWeek(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

export function formatWeekRange(monday: Date): string {
  const sunday = getSundayOfWeek(monday);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

export function getDateStr(weekStart: Date, dayOffset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  return formatLocalDate(d);
}

export function formatDateLabel(weekStart: Date, offset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAYS_COUNT = 7;
export const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeekNavigation() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));

  const goToPrevWeek = useCallback(() => {
    setWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 7);
      return n;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      return n;
    });
  }, []);

  const goToToday = useCallback(() => {
    setWeekStart(getMondayOfWeek(new Date()));
  }, []);

  const weekEnd = useMemo(() => getSundayOfWeek(weekStart), [weekStart]);

  return {
    weekStart,
    weekEnd,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
    formatWeekRange: () => formatWeekRange(weekStart),
    getDateStr: (offset: number) => getDateStr(weekStart, offset),
    formatDateLabel: (offset: number) => formatDateLabel(weekStart, offset),
    getWeekDays: () => Array.from({ length: DAYS_COUNT }, (_, i) => getDateStr(weekStart, i)),
    dayLabels: DAY_LABELS,
    daysCount: DAYS_COUNT,
  };
}
