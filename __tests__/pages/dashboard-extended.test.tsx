/**
 * Extended RTL tests for Dashboard page — Issue #373
 *
 * Focuses on:
 *  - Role-based rendering differences (Manager vs Engineer)
 *  - User interaction: retry buttons, conditional sections
 *  - Data-driven rendering: KPI section, today tasks, overdue highlight
 *  - Edge cases: mixed data states
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Session mock ──────────────────────────────────────────────────────────────
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

// ── Mock data ─────────────────────────────────────────────────────────────────

const WORKLOAD_HAPPY = {
  byPerson: [
    { userId: "u1", name: "Alice", total: 40, planned: 30, unplanned: 10 },
    { userId: "u2", name: "Bob", total: 35, planned: 25, unplanned: 10 },
  ],
  plannedRate: 75,
  unplannedRate: 25,
  totalHours: 75,
};

const WEEKLY_HAPPY = {
  completedCount: 5,
  overdueCount: 2,
  delayCount: 1,
  scopeChangeCount: 0,
  totalHours: 38,
};

const TASKS_HAPPY = [
  { id: "t1", title: "Task One", status: "IN_PROGRESS", priority: "HIGH", dueDate: null },
  { id: "t2", title: "Task Two", status: "TODO", priority: "MEDIUM", dueDate: "2099-12-31" },
  { id: "t3", title: "Overdue Task", status: "IN_PROGRESS", priority: "URGENT", dueDate: "2020-01-01" },
];

const KPI_HAPPY = [
  {
    id: "k1", code: "KPI-01", title: "Revenue Growth",
    target: 100, actual: 80, status: "ON_TRACK",
    autoCalc: false, taskLinks: [],
  },
  {
    id: "k2", code: "KPI-02", title: "Customer Satisfaction",
    target: 90, actual: 85, status: "AT_RISK",
    autoCalc: false, taskLinks: [],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function setSession(role: "MANAGER" | "MEMBER") {
  mockUseSession.mockReturnValue({
    data: { user: { id: "u1", name: "Alice", role }, expires: "2099" },
    status: "authenticated",
  });
}

function setupFetch(
  workload: unknown = WORKLOAD_HAPPY,
  weekly: unknown = WEEKLY_HAPPY,
  tasks: unknown = TASKS_HAPPY,
  kpi: unknown = KPI_HAPPY,
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("workload")) return Promise.resolve({ ok: true, json: async () => workload } as Response);
    if (url.includes("weekly")) return Promise.resolve({ ok: true, json: async () => weekly } as Response);
    if (url.includes("tasks")) return Promise.resolve({ ok: true, json: async () => tasks } as Response);
    if (url.includes("kpi")) return Promise.resolve({ ok: true, json: async () => kpi } as Response);
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Dashboard Extended — Role-based rendering", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Manager sees 團隊工時分佈 section with team member names", async () => {
    setSession("MANAGER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("團隊工時分佈（本月）")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("Manager sees 投入率分析 section with planned/unplanned rates", async () => {
    setSession("MANAGER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("投入率分析（計畫任務 vs 加入任務）")).toBeInTheDocument();
      expect(screen.getByText("計畫內投入")).toBeInTheDocument();
      expect(screen.getByText("計畫外投入")).toBeInTheDocument();
    });
  });

  it("Engineer sees 我的任務 section with task titles", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("我的任務（待辦 + 進行中）")).toBeInTheDocument();
      expect(screen.getAllByText("Task One").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Task Two").length).toBeGreaterThan(0);
    });
  });

  it("Engineer sees 本週工時進度 progress bar section", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("本週工時進度")).toBeInTheDocument();
    });
  });

  it("Engineer sees overdue task count as stat card with accent", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getAllByText("逾期任務").length).toBeGreaterThan(0);
    });
  });
});

describe("Dashboard Extended — KPI section", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders KPI progress bars with code and title", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("KPI-01")).toBeInTheDocument();
      expect(screen.getByText("Revenue Growth")).toBeInTheDocument();
      expect(screen.getByText("KPI-02")).toBeInTheDocument();
      expect(screen.getByText("Customer Satisfaction")).toBeInTheDocument();
    });
  });

  it("renders KPI status badges (ON_TRACK / AT_RISK)", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getAllByText("進行中").length).toBeGreaterThan(0); // ON_TRACK
      expect(screen.getAllByText("風險").length).toBeGreaterThan(0);   // AT_RISK
    });
  });
});

describe("Dashboard Extended — Error recovery interaction", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Manager: error state shows 發生錯誤 and retry triggers re-fetch", async () => {
    setSession("MANAGER");
    // First call fails, second succeeds
    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      callCount++;
      if (callCount <= 2) {
        // First round: both workload + weekly fail
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      // After retry
      if (url.includes("workload")) return Promise.resolve({ ok: true, json: async () => WORKLOAD_HAPPY } as Response);
      if (url.includes("weekly")) return Promise.resolve({ ok: true, json: async () => WEEKLY_HAPPY } as Response);
      if (url.includes("kpi")) return Promise.resolve({ ok: true, json: async () => KPI_HAPPY } as Response);
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0);
    });

    // Click retry button
    const retryButtons = screen.getAllByText("重試");
    expect(retryButtons.length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(retryButtons[0]); });

    // After retry, data should load
    await waitFor(() => {
      expect(screen.getByText("儀表板")).toBeInTheDocument();
    });
  });

  it("Engineer: empty tasks + zero weekly hours shows 尚無待處理任務 guidance", async () => {
    setSession("MEMBER");
    setupFetch(
      WORKLOAD_HAPPY,
      { completedCount: 0, overdueCount: 0, delayCount: 0, scopeChangeCount: 0, totalHours: 0 },
      [],
      KPI_HAPPY,
    );
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("尚無待處理任務")).toBeInTheDocument();
      expect(screen.getByText("開始使用")).toBeInTheDocument();
    });
  });

  it("Manager with zero data shows 尚無團隊數據 guidance", async () => {
    setSession("MANAGER");
    setupFetch(
      { byPerson: [], plannedRate: 0, unplannedRate: 0, totalHours: 0 },
      { completedCount: 0, overdueCount: 0, delayCount: 0, scopeChangeCount: 0, totalHours: 0 },
      [],
      [],
    );
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => {
      expect(screen.getByText("尚無團隊數據")).toBeInTheDocument();
      expect(screen.getByText("快速開始指南")).toBeInTheDocument();
    });
  });
});
