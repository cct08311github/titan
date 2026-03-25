/**
 * Component tests: TimesheetGrid
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimesheetGrid, TaskRow } from "@/app/components/timesheet-grid";

// Mock TimeEntryCell
jest.mock("@/app/components/time-entry-cell", () => ({
  TimeEntryCell: ({ hours }: { hours?: number }) => (
    <div data-testid="time-entry-cell">{hours ?? "-"}</div>
  ),
}));

const WEEK_START = new Date("2024-01-15"); // Monday

const TASK_ROWS: TaskRow[] = [
  { taskId: "task-1", label: "Feature Development" },
  { taskId: null, label: "Meeting" },
];

const ENTRIES = [
  { id: "e1", taskId: "task-1", date: "2024-01-15T00:00:00Z", hours: 4, category: "PLANNED_TASK", description: null },
  { id: "e2", taskId: null, date: "2024-01-16T00:00:00Z", hours: 2, category: "ADMIN", description: "Meeting" },
];

describe("TimesheetGrid", () => {
  const defaultProps = {
    weekStart: WEEK_START,
    taskRows: TASK_ROWS,
    entries: ENTRIES,
    onCellSave: jest.fn(),
    onCellDelete: jest.fn(),
  };

  it("renders day headers (Mon-Fri)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("週一")).toBeInTheDocument();
    expect(screen.getByText("週二")).toBeInTheDocument();
    expect(screen.getByText("週三")).toBeInTheDocument();
    expect(screen.getByText("週四")).toBeInTheDocument();
    expect(screen.getByText("週五")).toBeInTheDocument();
  });

  it("renders task row labels", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("Feature Development")).toBeInTheDocument();
    expect(screen.getByText("Meeting")).toBeInTheDocument();
  });

  it("renders date labels for the week", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("1/15")).toBeInTheDocument();
  });

  it("renders time entry cells for each row-day combination", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const cells = screen.getAllByTestId("time-entry-cell");
    // 2 rows x 5 days = 10 cells
    expect(cells.length).toBe(10);
  });

  it("renders daily totals row", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Row total for task-1 row should be 4.0 (may appear in row total and daily total column)
    expect(screen.getAllByText("4.0").length).toBeGreaterThan(0);
  });

  it("renders empty grid with no entries", () => {
    render(<TimesheetGrid {...defaultProps} entries={[]} />);
    expect(screen.getAllByTestId("time-entry-cell").length).toBe(10);
  });

  it("renders correctly with no task rows", () => {
    render(<TimesheetGrid {...defaultProps} taskRows={[]} />);
    expect(screen.queryByTestId("time-entry-cell")).not.toBeInTheDocument();
  });

  describe("daily limit warnings", () => {
    it("shows orange warning when daily total > 10h", () => {
      const highEntries = [
        { id: "e1", taskId: "task-1", date: "2024-01-15T00:00:00Z", hours: 8, category: "PLANNED_TASK", description: null },
        { id: "e2", taskId: null, date: "2024-01-15T00:00:00Z", hours: 3, category: "ADMIN", description: null },
      ];
      const { container } = render(
        <TimesheetGrid {...defaultProps} entries={highEntries} />
      );
      // 11h total on Monday - should have orange text and lightning emoji
      const footerSpans = container.querySelectorAll("tfoot span");
      const mondaySpan = Array.from(footerSpans).find((s) =>
        s.textContent?.includes("11.0")
      );
      expect(mondaySpan).toBeTruthy();
      expect(mondaySpan?.className).toContain("text-orange-500");
    });

    it("shows red warning when daily total > 12h", () => {
      const veryHighEntries = [
        { id: "e1", taskId: "task-1", date: "2024-01-15T00:00:00Z", hours: 8, category: "PLANNED_TASK", description: null },
        { id: "e2", taskId: null, date: "2024-01-15T00:00:00Z", hours: 5, category: "ADMIN", description: null },
      ];
      const { container } = render(
        <TimesheetGrid {...defaultProps} entries={veryHighEntries} />
      );
      // 13h total on Monday - should have red text and warning emoji
      const footerSpans = container.querySelectorAll("tfoot span");
      const mondaySpan = Array.from(footerSpans).find((s) =>
        s.textContent?.includes("13.0")
      );
      expect(mondaySpan).toBeTruthy();
      expect(mondaySpan?.className).toContain("text-red-500");
    });

    it("shows green for normal daily total <= 8h", () => {
      const { container } = render(<TimesheetGrid {...defaultProps} />);
      // Monday has 4h - should be green
      const footerSpans = container.querySelectorAll("tfoot span");
      const mondaySpan = Array.from(footerSpans).find((s) =>
        s.textContent?.includes("4.0")
      );
      expect(mondaySpan).toBeTruthy();
      expect(mondaySpan?.className).toContain("text-emerald-500");
    });
  });
});
