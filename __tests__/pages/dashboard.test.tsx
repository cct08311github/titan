/**
 * Page tests: Dashboard (My Day) — Updated for Phase A/B/C v2 redesign
 *
 * The dashboard was rewritten as "My Day" page that calls /api/my-day
 * and renders EngineerMyDay or ManagerMyDay based on returned role.
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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

// ── Global fetch mock ──────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Page component ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DashboardPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/dashboard/page");
  DashboardPage = mod.default;
});

// ── Mock data ──────────────────────────────────────────────────────────

const ENGINEER_DATA = {
  ok: true,
  data: {
    role: "ENGINEER",
    flaggedTasks: [],
    dueTodayTasks: [],
    inProgressTasks: [
      { id: "t1", title: "Task One", status: "IN_PROGRESS", priority: "P1", dueDate: null },
    ],
    todayHours: 2.5,
    dailyTarget: 8,
    timeSuggestions: [],
    monthlyGoals: [],
  },
};

const MANAGER_DATA = {
  ok: true,
  data: {
    role: "MANAGER",
    flaggedTasks: [],
    overdueTasks: [],
    memberWorkload: [
      { id: "u1", name: "Alice", avatar: null, activeTasks: 3, overdueTasks: 0, flaggedTasks: 0 },
    ],
    todayHours: 4,
    alerts: [],
    planSummaries: [],
  },
};

const EMPTY_ENGINEER_DATA = {
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
};

// ── Helpers ────────────────────────────────────────────────────────────
function setSession(role: "MANAGER" | "MEMBER") {
  mockUseSession.mockReturnValue({
    data: { user: { id: "u1", name: "Alice", role }, expires: "2099" },
    status: "authenticated",
  });
}

function setSessionLoading() {
  mockUseSession.mockReturnValue({ data: null, status: "loading" });
}

function setSessionUnauthenticated() {
  mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing with empty data (Engineer)", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => EMPTY_ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("shows loading state while session is loading (no crash)", async () => {
    setSessionLoading();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("shows greeting heading for all roles", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    // Greeting is dynamic (早安/午安/晚安) + user name
    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());
  });

  it("renders without crash when session is unauthenticated", async () => {
    setSessionUnauthenticated();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it("shows 我的一天 subtitle for MEMBER role", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText(/我的一天/)).toBeInTheDocument());
  });

  it("shows 進行中 section for Engineer with tasks", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("進行中")).toBeInTheDocument());
  });

  it("shows 團隊全局 subtitle for MANAGER role", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getAllByText(/團隊全局/).length).toBeGreaterThan(0));
  });

  it("shows 團隊健康快照 section for Manager", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => MANAGER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("團隊健康快照")).toBeInTheDocument());
  });

  it("handles API error without crashing", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0));
  });

  it("handles network rejection without crashing", async () => {
    setSession("MANAGER");
    mockFetch.mockRejectedValue(new Error("Network error"));
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0));
  });

  it("shows 尚無資料 when API returns null data", async () => {
    setSession("MANAGER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: null }) } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("尚無資料")).toBeInTheDocument());
  });

  it("defensive: does not crash on empty flaggedTasks", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => EMPTY_ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("今日工時")).toBeInTheDocument());
  });

  it("renders without crash on partial data (missing fields)", async () => {
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
    // Manager with empty memberWorkload shows fallback text
    await waitFor(() => expect(screen.getByText("尚無團隊成員資料")).toBeInTheDocument());
  });

  it("shows 今天沒有到期任務 when Engineer has no due today tasks", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => EMPTY_ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() =>
      expect(screen.getByText("今天沒有到期任務")).toBeInTheDocument()
    );
  });

  it("shows 目前沒有進行中的任務 when Engineer has no in-progress tasks", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: true, json: async () => EMPTY_ENGINEER_DATA } as Response);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() =>
      expect(screen.getByText("目前沒有進行中的任務")).toBeInTheDocument()
    );
  });
});
