"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, ChevronRight, LayoutTemplate, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type Priority = "P0" | "P1" | "P2" | "P3";
type Category = "PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";

type TaskTemplate = {
  id: string;
  title: string;
  description?: string | null;
  priority: Priority;
  category: Category;
  estimatedHours?: number | null;
  creator: { id: string; name: string };
  createdAt: string;
};

const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "P0", P1: "P1", P2: "P2", P3: "P3",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  P0: "text-red-400",
  P1: "text-orange-400",
  P2: "text-blue-400",
  P3: "text-muted-foreground",
};

const CATEGORY_LABEL: Record<Category, string> = {
  PLANNED: "計畫性",
  ADDED: "新增需求",
  INCIDENT: "事件",
  SUPPORT: "支援",
  ADMIN: "行政",
  LEARNING: "學習",
};

const inputCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";
const selectCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer";

export function TaskTemplateSection() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<Priority>("P2");
  const [formCategory, setFormCategory] = useState<Category>("PLANNED");
  const [formEstimatedHours, setFormEstimatedHours] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/task-templates?page=1&limit=20");
      if (res.ok) {
        const body = await res.json();
        setTemplates(extractItems<TaskTemplate>(body));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormPriority("P2");
    setFormCategory("PLANNED");
    setFormEstimatedHours("");
  }

  async function createTemplate() {
    if (!formTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          priority: formPriority,
          category: formCategory,
          estimatedHours: formEstimatedHours ? Number(formEstimatedHours) : undefined,
        }),
      });
      if (res.ok) {
        toast.success("範本已建立");
        resetForm();
        setShowForm(false);
        fetchTemplates();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("確定要刪除此範本？")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("範本已刪除");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error("刪除失敗");
      }
    } finally {
      setDeleting(null);
    }
  }

  async function applyTemplate(id: string) {
    if (!confirm("確定要從此範本建立任務？")) return;
    setApplying(id);
    try {
      const res = await fetch(`/api/task-templates/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success("任務已建立");
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "建立任務失敗");
      }
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">任務範本</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">({templates.length} 個)</span>
          )}
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
        >
          <Plus className="h-3 w-3" />
          建立範本
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">新增任務範本</span>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="範本標題（必填）"
            className={cn(inputCls, "w-full")}
            autoFocus
          />
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="說明（選填）"
            rows={2}
            className={cn(inputCls, "w-full resize-none")}
          />
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="優先級"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as Priority)}
              className={cn(selectCls, "w-24")}
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
            <select
              aria-label="類別"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as Category)}
              className={cn(selectCls, "flex-1 min-w-32")}
            >
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <input
              type="number"
              value={formEstimatedHours}
              onChange={(e) => setFormEstimatedHours(e.target.value)}
              placeholder="預估工時（hr）"
              min={0}
              step={0.5}
              className={cn(inputCls, "w-36")}
            />
            <button
              onClick={createTemplate}
              disabled={creating || !formTitle.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
        </div>
      )}

      {/* Template table */}
      {expanded && (
        <div className={cn("px-4 pb-4", !showForm && "border-t border-border pt-3")}>
          {templates.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">尚無任務範本</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">標題</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">優先</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">類別</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">工時</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">建立者</th>
                  <th className="py-1.5 px-2" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-border/20 hover:bg-accent/20">
                    <td className="py-1.5 px-2 font-medium text-foreground">{t.title}</td>
                    <td className={cn("py-1.5 px-2 font-medium", PRIORITY_COLOR[t.priority])}>
                      {PRIORITY_LABEL[t.priority]}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground">{CATEGORY_LABEL[t.category]}</td>
                    <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                      {t.estimatedHours != null ? `${t.estimatedHours}h` : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground">{t.creator.name}</td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => applyTemplate(t.id)}
                          disabled={applying === t.id}
                          title="套用範本建立任務"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          {applying === t.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          disabled={deleting === t.id}
                          title="刪除範本"
                          className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          {deleting === t.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
