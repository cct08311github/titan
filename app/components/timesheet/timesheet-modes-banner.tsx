"use client";

/**
 * TimesheetModesBanner — Issue #1539-6 (from #1538 audit)
 *
 * Problem: /timesheet exposes 3 different ways to log time:
 *   1. <TimesheetTimer>  — start/stop, for in-flight work
 *   2. <QuickLogButton>  — modal for "I just finished, log it"
 *   3. <TimesheetGrid>   — double-click cell, for backfilling whole week
 *
 * Users don't know which tool fits which moment, and bounce between them.
 * Most "工時模組不直覺" complaints in #1538 were really "I don't know which
 * input to use".
 *
 * Solution: a single calm banner at the top of /timesheet that names each
 * tool and the moment it's for. One-shot — once dismissed, never shown
 * again. Doesn't take vertical space after first dismiss.
 */
import { useEffect, useState } from "react";
import { Clock, Zap, Grid3X3, X } from "lucide-react";

const STORAGE_KEY = "titan:timesheet:modes-banner-dismissed";

export function TimesheetModesBanner() {
  const [dismissed, setDismissed] = useState(true); // start hidden so SSR + first paint don't flash

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  }

  if (dismissed) return null;

  return (
    <div
      className="border border-border rounded-lg bg-gradient-to-br from-primary/5 to-card px-4 py-3 relative"
      data-testid="timesheet-modes-banner"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
        aria-label="關閉說明"
        data-testid="timesheet-modes-banner-dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <h3 className="text-sm font-medium mb-2">三種記時模式，哪個都行</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex gap-2">
          <Clock className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
          <div>
            <div className="font-medium">正在做事</div>
            <div className="text-muted-foreground/80 mt-0.5">
              開計時器，停下來自動記錄
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Zap className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
          <div>
            <div className="font-medium">剛做完一件事</div>
            <div className="text-muted-foreground/80 mt-0.5">
              點「快速記時數」直接填當下
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Grid3X3 className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
          <div>
            <div className="font-medium">補登整週</div>
            <div className="text-muted-foreground/80 mt-0.5">
              點下方表格的格子直接填數字
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
