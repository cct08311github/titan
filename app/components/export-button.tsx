"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  /** Report type for the API call (e.g., "weekly", "monthly", "kpi") */
  reportType: string;
  /** Additional query params for the export API */
  queryParams?: Record<string, string>;
  /** Button label override */
  label?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * R-3: CSV export button component.
 * Triggers a CSV download from /api/reports/export?type={reportType}&format=csv.
 * Shows loading state during download.
 */
export function ExportButton({
  reportType,
  queryParams = {},
  label = "匯出 CSV",
  className,
  disabled = false,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading || disabled) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        type: reportType,
        format: "csv",
        ...queryParams,
      });

      const res = await fetch(`/api/reports/export?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message ?? "匯出失敗");
      }

      // Extract filename from Content-Disposition header or build default
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `${reportType}-report.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "匯出失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        "bg-accent hover:bg-accent/80 text-foreground border border-border",
        (loading || disabled) && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}
