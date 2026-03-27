/**
 * Tests for Timesheet Phase 1 Track A: Items 2, 7, 6
 *
 * Item 2: Locked entry frontend protection
 * Item 7: Multi-entry individual editing UI
 * Item 6: Template UI integration MVP
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock lucide-react icons ──────────────────────────────────────────────────
jest.mock("lucide-react", () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  Lock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-lock" {...props} />,
  ChevronLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-left" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-right" {...props} />,
  Grid3X3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grid" {...props} />,
  List: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-list" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  FileDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-down" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  Play: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-play" {...props} />,
  Square: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-square" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  FileText: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-text" {...props} />,
  Save: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-save" {...props} />,
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-down" {...props} />,
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trash" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Pencil: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-pencil" {...props} />,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
}));

import { TimesheetCell } from "@/app/components/timesheet/timesheet-cell";
import { TemplateSelector } from "@/app/components/timesheet/template-selector";
import type { TimeEntry } from "@/app/components/timesheet/use-timesheet";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const UNLOCKED_ENTRY: TimeEntry = {
  id: "e1",
  taskId: "task-1",
  date: "2026-03-23",
  hours: 8,
  category: "PLANNED_TASK",
  description: "API work",
  overtimeType: "NONE",
  locked: false,
};

const LOCKED_ENTRY: TimeEntry = {
  id: "e2",
  taskId: "task-1",
  date: "2026-03-23",
  hours: 4,
  category: "PLANNED_TASK",
  description: "Locked entry",
  overtimeType: "NONE",
  locked: true,
};

const MULTI_ENTRIES: TimeEntry[] = [
  {
    id: "m1",
    taskId: "task-1",
    date: "2026-03-23",
    hours: 4,
    category: "PLANNED_TASK",
    description: "Morning work",
    overtimeType: "NONE",
    locked: false,
  },
  {
    id: "m2",
    taskId: "task-1",
    date: "2026-03-23",
    hours: 3,
    category: "ADDED_TASK",
    description: "Afternoon work",
    overtimeType: "WEEKDAY",
    locked: false,
  },
  {
    id: "m3",
    taskId: "task-1",
    date: "2026-03-23",
    hours: 1,
    category: "SUPPORT",
    description: "Locked record",
    overtimeType: "NONE",
    locked: true,
  },
];

const defaultCellProps = {
  entries: [] as TimeEntry[],
  taskId: "task-1" as string | null,
  date: "2026-03-23",
  onQuickSave: jest.fn().mockResolvedValue(undefined),
  onFullSave: jest.fn().mockResolvedValue(undefined),
  onDelete: jest.fn().mockResolvedValue(undefined),
};

// ═════════════════════════════════════════════════════════════════════════════
// Item 2: Locked entry frontend protection
// ═════════════════════════════════════════════════════════════════════════════

describe("Item 2: Locked entry protection", () => {
  it("shows lock icon on all-locked cell instead of category dot", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[LOCKED_ENTRY]} />);
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
  });

  it("does not enter editing mode when clicking a locked cell", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[LOCKED_ENTRY]} />);
    fireEvent.click(screen.getByTestId("cell-button"));
    // Should NOT show the input
    expect(screen.queryByTestId("cell-input")).not.toBeInTheDocument();
  });

  it("enters editing mode when clicking an unlocked cell", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[UNLOCKED_ENTRY]} />);
    fireEvent.click(screen.getByTestId("cell-button"));
    expect(screen.getByTestId("cell-input")).toBeInTheDocument();
  });

  it("does not call onQuickSave for locked entry on Enter", async () => {
    const onQuickSave = jest.fn().mockResolvedValue(undefined);
    // First entry unlocked but with inline editing targeting it
    render(
      <TimesheetCell
        {...defaultCellProps}
        entries={[{ ...UNLOCKED_ENTRY, locked: true }]}
        onQuickSave={onQuickSave}
      />
    );
    // Locked cell won't enter editing mode, so quickSave won't be called
    fireEvent.click(screen.getByTestId("cell-button"));
    expect(screen.queryByTestId("cell-input")).not.toBeInTheDocument();
    expect(onQuickSave).not.toHaveBeenCalled();
  });

  it("shows locked badge in expanded editor for locked entries", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[LOCKED_ENTRY]} />);
    // Double click to open expanded (allowed for locked entries to view)
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    expect(screen.getByText("已鎖定")).toBeInTheDocument();
  });

  it("does not show save/delete buttons for locked entries in expanded editor", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[LOCKED_ENTRY]} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    // Should NOT have save/delete buttons for the locked entry
    expect(screen.queryByTestId("entry-save-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entry-delete-0")).not.toBeInTheDocument();
  });

  it("applies cursor-not-allowed class on locked cells", () => {
    render(<TimesheetCell {...defaultCellProps} entries={[LOCKED_ENTRY]} />);
    const button = screen.getByTestId("cell-button");
    expect(button.className).toContain("cursor-not-allowed");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Item 7: Multi-entry individual editing UI
// ═════════════════════════════════════════════════════════════════════════════

describe("Item 7: Multi-entry individual editing", () => {
  it("renders all entries in expanded editor on double-click", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    // Should show 3 entry editors
    expect(screen.getByTestId("entry-editor-0")).toBeInTheDocument();
    expect(screen.getByTestId("entry-editor-1")).toBeInTheDocument();
    expect(screen.getByTestId("entry-editor-2")).toBeInTheDocument();
  });

  it("shows individual save button for each unlocked entry", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    // m1 (unlocked) and m2 (unlocked) should have save buttons
    expect(screen.getByTestId("entry-save-0")).toBeInTheDocument();
    expect(screen.getByTestId("entry-save-1")).toBeInTheDocument();
    // m3 (locked) should NOT have save button
    expect(screen.queryByTestId("entry-save-2")).not.toBeInTheDocument();
  });

  it("shows individual delete button for each unlocked entry", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    expect(screen.getByTestId("entry-delete-0")).toBeInTheDocument();
    expect(screen.getByTestId("entry-delete-1")).toBeInTheDocument();
    // m3 (locked) should NOT have delete button
    expect(screen.queryByTestId("entry-delete-2")).not.toBeInTheDocument();
  });

  it("shows + 新增記錄 button in expanded editor", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    expect(screen.getByTestId("add-entry-btn")).toBeInTheDocument();
  });

  it("shows new entry form when + 新增記錄 is clicked", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    fireEvent.click(screen.getByTestId("add-entry-btn"));
    expect(screen.getByTestId("new-entry-form")).toBeInTheDocument();
    expect(screen.getByTestId("new-entry-save")).toBeInTheDocument();
  });

  it("calls onFullSave for individual entry save", async () => {
    const onFullSave = jest.fn().mockResolvedValue(undefined);
    render(
      <TimesheetCell
        {...defaultCellProps}
        entries={[UNLOCKED_ENTRY]}
        onFullSave={onFullSave}
      />
    );
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    fireEvent.click(screen.getByTestId("entry-save-0"));
    await waitFor(() => {
      expect(onFullSave).toHaveBeenCalledWith(
        "task-1",
        "2026-03-23",
        8,
        "PLANNED_TASK",
        "API work",
        "NONE",
        "e1",
        null,             // Issue #933: subTaskId
        expect.anything(), // startTime
        expect.anything()  // endTime
      );
    });
  });

  it("calls onDelete for individual entry delete", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(
      <TimesheetCell
        {...defaultCellProps}
        entries={[UNLOCKED_ENTRY]}
        onDelete={onDelete}
      />
    );
    fireEvent.doubleClick(screen.getByTestId("cell-button"));
    fireEvent.click(screen.getByTestId("entry-delete-0"));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("e1");
    });
  });

  it("shows +N indicator for multiple entries in cell display", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    // Should show "+2" for 3 entries (first one shown, +2 more)
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows total hours of all entries in cell display", () => {
    render(<TimesheetCell {...defaultCellProps} entries={MULTI_ENTRIES} />);
    // Total = 4 + 3 + 1 = 8.0
    expect(screen.getByText("8.0")).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Item 6: Template UI integration
// ═════════════════════════════════════════════════════════════════════════════

describe("Item 6: Template selector", () => {
  const WEEK_START = new Date("2026-03-23");

  const defaultTemplateProps = {
    weekStart: WEEK_START,
    entries: [] as TimeEntry[],
    daysCount: 7,
    getDateStr: (offset: number) => {
      const d = new Date(WEEK_START);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split("T")[0];
    },
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it("renders template button and save-as-template button", () => {
    render(<TemplateSelector {...defaultTemplateProps} />);
    expect(screen.getByTestId("template-btn")).toBeInTheDocument();
    expect(screen.getByTestId("save-template-btn")).toBeInTheDocument();
    expect(screen.getByText("模板")).toBeInTheDocument();
    expect(screen.getByText("儲存為模板")).toBeInTheDocument();
  });

  it("opens dropdown when template button clicked", async () => {
    render(<TemplateSelector {...defaultTemplateProps} />);
    fireEvent.click(screen.getByTestId("template-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("template-dropdown")).toBeInTheDocument();
    });
  });

  it("shows empty state when no templates exist", async () => {
    render(<TemplateSelector {...defaultTemplateProps} />);
    fireEvent.click(screen.getByTestId("template-btn"));
    await waitFor(() => {
      expect(screen.getByText(/尚無模板/)).toBeInTheDocument();
    });
  });

  it("opens save form when save-as-template button clicked", () => {
    render(<TemplateSelector {...defaultTemplateProps} />);
    fireEvent.click(screen.getByTestId("save-template-btn"));
    expect(screen.getByTestId("save-template-form")).toBeInTheDocument();
    expect(screen.getByTestId("template-name-input")).toBeInTheDocument();
  });

  it("shows template items when templates exist", async () => {
    const mockTemplates = [
      { id: "t1", name: "標準工時", entries: '[{"hours":8,"category":"PLANNED_TASK"}]', createdAt: "2026-03-20" },
      { id: "t2", name: "半天模板", entries: '[{"hours":4,"category":"ADMIN"}]', createdAt: "2026-03-21" },
    ];
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockTemplates }),
    });

    render(<TemplateSelector {...defaultTemplateProps} />);
    fireEvent.click(screen.getByTestId("template-btn"));

    await waitFor(() => {
      expect(screen.getByText("標準工時")).toBeInTheDocument();
      expect(screen.getByText("半天模板")).toBeInTheDocument();
    });
  });

  it("shows confirmation dialog when template is selected", async () => {
    const mockTemplates = [
      { id: "t1", name: "標準工時", entries: '[{"hours":8}]', createdAt: "2026-03-20" },
    ];
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockTemplates }),
    });

    render(<TemplateSelector {...defaultTemplateProps} />);
    fireEvent.click(screen.getByTestId("template-btn"));

    await waitFor(() => {
      expect(screen.getByText("標準工時")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("標準工時"));
    expect(screen.getByTestId("template-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("template-apply-confirm")).toBeInTheDocument();
  });

  it("calls save API when template name is submitted", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    (global.fetch as jest.Mock) = mockFetch;

    const entriesWithData = [
      { id: "x1", taskId: "task-1", date: "2026-03-23", hours: 8, category: "PLANNED_TASK", description: "test", overtimeType: "NONE" as const, locked: false },
    ];

    render(<TemplateSelector {...defaultTemplateProps} entries={entriesWithData} />);

    // Click save-as-template (this does NOT trigger loadTemplates since open isn't in template-list mode)
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-template-btn"));
    });

    const input = screen.getByTestId("template-name-input");
    fireEvent.change(input, { target: { value: "我的模板" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("template-save-confirm"));
    });

    await waitFor(() => {
      // Should have POST call for saving template
      const postCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === "object" && (c[1] as { method?: string }).method === "POST"
      );
      expect(postCalls.length).toBe(1);
      // Verify the payload includes the template name
      const payload = JSON.parse((postCalls[0][1] as { body: string }).body);
      expect(payload.name).toBe("我的模板");
      expect(payload.entries.length).toBe(1);
    });
  });
});
