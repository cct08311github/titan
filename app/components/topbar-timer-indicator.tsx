"use client";

/**
 * Topbar Timer Indicator — Issue #1070 (UX-06)
 *
 * Shows a mini elapsed-time badge when a time entry is running.
 * Polls /api/time-entries/running on mount and every 30s.
 */

import { useState, useEffect, useRef } from "react";
import { Timer, Square } from "lucide-react";
import Link from "next/link";
import { SimpleTooltip } from "@/app/components/ui/tooltip";
import { toast } from "sonner";

function formatElapsed(startIso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TopbarTimerIndicator() {
  const [running, setRunning] = useState<{ id: string; startTime: string; description?: string } | null>(null);
  const [display, setDisplay] = useState("00:00:00");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchRunning() {
    try {
      const res = await fetch("/api/time-entries/running");
      if (res.ok) {
        const body = await res.json();
        const entry = body.data ?? body;
        if (entry?.id && entry?.startTime) {
          setRunning(entry);
        } else {
          setRunning(null);
        }
      } else {
        setRunning(null);
      }
    } catch {
      setRunning(null);
    }
  }

  useEffect(() => {
    fetchRunning();
    const poll = setInterval(fetchRunning, 30000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (running) {
      setDisplay(formatElapsed(running.startTime));
      intervalRef.current = setInterval(() => {
        setDisplay(formatElapsed(running.startTime));
      }, 1000);
    } else {
      setDisplay("00:00:00");
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  async function stopTimer() {
    if (!running) return;
    try {
      const res = await fetch(`/api/time-entries/${running.id}/stop`, { method: "PATCH" });
      if (res.ok) {
        setRunning(null);
        toast.success("計時已停止");
      }
    } catch { /* ignore */ }
  }

  if (!running) return null;

  return (
    <SimpleTooltip content={running.description ?? "計時中 — 點擊前往工時頁面"} side="bottom">
      <div className="flex items-center gap-1.5">
        <Link
          href="/timesheet"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono tabular-nums hover:bg-destructive/20 transition-colors"
        >
          <Timer className="h-3 w-3 animate-pulse" />
          {display}
        </Link>
        <button
          onClick={stopTimer}
          className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
          aria-label="停止計時"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    </SimpleTooltip>
  );
}
