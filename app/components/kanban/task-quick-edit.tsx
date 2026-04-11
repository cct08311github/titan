"use client";

/**
 * TaskQuickEdit — bulk action bar + template import dialog extracted from kanban/page.tsx.
 * Pure UI: all state and handlers come from the parent KanbanPage.
 */

import { Loader2, CheckSquare, X, FileInput, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TaskStatus } from "./kanban-board";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "BACKLOG", label: "待辦清單" },
  { value: "TODO", label: "待處理" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "REVIEW", label: "審核中" },
  { value: "DONE", label: "已完成" },
];

const PRIORITY_OPTIONS = [
  { value: "P0", label: "P0" },
  { value: "P1", label: "P1" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
];

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

export interface BulkToast {
  type: "success" | "error" | "partial";
  message: string;
}

export interface BulkActionBarProps {
  selectedCount: number;
  bulkLoading: boolean;
  users: { id: string; name: string }[];
  onBulkAction: (updates: Record<string, unknown>) => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  bulkLoading,
  users,
  onBulkAction,
  onClearSelection,
}: BulkActionBarProps) {
  return (
    <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <CheckSquare className="h-4 w-4" />
        已選取 {selectedCount} 項
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Batch status change */}
      <select
        className="text-sm border border-border rounded-md px-2 py-1 bg-background"
        defaultValue=""
        disabled={bulkLoading}
        onChange={(e) => {
          if (e.target.value) {
            onBulkAction({ status: e.target.value });
            e.target.value = "";
          }
        }}
        data-testid="bulk-status-select"
      >
        <option value="" disabled>批次移動狀態</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Change priority */}
      <select
        className="text-sm border border-border rounded-md px-2 py-1 bg-background"
        defaultValue=""
        disabled={bulkLoading}
        onChange={(e) => {
          if (e.target.value) {
            onBulkAction({ priority: e.target.value });
            e.target.value = "";
          }
        }}
      >
        <option value="" disabled>變更優先度</option>
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Batch assignee change */}
      <select
        className="text-sm border border-border rounded-md px-2 py-1 bg-background"
        defaultValue=""
        disabled={bulkLoading}
        onChange={(e) => {
          if (e.target.value) {
            const val = e.target.value === "__unassign__" ? null : e.target.value;
            onBulkAction({ primaryAssigneeId: val });
            e.target.value = "";
          }
        }}
        data-testid="bulk-assignee-select"
      >
        <option value="" disabled>批次指派</option>
        <option value="__unassign__">取消指派</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      {/* Bulk deadline (Issue #1071) */}
      <input
        type="date"
        onChange={(e) => {
          if (e.target.value) {
            onBulkAction({ dueDate: new Date(e.target.value).toISOString() });
            e.target.value = "";
          }
        }}
        className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground cursor-pointer"
        title="批次設定截止日"
      />

      {bulkLoading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}

      <button
        onClick={onClearSelection}
        className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        aria-label="取消選取"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Bulk Operation Toast ─────────────────────────────────────────────────────

export interface BulkOperationToastProps {
  toast: BulkToast;
}

export function BulkOperationToast({ toast }: BulkOperationToastProps) {
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
        toast.type === "success" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
        toast.type === "error" && "bg-red-500/10 text-red-400 border border-red-500/30",
        toast.type === "partial" && "bg-amber-500/10 text-amber-500 border border-amber-500/30"
      )}
      role="status"
      aria-live="polite"
      data-testid="bulk-toast"
    >
      {toast.type === "success" ? (
        <Check className="h-4 w-4" />
      ) : toast.type === "error" ? (
        <X className="h-4 w-4" />
      ) : (
        <CheckSquare className="h-4 w-4" />
      )}
      {toast.message}
    </div>
  );
}

// ─── Template Import Dialog ───────────────────────────────────────────────────

export interface TemplateImportDialogProps {
  importJson: string;
  importLoading: boolean;
  importError: string | null;
  onJsonChange: (value: string) => void;
  onImport: () => void;
  onClose: () => void;
}

export function TemplateImportDialog({
  importJson,
  importLoading,
  importError,
  onJsonChange,
  onImport,
  onClose,
}: TemplateImportDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileInput className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">從範本匯入任務</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>貼上 JSON 範本（陣列或含 tasks 欄位的物件）。每筆任務支援欄位：</p>
          <code className="block bg-muted/50 rounded px-2 py-1 text-[11px] leading-relaxed">
            {`{ "title": "任務名稱", "priority": "P1", "category": "PLANNED", "status": "BACKLOG", "offsetDays": 7 }`}
          </code>
        </div>

        <textarea
          value={importJson}
          onChange={(e) => { onJsonChange(e.target.value); }}
          placeholder={`[\n  { "title": "任務一", "priority": "P1" },\n  { "title": "任務二", "offsetDays": 3 }\n]`}
          rows={8}
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
        />

        {importError && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <X className="h-3 w-3 shrink-0" />
            {importError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={onImport}
            disabled={importLoading || !importJson.trim()}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            匯入
          </button>
        </div>
      </div>
    </div>
  );
}
