"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useReportData, ReportLoading, ReportError, ReportHeader, GenericReportTable, flattenToTable } from "./report-shared";

export function V2EarnedValueReport({ from }: { from: string }) {
  const [planId, setPlanId] = useState("");
  const [debouncedPlanId, setDebouncedPlanId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPlanId(planId), 400);
    return () => clearTimeout(t);
  }, [planId]);

  const url = `/api/reports/v2/earned-value?asOfDate=${encodeURIComponent(from)}${debouncedPlanId ? `&planId=${encodeURIComponent(debouncedPlanId)}` : ""}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      planId?: string;
      planTitle?: string;
      asOfDate?: string;
      pv?: number;
      ev?: number;
      ac?: number;
      spi?: number;
      cpi?: number;
      items?: Record<string, unknown>[];
    };
  }>(url);

  const ev = data?.data;
  const items = (ev?.items ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="實獲值分析 (EVM)" description="Earned Value Management 指標">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="計畫 ID"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-28",
              "focus:outline-none focus:ring-1 focus:ring-ring",
            )}
          />
          <button onClick={reload} className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors">
            查詢
          </button>
        </div>
      </ReportHeader>
      {loading ? (
        <ReportLoading message="載入實獲值分析..." />
      ) : error ? (
        <ReportError message={error} onRetry={reload} />
      ) : (
        <>
          {ev && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "PV (計畫價值)", value: ev.pv },
                { label: "EV (實獲值)", value: ev.ev },
                { label: "AC (實際成本)", value: ev.ac },
                { label: "SPI (進度績效)", value: ev.spi },
                { label: "CPI (成本績效)", value: ev.cpi },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold mt-1">{value !== undefined ? value : "—"}</div>
                </div>
              ))}
            </div>
          )}
          {headers.length > 0 && <GenericReportTable headers={headers} rows={rows} />}
        </>
      )}
    </div>
  );
}
