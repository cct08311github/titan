/**
 * @jest-environment jsdom
 */
/**
 * Reports v2 Page Tests — Issue #964
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-auth
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1", role: "MANAGER" } } }),
}));

// Mock api-client
jest.mock("@/lib/api-client", () => ({
  extractData: (body: { data?: unknown }) => body?.data ?? body ?? null,
  extractItems: (body: { data?: unknown[] }) =>
    Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [],
}));

// Mock safe-number
jest.mock("@/lib/safe-number", () => ({
  safeFixed: (n: number, d: number) => (n ?? 0).toFixed(d),
  safePct: (n: number) => `${(n ?? 0).toFixed(1)}%`,
}));

describe("Reports v2 Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/reports/time-distribution")) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                members: [
                  { userId: "u1", userName: "Alice", totalHours: 160, availableHours: 176, utilizationPct: 90.9 },
                  { userId: "u2", userName: "Bob", totalHours: 120, availableHours: 176, utilizationPct: 68.2 },
                ],
              },
            }),
        };
      }
      if (url.includes("/api/reports/completion-rate")) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                weeks: [
                  { week: "W1", label: "W1", completed: 5 },
                  { week: "W2", label: "W2", completed: 8 },
                ],
              },
            }),
        };
      }
      if (url.includes("/api/reports/kpi")) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                months: [
                  {
                    month: "2026-01",
                    label: "1月",
                    kpis: [{ id: "k1", name: "可用性", achievementPct: 99.5, target: 99.9 }],
                  },
                ],
              },
            }),
        };
      }
      if (url.includes("/api/reports/workload")) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                months: [
                  { month: "2026-01", label: "1月", totalTasks: 20, unplannedTasks: 5, unplannedPct: 25 },
                ],
              },
            }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ ok: true, data: null }) };
    });
  });

  it("renders sidebar with 4 report nav items", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    expect(screen.getByText("團隊利用率")).toBeInTheDocument();
    expect(screen.getByText("任務速率")).toBeInTheDocument();
    expect(screen.getByText("KPI 達成率趨勢")).toBeInTheDocument();
    expect(screen.getByText("計畫外工作趨勢")).toBeInTheDocument();
  });

  it("loads utilization report by default", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("switches to velocity report on nav click", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    fireEvent.click(screen.getByText("任務速率"));

    await waitFor(() => {
      expect(screen.getByText("任務速率趨勢")).toBeInTheDocument();
    });
  });

  it("switches to KPI trend report on nav click", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    fireEvent.click(screen.getByText("KPI 達成率趨勢"));

    await waitFor(() => {
      expect(screen.getByText("可用性")).toBeInTheDocument();
    });
  });

  it("switches to unplanned trend report on nav click", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    fireEvent.click(screen.getByText("計畫外工作趨勢"));

    await waitFor(() => {
      expect(screen.getByText("1月")).toBeInTheDocument();
    });
  });

  it("has date range picker inputs", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    expect(screen.getByLabelText("開始日期")).toBeInTheDocument();
    expect(screen.getByLabelText("結束日期")).toBeInTheDocument();
  });

  it("each report has CSV export button", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });
  });

  it("utilization heatmap shows color coding", async () => {
    const Page = (await import("@/app/(app)/reports/page")).default;
    render(<Page />);

    await waitFor(() => {
      // Alice has 90.9% → emerald (green)
      const aliceRow = screen.getByText("Alice").closest("[role='row']");
      expect(aliceRow).toHaveClass("border-emerald-500/30");

      // Bob has 68.2% → orange
      const bobRow = screen.getByText("Bob").closest("[role='row']");
      expect(bobRow).toHaveClass("border-orange-500/30");
    });
  });
});
