/**
 * Component tests: Overtime badge in TimeEntryCell
 * Issue #723: [TS-19] 加班標記顯示
 *
 * TDD: Tests written first.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// We test the overtime logic and badge rendering
import { TimeEntryCell, type TimeEntry } from "@/app/components/time-entry-cell";

describe("Overtime Badge", () => {
  const baseProps = {
    taskId: "task-1",
    date: "2026-03-20",
    onSave: jest.fn(),
    onDelete: jest.fn(),
  };

  it("shows overtime badge when entry has overtime=true", () => {
    const entry: TimeEntry = {
      id: "e1",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 2,
      category: "PLANNED_TASK",
      description: null,
      overtime: true,
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.getByText("OT")).toBeInTheDocument();
  });

  it("does not show overtime badge when overtime=false", () => {
    const entry: TimeEntry = {
      id: "e2",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 2,
      category: "PLANNED_TASK",
      description: null,
      overtime: false,
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.queryByText("OT")).not.toBeInTheDocument();
  });

  it("does not show overtime badge when overtime is undefined", () => {
    const entry: TimeEntry = {
      id: "e3",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 2,
      category: "PLANNED_TASK",
      description: null,
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.queryByText("OT")).not.toBeInTheDocument();
  });

  it("shows overtime toggle in the edit popover", async () => {
    const entry: TimeEntry = {
      id: "e4",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
      overtime: false,
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);

    // Open popover by clicking the cell
    const cellButton = screen.getByText("4h");
    fireEvent.click(cellButton);

    // Should have overtime toggle
    expect(screen.getByLabelText("加班")).toBeInTheDocument();
  });

  it("overtime toggle is checked when entry.overtime=true", () => {
    const entry: TimeEntry = {
      id: "e5",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
      overtime: true,
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    fireEvent.click(screen.getByText("4h"));

    const checkbox = screen.getByLabelText("加班") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
