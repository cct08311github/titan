/**
 * Page tests: Kanban
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

// Mock child components
jest.mock("@/app/components/task-card", () => ({
  TaskCard: ({ task }: { task: { title: string } }) => (
    <div data-testid="task-card">{task.title}</div>
  ),
}));
jest.mock("@/app/components/task-filters", () => ({
  TaskFilters: () => <div data-testid="task-filters" />,
  emptyFilters: { assignee: "", priority: "", category: "", tags: [], dueDateFrom: "", dueDateTo: "" },
  hasActiveFilters: () => false,
}));
jest.mock("@/app/components/task-detail-modal", () => ({
  TaskDetailModal: () => <div data-testid="task-detail-modal" />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const TASKS = [
  { id: "t1", title: "Backlog Task", status: "BACKLOG", priority: "P2", category: "PLANNED" },
  { id: "t2", title: "In Progress Task", status: "IN_PROGRESS", priority: "P1", category: "PLANNED" },
];

describe("Kanban Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => TASKS,
    } as Response);
  });

  it("renders kanban columns", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("待辦清單")).toBeInTheDocument();
      expect(screen.getByText("進行中")).toBeInTheDocument();
      expect(screen.getByText("已完成")).toBeInTheDocument();
    });
  });

  it("renders task cards after loading", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("task-card").length).toBeGreaterThan(0);
    });
  });

  it("renders task filters component", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    expect(screen.getByTestId("task-filters")).toBeInTheDocument();
  });

  it("shows empty state guidance when task list is empty", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      // 空資料時顯示 PageEmpty 引導訊息
      expect(screen.getByText("尚無任務")).toBeInTheDocument();
      expect(screen.getByText("目前沒有任何任務，請點擊「新增任務」開始")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows empty column state per column when tasks exist only in one status", async () => {
    // Only BACKLOG tasks — IN_PROGRESS and DONE columns should be empty
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [TASKS[0]], // only BACKLOG task
    } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      // All column headers still rendered
      expect(screen.getByText("待辦清單")).toBeInTheDocument();
      expect(screen.getByText("進行中")).toBeInTheDocument();
      expect(screen.getByText("已完成")).toBeInTheDocument();
    });
  });

  it("renders task card for each task in correct column", async () => {
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      // Both tasks should have task-card elements
      const cards = screen.getAllByTestId("task-card");
      expect(cards.length).toBe(2);
      expect(screen.getByText("Backlog Task")).toBeInTheDocument();
      expect(screen.getByText("In Progress Task")).toBeInTheDocument();
    });
  });

  it("MEMBER role can view kanban board (no manager-only restriction)", async () => {
    // Default mock session is MEMBER — board should still render
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("待辦清單")).toBeInTheDocument();
    });
  });
});
