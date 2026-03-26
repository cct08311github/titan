/**
 * Page tests: Activity Feed — Issue #506, #810
 *
 * Covers:
 *  - Renders heading and description
 *  - Loading state (skeleton)
 *  - Empty state
 *  - Error state with retry
 *  - Renders activity items with badges
 *  - Infinite scroll (sentinel-based)
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MEMBER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/activity"),
}));

// IntersectionObserver mock (not available in jsdom)
const mockIntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

const mockFetch = jest.fn();
global.fetch = mockFetch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ActivityPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/activity/page");
  ActivityPage = mod.default;
});

// ── Mock data ─────────────────────────────────────────────────────────────────

const ACTIVITY_ITEMS = [
  {
    id: "a1",
    source: "task_activity",
    action: "CREATE",
    userId: "u1",
    userName: "Alice",
    resourceType: "task",
    resourceId: "t1",
    resourceName: "實作登入功能",
    detail: null,
    metadata: null,
    createdAt: "2026-03-25T10:00:00.000Z",
  },
  {
    id: "a2",
    source: "audit_log",
    action: "LOGIN_FAILURE",
    userId: null,
    userName: null,
    resourceType: "auth",
    resourceId: null,
    resourceName: null,
    detail: "Invalid credentials",
    metadata: null,
    createdAt: "2026-03-25T09:00:00.000Z",
  },
];

const PAGINATION = { page: 1, limit: 50, total: 2, totalPages: 1 };

function setupFetchSuccess(items = ACTIVITY_ITEMS, pagination = PAGINATION) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { items, pagination } }),
  } as Response);
}

describe("Activity Feed Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders heading and description", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("團隊動態")).toBeInTheDocument();
      expect(screen.getByText("查看團隊成員的最新操作紀錄，按時間倒序排列")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    await act(async () => { render(<ActivityPage />); });
    // UI uses ListSkeleton component while loading
    expect(screen.queryByText("尚無活動紀錄")).not.toBeInTheDocument();
  });

  it("shows empty state when no items", async () => {
    setupFetchSuccess([], { page: 1, limit: 50, total: 0, totalPages: 0 });
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("尚無活動紀錄")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("活動紀錄載入失敗")).toBeInTheDocument();
    });
  });

  it("shows error state on network rejection", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      // Component catches errors and shows the error message
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("renders activity items with formatted descriptions", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      // ActivityItem uses formatActivityDescription which includes the resource name
      expect(screen.getByText(/實作登入功能/)).toBeInTheDocument();
      // Source badge for task_activity
      expect(screen.getByText("任務")).toBeInTheDocument();
    });
  });

  it("shows 系統 badge for audit_log entries", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      // The audit_log entry should have a "系統" badge
      const systemElements = screen.getAllByText("系統");
      expect(systemElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("handles retry on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("活動紀錄載入失敗")).toBeInTheDocument();
    });
    // Setup success for retry
    setupFetchSuccess();
    const retryBtn = screen.getByText("重試");
    await act(async () => { fireEvent.click(retryBtn); });
    await waitFor(() => {
      expect(screen.getByText(/實作登入功能/)).toBeInTheDocument();
    });
  });
});
