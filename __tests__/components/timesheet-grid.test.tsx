/**
 * Component tests: TimesheetGrid (redesigned) + TimesheetCell + TimesheetTimer
 *
 * Tests cover:
 *  - Grid rendering (headers, rows, totals, empty state)
 *  - Inline edit flow (click → type → Enter → save)
 *  - Keyboard navigation (Tab, Shift+Tab, Escape)
 *  - Timer start/stop flow
 *  - Overtime indicator display
 *  - Empty state display
 *  - Daily totals correctness
 *  - Week navigation (prev/next)
 */
import React from "react";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { TimesheetGrid } from "@/app/components/timesheet/timesheet-grid";
import { TimesheetCell } from "@/app/components/timesheet/timesheet-cell";
import { TimesheetTimer } from "@/app/components/timesheet/timesheet-timer";
import { TimesheetToolbar } from "@/app/components/timesheet/timesheet-toolbar";
import type { TimeEntry, TaskRow, OvertimeType, TaskOption } from "@/app/components/timesheet/use-timesheet";

// ─── Mock lucide-react icons ─────────────────────────────────────────────────
jest.mock("lucide-react", () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  Play: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-play" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-right" {...props} />,
  Grid3X3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grid" {...props} />,
  List: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-list" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar" {...props} />,
  CalendarDays: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar-days" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  FileDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-down" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  Lock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-lock" {...props} />,
}));

// ─── Test data ───────────────────────────────────────────────────────────────

const WEEK_START = new Date("2024-01-15"); // Monday

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DAYS_COUNT = 7;

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

const TASK_ROWS: TaskRow[] = [
  { taskId: "task-1", label: "Feature Development" },
  { taskId: null, label: "自由工時（無任務）" },
];

const ENTRIES: TimeEntry[] = [
  {
    id: "e1",
    taskId: "task-1",
    date: "2024-01-15",
    hours: 4,
    category: "PLANNED_TASK",
    description: null,
    overtimeType: "NONE",
  },
  {
    id: "e2",
    taskId: null,
    date: "2024-01-16",
    hours: 2,
    category: "ADMIN",
    description: "Meeting",
    overtimeType: "NONE",
  },
];

const TASKS: TaskOption[] = [
  { id: "task-1", title: "Feature Development" },
  { id: "task-2", title: "Bug Fix" },
];

function getEntriesForCell(taskId: string | null, dateStr: string): TimeEntry[] {
  return ENTRIES.filter(
    (e) => (e.taskId ?? null) === (taskId ?? null) && e.date.split("T")[0] === dateStr
  );
}

function computeDailyTotals(entries: TimeEntry[]): number[] {
  return Array.from({ length: DAYS_COUNT }, (_, i) => {
    const dateStr = getDateStr(i);
    return entries
      .filter((e) => e.date.split("T")[0] === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  });
}

// ─── TimesheetGrid Tests ─────────────────────────────────────────────────────

describe("TimesheetGrid", () => {
  const dailyTotals = computeDailyTotals(ENTRIES);
  const weeklyTotal = ENTRIES.reduce((sum, e) => sum + e.hours, 0);

  const defaultProps = {
    weekStart: WEEK_START,
    taskRows: TASK_ROWS,
    entries: ENTRIES,
    tasks: TASKS,
    dailyTotals,
    weeklyTotal,
    dayLabels: DAY_LABELS,
    daysCount: DAYS_COUNT,
    getDateStr,
    formatDateLabel,
    getEntriesForCell,
    onQuickSave: jest.fn().mockResolvedValue(undefined),
    onFullSave: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
    onAddTaskRow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders day headers (Mon-Sun)", () => {
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
    expect(screen.getByText("Feature Development", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("自由工時（無任務）")).toBeInTheDocument();
  });

  it("renders date labels for the week", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("1/15")).toBeInTheDocument();
    expect(screen.getByText("1/16")).toBeInTheDocument();
  });

  it("renders timesheet cells for each row-day combination", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const cells = screen.getAllByTestId("timesheet-cell");
    // 2 rows x 7 days = 14 cells
    expect(cells.length).toBe(14);
  });

  it("shows '每日合計' label in footer row", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("每日合計")).toBeInTheDocument();
  });

  // (f) Daily totals: bottom row shows correct sum of column hours
  it("shows daily column total for Monday (4.0)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Monday has 4h from entry e1
    const allFourZero = screen.getAllByText("4.0");
    expect(allFourZero.length).toBeGreaterThanOrEqual(1);
  });

  it("shows daily column total for Tuesday (2.0)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Tuesday has 2h from entry e2
    const allTwoZero = screen.getAllByText("2.0");
    expect(allTwoZero.length).toBeGreaterThanOrEqual(1);
  });

  it("shows grand total of all hours (6.0)", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("6.0")).toBeInTheDocument();
  });

  // (e) Empty state: grid shows "—" in all cells when no entries
  it("shows dashes in empty cells when no entries", () => {
    const emptyProps = {
      ...defaultProps,
      entries: [] as TimeEntry[],
      dailyTotals: Array(7).fill(0),
      weeklyTotal: 0,
      getEntriesForCell: () => [] as TimeEntry[],
    };
    render(<TimesheetGrid {...emptyProps} />);
    const cells = screen.getAllByTestId("timesheet-cell");
    // All cells should show "—"
    cells.forEach((cell) => {
      expect(within(cell).getByText("—")).toBeInTheDocument();
    });
  });

  it("renders empty message with no task rows", () => {
    render(<TimesheetGrid {...defaultProps} taskRows={[]} />);
    expect(screen.getByText("本週尚無工時記錄")).toBeInTheDocument();
  });

  it("renders add-task-row button", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByTestId("add-task-row-btn")).toBeInTheDocument();
  });
});

