/**
 * Tests for Timesheet v3 Phase 2: Calendar Week View + Drag Interactions
 *
 * Covers:
 * - Week view renders 7 day columns
 * - Time blocks positioned correctly in their day column
 * - Drag within column creates entry
 * - Block move between days updates date
 * - Copy day duplicates entries
 * - Weekly total calculates correctly
 * - Mobile falls back (no week grid)
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock lucide-react icons ──────────────────────────────────────────────────
jest.mock("lucide-react", () => ({
  ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-right" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar" {...props} />,
  CalendarDays: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-calendar-days" {...props} />,
  Grid3X3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grid" {...props} />,
  List: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-list" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  FileDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-down" {...props} />,
}));

import { CalendarWeekView } from "@/app/components/timesheet/calendar-week-view";
import type { TimeEntry, TaskOption } from "@/app/components/timesheet/use-timesheet";

// ── Test Fixtures ────────────────────────────────────────────────────────────

// Monday 2026-03-23
const WEEK_START = new Date(2026, 2, 23);

const MOCK_TASKS: TaskOption[] = [
  { id: "task-1", title: "TITAN-123 前端重構" },
  { id: "task-2", title: "TITAN-456 API 設計" },
];

function makeEntry(overrides: Partial<TimeEntry> & { id: string; date: string }): TimeEntry {
  return {
    taskId: "task-1",
    hours: 3,
    startTime: "09:00",
    endTime: "12:00",
    category: "PLANNED_TASK",
    description: "Work",
    overtimeType: "NONE",
    locked: false,
    task: { id: "task-1", title: "TITAN-123 前端重構" },
    ...overrides,
  };
}

const MONDAY_ENTRY = makeEntry({ id: "e1", date: "2026-03-23", hours: 3, startTime: "09:00", endTime: "12:00" });
const TUESDAY_ENTRY = makeEntry({ id: "e2", date: "2026-03-24", hours: 2, startTime: "13:00", endTime: "15:00" });
const WEDNESDAY_ENTRY = makeEntry({ id: "e3", date: "2026-03-25", hours: 1, startTime: "16:00", endTime: "17:00" });

const ALL_ENTRIES = [MONDAY_ENTRY, TUESDAY_ENTRY, WEDNESDAY_ENTRY];

const noop = async () => {};

function renderWeekView(overrides: Partial<React.ComponentProps<typeof CalendarWeekView>> = {}) {
  return render(
    <CalendarWeekView
      weekStart={WEEK_START}
      entries={ALL_ENTRIES}
      tasks={MOCK_TASKS}
      onPrevWeek={jest.fn()}
      onNextWeek={jest.fn()}
      onThisWeek={jest.fn()}
      onSaveEntry={jest.fn().mockResolvedValue(undefined)}
      onDeleteEntry={jest.fn().mockResolvedValue(undefined)}
      {...overrides}
    />
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CalendarWeekView", () => {
  // Make sure we're on "desktop"
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 1200 });
    window.dispatchEvent(new Event("resize"));
  });

  it("renders 7 day columns", () => {
    renderWeekView();
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-column-${i}`)).toBeInTheDocument();
    }
  });

  it("renders 7 day headers with correct labels", () => {
    renderWeekView();
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-header-${i}`)).toBeInTheDocument();
    }
    // Check that Monday header contains "週一"
    expect(screen.getByTestId("day-header-0")).toHaveTextContent("週一");
    expect(screen.getByTestId("day-header-6")).toHaveTextContent("週日");
  });

  it("positions time blocks in the correct day column", () => {
    renderWeekView();
    const blocks = screen.getAllByTestId("week-time-block");
    // We have 3 entries, so 3 blocks
    expect(blocks).toHaveLength(3);

    // Monday column should contain TITAN-123 (e1)
    const mondayCol = screen.getByTestId("day-column-0");
    expect(mondayCol.querySelector("[data-time-block]")).toBeTruthy();

    // Tuesday column should contain e2
    const tuesdayCol = screen.getByTestId("day-column-1");
    expect(tuesdayCol.querySelector("[data-time-block]")).toBeTruthy();
  });

  it("calculates daily totals correctly", () => {
    renderWeekView();
    // Monday: 3h
    expect(screen.getByTestId("day-total-0")).toHaveTextContent("3.0h");
    // Tuesday: 2h
    expect(screen.getByTestId("day-total-1")).toHaveTextContent("2.0h");
    // Wednesday: 1h
    expect(screen.getByTestId("day-total-2")).toHaveTextContent("1.0h");
    // Thursday: --
    expect(screen.getByTestId("day-total-3")).toHaveTextContent("--");
  });

  it("calculates weekly total correctly", () => {
    renderWeekView();
    expect(screen.getByTestId("weekly-total")).toHaveTextContent("6.0h");
  });

  it("renders bottom totals row", () => {
    renderWeekView();
    const totalsRow = screen.getByTestId("week-totals-row");
    expect(totalsRow).toBeInTheDocument();
    // Monday total cell
    expect(screen.getByTestId("day-total-cell-0")).toHaveTextContent("3.0h");
  });

  it("opens create form on drag within a column", async () => {
    renderWeekView();
    const mondayCol = screen.getByTestId("day-column-0");

    // Mock getBoundingClientRect
    jest.spyOn(mondayCol, "getBoundingClientRect").mockReturnValue({
      top: 0,
      left: 0,
      bottom: 840,
      right: 200,
      width: 200,
      height: 840,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Simulate drag: mousedown at y=60 (09:00), mousemove to y=180 (11:00), mouseup
    fireEvent.mouseDown(mondayCol, { clientY: 60 });
    fireEvent.mouseMove(mondayCol, { clientY: 180 });
    fireEvent.mouseUp(mondayCol);

    // Create form should appear
    await waitFor(() => {
      expect(screen.getByTestId("week-create-form")).toBeInTheDocument();
    });
  });

  it("saves entry from create form", async () => {
    const onSaveEntry = jest.fn().mockResolvedValue(undefined);
    renderWeekView({ onSaveEntry });
    const mondayCol = screen.getByTestId("day-column-0");

    jest.spyOn(mondayCol, "getBoundingClientRect").mockReturnValue({
      top: 0, left: 0, bottom: 840, right: 200, width: 200, height: 840, x: 0, y: 0, toJSON: () => {},
    });

    fireEvent.mouseDown(mondayCol, { clientY: 60 });
    fireEvent.mouseMove(mondayCol, { clientY: 180 });
    fireEvent.mouseUp(mondayCol);

    await waitFor(() => {
      expect(screen.getByTestId("week-create-form")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("week-create-save-btn"));

    await waitFor(() => {
      expect(onSaveEntry).toHaveBeenCalled();
    });
  });

  it("moves block between days via drag-and-drop", async () => {
    const onSaveEntry = jest.fn().mockResolvedValue(undefined);
    renderWeekView({ onSaveEntry });

    const blocks = screen.getAllByTestId("week-time-block");
    const firstBlock = blocks[0]; // Monday entry

    // Simulate drag start on block
    fireEvent.dragStart(firstBlock, {
      dataTransfer: {
        setData: jest.fn(),
        effectAllowed: "move",
      },
    });

    // Drop on Wednesday column
    const wednesdayCol = screen.getByTestId("day-column-2");
    fireEvent.dragOver(wednesdayCol, {
      dataTransfer: { dropEffect: "move" },
      preventDefault: jest.fn(),
    });
    fireEvent.drop(wednesdayCol, {
      dataTransfer: {
        getData: () => "e1", // Monday entry ID
      },
      preventDefault: jest.fn(),
    });

    await waitFor(() => {
      expect(onSaveEntry).toHaveBeenCalledWith(
        "task-1",        // taskId
        "2026-03-25",    // Wednesday date
        3,               // hours
        "PLANNED_TASK",  // category
        "Work",          // description
        "NONE",          // overtimeType
        "e1",            // existingId (update)
        null,            // subTaskId
        "09:00",         // startTime
        "12:00"          // endTime
      );
    });
  });

  it("opens copy day context menu on right-click header", async () => {
    renderWeekView();
    const mondayHeader = screen.getByTestId("day-header-0");
    fireEvent.contextMenu(mondayHeader);

    await waitFor(() => {
      expect(screen.getByTestId("copy-day-menu")).toBeInTheDocument();
    });

    // Should show copy targets for all other days
    expect(screen.getByTestId("copy-to-day-1")).toBeInTheDocument(); // Tuesday
    expect(screen.queryByTestId("copy-to-day-0")).not.toBeInTheDocument(); // Not Monday itself
  });

  it("copies day entries to target day", async () => {
    const onSaveEntry = jest.fn().mockResolvedValue(undefined);
    renderWeekView({ onSaveEntry });

    // Right-click Monday header
    const mondayHeader = screen.getByTestId("day-header-0");
    fireEvent.contextMenu(mondayHeader);

    await waitFor(() => {
      expect(screen.getByTestId("copy-day-menu")).toBeInTheDocument();
    });

    // Click "copy to Thursday"
    fireEvent.click(screen.getByTestId("copy-to-day-3"));

    await waitFor(() => {
      // Should save Monday's entry (e1) to Thursday
      expect(onSaveEntry).toHaveBeenCalledWith(
        "task-1",
        "2026-03-26",    // Thursday
        3,
        "PLANNED_TASK",
        "Work",
        "NONE",
        undefined,       // no existingId (it's a new entry)
        null,
        "09:00",
        "12:00"
      );
    });
  });

  it("opens edit form on block click", async () => {
    renderWeekView();
    const blocks = screen.getAllByTestId("week-time-block");
    fireEvent.click(blocks[0]);

    await waitFor(() => {
      expect(screen.getByTestId("week-edit-form")).toBeInTheDocument();
    });
  });

  it("deletes entry from edit form", async () => {
    const onDeleteEntry = jest.fn().mockResolvedValue(undefined);
    renderWeekView({ onDeleteEntry });

    const blocks = screen.getAllByTestId("week-time-block");
    fireEvent.click(blocks[0]);

    await waitFor(() => {
      expect(screen.getByTestId("week-edit-form")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("week-edit-delete-btn"));

    await waitFor(() => {
      expect(onDeleteEntry).toHaveBeenCalledWith("e1");
    });
  });

  it("highlights daily total > 8h in amber", () => {
    const heavyEntry = makeEntry({
      id: "e-heavy",
      date: "2026-03-23",
      hours: 9,
      startTime: "08:00",
      endTime: "17:00",
    });
    renderWeekView({ entries: [heavyEntry] });

    const mondayTotal = screen.getByTestId("day-total-0");
    expect(mondayTotal).toHaveTextContent("9.0h");
    expect(mondayTotal.className).toContain("amber");
  });

  it("shows mobile fallback on small screen", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 600 });
    window.dispatchEvent(new Event("resize"));

    renderWeekView();
    expect(screen.getByTestId("week-view-mobile-fallback")).toBeInTheDocument();
  });

  it("does not render week grid on mobile", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, value: 600 });
    window.dispatchEvent(new Event("resize"));

    renderWeekView();
    expect(screen.queryByTestId("week-grid-body")).not.toBeInTheDocument();
  });

  it("navigates weeks with prev/next buttons", () => {
    const onPrevWeek = jest.fn();
    const onNextWeek = jest.fn();
    renderWeekView({ onPrevWeek, onNextWeek });

    fireEvent.click(screen.getByTestId("prev-week-btn"));
    expect(onPrevWeek).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("next-week-btn"));
    expect(onNextWeek).toHaveBeenCalled();
  });
});

// ── Calendar Utils Tests ─────────────────────────────────────────────────────

import {
  timeToHours,
  hoursToTime,
  timeToPosition,
  positionToTime,
  getBlockStyle,
  snapToGrid,
  formatDuration,
  getCatColor,
  getCatBg,
  HOUR_HEIGHT,
  MIN_HOUR,
} from "@/app/components/timesheet/calendar-utils";

describe("calendar-utils", () => {
  describe("timeToHours", () => {
    it("converts HH:MM to fractional hours", () => {
      expect(timeToHours("09:00")).toBe(9);
      expect(timeToHours("09:30")).toBe(9.5);
      expect(timeToHours("14:15")).toBe(14.25);
    });
  });

  describe("hoursToTime", () => {
    it("converts fractional hours to HH:MM", () => {
      expect(hoursToTime(9)).toBe("09:00");
      expect(hoursToTime(9.5)).toBe("09:30");
      expect(hoursToTime(14.25)).toBe("14:15");
    });
  });

  describe("timeToPosition", () => {
    it("converts time to pixel position", () => {
      // 09:00 → (9 - 8) * 60 = 60px
      expect(timeToPosition("09:00", HOUR_HEIGHT)).toBe(60);
      // 12:00 → (12 - 8) * 60 = 240px
      expect(timeToPosition("12:00", HOUR_HEIGHT)).toBe(240);
    });
  });

  describe("positionToTime", () => {
    it("converts pixel position to time string", () => {
      // 60px → 8 + 60/60 = 9.0 → "09:00"
      expect(positionToTime(60, HOUR_HEIGHT)).toBe("09:00");
      // 90px → 8 + 90/60 = 9.5 → "09:30"
      expect(positionToTime(90, HOUR_HEIGHT)).toBe("09:30");
    });
  });

  describe("getBlockStyle", () => {
    it("returns correct top and height", () => {
      const style = getBlockStyle("09:00", "12:00", HOUR_HEIGHT);
      expect(style.top).toBe(60);   // (9-8)*60
      expect(style.height).toBe(180); // 3*60
    });

    it("enforces minimum height of 24px", () => {
      const style = getBlockStyle("09:00", "09:05", HOUR_HEIGHT);
      expect(style.height).toBe(24);
    });
  });

  describe("snapToGrid", () => {
    it("snaps to 15-minute intervals", () => {
      expect(snapToGrid(9.1)).toBe(9);       // closer to 9:00
      expect(snapToGrid(9.13)).toBe(9.25);   // closer to 9:15
      expect(snapToGrid(9.5)).toBe(9.5);     // exactly 9:30
      expect(snapToGrid(9.63)).toBe(9.75);   // closer to 9:45
    });
  });

  describe("formatDuration", () => {
    it("formats sub-hour as minutes", () => {
      expect(formatDuration(0.5)).toBe("30min");
      expect(formatDuration(0.25)).toBe("15min");
    });
    it("formats 1h+ as hours", () => {
      expect(formatDuration(1)).toBe("1.0h");
      expect(formatDuration(2.5)).toBe("2.5h");
    });
  });

  describe("getCatColor", () => {
    it("returns correct dot color", () => {
      expect(getCatColor("PLANNED_TASK")).toBe("bg-blue-500");
      expect(getCatColor("ADMIN")).toBe("bg-slate-400");
    });
    it("returns fallback for unknown category", () => {
      expect(getCatColor("UNKNOWN")).toBe("bg-slate-400");
    });
  });

  describe("getCatBg", () => {
    it("returns correct background classes", () => {
      const bg = getCatBg("PLANNED_TASK");
      expect(bg).toContain("bg-blue-500/15");
    });
    it("returns fallback for unknown category", () => {
      const bg = getCatBg("UNKNOWN");
      expect(bg).toContain("bg-slate-400/15");
    });
  });
});
