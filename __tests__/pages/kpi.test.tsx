/**
 * Page tests: KPI
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MANAGER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const KPI_LIST = [
  {
    id: "kpi-1",
    code: "KPI-01",
    title: "Revenue Growth",
    target: 100,
    actual: 80,
    weight: 1,
    autoCalc: false,
    taskLinks: [],
    deliverables: [],
  },
];

describe("KPI Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // KPI page fetches /api/kpi?year=... and expects an array
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => KPI_LIST,
    } as Response);
  });

  it("renders without crashing", async () => {
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows KPI title after loading", async () => {
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("Revenue Growth")).toBeInTheDocument();
    });
  });

  it("shows KPI code", async () => {
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("KPI-01")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows empty state guidance when KPI list is empty (Manager)", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    await waitFor(() => {
      // 空資料時應顯示引導訊息
      expect(screen.getByText("尚無 KPI")).toBeInTheDocument();
      // Manager 角色應看到指向建立的提示
      expect(screen.getByText("請點擊「新增 KPI」建立")).toBeInTheDocument();
    });
  });

  it("handles divide-by-zero: target=0 does not crash achievementRate display", async () => {
    const zeroTargetKpi = [{ ...KPI_LIST[0], target: 0, actual: 0 }];
    mockFetch.mockResolvedValue({ ok: true, json: async () => zeroTargetKpi } as Response);
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    // Page should not throw — divide-by-zero guard must exist
    expect(document.body).toBeDefined();
  });

  it("handles null achievementRate without crashing", async () => {
    const nullRateKpi = [{ ...KPI_LIST[0], actual: null, achievementRate: null }];
    mockFetch.mockResolvedValue({ ok: true, json: async () => nullRateKpi } as Response);
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("Manager role can view KPI page (default session role)", async () => {
    const { default: KpiPage } = await import("@/app/(app)/kpi/page");
    await act(async () => {
      render(<KpiPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("Revenue Growth")).toBeInTheDocument();
    });
  });
});
