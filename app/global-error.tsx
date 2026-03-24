"use client";

/**
 * Root-level Error Boundary (Issue #196).
 * Catches errors in the root layout itself. Must include <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Fire-and-forget error report to AuditLog
  if (typeof window !== "undefined") {
    fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        source: "global-error",
      }),
    }).catch(() => {});
  }

  return (
    <html lang="zh-TW">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            系統發生錯誤
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            很抱歉，系統遇到了非預期的問題。錯誤已自動回報，技術團隊會盡快處理。
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            重試
          </button>
        </div>
      </body>
    </html>
  );
}
