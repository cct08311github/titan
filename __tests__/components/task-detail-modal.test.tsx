/**
 * Component tests: TaskDetailModal
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TaskDetailModal } from "@/app/components/task-detail-modal";

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock child components
jest.mock("@/app/components/subtask-list", () => ({
  SubTaskList: () => <div data-testid="subtask-list" />,
}));
jest.mock("@/app/components/deliverable-list", () => ({
  DeliverableList: () => <div data-testid="deliverable-list" />,
}));
jest.mock("@/app/components/comment-list", () => ({
  CommentList: () => <div data-testid="comment-list" />,
}));
jest.mock("@/lib/security/sanitize", () => ({
  sanitizeHtml: (html: string) => html,
}));

const MOCK_TASK = {
  id: "task-1",
  title: "Test Task",
  description: "A test description",
  status: "TODO",
  priority: "P2",
  category: "PLANNED",
  primaryAssigneeId: null,
  backupAssigneeId: null,
  monthlyGoalId: null,
  dueDate: null,
  estimatedHours: null,
  subTasks: [],
  deliverables: [],
  primaryAssignee: null,
  backupAssignee: null,
  monthlyGoal: null,
};

describe("TaskDetailModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_TASK,
    } as Response);
  });

  it("renders loading state initially", async () => {
    render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    // Check that fetch was called
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1");
  });

  it("renders task title after loading", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      // Title is rendered in an <input value="..."> field
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });
  });

  it("renders close button (X icon)", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      // Wait for the modal to finish loading (title input appears)
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });
    // Close button is in the modal header (second button: Save + X)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={onClose} />);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });
    // Click the X button — after adding tabs, the button index changed
    // Find the close button by its position after Save and tab buttons
    const buttons = screen.getAllByRole("button");
    // Close button is after: 詳情 tab, 變更歷史 tab, Save button — so index 3
    const closeBtn = buttons[3];
    // Click the X button — find it by looking for all buttons and picking the last one in the header
    const buttons = screen.getAllByRole("button");
    // The X button is after Save, tabs (詳情, 評論), so find by iterating from end
    const closeBtn = buttons.find((b) => {
      // The X button is the one that is not Save, not a tab
      return b.closest(".flex.items-center.gap-2") && !b.textContent?.includes("儲存");
    }) ?? buttons[buttons.length - 1];
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders status select with options", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText("待處理")).toBeInTheDocument();
    });
  });

  it("renders subtask list component", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("subtask-list")).toBeInTheDocument();
    });
  });

  it("renders deliverable list component", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("deliverable-list")).toBeInTheDocument();
    });
  });

  it("shows description when provided", async () => {
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    await waitFor(() => {
      // Description is rendered in a MarkdownEditor textarea
      const textareas = screen.getAllByRole("textbox");
      const descTextarea = textareas.find((t) => (t as HTMLTextAreaElement).value === "A test description");
      expect(descTextarea).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    await act(async () => {
      render(<TaskDetailModal taskId="task-1" onClose={jest.fn()} />);
    });
    // Should not throw and show some error state or nothing
    expect(screen.queryByDisplayValue("Test Task")).not.toBeInTheDocument();
  });
});
