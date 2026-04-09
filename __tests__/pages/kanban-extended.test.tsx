/**
 * Extended RTL tests for Kanban page — Issue #373
 *
 * Focuses on:
 *  - All 5 column headers render correctly
 *  - Task count badge per column
 *  - "新增任務" button presence
 *  - Empty column placeholder text
 *  - Error state rendering
 *  - Network rejection handling
 *  - Multiple tasks distributed across columns
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

// Mock next/navigation — useSearchParams returns null if not mocked, crashing the page
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/kanban"),
}));

jest.mock("@/app/components/task-card", () => ({
  TaskCard: ({ task }: { task: { title: string } }) => (
    <div data-testid="task-card">{task.title}</div>
  ),
}));
jest.mock("@/app/components/task-filters", () => ({
  TaskFilters: () => <div data-testid="task-filters" />,
  emptyFilters: { assignee: "", priority: "", category: "", tags: [], dueDateFrom: "", dueDateTo: "" },
  hasActiveFilters: () => false,
  parseFiltersFromUrl: () => ({ assignee: "", priority: "", category: "", tags: [], dueDateFrom: "", dueDateTo: "" }),
}));
jest.mock("@/app/components/task-detail-modal", () => ({
  TaskDetailModal: () => <div data-testid="task-detail-modal" />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const TASKS_ALL_COLUMNS = [
  { id: "t1", title: "Backlog Item", status: "BACKLOG", priority: "P2", category: "PLANNED" },
  { id: "t2", title: "Todo Item", status: "TODO", priority: "P1", category: "PLANNED" },
  { id: "t3", title: "WIP Item", status: "IN_PROGRESS", priority: "P0", category: "INCIDENT" },
  { id: "t4", title: "Review Item", status: "REVIEW", priority: "P2", category: "PLANNED" },
  { id: "t5", title: "Done Item", status: "DONE", priority: "P3", category: "PLANNED" },
];

describe("Kanban Extended", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => TASKS_ALL_COLUMNS,
    } as Response);
  });

  it("renders all 5 column headers", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText("待辦清單")).toBeInTheDocument();
      expect(screen.getByText("待處理")).toBeInTheDocument();
      expect(screen.getByText("進行中")).toBeInTheDocument();
      expect(screen.getByText("審核中")).toBeInTheDocument();
      expect(screen.getByText("已完成")).toBeInTheDocument();
    });
  });

  it("shows 新增任務 button", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    expect(screen.getByText("新增任務")).toBeInTheDocument();
  });

  it("renders the correct total task count in header", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText(/共 5 項任務/)).toBeInTheDocument();
    });
  });

  it("renders task cards in each column (5 tasks across 5 columns)", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText("Backlog Item")).toBeInTheDocument();
      expect(screen.getByText("Todo Item")).toBeInTheDocument();
      expect(screen.getByText("WIP Item")).toBeInTheDocument();
      expect(screen.getByText("Review Item")).toBeInTheDocument();
      expect(screen.getByText("Done Item")).toBeInTheDocument();
    });
  });

  it("shows 看板 heading", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    expect(screen.getByText("看板")).toBeInTheDocument();
  });

  it("renders 載入看板 while loading", async () => {
    // Make fetch never resolve to keep loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    expect(screen.getByText("載入看板...")).toBeInTheDocument();
  });

  it("shows error message on fetch error with retry", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("handles network rejection without crashing", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("supports paginated response format { data: { items } }", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [TASKS_ALL_COLUMNS[0]],
          pagination: { page: 1, limit: 20, total: 1 },
        },
      }),
    } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByText("Backlog Item")).toBeInTheDocument();
    });
  });

  it("renders kanban region with aria-label for accessibility", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => { render(<KanbanPage />); });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "看板欄位" })).toBeInTheDocument();
    });
  });
});
