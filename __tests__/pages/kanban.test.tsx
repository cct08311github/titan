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

  it("handles empty task list", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: KanbanPage } = await import("@/app/(app)/kanban/page");
    await act(async () => {
      render(<KanbanPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("待辦清單")).toBeInTheDocument();
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
});
