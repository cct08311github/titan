"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagButtonProps {
  taskId: string;
  flagged: boolean;
  onFlagChange?: (flagged: boolean) => void;
  className?: string;
}

/**
 * FlagButton — Issue #960
 *
 * Manager-only button to flag/unflag tasks.
 * Shows a flame icon that toggles the managerFlagged state.
 */
export function FlagButton({ taskId, flagged, onFlagChange, className }: FlagButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");

  async function handleFlag(e: React.MouseEvent) {
    e.stopPropagation();

    if (!flagged && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagged: !flagged,
          reason: !flagged ? reason || null : null,
        }),
      });
      if (res.ok) {
        onFlagChange?.(!flagged);
        setShowReasonInput(false);
        setReason("");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setShowReasonInput(false);
    setReason("");
  }

  if (showReasonInput) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="標記原因（選填）"
          className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground w-32"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFlag(e as unknown as React.MouseEvent);
            if (e.key === "Escape") handleCancel(e as unknown as React.MouseEvent);
          }}
        />
        <button
          onClick={handleFlag}
          disabled={loading}
          className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? "..." : "OK"}
        </button>
        <button
          onClick={handleCancel}
          className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground"
        >
          X
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleFlag}
      disabled={loading}
      title={flagged ? "取消標記" : "標記此任務"}
      className={cn(
        "p-1 rounded-md transition-colors",
        flagged
          ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950",
        loading && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <Flame className={cn("h-4 w-4", flagged && "fill-current")} />
    </button>
  );
}
