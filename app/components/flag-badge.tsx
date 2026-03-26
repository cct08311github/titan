"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlagBadgeProps {
  reason?: string | null;
  className?: string;
}

/**
 * FlagBadge — Issue #960
 *
 * Red pulsing badge shown on flagged tasks.
 * Displays the flag reason on hover via title attribute.
 */
export function FlagBadge({ reason, className }: FlagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full",
        "text-[10px] font-medium text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50",
        "animate-pulse",
        className
      )}
      title={reason || "主管標記"}
    >
      <Flame className="h-3 w-3 fill-current" />
      <span>FLAG</span>
    </span>
  );
}
