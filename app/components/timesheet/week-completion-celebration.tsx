"use client";

/**
 * WeekCompletionCelebration — Issue #1539-5 (from #1538 audit)
 *
 * Detects when the user's weekly hours cross the "complete" threshold
 * (default 40h) for the first time this week and shows a calm,
 * non-patronizing toast.
 *
 * Design philosophy (from non-toxic-team-social-layer skill):
 * - One-shot per week, never spam
 * - "肯定" not "誇獎" — neutral acknowledgement, not "good job!"
 * - Toast, not modal — never interrupt work
 * - No comparison to others (would create competition / shame)
 * - Mid-week zero gets silence (not "still 0h?" passive aggression)
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { safeFixed } from "@/lib/safe-number";

interface WeekCompletionCelebrationProps {
  /** Current week's total logged hours */
  weeklyTotal: number;
  /** ISO week start date (YYYY-MM-DD) used as celebration ledger key */
  weekStartIso: string;
  /** Threshold for "完成" — defaults to 40h */
  threshold?: number;
}

const STORAGE_PREFIX = "titan:timesheet:celebrated:";
const DEFAULT_THRESHOLD = 40;

function makeKey(weekStartIso: string): string {
  return `${STORAGE_PREFIX}${weekStartIso}`;
}

export function WeekCompletionCelebration({
  weeklyTotal,
  weekStartIso,
  threshold = DEFAULT_THRESHOLD,
}: WeekCompletionCelebrationProps) {
  // Track previous total to detect cross-over (rather than re-firing on re-renders)
  const prevTotalRef = useRef<number>(weeklyTotal);
  // Track whether we've already fired for the active week (avoids hot-reload double-fire)
  const firedThisRenderRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!weekStartIso) return;

    const key = makeKey(weekStartIso);
    const alreadyCelebrated = window.localStorage.getItem(key) === "1";

    if (alreadyCelebrated) {
      prevTotalRef.current = weeklyTotal;
      return;
    }

    const prev = prevTotalRef.current;
    prevTotalRef.current = weeklyTotal;

    // Trigger when crossing from below to at-or-above threshold
    const justCrossed = prev < threshold && weeklyTotal >= threshold;

    if (justCrossed && !firedThisRenderRef.current) {
      firedThisRenderRef.current = true;
      window.localStorage.setItem(key, "1");
      toast.success(
        `本週累計 ${safeFixed(weeklyTotal, 1)} 小時 — 週末快樂 🎉`,
        {
          duration: 5000,
        },
      );
    }
  }, [weeklyTotal, weekStartIso, threshold]);

  // Reset firedThisRenderRef when week changes (user navigates to another week)
  useEffect(() => {
    firedThisRenderRef.current = false;
  }, [weekStartIso]);

  return null;
}
