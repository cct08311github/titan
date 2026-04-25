"use client";

/**
 * useDeleteWithUndo — Issue #1539-12
 *
 * Wraps the timesheet hook's deleteEntry to add a 5-second undo toast.
 * Strategy: server-delete immediately, snapshot the entry locally, and if
 * the user clicks "復原" within 5s, recreate the same entry via saveEntry.
 *
 * Backend untouched. Restored entry gets a new id but is visually identical.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { OvertimeType, TimeEntry } from "./use-timesheet";

type SaveEntry = (
  taskId: string | null,
  date: string,
  hours: number,
  category: string,
  description: string,
  overtimeType: OvertimeType,
  existingId?: string,
  subTaskId?: string | null,
  startTime?: string | null,
  endTime?: string | null,
) => Promise<void>;

type DeleteEntry = (id: string) => Promise<void>;

interface UseDeleteWithUndoArgs {
  entries: TimeEntry[];
  deleteEntry: DeleteEntry;
  saveEntry: SaveEntry;
}

export function useDeleteWithUndo({
  entries,
  deleteEntry,
  saveEntry,
}: UseDeleteWithUndoArgs) {
  return useCallback(
    async (id: string) => {
      const original = entries.find((e) => e.id === id);
      await deleteEntry(id);
      if (!original) return;

      toast("已刪除工時", {
        duration: 5000,
        action: {
          label: "復原",
          onClick: async () => {
            try {
              await saveEntry(
                original.taskId,
                original.date.split("T")[0],
                Number(original.hours ?? 0),
                original.category,
                original.description ?? "",
                (original.overtimeType ?? "NONE"),
                undefined, // not editing existing
                original.subTaskId ?? null,
                original.startTime ?? null,
                original.endTime ?? null,
              );
              toast.success("已復原");
            } catch {
              toast.error("復原失敗，請手動重新建立");
            }
          },
        },
      });
    },
    [entries, deleteEntry, saveEntry],
  );
}
