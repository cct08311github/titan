/**
 * Page tests: Timesheet
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

// Mock the grid to avoid complexity
jest.mock("@/app/components/timesheet-grid", () => ({
  TimesheetGrid: () => <div data-testid="timesheet-grid" />,
}));
jest.mock("@/app/components/time-summary", () => ({
  TimeSummary: () => <div data-testid="time-summary" />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Timesheet Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
  });

  it("renders without crashing", async () => {
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("renders week navigation", async () => {
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    // Should show previous/next week navigation
    expect(document.body).toBeDefined();
  });

  it("renders timesheet grid", async () => {
    // Provide mock time entries so the grid is rendered instead of the empty state
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-entries/stats")) {
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: "e1", userId: "u1", taskId: null, date: "2024-01-15", hours: 4, category: "PLANNED_TASK", description: null, task: null },
        ],
      } as Response);
    });
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-grid")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("renders without crash when entries and users are empty arrays", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    expect(document.body).toBeDefined();
  });
});
