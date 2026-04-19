"use client";

/**
 * Shared primitives for the reports-extended split.
 * Provides: GenericReportTable, useReportData, ReportLoading, ReportError,
 * ReportHeader, flattenToTable.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { extractData } from "@/lib/api-client";

// ─── Generic table ────────────────────────────────────────────────────────────

export interface GenericReportTableProps {
  headers: string[];
  rows: (string | number)[][];
}

export function GenericReportTable({ headers, rows }: GenericReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 text-sm">
        此期間無資料
      </div>
    );
  }
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="報表資料">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 whitespace-nowrap tabular-nums">
                  {String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared fetch hook ────────────────────────────────────────────────────────

export function useReportData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => setData(extractData<T>(body)))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, reload };
}

// ─── Loading / Error wrappers ─────────────────────────────────────────────────

export function ReportLoading({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{message ?? "載入中..."}</span>
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
      <AlertCircle className="h-6 w-6" />
      <span className="text-sm">{message}</span>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
      >
        重試
      </button>
    </div>
  );
}

// ─── Report header ────────────────────────────────────────────────────────────

export function ReportHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Utility: flatten object array to header/row ──────────────────────────────

export function flattenToTable(
  items: Record<string, unknown>[],
): { headers: string[]; rows: (string | number)[][] } {
  if (!items || items.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(items[0]);
  const rows = items.map((item) =>
    headers.map((h) => {
      const v = item[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v as string | number;
    }),
  );
  return { headers, rows };
}
