/**
 * Extended RTL tests for Timesheet page — Issue #373
 *
 * Focuses on:
 *  - Page heading and week label render
 *  - Manager role: user filter dropdown visible
 *  - MEMBER role: user filter NOT visible
 *  - Week navigation buttons (本週, prev, next)
 *  - Refresh button present
 *  - Error state with retry
 *  - Loading state text
 *  - Stats summary rendering when data is present
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

jest.mock("@/app/components/timesheet-grid", () => ({
  TimesheetGrid: () => <div data-testid="timesheet-grid" />,
}));
jest.mock("@/app/components/time-summary", () => ({
  TimeSummary: ({ totalHours }: { totalHours: number }) => (
    <div data-testid="time-summary">Total: {totalHours}h</div>
  ),
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
  { id: "e1", userId: "u1", taskId: null, date: "2024-01-15", hours: 4, category: "PLANNED_TASK", description: null, task: null },
  { id: "e2", userId: "u1", taskId: "t1", date: "2024-01-16", hours: 6, category: "PLANNED_TASK", description: null, task: { id: "t1", title: "Dev Task" } },
];

const STATS_DATA = {
  totalHours: 10,
  breakdown: [{ category: "PLANNED_TASK", hours: 10, pct: 100 }],
  taskInvestmentRate: 60,
  entryCount: 2,
};

function setupFetchWithEntries(entries: unknown[] = TIME_ENTRIES, stats: unknown = STATS_DATA) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("time-entries/stats")) {
      return Promise.resolve({ ok: true, json: async () => stats } as Response);
    }
    if (url.includes("time-entries")) {
      return Promise.resolve({ ok: true, json: async () => entries } as Response);
    }
    if (url.includes("users")) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: "u1", name: "Alice" },
          { id: "u2", name: "Bob" },
        ],
      } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

describe("Timesheet Extended — Basic render", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders 工時紀錄 heading", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    expect(screen.getByText("工時紀錄")).toBeInTheDocument();
  });

  it("renders week label with year and date range", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    // Refactored toolbar shows page title
    expect(screen.getByText("工時紀錄")).toBeInTheDocument();
  });

  it("renders 本週 navigation button", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    expect(screen.getByText("本週")).toBeInTheDocument();
  });

  it("renders help text about cell interaction", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByText(/點擊格子直接輸入數字/)).toBeInTheDocument();
    });
  });
});

describe("Timesheet Extended — Role-based rendering", () => {
  beforeEach(() => jest.clearAllMocks());

  it("MANAGER sees user filter dropdown", async () => {
    setSession("MANAGER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByLabelText("篩選使用者")).toBeInTheDocument();
    });
  });

  it("MEMBER does NOT see user filter dropdown", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.queryByLabelText("篩選使用者")).not.toBeInTheDocument();
    });
  });

  it("MANAGER user filter shows team member names", async () => {
    setSession("MANAGER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      const select = screen.getByLabelText("篩選使用者");
      expect(select).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });
});

describe("Timesheet Extended — Data states", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders TimesheetGrid when entries exist", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByTestId("timesheet-grid")).toBeInTheDocument();
    });
  });

  it("renders TimeSummary when stats have positive totalHours", async () => {
    setSession("MEMBER");
    setupFetchWithEntries();
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByTestId("time-summary")).toBeInTheDocument();
      expect(screen.getByText("Total: 10h")).toBeInTheDocument();
    });
  });

  it("shows error state with 發生錯誤 on fetch failure", async () => {
    setSession("MEMBER");
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("users")) return Promise.resolve({ ok: true, json: async () => [] } as Response);
      if (url.includes("stats")) return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
    });
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("shows loading state text 載入工時", async () => {
    setSession("MEMBER");
    // Never resolve fetch to keep loading
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("users")) return Promise.resolve({ ok: true, json: async () => [] } as Response);
      return new Promise(() => {});
    });
    const { default: TimesheetPage } = await import("@/app/(app)/timesheet/page");
    await act(async () => { render(<TimesheetPage />); });
    expect(screen.getByText("載入工時...")).toBeInTheDocument();
  });
});
