"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Copy, Check, ChevronDown, ChevronUp, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-level Error Boundary (Issue #196, improved in Issue #782).
 * Catches errors in any page within the (app) route group.
 * Reports to /api/error-report for AuditLog persistence.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        source: "app-error",
        url: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  function buildErrorReport() {
    return [
      `TITAN 錯誤回報`,
      `──────────────`,
      `錯誤訊息: ${error.message}`,
      `Digest: ${error.digest ?? "N/A"}`,
      `頁面: ${typeof window !== "undefined" ? window.location.pathname : "unknown"}`,
      `時間: ${new Date().toISOString()}`,
      `User-Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
    ].join("\n");
  }

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(buildErrorReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback: select text from a hidden textarea
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-danger" />
        </div>

        {/* Title & description */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">此頁面發生錯誤</h2>
          <p className="text-sm text-muted-foreground">
            很抱歉，載入此頁面時發生問題。錯誤已自動回報，您也可以手動複製錯誤資訊提供給管理員。
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            重試
          </button>
          <button
            onClick={handleCopyReport}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors shadow-sm",
              copied
                ? "bg-success/10 text-success border border-success/30"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "已複製到剪貼簿" : "回報問題"}
          </button>
        </div>

        {/* Back to dashboard */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          返回儀表板
        </a>

        {/* Error detail toggle */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetail ? "隱藏" : "顯示"}錯誤詳情
          </button>
          {showDetail && (
            <div className="mt-3 text-left bg-muted/50 rounded-lg p-3 text-xs font-mono text-muted-foreground break-all space-y-1">
              <p><span className="text-foreground/60">Message:</span> {error.message}</p>
              <p><span className="text-foreground/60">Digest:</span> {error.digest ?? "N/A"}</p>
              <p><span className="text-foreground/60">URL:</span> {typeof window !== "undefined" ? window.location.pathname : "unknown"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
