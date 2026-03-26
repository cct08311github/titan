"use client";

import { cn } from "@/lib/utils";

type DiffViewProps = {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
};

/**
 * Simple side-by-side text diff view.
 * Compares lines and highlights additions/removals.
 */
export function DiffView({ oldText, newText, oldLabel = "舊版", newLabel = "新版" }: DiffViewProps) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff
  const diff = computeLineDiff(oldLines, newLines);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="grid grid-cols-2 border-b border-border bg-muted">
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-r border-border">
          {oldLabel}
        </div>
        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {newLabel}
        </div>
      </div>

      {/* Diff content */}
      <div className="grid grid-cols-2 text-xs font-mono max-h-96 overflow-y-auto">
        <div className="border-r border-border">
          {diff.map((entry, i) => (
            <div
              key={`old-${i}`}
              className={cn(
                "px-3 py-0.5 whitespace-pre-wrap break-all min-h-[1.5rem]",
                entry.type === "removed" && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
                entry.type === "added" && "bg-transparent text-transparent select-none",
                entry.type === "same" && "text-muted-foreground"
              )}
            >
              {entry.type === "removed" && <span className="select-none text-red-400 mr-1">-</span>}
              {entry.type === "same" && <span className="select-none text-muted-foreground/40 mr-1">&nbsp;</span>}
              {entry.type === "added" && <span className="select-none mr-1">&nbsp;</span>}
              {entry.type !== "added" ? entry.oldLine ?? "" : "\u00A0"}
            </div>
          ))}
        </div>
        <div>
          {diff.map((entry, i) => (
            <div
              key={`new-${i}`}
              className={cn(
                "px-3 py-0.5 whitespace-pre-wrap break-all min-h-[1.5rem]",
                entry.type === "added" && "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
                entry.type === "removed" && "bg-transparent text-transparent select-none",
                entry.type === "same" && "text-muted-foreground"
              )}
            >
              {entry.type === "added" && <span className="select-none text-green-400 mr-1">+</span>}
              {entry.type === "same" && <span className="select-none text-muted-foreground/40 mr-1">&nbsp;</span>}
              {entry.type === "removed" && <span className="select-none mr-1">&nbsp;</span>}
              {entry.type !== "removed" ? entry.newLine ?? "" : "\u00A0"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Simple line-based diff algorithm ──

type DiffEntry = {
  type: "same" | "added" | "removed";
  oldLine?: string;
  newLine?: string;
};

function computeLineDiff(oldLines: string[], newLines: string[]): DiffEntry[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffEntry[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "same", oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", newLine: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", oldLine: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}
