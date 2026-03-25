"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FileText, Save, ChevronDown, Trash2, X } from "lucide-react";
import { type TimeEntry } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateEntry = {
  hours: number;
  category?: string;
  taskId?: string;
  description?: string;
};

type Template = {
  id: string;
  name: string;
  entries: string; // JSON-stringified TemplateEntry[]
  createdAt: string;
};

type TemplateSelectorProps = {
  weekStart: Date;
  entries: TimeEntry[];
  daysCount: number;
  getDateStr: (offset: number) => string;
  onRefresh: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTemplateEntries(raw: string): TemplateEntry[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateSelector({
  weekStart,
  entries,
  daysCount,
  getDateStr,
  onRefresh,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [confirmTemplate, setConfirmTemplate] = useState<Template | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/time-entries/templates");
      if (res.ok) {
        const body = await res.json();
        const data = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setTemplates(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSaveMode(false);
        setConfirmTemplate(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Clear feedback after delay
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(t);
  }, [feedback]);

  // Apply template to current week (fill only empty cells)
  async function handleApply(template: Template) {
    setApplying(true);
    setConfirmTemplate(null);
    try {
      const templateEntries = parseTemplateEntries(template.entries);
      let totalCreated = 0;

      // Apply to each day of the week
      for (let dayOffset = 0; dayOffset < daysCount; dayOffset++) {
        const dateStr = getDateStr(dayOffset);
        // Get existing entries for this date
        const existingOnDate = entries.filter(
          (e) => e.date.split("T")[0] === dateStr
        );
        // Skip locked entries check
        const hasLockedOnDate = existingOnDate.some((e) => e.locked);
        if (hasLockedOnDate) continue;

        // Only apply if the day has no existing entries (fill empty cells only)
        if (existingOnDate.length > 0) continue;

        // Apply template for this date
        const res = await fetch(`/api/time-entries/templates/${template.id}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr }),
        });
        if (res.ok) {
          const body = await res.json();
          const created = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
          totalCreated += created.length;
        }
      }

      if (totalCreated > 0) {
        setFeedback({ type: "success", msg: `已套用模板，新增 ${totalCreated} 筆記錄` });
        onRefresh();
      } else {
        setFeedback({ type: "success", msg: "所有日期已有記錄，未新增任何項目" });
      }
    } catch {
      setFeedback({ type: "error", msg: "套用模板失敗" });
    } finally {
      setApplying(false);
      setOpen(false);
    }
  }

  // Save current week as template
  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      // Collect unique entry patterns from the current week (deduplicate by taskId+category)
      const seen = new Set<string>();
      const templateEntries: TemplateEntry[] = [];
      for (const e of entries) {
        if (e.locked) continue; // Don't include locked entries in template
        const key = `${e.taskId ?? "null"}-${e.category}`;
        if (seen.has(key)) continue;
        seen.add(key);
        templateEntries.push({
          hours: e.hours,
          category: e.category,
          taskId: e.taskId ?? undefined,
          description: e.description ?? undefined,
        });
      }

      if (templateEntries.length === 0) {
        setFeedback({ type: "error", msg: "本週無可儲存的記錄" });
        return;
      }

      const res = await fetch("/api/time-entries/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          entries: templateEntries,
        }),
      });

      if (res.ok) {
        setFeedback({ type: "success", msg: `模板「${saveName.trim()}」已儲存` });
        setSaveMode(false);
        setSaveName("");
        loadTemplates();
      } else {
        const body = await res.json().catch(() => ({}));
        setFeedback({ type: "error", msg: body?.error ?? "儲存模板失敗" });
      }
    } finally {
      setSaving(false);
    }
  }

  // Delete template
  async function handleDelete(templateId: string) {
    const res = await fetch(`/api/time-entries/templates/${templateId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setFeedback({ type: "success", msg: "模板已刪除" });
    }
  }

  return (
    <div ref={ref} className="relative" data-testid="template-selector">
      {/* Trigger buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setOpen(!open);
            setSaveMode(false);
            setConfirmTemplate(null);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
            "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          data-testid="template-btn"
        >
          <FileText className="h-3.5 w-3.5" />
          模板
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>

        <button
          onClick={() => {
            setOpen(true);
            setSaveMode(true);
            setConfirmTemplate(null);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
            "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          data-testid="save-template-btn"
        >
          <Save className="h-3.5 w-3.5" />
          儲存為模板
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl p-2" data-testid="template-dropdown">
          {saveMode ? (
            /* Save as template form */
            <div className="space-y-2 p-1" data-testid="save-template-form">
              <div className="text-xs font-medium text-foreground">儲存本週為模板</div>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="輸入模板名稱..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") { setSaveMode(false); setOpen(false); }
                }}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="template-name-input"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !saveName.trim()}
                  className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
                  data-testid="template-save-confirm"
                >
                  {saving ? "儲存中..." : "儲存"}
                </button>
                <button
                  onClick={() => { setSaveMode(false); setOpen(false); }}
                  className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : confirmTemplate ? (
            /* Confirmation dialog */
            <div className="space-y-2 p-1" data-testid="template-confirm">
              <div className="text-xs font-medium text-foreground">
                確定要套用模板「{confirmTemplate.name}」？
              </div>
              <p className="text-[10px] text-muted-foreground">
                僅填入空白日期，已有記錄的日期不受影響。鎖定的日期將被跳過。
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApply(confirmTemplate)}
                  disabled={applying}
                  className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
                  data-testid="template-apply-confirm"
                >
                  {applying ? "套用中..." : "確定套用"}
                </button>
                <button
                  onClick={() => setConfirmTemplate(null)}
                  className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            /* Template list */
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground px-2 py-1">我的模板</div>
              {loading ? (
                <div className="text-xs text-muted-foreground/60 text-center py-4">載入中...</div>
              ) : templates.length === 0 ? (
                <div className="text-xs text-muted-foreground/60 text-center py-4">
                  尚無模板，點擊「儲存為模板」建立
                </div>
              ) : (
                templates.map((t) => {
                  const entryCount = parseTemplateEntries(t.entries).length;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 group"
                      data-testid={`template-item-${t.id}`}
                    >
                      <button
                        onClick={() => setConfirmTemplate(t)}
                        className="flex-1 text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/50 rounded-md transition-colors truncate"
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                          ({entryCount} 筆)
                        </span>
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1 text-muted-foreground/40 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="刪除模板"
                        data-testid={`template-delete-${t.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          )}
          data-testid="template-feedback"
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}
