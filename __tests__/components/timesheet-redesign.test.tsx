/**
 * Component tests: Timesheet Redesign (Clockify-style grid)
 * Tests the new TimesheetGrid, TimesheetCell, TimesheetToolbar, TimesheetTimer
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock lucide-react icons ──────────────────────────────────────────────────
jest.mock("lucide-react", () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-right" {...props} />,
  Grid3X3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grid" {...props} />,
  List: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-list" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  FileDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-down" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  Play: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-play" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  Lock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-lock" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

import { TimesheetGrid } from "@/app/components/timesheet/timesheet-grid";
import { TimesheetToolbar } from "@/app/components/timesheet/timesheet-toolbar";
import { TimesheetTimer } from "@/app/components/timesheet/timesheet-timer";
import { TimesheetCell } from "@/app/components/timesheet/timesheet-cell";
import type { TimeEntry, TaskRow, TaskOption } from "@/app/components/timesheet/use-timesheet";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const WEEK_START = new Date("2026-03-23"); // Monday

const TASK_ROWS: TaskRow[] = [
  { taskId: "task-1", label: "API 開發" },
  { taskId: "task-2", label: "前端重構" },
  { taskId: null, label: "自由工時（無任務）" },
];

const TASKS: TaskOption[] = [
  { id: "task-1", title: "API 開發" },
  { id: "task-2", title: "前端重構" },
  { id: "task-3", title: "文件撰寫" },
];

const ENTRIES: TimeEntry[] = [
  {
    id: "e1",
    taskId: "task-1",
    date: "2026-03-23T00:00:00Z",
    hours: 8,
    category: "PLANNED_TASK",
    description: "完成 REST API",
    overtimeType: "NONE",
  },
  {
    id: "e2",
    taskId: "task-1",
    date: "2026-03-24T00:00:00Z",
    hours: 7.5,
    category: "PLANNED_TASK",
    description: null,
    overtimeType: "NONE",
  },
  {
    id: "e3",
    taskId: "task-2",
    date: "2026-03-24T00:00:00Z",
    hours: 0.5,
    category: "ADDED_TASK",
    description: "Bug fix",
    overtimeType: "WEEKDAY",
  },
  {
    id: "e4",
    taskId: null,
    date: "2026-03-28T00:00:00Z",
    hours: 4,
    category: "ADMIN",
    description: "週六加班",
    overtimeType: "HOLIDAY",
  },
];

function getDateStr(offset: number): string {
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(offset: number): string {
  const d = new Date(WEEK_START);
  d.setDate(d.getDate() + offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getEntriesForCell(taskId: string | null, dateStr: string): TimeEntry[] {
  return ENTRIES.filter(
    (e) => (e.taskId ?? null) === (taskId ?? null) && e.date.split("T")[0] === dateStr
  );
}

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DAYS_COUNT = 7;
const DAILY_TOTALS = Array.from({ length: 7 }, (_, i) => {
  const ds = getDateStr(i);
  return ENTRIES.filter((e) => e.date.split("T")[0] === ds).reduce((s, e) => s + e.hours, 0);
});
const WEEKLY_TOTAL = ENTRIES.reduce((s, e) => s + e.hours, 0);

// ═════════════════════════════════════════════════════════════════════════════
// TimesheetGrid tests
// ═════════════════════════════════════════════════════════════════════════════

describe("TimesheetGrid", () => {
  const defaultProps = {
    weekStart: WEEK_START,
    taskRows: TASK_ROWS,
    entries: ENTRIES,
    tasks: TASKS,
    dailyTotals: DAILY_TOTALS,
    weeklyTotal: WEEKLY_TOTAL,
    dayLabels: DAY_LABELS,
    daysCount: DAYS_COUNT,
    getDateStr,
    formatDateLabel,
    getEntriesForCell,
    onQuickSave: jest.fn(),
    onFullSave: jest.fn(),
    onDelete: jest.fn(),
    onAddTaskRow: jest.fn(),
  };

  it("renders 7 day headers (Mon-Sun)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("週一")).toBeInTheDocument();
    expect(screen.getByText("週二")).toBeInTheDocument();
    expect(screen.getByText("週三")).toBeInTheDocument();
    expect(screen.getByText("週四")).toBeInTheDocument();
    expect(screen.getByText("週五")).toBeInTheDocument();
    expect(screen.getByText("週六")).toBeInTheDocument();
    expect(screen.getByText("週日")).toBeInTheDocument();
  });

  it("renders task row labels", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText(/API 開發/)).toBeInTheDocument();
    expect(screen.getByText(/前端重構/)).toBeInTheDocument();
    expect(screen.getByText(/自由工時/)).toBeInTheDocument();
  });

  it("renders date labels for the week", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("3/23")).toBeInTheDocument();
    expect(screen.getByText("3/29")).toBeInTheDocument();
  });

  it("renders cells for each row-day combination (3 rows x 7 days = 21)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const cells = screen.getAllByTestId("timesheet-cell");
    expect(cells.length).toBe(21);
  });

  it("shows daily total footer with '每日合計' label", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("每日合計")).toBeInTheDocument();
  });

  it("renders weekly total", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Total = 8 + 7.5 + 0.5 + 4 = 20.0
    expect(screen.getByText("20.0")).toBeInTheDocument();
  });

  it("renders '+ 新增任務列' button", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByTestId("add-task-row-btn")).toBeInTheDocument();
    expect(screen.getByText("新增任務列")).toBeInTheDocument();
  });

  it("shows task search input when add-task-row is clicked", () => {
    render(<TimesheetGrid {...defaultProps} />);
    fireEvent.click(screen.getByTestId("add-task-row-btn"));
    expect(screen.getByTestId("task-search-input")).toBeInTheDocument();
  });

  it("shows empty state when no task rows", () => {
    render(<TimesheetGrid {...defaultProps} taskRows={[]} />);
    expect(screen.getByText("本週尚無工時記錄")).toBeInTheDocument();
  });

  it("renders daily totals correctly", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Monday: 8.0
    const eightZero = screen.getAllByText("8.0");
    expect(eightZero.length).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TimesheetCell tests
// ═════════════════════════════════════════════════════════════════════════════

describe("TimesheetCell", () => {
  const defaultProps = {
    entries: [] as TimeEntry[],
    taskId: "task-1" as string | null,
    date: "2026-03-23",
    onQuickSave: jest.fn(),
    onFullSave: jest.fn(),
    onDelete: jest.fn(),
  };

  it("renders empty cell with dash", () => {
    render(<TimesheetCell {...defaultProps} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders cell with hours when entry exists", () => {
    const entry: TimeEntry = {
      id: "e1",
      taskId: "task-1",
      date: "2026-03-23",
      hours: 8,
      category: "PLANNED_TASK",
      description: null,
      overtimeType: "NONE",
    };
    render(<TimesheetCell {...defaultProps} entries={[entry]} />);
    expect(screen.getByText("8.0")).toBeInTheDocument();
  });

  it("enters editing mode on click", () => {
    render(<TimesheetCell {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cell-button"));
    expect(screen.getByTestId("cell-input")).toBeInTheDocument();
  });

  it("calls onQuickSave on Enter with valid input", async () => {
    const onQuickSave = jest.fn().mockResolvedValue(undefined);
    render(<TimesheetCell {...defaultProps} onQuickSave={onQuickSave} />);

    fireEvent.click(screen.getByTestId("cell-button"));
    const input = screen.getByTestId("cell-input");
    fireEvent.change(input, { target: { value: "7.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onQuickSave).toHaveBeenCalledWith("task-1", "2026-03-23", 7.5, undefined);
    });
  });

  it("exits editing on Escape", () => {
    render(<TimesheetCell {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cell-button"));
    const input = screen.getByTestId("cell-input");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("cell-input")).not.toBeInTheDocument();
  });

  it("shows overtime indicator for WEEKDAY overtime", () => {
    const entry: TimeEntry = {
      id: "e1",
      taskId: "task-1",
      date: "2026-03-23",
      hours: 2,
      category: "ADDED_TASK",
      description: null,
      overtimeType: "WEEKDAY",
    };
    render(<TimesheetCell {...defaultProps} entries={[entry]} />);
    // Should have an overtime dot with amber color (title = 平日加班)
    const dot = screen.getByTitle("平日加班");
    expect(dot).toBeInTheDocument();
  });

  it("shows overtime indicator for HOLIDAY overtime", () => {
    const entry: TimeEntry = {
      id: "e1",
      taskId: null,
      date: "2026-03-28",
      hours: 4,
      category: "ADMIN",
      description: null,
      overtimeType: "HOLIDAY",
    };
    render(<TimesheetCell {...defaultProps} taskId={null} entries={[entry]} />);
    const dot = screen.getByTitle("假日加班");
    expect(dot).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TimesheetToolbar tests
// ═════════════════════════════════════════════════════════════════════════════

describe("TimesheetToolbar", () => {
  const defaultProps = {
    weekRange: "2026/03/23 — 2026/03/29",
    viewMode: "grid" as const,
    onViewModeChange: jest.fn(),
    onPrevWeek: jest.fn(),
    onNextWeek: jest.fn(),
    onThisWeek: jest.fn(),
    onCopyPreviousWeek: jest.fn().mockResolvedValue(true),
    onRefresh: jest.fn(),
    loading: false,
  };

  it("renders week range", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    expect(screen.getByText("2026/03/23 — 2026/03/29")).toBeInTheDocument();
  });

  it("renders week navigation buttons", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    expect(screen.getByTestId("prev-week-btn")).toBeInTheDocument();
    expect(screen.getByTestId("this-week-btn")).toBeInTheDocument();
    expect(screen.getByTestId("next-week-btn")).toBeInTheDocument();
  });

  it("calls onPrevWeek when previous button clicked", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    fireEvent.click(screen.getByTestId("prev-week-btn"));
    expect(defaultProps.onPrevWeek).toHaveBeenCalled();
  });

  it("calls onNextWeek when next button clicked", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    fireEvent.click(screen.getByTestId("next-week-btn"));
    expect(defaultProps.onNextWeek).toHaveBeenCalled();
  });

  it("calls onThisWeek when '本週' clicked", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    fireEvent.click(screen.getByTestId("this-week-btn"));
    expect(defaultProps.onThisWeek).toHaveBeenCalled();
  });

  it("renders view toggle buttons", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    expect(screen.getByTestId("view-grid-btn")).toBeInTheDocument();
    expect(screen.getByTestId("view-list-btn")).toBeInTheDocument();
  });

  it("renders copy-week button", () => {
    render(<TimesheetToolbar {...defaultProps} />);
    expect(screen.getByTestId("copy-week-btn")).toBeInTheDocument();
    expect(screen.getByText("複製上週")).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TimesheetTimer tests
// ═════════════════════════════════════════════════════════════════════════════

describe("TimesheetTimer", () => {
  const defaultProps = {
    timer: null,
    elapsed: 0,
    tasks: TASKS,
    onStart: jest.fn().mockResolvedValue({ ok: true, error: null }),
    onStop: jest.fn().mockResolvedValue({ ok: true, error: null }),
  };

  it("renders timer display showing 00:00:00", () => {
    render(<TimesheetTimer {...defaultProps} />);
    expect(screen.getByTestId("timer-display")).toHaveTextContent("00:00:00");
  });

  it("renders start button when not running", () => {
    render(<TimesheetTimer {...defaultProps} />);
    expect(screen.getByTestId("timer-start-btn")).toBeInTheDocument();
  });

  it("renders stop button when running", () => {
    render(
      <TimesheetTimer
        {...defaultProps}
        timer={{ isRunning: true, taskId: "task-1", taskLabel: "API 開發", startTime: Date.now(), entryId: "e1" }}
        elapsed={3661}
      />
    );
    expect(screen.getByTestId("timer-stop-btn")).toBeInTheDocument();
    expect(screen.getByTestId("timer-display")).toHaveTextContent("01:01:01");
  });

  it("renders task selector when not running", () => {
    render(<TimesheetTimer {...defaultProps} />);
    expect(screen.getByTestId("timer-task-select")).toBeInTheDocument();
  });

  it("shows running task label when running", () => {
    render(
      <TimesheetTimer
        {...defaultProps}
        timer={{ isRunning: true, taskId: "task-1", taskLabel: "API 開發", startTime: Date.now(), entryId: "e1" }}
        elapsed={10}
      />
    );
    expect(screen.getByTestId("timer-running-label")).toHaveTextContent("正在計時：API 開發");
  });

  it("calls onStart when start button clicked", async () => {
    const onStart = jest.fn().mockResolvedValue({ ok: true, error: null });
    render(<TimesheetTimer {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByTestId("timer-start-btn"));
    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith(null);
    });
  });

  it("calls onStop when stop button clicked", async () => {
    const onStop = jest.fn().mockResolvedValue({ ok: true, error: null });
    render(
      <TimesheetTimer
        {...defaultProps}
        onStop={onStop}
        timer={{ isRunning: true, taskId: null, taskLabel: "自由工時", startTime: Date.now(), entryId: "e1" }}
        elapsed={100}
      />
    );
    fireEvent.click(screen.getByTestId("timer-stop-btn"));
    await waitFor(() => {
      expect(onStop).toHaveBeenCalled();
    });
  });
});
