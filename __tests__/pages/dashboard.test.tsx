/**
 * Page tests: Dashboard (15 cases)
 *
 * Covers:
 *  - Engineer view, Manager view, loading state, unauthenticated
 *  - 6 stat-card defensive cases: null / undefined / NaN / 0 / negative / malformed types
 *  - API error state, network rejection
 *  - Empty workload, empty KPI list, empty task list
 *  - 4-level mock strategy: happy / empty / partial / malformed
 *
 * NOTE: Do NOT call jest.resetModules() in this suite — it breaks React's
 * internal hook registry and causes "Cannot read properties of null (reading
 * 'useState')" crashes. Instead, import the page once in beforeAll and
 * control per-test behaviour through mockReturnValue / mockImplementation.
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Session mock (must be hoisted before any import of next-auth) ──────────

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard"),
}));

// ── Global fetch mock ──────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Page component (imported once; resetModules would break React hooks) ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DashboardPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/dashboard/page");
  DashboardPage = mod.default;
});

// ── Mock data (4-level strategy) ───────────────────────────────────────────

// Level 1 — happy: complete valid data
const WORKLOAD_HAPPY = {
  byPerson: [{ userId: "u1", name: "Alice", total: 40, planned: 30, unplanned: 10 }],
  plannedRate: 75,
  unplannedRate: 25,
  totalHours: 40,
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
];
const KPI_HAPPY = [
  {
    id: "k1", code: "KPI-01", title: "Revenue Growth",
    target: 100, actual: 80, status: "ON_TRACK",
    autoCalc: false, taskLinks: [],
  },
];

// Level 2 — empty: null / empty arrays
const WORKLOAD_EMPTY = { byPerson: [], plannedRate: 0, unplannedRate: 0, totalHours: 0 };
const WEEKLY_EMPTY = { completedCount: 0, overdueCount: 0, delayCount: 0, scopeChangeCount: 0, totalHours: 0 };

// Level 3 — partial: missing fields (schema drift)
const WORKLOAD_PARTIAL = {
  byPerson: [{ userId: "u2", name: "Bob" /* total / planned / unplanned missing */ }],
  /* plannedRate / unplannedRate / totalHours missing */
};
const WEEKLY_PARTIAL = {
  completedCount: 3,
  /* overdueCount / delayCount / scopeChangeCount / totalHours missing */
};

// Level 4 — malformed: wrong types
const WEEKLY_MALFORMED = {
  completedCount: "five" as unknown as number,
  overdueCount: null as unknown as number,
  delayCount: undefined as unknown as number,
  scopeChangeCount: NaN,
  totalHours: -1,
};
const WORKLOAD_MALFORMED = {
  byPerson: [
    { userId: 123 as unknown as string, name: null as unknown as string,
      total: "forty" as unknown as number, planned: NaN, unplanned: -5 },
  ],
  plannedRate: NaN,
  unplannedRate: undefined as unknown as number,
  totalHours: null as unknown as number,
};

// ── Helpers ────────────────────────────────────────────────────────────────

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

const TASK_SUMMARY_HAPPY = {
  data: {
    todo: { count: 3, trend: "up" as const, diff: 1 },
    inProgress: { count: 5, trend: "same" as const, diff: 0 },
    done: { count: 8, trend: "down" as const, diff: -2 },
    scope: "personal" as const,
  },
};
const TASK_SUMMARY_EMPTY = {
  data: {
    todo: { count: 0, trend: "same" as const, diff: 0 },
    inProgress: { count: 0, trend: "same" as const, diff: 0 },
    done: { count: 0, trend: "same" as const, diff: 0 },
    scope: "personal" as const,
  },
};

