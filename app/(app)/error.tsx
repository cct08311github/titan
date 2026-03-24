"use client";

import { useEffect } from "react";

/**
 * App-level Error Boundary (Issue #196).
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-semibold">此頁面發生錯誤</h2>
        <p className="text-muted-foreground">
          很抱歉，載入此頁面時發生問題。錯誤已自動回報。
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          重試
        </button>
      </div>
    </div>
  );
}
