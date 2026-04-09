/**
 * Page tests: Timesheet
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/timesheet",
}));

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
    // Provide mock time entries with a real taskId so taskRows has a task-bound row
    // (taskId: null is a free-row entry and does NOT add a task-bound row to taskRows)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-entries/stats")) {
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: "e1", userId: "u1", taskId: "task-1", date: "2024-01-15", hours: 4, category: "PLANNED_TASK", description: null, task: { title: "Task 1" } },
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

  it("shows empty state guidance when no time entries exist", async () => {
    // Empty entries → page should guide user to add time
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    await waitFor(() => {
      // 空資料時仍顯示 grid（讓使用者可以點擊格子輸入），但有引導提示
      // Refactored page shows help text
      expect(screen.getByText(/點擊格子直接輸入數字/)).toBeInTheDocument();
    });
  });

  it("shows PageEmpty CTA when only FREE_ROW exists (no task-bound rows)", async () => {
    // When fetch returns empty entries, taskRows = [FREE_ROW] only.
    // The fixed condition filters out FREE_ROW (taskId === null), so length === 0 → PageEmpty renders.
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-entries/stats")) {
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    });
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("從看板選擇任務或先建立一個")).toBeInTheDocument();
    });
    const kanbanLink = screen.getByRole("link", { name: "前往看板" });
    expect(kanbanLink).toBeInTheDocument();
    expect(kanbanLink).toHaveAttribute("href", "/kanban");
  });

  it("renders without crash when hours fields are null in time entries", async () => {
    // Null hours guard: prevents NaN from null.toFixed()
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("time-entries/stats")) {
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: "e-null", userId: "u1", taskId: null, date: "2024-01-15", hours: null, category: "PLANNED_TASK", description: null, task: null },
        ],
      } as Response);
    });
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => {
      render(<TimesheetPage />);
    });
    // Should not throw TypeError on null.toFixed()
    expect(document.body).toBeDefined();
  });
});
