/**
 * @jest-environment jsdom
 */
/**
 * Tests: WeeklyPivotReport + MonthlyPivotReport — Issue #1539-3
 *
 * Covers:
 * - Pivot reports load data from view=pivot endpoint
 * - Render pivot table headers / totals / loading / error states
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeeklyPivotReport } from "@/app/components/reports/report-weekly-pivot";
import { MonthlyPivotReport } from "@/app/components/reports/report-monthly-pivot";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/lib/api-client", () => ({
  extractData: (body: { data?: unknown }) => body?.data ?? body ?? null,
  extractItems: (body: { data?: unknown[] }) =>
    Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [],
}));

const PIVOT_PAYLOAD = {
  data: {
    period: { start: "2026-04-20", end: "2026-04-26", label: "2026-04-20 ~ 2026-04-26" },
    rows: [
      {
        userId: "u1",
        userName: "王大明",
        cells: { PLANNED_TASK: 30, INCIDENT: 5 },
        total: 35,
        overtimeTotal: 2,
      },
      {
        userId: "u2",
        userName: "李小華",
        cells: { PLANNED_TASK: 28, ADMIN: 4 },
        total: 32,
        overtimeTotal: 0,
      },
    ],
    categories: ["PLANNED_TASK", "INCIDENT", "ADMIN"],
    categoryTotals: { PLANNED_TASK: 58, INCIDENT: 5, ADMIN: 4 },
    grandTotal: 67,
    grandOvertimeTotal: 2,
  },
};

describe("Pivot reports — Issue #1539-3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: () => Promise.resolve(PIVOT_PAYLOAD),
    }));
  });

  it("WeeklyPivotReport calls weekly endpoint with view=pivot", async () => {
    render(<WeeklyPivotReport from="2026-04-20" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/reports/weekly");
    expect(url).toContain("view=pivot");
    expect(url).toContain("weekStart=2026-04-20");
  });

  it("WeeklyPivotReport renders pivot data", async () => {
    render(<WeeklyPivotReport from="2026-04-20" />);
    await waitFor(() => {
      expect(screen.getByText("週報摘要")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("王大明")).toBeInTheDocument();
      expect(screen.getByText("李小華")).toBeInTheDocument();
    });
  });

  it("MonthlyPivotReport derives YYYY-MM from from-date", async () => {
    render(<MonthlyPivotReport from="2026-04-20" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/reports/monthly");
    expect(url).toContain("view=pivot");
    expect(url).toContain("month=2026-04");
  });

  it("MonthlyPivotReport renders title with month", async () => {
    render(<MonthlyPivotReport from="2026-04-20" />);
    await waitFor(() => {
      expect(screen.getByText(/月報摘要 2026-04/)).toBeInTheDocument();
    });
  });

  it("WeeklyPivotReport handles fetch error gracefully", async () => {
    mockFetch.mockImplementation(async () => ({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    }));
    render(<WeeklyPivotReport from="2026-04-20" />);
    await waitFor(() => {
      // ReportError displays a message; check for retry button presence
      expect(screen.getByRole("button", { name: /重試|retry/i })).toBeInTheDocument();
    });
  });
});
