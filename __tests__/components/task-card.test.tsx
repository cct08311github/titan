/**
 * Component tests: TaskCard
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TaskCard, TaskCardData } from "@/app/components/task-card";

// Mock next/navigation (used transitively)
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

const baseTask: TaskCardData = {
  id: "task-1",
  title: "Test Task Title",
  priority: "P2",
  category: "PLANNED",
  status: "TODO",
};

describe("TaskCard", () => {
  it("renders task title", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("Test Task Title")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("P2")).toBeInTheDocument();
  });

  it("renders category label", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("規劃")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = jest.fn();
    render(<TaskCard task={baseTask} onClick={handleClick} />);
    fireEvent.click(screen.getByText("Test Task Title"));
    expect(handleClick).toHaveBeenCalledWith(baseTask);
  });

  it("does not throw when onClick is not provided", () => {
    render(<TaskCard task={baseTask} />);
    expect(() => fireEvent.click(screen.getByText("Test Task Title"))).not.toThrow();
  });

  it("applies dragging styles when isDragging is true", () => {
    const { container } = render(<TaskCard task={baseTask} isDragging />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("opacity-50");
  });

  it("shows due date when provided", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const task = { ...baseTask, dueDate: futureDate.toISOString() };
    render(<TaskCard task={task} />);
    const month = futureDate.getMonth() + 1;
    const day = futureDate.getDate();
    expect(screen.getByText(`${month}/${day}`)).toBeInTheDocument();
  });

  it("shows subtask progress when subTasks provided", () => {
    const task = { ...baseTask, subTasks: [{ done: true }, { done: false }] };
    render(<TaskCard task={task} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("shows estimated hours when provided", () => {
    const task = { ...baseTask, estimatedHours: 8 };
    render(<TaskCard task={task} />);
    expect(screen.getByText("8h")).toBeInTheDocument();
  });

  it("renders P0 task with red left border class", () => {
    const task = { ...baseTask, priority: "P0" as const };
    const { container } = render(<TaskCard task={task} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-l-red-500");
  });

  it("shows primary assignee initial when no avatar", () => {
    const task = {
      ...baseTask,
      primaryAssignee: { id: "user-1", name: "Alice", avatar: null },
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows backup assignee when provided", () => {
    const task = {
      ...baseTask,
      primaryAssignee: { id: "user-1", name: "Alice", avatar: null },
      backupAssignee: { id: "user-2", name: "Bob", avatar: null },
    };
    render(<TaskCard task={task} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders INCIDENT category correctly", () => {
    const task = { ...baseTask, category: "INCIDENT" as const };
    render(<TaskCard task={task} />);
    expect(screen.getByText("突發")).toBeInTheDocument();
  });

  it("renders SUPPORT category correctly", () => {
    const task = { ...baseTask, category: "SUPPORT" as const };
    render(<TaskCard task={task} />);
    expect(screen.getByText("支援")).toBeInTheDocument();
  });
});
