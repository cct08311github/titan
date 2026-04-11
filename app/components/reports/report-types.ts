/**
 * Shared types for report components.
 * Centralises DateRangeProps and related interfaces to avoid duplication
 * across report-table.tsx, report-table-audit.tsx, report-charts.tsx, and the
 * reports-extended split files.
 */

export interface DateRangeProps {
  from: string;
  to: string;
}
