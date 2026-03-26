"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type KudosButtonProps = {
  taskId: string;
  className?: string;
  onKudosSent?: () => void;
};

/**
 * Simple kudos button for activity items (Issue #969)
 *
 * Sends a "KUDOS" activity for the given task.
 */
export function KudosButton({ taskId, className, onKudosSent }: KudosButtonProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleClick() {
    if (sent || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        setSent(true);
        onKudosSent?.();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={sending || sent}
      title={sent ? "已給讚" : "給讚"}
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
        sent
          ? "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 cursor-default"
          : "text-muted-foreground hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30",
        className
      )}
    >
      {sending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Heart className={cn("h-3 w-3", sent && "fill-current")} />
      )}
      {sent ? "已讚" : "讚"}
    </button>
  );
}
