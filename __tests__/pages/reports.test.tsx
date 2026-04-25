/**
 * Page tests: Reports v2 — Updated for Phase A/B/C sidebar nav + 4 report types
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MEMBER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

// Issue #1539-3: reports/page.tsx now uses useSearchParams for ?id=<report> deep-link
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Reports Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-distribution")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            data: {
              members: [
                { userId: "u1", userName: "Alice", totalHours: 35, availableHours: 40, utilizationPct: 87.5 },
              ],
            },
          }),
        } as Response);
      }
      if (url.includes("completion-rate")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            data: { weeks: [{ week: "2026-W12", label: "W12", completed: 3 }] },
          }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: {} }) } as Response);
    });
  });

  it("renders without crashing", async () => {
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("renders report sidebar nav labels", async () => {
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getByText("團隊利用率")).toBeInTheDocument();
    expect(screen.getByText("任務速率")).toBeInTheDocument();
    expect(screen.getByText("KPI 達成率趨勢")).toBeInTheDocument();
    expect(screen.getByText("計畫外工作趨勢")).toBeInTheDocument();
  });

  it("shows utilization report data after loading", async () => {
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, json: async () => ({}) } as Response)
    );
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    // Component shows error state without crashing
    expect(document.body).toBeDefined();
  });

  it("renders 報表 heading", async () => {
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(screen.getAllByText("報表").length).toBeGreaterThan(0);
  });

  it("shows empty state when utilization report returns no members", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-distribution")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, data: { members: [] } }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: {} }) } as Response);
    });
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("此期間無工時資料")).toBeInTheDocument();
    });
  });

  it("handles API error (network failure) without crashing", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { default: ReportsPage } = await import("@/app/(app)/reports/page");
    await act(async () => {
      render(<ReportsPage />);
    });
    expect(document.body).toBeDefined();
  });
});
