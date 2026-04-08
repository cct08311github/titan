"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { extractData } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimerState = {
  isRunning: boolean;
  taskId: string | null;
  taskLabel: string;
  startTime: number | null; // epoch ms
  entryId: string | null;
};

// ─── localStorage persistence ────────────────────────────────────────────────

const TIMER_STORAGE_KEY = "titan-timer-state";

function loadTimerState(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function saveTimerState(state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimer() {
  const [timer, setTimer] = useState<TimerState | null>(() => loadTimerState());
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist timer state
  useEffect(() => {
    saveTimerState(timer);
  }, [timer]);

  // Tick timer
  useEffect(() => {
    if (timer?.isRunning && timer.startTime) {
      setElapsed(Math.floor((Date.now() - timer.startTime) / 1000));
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timer.startTime!) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer]);

  // Restore timer from server on mount
  useEffect(() => {
    fetch("/api/time-entries/running")
      .then((r) => r.json())
      .then((body) => {
        const data = extractData<{
          id: string;
          taskId: string | null;
          startTime: string;
          task?: { title: string } | null;
        } | null>(body);
        if (data?.startTime) {
          setTimer({
            isRunning: true,
            taskId: data.taskId,
            taskLabel: data.task?.title ?? "自由工時",
            startTime: new Date(data.startTime).getTime(),
            entryId: data.id,
          });
        }
      })
      .catch(() => { toast.warning("計時器狀態載入失敗"); });
  }, []);

  // Start timer
  const startTimer = useCallback(async (taskId: string | null) => {
    try {
      const res = await fetch("/api/time-entries/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId || undefined }),
      });
      if (res.status === 409) return { ok: false, error: "已有計時器在運行中" };
      if (!res.ok) return { ok: false, error: "啟動計時器失敗" };
      const body = await res.json();
      const entry = extractData<{
        id: string;
        taskId: string | null;
        startTime: string;
        task?: { title: string } | null;
      }>(body);
      const taskLabel = entry.task?.title ?? "自由工時";
      setTimer({
        isRunning: true,
        taskId: entry.taskId,
        taskLabel,
        startTime: new Date(entry.startTime).getTime(),
        entryId: entry.id,
      });
      return { ok: true, error: null };
    } catch {
      return { ok: false, error: "啟動計時器失敗" };
    }
  }, []);

  // Stop timer — returns { ok, error }; caller should refresh entries after success
  const stopTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return { ok: false, error: "停止計時器失敗" };
      setTimer(null);
      return { ok: true, error: null };
    } catch {
      return { ok: false, error: "停止計時器失敗" };
    }
  }, []);

  // Reset timer (clear without API call)
  const resetTimer = useCallback(() => {
    setTimer(null);
  }, []);

  return {
    timer,
    elapsed,
    startTimer,
    stopTimer,
    resetTimer,
  };
}
