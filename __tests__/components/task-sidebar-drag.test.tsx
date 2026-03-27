/**
 * @jest-environment jsdom
 */
/**
 * TaskSidebarDrag component tests — Issue #1003
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  GripVertical: () => <span data-testid="icon-grip" />,
  Search: () => <span data-testid="icon-search" />,
}));

// Mock utils
jest.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { TaskSidebarDrag } from "@/app/components/timesheet/task-sidebar-drag";

const mockTasks = [
  { id: "t1", title: "Task Alpha" },
  { id: "t2", title: "Task Beta" },
  { id: "t3", title: "Task Gamma" },
];

describe("TaskSidebarDrag", () => {
  const mockOnDrop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders task list", () => {
    render(<TaskSidebarDrag tasks={mockTasks} onDropOnTimeSlot={mockOnDrop} />);
    expect(screen.getByTestId("task-sidebar-drag")).toBeInTheDocument();
    expect(screen.getByTestId("task-sidebar-list")).toBeInTheDocument();
    expect(screen.getByTestId("draggable-task-t1")).toBeInTheDocument();
    expect(screen.getByTestId("draggable-task-t2")).toBeInTheDocument();
    expect(screen.getByTestId("draggable-task-t3")).toBeInTheDocument();
  });

  it("filters tasks by search term", () => {
    render(<TaskSidebarDrag tasks={mockTasks} onDropOnTimeSlot={mockOnDrop} />);
    const search = screen.getByTestId("task-sidebar-search");

    fireEvent.change(search, { target: { value: "Alpha" } });

    expect(screen.getByTestId("draggable-task-t1")).toBeInTheDocument();
    expect(screen.queryByTestId("draggable-task-t2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("draggable-task-t3")).not.toBeInTheDocument();
  });

  it("shows empty message when no tasks match", () => {
    render(<TaskSidebarDrag tasks={mockTasks} onDropOnTimeSlot={mockOnDrop} />);
    const search = screen.getByTestId("task-sidebar-search");

    fireEvent.change(search, { target: { value: "nonexistent" } });

    expect(screen.getByText("無符合的任務")).toBeInTheDocument();
  });

  it("makes task items draggable", () => {
    render(<TaskSidebarDrag tasks={mockTasks} onDropOnTimeSlot={mockOnDrop} />);
    const item = screen.getByTestId("draggable-task-t1");
    expect(item).toHaveAttribute("draggable", "true");
  });

  it("sets drag data on dragStart", () => {
    render(<TaskSidebarDrag tasks={mockTasks} onDropOnTimeSlot={mockOnDrop} />);
    const item = screen.getByTestId("draggable-task-t1");

    const setData = jest.fn();
    fireEvent.dragStart(item, {
      dataTransfer: { setData, effectAllowed: "copy" },
    });

    expect(setData).toHaveBeenCalledWith(
      "application/json",
      JSON.stringify({
        taskId: "t1",
        taskTitle: "Task Alpha",
        category: "PLANNED_TASK",
        estimatedHours: null,
      })
    );
  });

  it("shows empty state when no tasks", () => {
    render(<TaskSidebarDrag tasks={[]} onDropOnTimeSlot={mockOnDrop} />);
    expect(screen.getByText("尚無任務")).toBeInTheDocument();
  });
});
