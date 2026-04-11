"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable, flattenToTable } from "./report-shared";

export function CustomReport({ from, to }: { from: string; to: string }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");
  const [debouncedStatus, setDebouncedStatus] = useState("");
  const [page] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategory(category), 400);
    return () => clearTimeout(t);
  }, [category]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStatus(status), 400);
    return () => clearTimeout(t);
  }, [status]);

  const url = `/api/reports/custom?category=${encodeURIComponent(debouncedCategory)}&status=${encodeURIComponent(debouncedStatus)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&limit=20`;
  const { data, loading, error, reload } = useReportData<{
    items?: Record<string, unknown>[];
    total?: number;
    page?: number;
    limit?: number;
  }>(url);

  const items = data?.items ?? [];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="自訂查詢" description="按類別和狀態過濾任務">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="類別"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-24",
              "focus:outline-none focus:ring-1 focus:ring-ring",
            )}
          />
          <input
            type="text"
            placeholder="狀態"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-24",
              "focus:outline-none focus:ring-1 focus:ring-ring",
            )}
          />
          <button
            onClick={reload}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
          >
            查詢
          </button>
        </div>
      </ReportHeader>
      {loading ? (
        <ReportLoading message="查詢中..." />
      ) : error ? (
        <ReportError message={error} onRetry={reload} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">共 {data?.total ?? 0} 筆</p>
          <GenericReportTable headers={headers} rows={rows} />
        </>
      )}
    </div>
  );
}
