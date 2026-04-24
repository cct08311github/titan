"use client";

/**
 * ReactionBar — Issue #1512 (Phase 2 of team-love initiative #1505)
 *
 * Renders the aggregated emoji bar under a comment or activity item.
 * - Shows only emoji that have at least one reaction, plus a "+" button
 *   that opens the fixed 6-emoji picker.
 * - Optimistic update: tapping a count toggles immediately, rolls back
 *   on server error with a toast.
 * - Hover reveals "Alice, Bob reacted" tooltip.
 *
 * Consumers render this anywhere with (targetType, targetId). The
 * component self-fetches on mount. Pass `initialReactions` to skip the
 * initial fetch when the parent already has the data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/validators/reaction-validators";

type ReactionTargetType = "TASK_COMMENT" | "DOCUMENT_COMMENT" | "ACTIVITY";

export type ReactionSummary = {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
};

interface ReactionBarProps {
  targetType: ReactionTargetType;
  targetId: string;
  /** Optional: map of userId → display name for tooltips. If absent, falls back to the id. */
  userNames?: Record<string, string>;
  /** Optional: skip initial fetch if parent already has the summary. */
  initialReactions?: ReactionSummary[];
  className?: string;
}

export function ReactionBar({
  targetType,
  targetId,
  userNames,
  initialReactions,
  className,
}: ReactionBarProps) {
  const [reactions, setReactions] = useState<ReactionSummary[]>(initialReactions ?? []);
  const [loading, setLoading] = useState(!initialReactions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`
      );
      if (!res.ok) return;
      const body = await res.json();
      setReactions(body.data?.reactions ?? []);
    } catch {
      // Silent — reactions are a nice-to-have.
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (initialReactions) return;
    fetchSummary();
  }, [fetchSummary, initialReactions]);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pickerOpen]);

  function applyOptimistic(emoji: string): ReactionSummary[] {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing?.reactedByMe) {
      // Toggle off: decrement; drop entry if count hits 0.
      const nextCount = existing.count - 1;
      if (nextCount <= 0) {
        return reactions.filter((r) => r.emoji !== emoji);
      }
      return reactions.map((r) =>
        r.emoji === emoji
          ? { ...r, count: nextCount, reactedByMe: false, userIds: r.userIds.filter((u) => u !== "__me__") }
          : r
      );
    }
    if (existing) {
      return reactions.map((r) =>
        r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
      );
    }
    return [...reactions, { emoji, count: 1, userIds: [], reactedByMe: true }];
  }

  async function toggle(emoji: ReactionEmoji) {
    const snapshot = reactions;
    setReactions(applyOptimistic(emoji));
    setPickerOpen(false);
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, emoji }),
      });
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setReactions(body.data?.reactions ?? []);
    } catch {
      setReactions(snapshot);
      toast.error("反應操作失敗，請重試");
    }
  }

  function tooltipFor(r: ReactionSummary): string {
    const names = r.userIds.map((id) => userNames?.[id] ?? id);
    if (names.length === 0) return "你";
    const label = names.slice(0, 3).join("、");
    const extra = names.length > 3 ? ` 等 ${names.length} 人` : "";
    return (r.reactedByMe ? "你與 " : "") + label + extra;
  }

  if (loading) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1 mt-1", className)}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          aria-label={`${r.emoji} 反應，${r.count} 人，${r.reactedByMe ? "點擊取消" : "點擊加入"}`}
          onClick={() => toggle(r.emoji as ReactionEmoji)}
          title={tooltipFor(r)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border",
            r.reactedByMe
              ? "bg-primary/10 border-primary/40 text-primary"
              : "bg-muted/50 border-transparent hover:bg-muted"
          )}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      <div ref={pickerRef} className="relative">
        <button
          type="button"
          aria-label="新增反應"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          + 反應
        </button>
        {pickerOpen && (
          <div
            role="dialog"
            aria-label="選擇反應表情"
            className="absolute top-full left-0 mt-1 flex gap-0.5 bg-popover border rounded-md shadow-md p-1 z-10"
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`加入 ${e} 反應`}
                onClick={() => toggle(e)}
                className="w-7 h-7 rounded hover:bg-muted transition-colors text-sm"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