function setupFetch(
  workload: unknown = WORKLOAD_HAPPY,
  weekly: unknown = WEEKLY_HAPPY,
  tasks: unknown = TASKS_HAPPY,
  kpi: unknown = KPI_HAPPY,
  taskSummary: unknown = TASK_SUMMARY_HAPPY,
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("task-summary")) return Promise.resolve({ ok: true, json: async () => taskSummary } as Response);
    if (url.includes("workload")) return Promise.resolve({ ok: true, json: async () => workload } as Response);
    if (url.includes("weekly"))   return Promise.resolve({ ok: true, json: async () => weekly   } as Response);
    if (url.includes("tasks"))    return Promise.resolve({ ok: true, json: async () => tasks    } as Response);
    if (url.includes("kpi"))      return Promise.resolve({ ok: true, json: async () => kpi      } as Response);
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Case 1: renders without crashing (empty data) ────────────────────────
  it("renders without crashing with empty data (Engineer)", async () => {
    setSession("MEMBER");
    setupFetch(WORKLOAD_EMPTY, WEEKLY_EMPTY, [], []);
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
    expect(screen.queryByText(/uncaught/i)).not.toBeInTheDocument();
  });

  // ── Case 2: loading state ────────────────────────────────────────────────
  it("shows loading state while session is loading (no crash)", async () => {
    setSessionLoading();
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
    expect(screen.queryByText(/uncaught/i)).not.toBeInTheDocument();
  });

  // ── Case 3: key UI element — 儀表板 heading ──────────────────────────────
  it("shows 儀表板 heading for all roles", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    expect(screen.getByText("儀表板")).toBeInTheDocument();
  });

  // ── Case 4: defensive — unauthenticated session ──────────────────────────
  it("renders without crash when session is unauthenticated", async () => {
    setSessionUnauthenticated();
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
    expect(screen.queryByText(/uncaught/i)).not.toBeInTheDocument();
  });

  // ── Case 5: Engineer role subtitle ──────────────────────────────────────
  it("shows 工程師視角 subtitle for MEMBER role", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText(/工程師視角/)).toBeInTheDocument());
  });

  // ── Case 6: Engineer stat card ───────────────────────────────────────────
  it("shows 進行中任務 stat card label for Engineer", async () => {
    setSession("MEMBER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("進行中任務")).toBeInTheDocument());
  });

  // ── Case 7: Manager role subtitle ───────────────────────────────────────
  it("shows 主管視角 subtitle for MANAGER role", async () => {
    setSession("MANAGER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText(/主管視角/)).toBeInTheDocument());
  });

  // ── Case 8: Manager stat card ────────────────────────────────────────────
  it("shows 本週完成任務 stat card label for Manager", async () => {
    setSession("MANAGER");
    setupFetch();
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("本週完成任務")).toBeInTheDocument());
  });

  // ── Case 9: API error state (ok: false) ─────────────────────────────────
  it("handles API error (ok: false) without crashing", async () => {
    setSession("MEMBER");
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    await act(async () => { render(<DashboardPage />); });
    // PageError renders 「發生錯誤」— may appear multiple times (main + KPI section)
    await waitFor(() => expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0));
    // Should show localised error message, not raw JSON
    expect(screen.queryByText(/^\{"error"/)).not.toBeInTheDocument();
  });

  // ── Case 10: network rejection ───────────────────────────────────────────
  it("handles network rejection without crashing", async () => {
    setSession("MANAGER");
    mockFetch.mockRejectedValue(new Error("Network error"));
    await act(async () => { render(<DashboardPage />); });
    // PageError renders 「發生錯誤」— may appear multiple times (main + KPI section)
    await waitFor(() => expect(screen.getAllByText("發生錯誤").length).toBeGreaterThan(0));
    // Should show localised error message, not raw JSON
    expect(screen.queryByText(/^\{"error"/)).not.toBeInTheDocument();
  });

  // ── Case 11: empty workload ──────────────────────────────────────────────
  it("shows fallback text when Manager workload byPerson is empty", async () => {
    setSession("MANAGER");
    setupFetch(WORKLOAD_EMPTY, WEEKLY_HAPPY);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() =>
      expect(screen.getByText("本月尚無工時紀錄")).toBeInTheDocument()
    );
  });

  // ── Case 12: empty KPI list ──────────────────────────────────────────────
  it("shows 尚無 KPI when KPI list is empty", async () => {
    setSession("MEMBER");
    setupFetch(WORKLOAD_HAPPY, WEEKLY_HAPPY, TASKS_HAPPY, []);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() => expect(screen.getByText("尚無 KPI")).toBeInTheDocument());
  });

  // ── Case 13: defensive — NaN / null / negative / malformed types ─────────
  it("defensive: stat cards do not crash on null/NaN/negative/malformed stats", async () => {
    setSession("MANAGER");
    setupFetch(WORKLOAD_MALFORMED, WEEKLY_MALFORMED);
    await act(async () => { render(<DashboardPage />); });
    expect(screen.getByText("儀表板")).toBeInTheDocument();
    expect(screen.queryByText(/uncaught/i)).not.toBeInTheDocument();
  });

  // ── Case 14: defensive — partial data (schema drift) ────────────────────
  it("renders without crash on partial workload/weekly data (missing fields)", async () => {
    setSession("MANAGER");
    setupFetch(WORKLOAD_PARTIAL, WEEKLY_PARTIAL);
    await act(async () => { render(<DashboardPage />); });
    expect(screen.getByText("儀表板")).toBeInTheDocument();
    expect(screen.queryByText(/uncaught/i)).not.toBeInTheDocument();
  });

  // ── Case 15: empty tasks list for Engineer ───────────────────────────────
  it("shows fallback text when Engineer has no tasks", async () => {
    setSession("MEMBER");
    setupFetch(WORKLOAD_HAPPY, WEEKLY_HAPPY, [], []);
    await act(async () => { render(<DashboardPage />); });
    await waitFor(() =>
      expect(screen.getByText("目前沒有待處理的任務")).toBeInTheDocument()
    );
  });
});
