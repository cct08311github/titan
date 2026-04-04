"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type DocumentTemplate = {
  id: string;
  title: string;
  content: string;
  category: string;
  isSystem: boolean;
  creator: { id: string; name: string };
};

const inputCls =
  "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";
const selectCls =
  "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer";

export function DocumentTemplatePicker() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formContent, setFormContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const url = categoryFilter
        ? `/api/document-templates?category=${encodeURIComponent(categoryFilter)}`
        : "/api/document-templates";
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        setTemplates(extractItems<DocumentTemplate>(body));
      }
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function createTemplate() {
    if (!formTitle.trim() || !formCategory.trim() || !formContent.trim()) return;
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          category: formCategory.trim(),
          content: formContent.trim(),
        }),
      });
      if (res.ok) {
        setFormTitle("");
        setFormCategory("");
        setFormContent("");
        setShowForm(false);
        setFormError("");
        fetchTemplates();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFormError(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreating(false);
    }
  }

  // Derive unique categories from loaded templates
  const categories = Array.from(new Set(templates.map((t) => t.category))).sort();

  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) : null;

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">文件範本</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">({templates.length} 個)</span>
          )}
        </button>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setFormError("");
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
        >
          <Plus className="h-3 w-3" />
          新增範本
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">新增文件範本</span>
            <button
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="範本標題"
              className={cn(inputCls, "flex-1 min-w-48")}
              autoFocus
            />
            <input
              type="text"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="分類（例如：SOP、會議紀錄）"
              className={cn(inputCls, "flex-1 min-w-48")}
            />
          </div>
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="範本內容（Markdown）"
            rows={5}
            className={cn(inputCls, "w-full resize-y font-mono text-xs")}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={createTemplate}
              disabled={creating || !formTitle.trim() || !formCategory.trim() || !formContent.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      )}

      {/* Template grid / table */}
      {expanded && (
        <div className={cn("px-4 pb-4", !showForm && "border-t border-border pt-3")}>
          {/* Category filter */}
          <div className="mb-3">
            <select
              aria-label="分類篩選"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSelectedId(null);
              }}
              className={cn(selectCls, "text-xs py-1 w-48")}
            >
              <option value="">所有分類</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {templates.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">尚無文件範本</p>
          ) : (
            <>
              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">標題</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">分類</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">類型</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">建立者</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr
                      key={tpl.id}
                      onClick={() => setSelectedId(selectedId === tpl.id ? null : tpl.id)}
                      className={cn(
                        "border-b border-border/20 cursor-pointer transition-colors",
                        selectedId === tpl.id
                          ? "bg-accent/40"
                          : "hover:bg-accent/20"
                      )}
                    >
                      <td className="py-1.5 px-2 font-medium text-foreground">{tpl.title}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{tpl.category}</td>
                      <td className="py-1.5 px-2">
                        {tpl.isSystem ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            系統
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            自訂
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{tpl.creator.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Content preview panel */}
              {selectedTemplate && (
                <div className="border border-border rounded-lg bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">
                      預覽：{selectedTemplate.title}
                    </span>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                    {selectedTemplate.content}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
