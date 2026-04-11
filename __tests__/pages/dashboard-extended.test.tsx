/**
 * Extended tests for Dashboard (My Day) page — Updated for Phase A/B/C v2 redesign
 *
 * Covers:
 *  - Role-based rendering (Manager vs Engineer My Day)
 *  - Error recovery with retry
 *  - Edge cases: empty data states
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Session mock ──────────────────────────────────────────────────────
const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DashboardPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/dashboard/page");
  DashboardPage = mod.default;
});

// ── Mock data ────────────────────────────────────────────────────────

const MANAGER_DATA_HAPPY = {
  ok: true,
  data: {
    role: "MANAGER",
    flaggedTasks: [
      { id: "t1", title: "Flagged Task", status: "IN_PROGRESS", priority: "P0", dueDate: null, managerFlagged: true },
    ],
    overdueTasks: [
      { id: "t2", title: "Overdue Task", status: "IN_PROGRESS", priority: "P1", dueDate: "2020-01-01" },
    ],
    memberWorkload: [
      { id: "u1", name: "Alice", avatar: null, activeTasks: 5, overdueTasks: 1, flaggedTasks: 1 },
      { id: "u2", name: "Bob", avatar: null, activeTasks: 3, overdueTasks: 0, flaggedTasks: 0 },
    ],
    todayHours: 4,
    alerts: [
      { type: "CRITICAL", message: "2 tasks overdue > 3 days" },
    ],
    planSummaries: [
      { id: "p1", title: "2026 Annual Plan", progressPct: 65, flaggedCount: 2 },
    ],
  },
};

const ENGINEER_DATA_HAPPY = {
  ok: true,
  data: {
    role: "ENGINEER",
    flaggedTasks: [
      { id: "t3", title: "Manager Flagged", status: "IN_PROGRESS", priority: "P0", dueDate: null, managerFlagged: true },
    ],
    dueTodayTasks: [
      { id: "t4", title: "Due Today Task", status: "TODO", priority: "P1", dueDate: "2026-03-27" },
    ],
    inProgressTasks: [
      { id: "t5", title: "Working On It", status: "IN_PROGRESS", priority: "P2", dueDate: null },
    ],
    todayHours: 3.5,
    dailyTarget: 8,
    timeSuggestions: [],
    monthlyGoals: [
      { id: "g1", title: "Complete Module A", progressPct: 70, status: "IN_PROGRESS" },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function setSession(role: "MANAGER" | "MEMBER") {
  mockUseSession.mockReturnValue({
    data: { user: { id: "u1", name: "Alice", role }, expires: "2099" },
    status: "authenticated",
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Dashboard Extended — Role-based rendering", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Manager sees 團隊健康快照 section with team member names", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("團隊健康快照")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("Manager sees alerts bar when alerts exist", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("2 tasks overdue > 3 days")).toBeInTheDocument();
    });
  });

  it("Manager sees 年度計畫 summaries with progress", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("年度計畫")).toBeInTheDocument();
      expect(screen.getByText("2026 Annual Plan")).toBeInTheDocument();
    });
  });

  it("Engineer sees flagged tasks section when manager-flagged tasks exist", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("主管標記任務")).toBeInTheDocument();
      expect(screen.getByText("Manager Flagged")).toBeInTheDocument();
    });
  });

  it("Engineer sees 今日到期 section", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("今日到期")).toBeInTheDocument();
      expect(screen.getByText("Due Today Task")).toBeInTheDocument();
    });
  });

  it("Engineer sees 本月目標 section", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("本月目標")).toBeInTheDocument();
      expect(screen.getByText("Complete Module A")).toBeInTheDocument();
    });
  });

  it("Engineer sees 今日工時 progress bar section", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA_HAPPY } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("今日工時")).toBeInTheDocument();
    });
  });
});

describe("Dashboard Extended — Error recovery interaction", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Manager: error state shows 發生錯誤 and retry triggers re-fetch", async () => {
    setSession("MANAGER");
    // All fetches fail until we explicitly switch to success after verifying error state.
    const failResponse = { ok: false, status: 500, json: async () => ({}) } as Response;
    mockFetch.mockResolvedValue(failResponse);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const retryButtons = screen.getAllByText("重試");
    expect(retryButtons.length).toBeGreaterThan(0);
    // Switch to success before clicking retry
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA_HAPPY } as Response);
    await act(async () => { fireEvent.click(retryButtons[0]); });

    await waitFor(() => {
      expect(screen.getByText("團隊健康快照")).toBeInTheDocument();
    });
  });

  it("Engineer: empty tasks shows 今天沒有到期任務 and 目前沒有進行中的任務", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          role: "ENGINEER",
          flaggedTasks: [],
          dueTodayTasks: [],
          inProgressTasks: [],
          todayHours: 0,
          dailyTarget: 8,
          timeSuggestions: [],
          monthlyGoals: [],
        },
      }),
    } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("今天沒有到期任務")).toBeInTheDocument();
      expect(screen.getByText("目前沒有進行中的任務")).toBeInTheDocument();
    });
  });

  it("Manager with empty team shows 尚無團隊成員資料", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          role: "MANAGER",
          flaggedTasks: [],
          overdueTasks: [],
          memberWorkload: [],
          todayHours: 0,
          alerts: [],
          planSummaries: [],
        },
      }),
    } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("尚無團隊成員資料")).toBeInTheDocument();
    });
  });
});
