"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

type TaskOption = {
  id: string;
  title: string;
};

type RunningEntry = {
  id: string;
  taskId: string | null;
  startTime: string;
  isRunning: boolean;
  category: string;
  description: string | null;
  task: { id: string; title: string; category: string } | null;
};

type TimerWidgetProps = {
  tasks?: TaskOption[];
  onTimerChange?: () => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TimerWidget({ tasks = [], onTimerChange }: TimerWidgetProps) {
  const [running, setRunning] = useState<RunningEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current running timer ──────────────────────────────────────────
  const fetchRunning = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/running");
      if (!res.ok) return;
      const body = await res.json();
      const data = extractData<RunningEntry | null>(body);
      setRunning(data);
      if (data?.startTime) {
        const start = new Date(data.startTime).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - start) / 1000));
      } else {
        setElapsed(0);
      }
    } catch {
      // Silently fail — widget is non-critical
    }
  }, []);

  useEffect(() => {
    fetchRunning();
  }, [fetchRunning]);

  // ── Tick elapsed counter when running ────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // ── Start timer ──────────────────────────────────────────────────────────
  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/time-entries/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTaskId || undefined,
        }),
      });

      if (res.status === 409) {
        setError("已有計時器在運行中");
        return;
      }

      if (!res.ok) {
        setError("啟動計時器失敗");
        return;
      }

      const body = await res.json();
      const entry = extractData<RunningEntry>(body);
      setRunning(entry);
      setElapsed(0);
      onTimerChange?.();
    } catch {
      setError("啟動計時器失敗");
    } finally {
      setLoading(false);
    }
  }

  // ── Stop timer ───────────────────────────────────────────────────────────
  async function handleStop() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/time-entries/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setError("停止計時器失敗");
        return;
      }

      setRunning(null);
      setElapsed(0);
      setSelectedTaskId("");
      onTimerChange?.();
    } catch {
      setError("停止計時器失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3" data-testid="timer-widget">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">計時器</span>
      </div>

      {/* Timer display */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "text-2xl font-mono font-bold tabular-nums transition-colors",
            running ? "text-emerald-500" : "text-muted-foreground/40"
          )}
          data-testid="timer-display"
        >
          {formatElapsed(elapsed)}
        </div>

        {running ? (
          <button
            onClick={handleStop}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            data-testid="timer-stop-btn"
          >
            <Square className="h-3 w-3" />
            停止
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            data-testid="timer-start-btn"
          >
            <Play className="h-3 w-3" />
            開始
          </button>
        )}
      </div>

      {/* Task selector — only when not running */}
      {!running && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">選擇任務</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            data-testid="timer-task-select"
          >
            <option value="">自由工時（無任務）</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Running task label */}
      {running && (
        <div className="text-xs text-muted-foreground" data-testid="timer-running-label">
          正在計時：{running.task?.title ?? "自由工時"}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-400" data-testid="timer-error">
          {error}
        </div>
      )}
    </div>
  );
}
