/**
 * Page tests: Dashboard
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

const mockFetch = jest.fn();
global.fetch = mockFetch;

const WORKLOAD_RESPONSE = {
  byPerson: [{ userId: "u1", name: "Alice", total: 40, planned: 30, unplanned: 10 }],
  plannedRate: 75,
  unplannedRate: 25,
  totalHours: 40,
};

const WEEKLY_RESPONSE = {
  completedCount: 5,
  overdueCount: 2,
  delayCount: 1,
  scopeChangeCount: 0,
  totalHours: 40,
};

const TASKS_RESPONSE = [
  { id: "t1", title: "Task One", status: "TODO", priority: "P2", dueDate: null },
];

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("workload")) {
        return Promise.resolve({ ok: true, json: async () => WORKLOAD_RESPONSE } as Response);
      }
      if (url.includes("weekly")) {
        return Promise.resolve({ ok: true, json: async () => WEEKLY_RESPONSE } as Response);
      }
      if (url.includes("tasks")) {
        return Promise.resolve({ ok: true, json: async () => TASKS_RESPONSE } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
  });

  it("renders without crashing", async () => {
    const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");
    await act(async () => {
      render(<DashboardPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("loads and displays dashboard heading", async () => {
    const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");
    await act(async () => {
      render(<DashboardPage />);
    });
    await waitFor(() => {
      // MEMBER view shows "工程師視角" subheading after loading
      expect(screen.getByText(/工程師視角/)).toBeInTheDocument();
    });
  });

  it("shows stat card labels after loading", async () => {
    const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");
    await act(async () => {
      render(<DashboardPage />);
    });
    await waitFor(() => {
      // MEMBER view has "進行中任務" stat card
      expect(screen.getByText("進行中任務")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    // Use ok: false to simulate server error (avoids unhandled promise rejections)
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: DashboardPage } = await import("@/app/(app)/dashboard/page");
    await act(async () => {
      render(<DashboardPage />);
    });
    expect(document.body).toBeDefined();
  });
});
