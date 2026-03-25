"use client";

import { useState } from "react";
import { Play, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TimerState, type TaskOption } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimesheetTimerProps = {
  timer: TimerState | null;
  elapsed: number;
  tasks: TaskOption[];
  onStart: (taskId: string | null) => Promise<{ ok: boolean; error: string | null }>;
  onStop: () => Promise<{ ok: boolean; error: string | null }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetTimer({ timer, elapsed, tasks, onStart, onStop }: TimesheetTimerProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = timer?.isRunning ?? false;

  async function handleStart() {
    setLoading(true);
    setError(null);
    const result = await onStart(selectedTaskId || null);
    if (!result.ok) setError(result.error);
    setLoading(false);
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    const result = await onStop();
    if (!result.ok) setError(result.error);
    else setSelectedTaskId("");
    setLoading(false);
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
        isRunning
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-card border-border"
      )}
      data-testid="timesheet-timer"
    >
      {/* Timer icon + display */}
      <div className="flex items-center gap-3">
        <Clock className={cn("h-4 w-4", isRunning ? "text-emerald-500" : "text-muted-foreground")} />
        <div
          className={cn(
            "text-xl sm:text-2xl font-mono font-bold tabular-nums transition-colors",
            isRunning ? "text-emerald-500" : "text-muted-foreground/30"
          )}
          data-testid="timer-display"
        >
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Task selector (when not running) */}
      {!isRunning && (
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[160px]"
          data-testid="timer-task-select"
        >
          <option value="">自由工時（無任務）</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      )}

      {/* Running task label */}
      {isRunning && timer && (
        <span className="text-xs text-muted-foreground" data-testid="timer-running-label">
          正在計時：{timer.taskLabel}
        </span>
      )}

      {/* Start / Stop */}
      {isRunning ? (
        <button
          onClick={handleStop}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-md transition-colors disabled:opacity-50 sm:ml-auto"
          data-testid="timer-stop-btn"
        >
          <Square className="h-3 w-3" />
          停止
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-xs font-medium rounded-md transition-colors disabled:opacity-50 sm:ml-auto"
          data-testid="timer-start-btn"
        >
          <Play className="h-3 w-3" />
          開始計時
        </button>
      )}

      {/* Error */}
      {error && (
        <span className="text-xs text-red-400" data-testid="timer-error">{error}</span>
      )}
    </div>
  );
}
