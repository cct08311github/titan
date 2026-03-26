/**
 * Component tests: Overtime badge in TimeEntryCell
 * Issue #723: [TS-19] 加班標記顯示
 * Updated for Issue #814 (T-2): overtimeType dropdown
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TimeEntryCell, type TimeEntry } from "@/app/components/time-entry-cell";

describe("Overtime Badge", () => {
  const baseProps = {
    taskId: "task-1",
    date: "2026-03-20",
    onSave: jest.fn(),
    onDelete: jest.fn(),
  };

  it("shows overtime badge when entry has overtimeType=WEEKDAY", () => {
    const entry: TimeEntry = {
      id: "e1",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 2,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "WEEKDAY",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.getByText("OT")).toBeInTheDocument();
  });

  it("shows REST_DAY badge", () => {
    const entry: TimeEntry = {
      id: "e1b",
      taskId: "task-1",
      date: "2026-03-21",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "REST_DAY",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.getByText("\u4F11")).toBeInTheDocument(); // 休
  });

  it("shows HOLIDAY badge", () => {
    const entry: TimeEntry = {
      id: "e1c",
      taskId: "task-1",
      date: "2026-03-22",
      hours: 6,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "HOLIDAY",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.getByText("\u5047")).toBeInTheDocument(); // 假
  });

  it("does not show overtime badge when overtimeType=NONE", () => {
    const entry: TimeEntry = {
      id: "e2",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 2,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "NONE",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    expect(screen.queryByText("OT")).not.toBeInTheDocument();
  });

  it("does not show overtime badge when overtimeType is undefined", () => {
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

  it("shows overtime type dropdown in the edit popover", async () => {
    const entry: TimeEntry = {
      id: "e4",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "NONE",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    fireEvent.click(screen.getByText("4h"));

    // Should have overtime type label
    expect(screen.getByText("加班類型")).toBeInTheDocument();
    // Should have options
    expect(screen.getByText("非加班")).toBeInTheDocument();
    expect(screen.getByText("平日加班")).toBeInTheDocument();
    expect(screen.getByText("休息日加班")).toBeInTheDocument();
    expect(screen.getByText("國定假日加班")).toBeInTheDocument();
  });

  it("dropdown shows correct value for WEEKDAY entry", () => {
    const entry: TimeEntry = {
      id: "e5",
      taskId: "task-1",
      date: "2026-03-20",
      hours: 4,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "WEEKDAY",
    };

    render(<TimeEntryCell {...baseProps} entry={entry} />);
    fireEvent.click(screen.getByText("OT"));

    // The select should have WEEKDAY selected
    const select = screen.getByDisplayValue("平日加班");
    expect(select).toBeInTheDocument();
  });
});
