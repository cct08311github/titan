import { NextResponse } from "next/server";

/**
 * Unified report response format (Issue #1004)
 *
 * Standard wrapper for all v2 report APIs:
 * { ok: true, data: T, meta: { dateRange, generatedAt, reportType } }
 */

export interface ReportMeta {
  dateRange: { from: string | null; to: string | null };
  generatedAt: string;
  reportType: string;
}

export interface ReportResponse<T = unknown> {
  ok: boolean;
  data?: T;
  meta?: ReportMeta;
  error?: string;
  message?: string;
}

/**
 * Returns a successful report JSON response with standard meta.
 */
export function reportSuccess<T>(
  data: T,
  reportType: string,
  dateRange: { from?: string | null; to?: string | null },
  status = 200
): NextResponse<ReportResponse<T>> {
  const meta: ReportMeta = {
    dateRange: { from: dateRange.from ?? null, to: dateRange.to ?? null },
    generatedAt: new Date().toISOString(),
    reportType,
  };
  return NextResponse.json({ ok: true, data, meta }, { status });
}
