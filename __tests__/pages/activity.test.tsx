/**
 * Page tests: Activity Feed — Issue #506
 *
 * Covers:
 *  - Renders heading and description
 *  - Loading state
 *  - Empty state
 *  - Error state with retry
 *  - Renders activity items with badges
 *  - Pagination controls
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

const mockFetch = jest.fn();
global.fetch = mockFetch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ActivityPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/activity/page");
  ActivityPage = mod.default;
});

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
    createdAt: "2026-03-25T09:00:00.000Z",
  },
];

const PAGINATION = { page: 1, limit: 30, total: 2, totalPages: 1 };

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
      expect(screen.getByText("查看團隊成員的最新操作紀錄")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    await act(async () => { render(<ActivityPage />); });
    expect(screen.getByText("載入動態...")).toBeInTheDocument();
  });

  it("shows empty state when no items", async () => {
    setupFetchSuccess([], { page: 1, limit: 30, total: 0, totalPages: 0 });
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("尚無活動紀錄")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("shows error state on network rejection", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("renders activity items with source badges", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("建立")).toBeInTheDocument();
      expect(screen.getByText("實作登入功能")).toBeInTheDocument();
      expect(screen.getByText("任務")).toBeInTheDocument();
    });
  });

  it("shows 系統 badge and userName fallback for audit_log entries", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      // Both the badge label "系統" and the userName fallback "系統" exist
      const systemElements = screen.getAllByText("系統");
      expect(systemElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders pagination when multiple pages", async () => {
    setupFetchSuccess(ACTIVITY_ITEMS, { page: 1, limit: 30, total: 60, totalPages: 2 });
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("共 60 筆，第 1/2 頁")).toBeInTheDocument();
      expect(screen.getByLabelText("下一頁")).toBeInTheDocument();
    });
  });

  it("does not render pagination when single page", async () => {
    setupFetchSuccess();
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("下一頁")).not.toBeInTheDocument();
  });

  it("handles retry on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);
    await act(async () => { render(<ActivityPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
    // Setup success for retry
    setupFetchSuccess();
    const retryBtn = screen.getByText("重試");
    await act(async () => { fireEvent.click(retryBtn); });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });
});
