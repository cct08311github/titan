"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type VerificationSummary = {
  total: number;
  expired: number;
  needsReview: number;
  verified: number;
};

type VerificationItem = {
  id: string;
  title: string;
  status: "expired" | "needs_review" | "verified";
  verifier: { id: string; name: string } | null;
  dueDate: string | null;
};

type WidgetProps = {
  userId?: string;
  className?: string;
};

/**
 * Dashboard widget: "N 份文件待驗證" (Issue #968)
 */
export function VerificationWidget({ userId, className }: WidgetProps) {
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const url = userId
      ? `/api/documents/verification-due?userId=${userId}`
      : "/api/documents/verification-due";
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((raw) => {
        if (raw) {
          const data = extractData<{ items: VerificationItem[]; summary: VerificationSummary }>(raw);
          setSummary(data?.summary ?? null);
          setItems(data?.items ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const pendingCount = (summary?.expired ?? 0) + (summary?.needsReview ?? 0);

  return (
    <div className={cn("border border-border rounded-lg bg-card", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center",
          pendingCount > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-green-100 dark:bg-green-900/30"
        )}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : pendingCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-foreground">
            {loading ? "載入中..." : `${pendingCount} 份文件待驗證`}
          </div>
          {summary && (
            <div className="text-xs text-muted-foreground">
              {summary.expired > 0 && <span className="text-red-500">{summary.expired} 已過期</span>}
              {summary.expired > 0 && summary.needsReview > 0 && " / "}
              {summary.needsReview > 0 && <span className="text-amber-500">{summary.needsReview} 待複查</span>}
              {pendingCount === 0 && "所有文件驗證狀態正常"}
            </div>
          )}
        </div>
      </button>

      {expanded && items.length > 0 && (
        <div className="border-t border-border max-h-48 overflow-y-auto">
          {items.filter((i) => i.status !== "verified").map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2 text-xs border-b border-border/50 last:border-0">
              <span>{item.status === "expired" ? "\u26A0\uFE0F" : "\uD83D\uDD04"}</span>
              <span className="flex-1 truncate font-medium text-foreground">{item.title}</span>
              {item.verifier && (
                <span className="text-muted-foreground">{item.verifier.name}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
