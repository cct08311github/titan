/**
 * Component tests: TaskFilters
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TaskFilters } from "@/app/components/task-filters";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const emptyFilters = { assignee: "", priority: "", category: "" };

describe("TaskFilters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
    } as Response);
  });

  it("renders filter icon and label", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("篩選")).toBeInTheDocument();
  });

  it("renders priority select with options", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("所有優先度")).toBeInTheDocument();
    expect(screen.getByText("P0 緊急")).toBeInTheDocument();
    expect(screen.getByText("P1 高")).toBeInTheDocument();
  });

  it("renders category select with options", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("所有分類")).toBeInTheDocument();
    expect(screen.getByText("原始規劃")).toBeInTheDocument();
    expect(screen.getByText("突發事件")).toBeInTheDocument();
  });

  it("loads and renders users in assignee select", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("calls onChange when priority is changed", async () => {
    const handleChange = jest.fn();
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={handleChange} />);
    });
    const selects = screen.getAllByRole("combobox");
    // Priority is the second select (after assignee)
    fireEvent.change(selects[1], { target: { value: "P1" } });
    expect(handleChange).toHaveBeenCalledWith({ assignee: "", priority: "P1", category: "" });
  });

  it("calls onChange when category is changed", async () => {
    const handleChange = jest.fn();
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={handleChange} />);
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[2], { target: { value: "INCIDENT" } });
    expect(handleChange).toHaveBeenCalledWith({ assignee: "", priority: "", category: "INCIDENT" });
  });

  it("does not show clear button when no active filters", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.queryByText("清除篩選")).not.toBeInTheDocument();
  });

  it("shows clear button when filter is active", async () => {
    await act(async () => {
      render(<TaskFilters filters={{ assignee: "u1", priority: "", category: "" }} onChange={jest.fn()} />);
    });
    expect(screen.getByText("清除篩選")).toBeInTheDocument();
  });

  it("calls onChange with cleared filters when clear is clicked", async () => {
    const handleChange = jest.fn();
    await act(async () => {
      render(<TaskFilters filters={{ assignee: "u1", priority: "P0", category: "" }} onChange={handleChange} />);
    });
    fireEvent.click(screen.getByText("清除篩選"));
    expect(handleChange).toHaveBeenCalledWith({ assignee: "", priority: "", category: "" });
  });
});
