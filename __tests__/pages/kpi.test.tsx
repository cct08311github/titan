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
});
