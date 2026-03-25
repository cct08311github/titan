/**
 * Enhanced Timesheet Tests — TDD for Issues #717, #718, #719
 *
 * Tests dual view (grid/list toggle), list view rendering,
 * and timer widget integration.
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

jest.mock("@/app/components/timesheet-grid", () => ({
  TimesheetGrid: () => <div data-testid="timesheet-grid">Grid View</div>,
}));
jest.mock("@/app/components/time-summary", () => ({
  TimeSummary: () => <div data-testid="time-summary" />,
}));
jest.mock("@/app/components/timer-widget", () => ({
  TimerWidget: () => <div data-testid="timer-widget">Timer</div>,
}));
jest.mock("@/app/components/timesheet-list-view", () => ({
  TimesheetListView: () => <div data-testid="timesheet-list-view">List View</div>,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function setSession(role: "MANAGER" | "MEMBER") {
  mockUseSession.mockReturnValue({
    data: { user: { id: "u1", name: "Alice", role }, expires: "2099" },
    status: "authenticated",
  });
}

const TIME_ENTRIES = [
  {
    id: "e1", userId: "u1", taskId: null, date: "2024-01-15",
    hours: 4, category: "PLANNED_TASK", description: null,
    startTime: "2024-01-15T08:00:00Z", endTime: "2024-01-15T12:00:00Z",
    task: null,
  },
  {
    id: "e2", userId: "u1", taskId: "t1", date: "2024-01-15",
    hours: 3, category: "ADDED_TASK", description: "Code review",
    startTime: "2024-01-15T13:00:00Z", endTime: "2024-01-15T16:00:00Z",
    task: { id: "t1", title: "Dev Task", category: "PLANNED" },
  },
];

const STATS_DATA = {
  totalHours: 7,
  breakdown: [
    { category: "PLANNED_TASK", hours: 4, pct: 57 },
    { category: "ADDED_TASK", hours: 3, pct: 43 },
  ],
  taskInvestmentRate: 57,
  entryCount: 2,
};

function setupFetch(entries = TIME_ENTRIES, stats = STATS_DATA) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("time-entries/running")) {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, data: null }) } as Response);
    }
    if (url.includes("time-entries/stats")) {
      return Promise.resolve({ ok: true, json: async () => stats } as Response);
    }
    if (url.includes("time-entries")) {
      return Promise.resolve({ ok: true, json: async () => entries } as Response);
    }
    if (url.includes("users")) {
      return Promise.resolve({ ok: true, json: async () => [{ id: "u1", name: "Alice" }] } as Response);
    }
    if (url.includes("tasks")) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: "t1", title: "Dev Task" }, { id: "t2", title: "Design" }],
      } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// View Toggle Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Timesheet Enhanced — View Toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Do not use jest.resetModules() — causes React hook resolution issues
  });

  it("renders grid view by default", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-grid")).toBeInTheDocument();
    });
  });

  it("shows view toggle tabs (格子/列表)", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByText("格子")).toBeInTheDocument();
      expect(screen.getByText("列表")).toBeInTheDocument();
    });
  });

  it("switches to list view when clicking 列表 tab", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByText("列表")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("列表"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-list-view")).toBeInTheDocument();
    });
  });

  it("switches back to grid view when clicking 格子 tab", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => { expect(screen.getByText("列表")).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText("列表")); });
    await waitFor(() => { expect(screen.getByTestId("timesheet-list-view")).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByText("格子")); });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-grid")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Timer Widget Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe("Timesheet Enhanced — Timer Widget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Do not use jest.resetModules() — causes React hook resolution issues
  });

  it("renders timer widget on the page", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-timer")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Totals (grid already has this, just verify the grid still renders)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Timesheet Enhanced — Data rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Do not use jest.resetModules() — causes React hook resolution issues
  });

  it("renders grid with entries present", async () => {
    setSession("MEMBER");
    setupFetch();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-grid")).toBeInTheDocument();
    });
  });
});
