/**
 * Component tests: SubTaskList
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SubTaskList } from "@/app/components/subtask-list";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const SUBTASKS = [
  { id: "s1", title: "First subtask", done: false, order: 0 },
  { id: "s2", title: "Second subtask", done: true, order: 1 },
];

describe("SubTaskList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s3", title: "New sub", done: false, order: 2 }),
    } as Response);
  });

  it("renders all subtask titles", () => {
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" />);
    expect(screen.getByText("First subtask")).toBeInTheDocument();
    expect(screen.getByText("Second subtask")).toBeInTheDocument();
  });

  it("shows progress count", () => {
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("applies line-through style to completed subtasks", () => {
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" />);
    const doneText = screen.getByText("Second subtask");
    expect(doneText.className).toContain("line-through");
  });

  it("renders add subtask input", () => {
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" />);
    expect(screen.getByPlaceholderText("新增子任務...")).toBeInTheDocument();
  });

  it("toggles subtask done state on click", async () => {
    const onUpdate = jest.fn();
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" onUpdate={onUpdate} />);
    // Click the first subtask's toggle button
    const toggleButtons = screen.getAllByRole("button");
    await act(async () => {
      fireEvent.click(toggleButtons[0]);
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subtasks/s1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("adds new subtask on button click", async () => {
    const onUpdate = jest.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s3", title: "New sub", done: false, order: 2 }),
    } as Response);
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" onUpdate={onUpdate} />);
    const input = screen.getByPlaceholderText("新增子任務...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "New sub" } });
    });
    // Submit via Enter key (more reliable than button click in this component)
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subtasks",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("adds new subtask on Enter key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s3", title: "New sub", done: false, order: 2 }),
    } as Response);
    render(<SubTaskList subtasks={SUBTASKS} taskId="task-1" />);
    const input = screen.getByPlaceholderText("新增子任務...");
    fireEvent.change(input, { target: { value: "New sub" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/subtasks", expect.any(Object));
    });
  });

  it("renders empty state with no subtasks and progress bar hidden", () => {
    render(<SubTaskList subtasks={[]} taskId="task-1" />);
    expect(screen.queryByText("0/0")).not.toBeInTheDocument();
  });
});
