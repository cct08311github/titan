/**
 * Shared calendar utilities for day view and week view.
 * Extracted from calendar-day-view.tsx for reuse.
 */
import type { CSSProperties } from "react";
import { safeFixed } from "@/lib/safe-number";
import { CATEGORIES } from "./timesheet-cell";

// ─── Constants ────────────────────────────────────────────────────────────────

export const HOUR_HEIGHT = 60; // px per hour
export const MIN_HOUR = 8;
export const MAX_HOUR = 22;
export const TOTAL_HOURS = MAX_HOUR - MIN_HOUR;
export const SNAP_MINUTES = 15;

// ─── Time ↔ Position Converters ──────────────────────────────────────────────

/** Convert "HH:MM" string to a fractional hour number (e.g., "09:30" → 9.5). */
export function timeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** Convert a fractional hour to "HH:MM" (e.g., 9.5 → "09:30"). */
export function hoursToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Convert a time string to a pixel Y offset from the top of the grid. */
export function timeToPosition(time: string, hourHeight: number): number {
  const hours = timeToHours(time);
  return (hours - MIN_HOUR) * hourHeight;
}

/** Convert a pixel Y offset to a time string, snapped to the grid. */
export function positionToTime(y: number, hourHeight: number): string {
  const hour = MIN_HOUR + y / hourHeight;
  return hoursToTime(snapToGrid(hour));
}

/** Snap a fractional hour to the nearest SNAP_MINUTES increment. */
export function snapToGrid(hours: number): number {
  const mins = hours * 60;
  const snapped = Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped / 60;
}

/** Format a fractional hour as a human-readable duration (e.g., "30min" or "2.5h"). */
export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${safeFixed(hours, 1)}h`;
}

// ─── Block Styling ───────────────────────────────────────────────────────────

/** Get CSS properties for positioning a time block within a calendar column. */
export function getBlockStyle(
  startTime: string,
  endTime: string,
  hourHeight: number
): CSSProperties {
  const startH = timeToHours(startTime);
  const endH = timeToHours(endTime);
  const top = (startH - MIN_HOUR) * hourHeight;
  const height = (endH - startH) * hourHeight;
  return { top, height: Math.max(height, 24) };
}

// ─── Category Color Mapping ──────────────────────────────────────────────────

/** Return the Tailwind dot color class for a category. */
export function getCatColor(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.dot ?? "bg-slate-400";
}

/** Return the Tailwind background/border classes for a time block category. */
export function getCatBg(cat: string): string {
  const map: Record<string, string> = {
    PLANNED_TASK: "bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25",
    ADDED_TASK: "bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/25",
    INCIDENT: "bg-red-500/15 border-red-500/30 hover:bg-red-500/25",
    SUPPORT: "bg-orange-500/15 border-orange-500/30 hover:bg-orange-500/25",
    ADMIN: "bg-slate-400/15 border-slate-400/30 hover:bg-slate-400/25",
    LEARNING: "bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25",
  };
  return map[cat] ?? "bg-slate-400/15 border-slate-400/30 hover:bg-slate-400/25";
}
