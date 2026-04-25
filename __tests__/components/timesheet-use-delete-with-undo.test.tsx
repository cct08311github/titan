/**
 * @jest-environment jsdom
 */
/**
 * Tests: useDeleteWithUndo hook (Issue #1539-12)
 *
 * Covers:
 * - Server delete called with correct id
 * - Toast shown with action button after delete
 * - Click "復原" recreates the entry via saveEntry with original fields
 * - Missing entry (already deleted by another tab) doesn't crash
 * - Undo failure shows error toast
 * - Decimal-as-string hours coerced via Number()
 */
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useDeleteWithUndo } from "@/app/components/timesheet/use-delete-with-undo";
import type { TimeEntry } from "@/app/components/timesheet/use-timesheet";

const mockToast = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    {
      success: (...args: unknown[]) => mockToastSuccess(...args),
      error: (...args: unknown[]) => mockToastError(...args),
    },
  ),
}));

const SAMPLE_ENTRY: TimeEntry = {
  id: "e1",
  taskId: "t1",
  date: "2026-04-25T00:00:00Z",
  hours: 2.5,
  category: "PLANNED_TASK",
  description: "fix prod bug",
  startTime: "10:00",
  endTime: "12:30",
  overtimeType: "NONE",
  subTaskId: "st1",
};

describe("useDeleteWithUndo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls deleteEntry with the given id", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [SAMPLE_ENTRY], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e1");
    });

    expect(deleteEntry).toHaveBeenCalledWith("e1");
  });

  it("shows undo toast after delete", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [SAMPLE_ENTRY], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e1");
    });

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast.mock.calls[0][0]).toBe("已刪除工時");
    const toastOptions = mockToast.mock.calls[0][1];
    expect(toastOptions.duration).toBe(5000);
    expect(toastOptions.action.label).toBe("復原");
    expect(typeof toastOptions.action.onClick).toBe("function");
  });

  it("recreates entry via saveEntry when undo clicked", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [SAMPLE_ENTRY], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e1");
    });

    const undoFn = mockToast.mock.calls[0][1].action.onClick;
    await act(async () => {
      await undoFn();
    });

    expect(saveEntry).toHaveBeenCalledWith(
      "t1",                    // taskId
      "2026-04-25",            // date (split off T)
      2.5,                     // hours coerced
      "PLANNED_TASK",          // category
      "fix prod bug",          // description
      "NONE",                  // overtimeType
      undefined,               // existingId (not editing)
      "st1",                   // subTaskId
      "10:00",                 // startTime
      "12:30",                 // endTime
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("已復原");
  });

  it("shows error toast when undo fails", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockRejectedValue(new Error("save failed"));
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [SAMPLE_ENTRY], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e1");
    });

    const undoFn = mockToast.mock.calls[0][1].action.onClick;
    await act(async () => {
      await undoFn();
    });

    expect(mockToastError).toHaveBeenCalledWith("復原失敗，請手動重新建立");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("doesn't crash when entry not found in entries array", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("nonexistent");
    });

    expect(deleteEntry).toHaveBeenCalledWith("nonexistent");
    // No toast shown because entry wasn't found
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("coerces Decimal-as-string hours via Number()", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const entryWithStringHours = { ...SAMPLE_ENTRY, hours: "3.5" as unknown as number };
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [entryWithStringHours], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e1");
    });

    const undoFn = mockToast.mock.calls[0][1].action.onClick;
    await act(async () => {
      await undoFn();
    });

    const callArgs = saveEntry.mock.calls[0];
    expect(callArgs[2]).toBe(3.5); // hours coerced to number
  });

  it("handles missing optional fields gracefully", async () => {
    const deleteEntry = jest.fn().mockResolvedValue(undefined);
    const saveEntry = jest.fn().mockResolvedValue(undefined);
    const minimalEntry: TimeEntry = {
      id: "e2",
      taskId: null, // free entry
      date: "2026-04-25",
      hours: 1,
      category: "ADMIN",
      description: null,
    };
    const { result } = renderHook(() =>
      useDeleteWithUndo({ entries: [minimalEntry], deleteEntry, saveEntry })
    );

    await act(async () => {
      await result.current("e2");
    });

    const undoFn = mockToast.mock.calls[0][1].action.onClick;
    await act(async () => {
      await undoFn();
    });

    expect(saveEntry).toHaveBeenCalledWith(
      null, // taskId
      "2026-04-25",
      1,
      "ADMIN",
      "", // description fallback
      "NONE", // overtimeType fallback
      undefined,
      null, // subTaskId
      null, // startTime
      null, // endTime
    );
  });
});
