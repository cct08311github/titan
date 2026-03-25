/**
 * Component tests: TimeEntryCell keyboard navigation (TS-21)
 *
 * TDD Red phase — tests written before implementation.
 *
 * Requirements:
 *   - Tab moves focus to next cell
 *   - Enter opens cell for editing
 *   - Shift+Tab moves backward
 *   - Escape closes editor
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimeEntryCell } from "@/app/components/time-entry-cell";

const defaultProps = {
  taskId: "task-1",
  date: "2024-01-15",
  onSave: jest.fn().mockResolvedValue(undefined),
  onDelete: jest.fn().mockResolvedValue(undefined),
};

describe("TimeEntryCell keyboard navigation (TS-21)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens editor when Enter is pressed on the cell button", () => {
    render(<TimeEntryCell {...defaultProps} />);
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.keyDown(button, { key: "Enter" });
    // Editor popover should appear with the hours input
    expect(screen.getByPlaceholderText("0")).toBeInTheDocument();
  });

  it("closes editor when Escape is pressed", () => {
    render(<TimeEntryCell {...defaultProps} />);
    // Open the editor
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.click(button);
    expect(screen.getByPlaceholderText("0")).toBeInTheDocument();

    // Press Escape on the hours input
    fireEvent.keyDown(screen.getByPlaceholderText("0"), { key: "Escape" });
    // Editor should be closed — no hours input visible
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
  });

  it("cell button is focusable via tab (has tabIndex)", () => {
    render(<TimeEntryCell {...defaultProps} />);
    const button = screen.getByRole("button", { name: "+" });
    // Button should be focusable (native buttons are, but verify no tabIndex=-1)
    expect(button).not.toHaveAttribute("tabindex", "-1");
  });

  it("emits onNavigate('next') on Tab keydown inside editor", () => {
    const onNavigate = jest.fn();
    render(<TimeEntryCell {...defaultProps} onNavigate={onNavigate} />);
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.click(button);

    // Press Tab on the hours input
    fireEvent.keyDown(screen.getByPlaceholderText("0"), { key: "Tab" });
    expect(onNavigate).toHaveBeenCalledWith("next");
  });

  it("emits onNavigate('prev') on Shift+Tab keydown inside editor", () => {
    const onNavigate = jest.fn();
    render(<TimeEntryCell {...defaultProps} onNavigate={onNavigate} />);
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.click(button);

    // Press Shift+Tab on the hours input
    fireEvent.keyDown(screen.getByPlaceholderText("0"), { key: "Tab", shiftKey: true });
    expect(onNavigate).toHaveBeenCalledWith("prev");
  });

  it("closes editor and emits onNavigate on Tab/Shift+Tab", () => {
    const onNavigate = jest.fn();
    render(<TimeEntryCell {...defaultProps} onNavigate={onNavigate} />);
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.click(button);

    fireEvent.keyDown(screen.getByPlaceholderText("0"), { key: "Tab" });
    // After Tab, editor should close
    expect(screen.queryByPlaceholderText("0")).not.toBeInTheDocument();
  });

  it("displays existing entry hours and opens editor on Enter", () => {
    const entry = {
      id: "e1",
      taskId: "task-1",
      date: "2024-01-15",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
    };
    render(<TimeEntryCell {...defaultProps} entry={entry} />);
    const button = screen.getByText("4h");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });
});
