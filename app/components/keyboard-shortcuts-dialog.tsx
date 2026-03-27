"use client";

/**
 * KeyboardShortcutsDialog — Global keyboard shortcuts help overlay
 *
 * Triggered by pressing `?` key (when not in input/textarea/contenteditable).
 * Shows all available keyboard shortcuts grouped by category.
 * Closes on Escape or clicking the backdrop.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Shortcut Definitions ────────────────────────────────────────────────────

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "導航",
    shortcuts: [
      { keys: ["G", "D"], description: "前往儀表板" },
      { keys: ["G", "K"], description: "前往任務看板" },
      { keys: ["G", "G"], description: "前往甘特圖" },
      { keys: ["G", "P"], description: "前往年度計畫" },
      { keys: ["G", "I"], description: "前往 KPI" },
      { keys: ["G", "B"], description: "前往知識庫" },
      { keys: ["G", "T"], description: "前往工時紀錄" },
      { keys: ["G", "R"], description: "前往報表" },
    ],
  },
  {
    title: "操作",
    shortcuts: [
      { keys: ["⌘", "K"], description: "開啟快速搜尋" },
      { keys: ["Ctrl", "Enter"], description: "送出表單" },
      { keys: ["Tab"], description: "工時表格快速切換格子" },
      { keys: ["Esc"], description: "關閉對話框 / 取消" },
    ],
  },
  {
    title: "檢視",
    shortcuts: [
      { keys: ["?"], description: "顯示快捷鍵說明（本視窗）" },
      { keys: ["↑", "↓"], description: "搜尋結果中上下選擇" },
      { keys: ["Enter"], description: "搜尋結果中前往選取項目" },
    ],
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setOpen(false), []);

  // Listen for `?` key to open; ignore when typing in inputs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Close on Escape — stop propagation to prevent bubbling to other modals
      if (e.key === "Escape" && open) {
        e.stopPropagation();
        setOpen(false);
        return;
      }

      // Don't trigger when typing in form elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger when modifier keys are held (avoid conflicts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus the dialog container when it opens
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  // Basic focus trap: wrap Tab from last to first focusable element
  useEffect(() => {
    if (!open) return;
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === dialogRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-xl mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="鍵盤快捷鍵"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              鍵盤快捷鍵
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category.title}
                </h3>
                <ul className="space-y-2">
                  {category.shortcuts.map((shortcut, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, ki) => (
                          <span key={ki} className="flex items-center gap-0.5">
                            {ki > 0 && (
                              <span className="text-[10px] text-muted-foreground mx-0.5">
                                +
                              </span>
                            )}
                            <kbd
                              className={cn(
                                "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5",
                                "text-xs font-mono font-medium",
                                "rounded border border-border bg-muted/60 text-foreground",
                                "shadow-[0_1px_0_1px_hsl(var(--border))]"
                              )}
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <p className="text-[11px] text-muted-foreground text-center">
            按 <kbd className="border border-border rounded px-1 py-0.5 text-[10px] mx-0.5">?</kbd> 或{" "}
            <kbd className="border border-border rounded px-1 py-0.5 text-[10px] mx-0.5">Esc</kbd> 關閉此視窗
          </p>
        </div>
      </div>
    </div>
  );
}