// ─── TimesheetCell: Inline Edit Flow ─────────────────────────────────────────

describe("TimesheetCell — inline edit flow", () => {
  const defaultCellProps = {
    entries: [] as TimeEntry[],
    taskId: "task-1",
    date: "2024-01-15",
    onQuickSave: jest.fn().mockResolvedValue(undefined),
    onFullSave: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
    onNavigate: jest.fn(),
    isWeekend: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // (a) Inline edit flow: click cell -> input appears -> type "3" -> press Enter -> save called with hours=3
  it("click cell -> input appears -> type '3' -> Enter -> save called with hours=3", async () => {
    const user = userEvent.setup();
    render(<TimesheetCell {...defaultCellProps} />);

    // Click cell button to start editing
    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    // Input should appear
    const input = screen.getByTestId("cell-input");
    expect(input).toBeInTheDocument();

    // Type "3"
    await user.type(input, "3");

    // Press Enter
    await user.keyboard("{Enter}");

    // onQuickSave should be called with hours=3
    expect(defaultCellProps.onQuickSave).toHaveBeenCalledWith("task-1", "2024-01-15", 3, undefined);
  });

  // (b) Keyboard navigation: Tab moves to next cell
  it("Tab calls onNavigate('next')", async () => {
    const user = userEvent.setup();
    render(<TimesheetCell {...defaultCellProps} />);

    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    const input = screen.getByTestId("cell-input");
    await user.type(input, "2");
    await user.keyboard("{Tab}");

    expect(defaultCellProps.onNavigate).toHaveBeenCalledWith("next");
  });

  // (b) Keyboard navigation: Shift+Tab moves back
  it("Shift+Tab calls onNavigate('prev')", async () => {
    const user = userEvent.setup();
    render(<TimesheetCell {...defaultCellProps} />);

    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    const input = screen.getByTestId("cell-input");
    await user.type(input, "1");
    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(defaultCellProps.onNavigate).toHaveBeenCalledWith("prev");
  });

  // (b) Keyboard navigation: Escape cancels edit
  it("Escape cancels edit without saving", async () => {
    const user = userEvent.setup();
    render(<TimesheetCell {...defaultCellProps} />);

    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    const input = screen.getByTestId("cell-input");
    await user.type(input, "5");
    await user.keyboard("{Escape}");

    // Should not save
    expect(defaultCellProps.onQuickSave).not.toHaveBeenCalled();
    // Input should disappear, button should be back
    expect(screen.getByTestId("cell-button")).toBeInTheDocument();
  });

  // (d) Overtime indicator: cell shows overtime indicator
  it("shows overtime indicator when entry has WEEKDAY overtime", () => {
    const overtimeEntry: TimeEntry[] = [
      {
        id: "ot1",
        taskId: "task-1",
        date: "2024-01-15",
        hours: 2,
        category: "PLANNED_TASK",
        description: null,
        overtimeType: "WEEKDAY",
      },
    ];
    render(
      <TimesheetCell
        {...defaultCellProps}
        entries={overtimeEntry}
      />
    );
    // Should show overtime dot with title "平日加班"
    const btn = screen.getByTestId("cell-button");
    const overtimeDot = btn.querySelector('[title="平日加班"]');
    expect(overtimeDot).toBeInTheDocument();
  });

  it("shows holiday overtime indicator when entry has HOLIDAY overtime", () => {
    const holidayEntry: TimeEntry[] = [
      {
        id: "ot2",
        taskId: "task-1",
        date: "2024-01-15",
        hours: 3,
        category: "PLANNED_TASK",
        description: null,
        overtimeType: "HOLIDAY",
      },
    ];
    render(
      <TimesheetCell
        {...defaultCellProps}
        entries={holidayEntry}
      />
    );
    const btn = screen.getByTestId("cell-button");
    const overtimeDot = btn.querySelector('[title="假日加班"]');
    expect(overtimeDot).toBeInTheDocument();
  });

  // (e) Empty state: single cell shows "—"
  it("shows dash when no entries", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  // Item 5: Enter → blur sequence only triggers one save call (double save prevention)
  it("Enter then blur only triggers one save (no double save)", async () => {
    const user = userEvent.setup();
    render(<TimesheetCell {...defaultCellProps} />);

    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    const input = screen.getByTestId("cell-input");
    await user.type(input, "5");

    // Press Enter (saves + sets savedByKeyboard flag)
    await user.keyboard("{Enter}");

    // The blur event fires after Enter sets editing=false, but savedByKeyboard
    // flag prevents duplicate save. Verify only one save call.
    expect(defaultCellProps.onQuickSave).toHaveBeenCalledTimes(1);
    expect(defaultCellProps.onQuickSave).toHaveBeenCalledWith("task-1", "2024-01-15", 5, undefined);
  });

  // Inline edit with existing entry pre-fills hours
  it("pre-fills input with existing entry hours", async () => {
    const user = userEvent.setup();
    const existingEntry: TimeEntry[] = [
      {
        id: "e1",
        taskId: "task-1",
        date: "2024-01-15",
        hours: 4,
        category: "PLANNED_TASK",
        description: null,
        overtimeType: "NONE",
      },
    ];
    render(<TimesheetCell {...defaultCellProps} entries={existingEntry} />);

    const btn = screen.getByTestId("cell-button");
    await user.click(btn);

    const input = screen.getByTestId("cell-input") as HTMLInputElement;
    expect(input.value).toBe("4.0");
  });
});

// ─── TimesheetTimer Tests ────────────────────────────────────────────────────

describe("TimesheetTimer", () => {
  const defaultTimerProps = {
    timer: null,
    elapsed: 0,
    tasks: TASKS,
    onStart: jest.fn().mockResolvedValue({ ok: true, error: null }),
    onStop: jest.fn().mockResolvedValue({ ok: true, error: null }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // (c) Timer: start button -> elapsed time display -> stop button
  it("shows start button when timer is not running", () => {
    render(<TimesheetTimer {...defaultTimerProps} />);
    expect(screen.getByTestId("timer-start-btn")).toBeInTheDocument();
    expect(screen.getByText("開始計時")).toBeInTheDocument();
  });

  it("clicking start calls onStart", async () => {
    const user = userEvent.setup();
    render(<TimesheetTimer {...defaultTimerProps} />);

    await user.click(screen.getByTestId("timer-start-btn"));
    expect(defaultTimerProps.onStart).toHaveBeenCalledWith(null);
  });

  it("shows elapsed time when timer is running", () => {
    const runningProps = {
      ...defaultTimerProps,
      timer: {
        isRunning: true,
        taskId: "task-1",
        taskLabel: "Feature Development",
        startTime: Date.now() - 3661000,
        entryId: "entry-1",
      },
      elapsed: 3661, // 1h 1m 1s
    };
    render(<TimesheetTimer {...runningProps} />);

    const display = screen.getByTestId("timer-display");
    expect(display.textContent).toBe("01:01:01");
  });

  it("shows stop button and running task label when timer is running", () => {
    const runningProps = {
      ...defaultTimerProps,
      timer: {
        isRunning: true,
        taskId: "task-1",
        taskLabel: "Feature Development",
        startTime: Date.now(),
        entryId: "entry-1",
      },
      elapsed: 60,
    };
    render(<TimesheetTimer {...runningProps} />);

    expect(screen.getByTestId("timer-stop-btn")).toBeInTheDocument();
    expect(screen.getByText("正在計時：Feature Development")).toBeInTheDocument();
  });

  it("clicking stop calls onStop", async () => {
    const user = userEvent.setup();
    const runningProps = {
      ...defaultTimerProps,
      timer: {
        isRunning: true,
        taskId: "task-1",
        taskLabel: "Feature Development",
        startTime: Date.now(),
        entryId: "entry-1",
      },
      elapsed: 120,
    };
    render(<TimesheetTimer {...runningProps} />);

    await user.click(screen.getByTestId("timer-stop-btn"));
    expect(defaultTimerProps.onStop).toHaveBeenCalled();
  });

  it("shows task selector when timer is not running", () => {
    render(<TimesheetTimer {...defaultTimerProps} />);
    expect(screen.getByTestId("timer-task-select")).toBeInTheDocument();
  });

  it("shows 00:00:00 when elapsed is 0", () => {
    render(<TimesheetTimer {...defaultTimerProps} />);
    expect(screen.getByTestId("timer-display").textContent).toBe("00:00:00");
  });
});

// ─── TimesheetToolbar: Week Navigation ───────────────────────────────────────

describe("TimesheetToolbar — week navigation", () => {
  const defaultToolbarProps = {
    weekRange: "2024/01/15 — 2024/01/21",
    viewMode: "grid" as const,
    onViewModeChange: jest.fn(),
    onPrevWeek: jest.fn(),
    onNextWeek: jest.fn(),
    onThisWeek: jest.fn(),
    onCopyPreviousWeek: jest.fn().mockResolvedValue(true),
    onRefresh: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // (g) Week navigation: clicking prev/next changes date range
  it("clicking prev-week button calls onPrevWeek", async () => {
    const user = userEvent.setup();
    render(<TimesheetToolbar {...defaultToolbarProps} />);

    await user.click(screen.getByTestId("prev-week-btn"));
    expect(defaultToolbarProps.onPrevWeek).toHaveBeenCalledTimes(1);
  });

  it("clicking next-week button calls onNextWeek", async () => {
    const user = userEvent.setup();
    render(<TimesheetToolbar {...defaultToolbarProps} />);

    await user.click(screen.getByTestId("next-week-btn"));
    expect(defaultToolbarProps.onNextWeek).toHaveBeenCalledTimes(1);
  });

  it("clicking this-week button calls onThisWeek", async () => {
    const user = userEvent.setup();
    render(<TimesheetToolbar {...defaultToolbarProps} />);

    await user.click(screen.getByTestId("this-week-btn"));
    expect(defaultToolbarProps.onThisWeek).toHaveBeenCalledTimes(1);
  });

  it("displays week range text", () => {
    render(<TimesheetToolbar {...defaultToolbarProps} />);
    expect(screen.getByText("2024/01/15 — 2024/01/21")).toBeInTheDocument();
  });

  // Issue #1539-11: weekly progress hint in subtitle
  describe("weekly progress hint (#1539-11)", () => {
    it("hides progress when weeklyTotal not provided", () => {
      render(<TimesheetToolbar {...defaultToolbarProps} />);
      expect(screen.queryByTestId("toolbar-weekly-progress")).not.toBeInTheDocument();
    });

    it("shows weekly progress when weeklyTotal provided", () => {
      render(<TimesheetToolbar {...defaultToolbarProps} weeklyTotal={28.5} />);
      const progress = screen.getByTestId("toolbar-weekly-progress");
      expect(progress).toBeInTheDocument();
      expect(progress).toHaveTextContent("本週 28.5h / 40h");
    });

    it("respects custom weeklyTarget", () => {
      render(
        <TimesheetToolbar {...defaultToolbarProps} weeklyTotal={20} weeklyTarget={32} />
      );
      expect(screen.getByTestId("toolbar-weekly-progress")).toHaveTextContent(
        "本週 20.0h / 32h"
      );
    });

    it("uses emerald color when totalHours >= target", () => {
      render(<TimesheetToolbar {...defaultToolbarProps} weeklyTotal={42} />);
      const progress = screen.getByTestId("toolbar-weekly-progress");
      expect(progress.className).toMatch(/emerald/);
    });

    it("uses neutral color when totalHours below target", () => {
      render(<TimesheetToolbar {...defaultToolbarProps} weeklyTotal={20} />);
      const progress = screen.getByTestId("toolbar-weekly-progress");
      expect(progress.className).not.toMatch(/emerald/);
    });

    it("renders 0h when weeklyTotal is 0", () => {
      render(<TimesheetToolbar {...defaultToolbarProps} weeklyTotal={0} />);
      const progress = screen.getByTestId("toolbar-weekly-progress");
      expect(progress).toHaveTextContent("本週 0.0h / 40h");
    });
  });
});
