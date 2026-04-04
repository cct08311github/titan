"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type ReadingList = {
  id: string;
  title: string;
  description: string | null;
  isDefault: boolean;
  creator: { id: string; name: string };
  _count: { items: number; assignments: number };
};

type ReadingListDetail = ReadingList & {
  items: { id: string; document: { id: string; title: string } }[];
  assignments: { id: string; user: { id: string; name: string } }[];
};

const inputCls =
  "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";

export function ReadingListSection() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, ReadingListDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reading-lists");
      if (res.ok) {
        const body = await res.json();
        setLists(extractItems<ReadingList>(body));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  async function loadDetail(id: string) {
    if (detailMap[id]) return;
    setLoadingDetail(id);
    try {
      const res = await fetch(`/api/reading-lists/${id}`);
      if (res.ok) {
        const body = await res.json();
        const detail = body?.data ?? body;
        setDetailMap((prev) => ({ ...prev, [id]: detail as ReadingListDetail }));
      }
    } finally {
      setLoadingDetail(null);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadDetail(id);
    }
  }

  async function createList() {
    if (!formTitle.trim()) return;
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/reading-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          isDefault: formIsDefault,
        }),
      });
      if (res.ok) {
        setFormTitle("");
        setFormDescription("");
        setFormIsDefault(false);
        setShowForm(false);
        setFormError("");
        fetchLists();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFormError(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreating(false);
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
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">閱讀清單</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">({lists.length} 個)</span>
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
          新增清單
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">新增閱讀清單</span>
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
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="清單標題"
              className={cn(inputCls, "flex-1 min-w-48")}
              autoFocus
            />
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="描述（選填）"
              className={cn(inputCls, "flex-1 min-w-48")}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              設為預設清單
            </label>
            <button
              onClick={createList}
              disabled={creating || !formTitle.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      )}

      {/* Lists table */}
      {expanded && (
        <div className={cn("px-4 pb-4", !showForm && "border-t border-border pt-3")}>
          {lists.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">尚無閱讀清單</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">標題</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">建立者</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">文件數</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">指派數</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((list) => (
                  <>
                    <tr
                      key={list.id}
                      className="border-b border-border/20 hover:bg-accent/20 cursor-pointer"
                      onClick={() => toggleExpand(list.id)}
                    >
                      <td className="py-1.5 px-2 font-medium text-foreground flex items-center gap-1.5">
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-muted-foreground transition-transform flex-shrink-0",
                            expandedId === list.id && "rotate-90"
                          )}
                        />
                        {list.title}
                        {list.isDefault && (
                          <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            預設
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{list.creator.name}</td>
                      <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                        {list._count.items}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                        {list._count.assignments}
                      </td>
                      <td className="py-1.5 px-2">
                        {loadingDetail === list.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                    {expandedId === list.id && detailMap[list.id] && (
                      <tr key={`${list.id}-detail`}>
                        <td colSpan={5} className="px-6 pb-3 pt-1 bg-accent/10">
                          <div className="flex gap-6">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                                文件
                              </p>
                              {detailMap[list.id].items.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground/60">尚無文件</p>
                              ) : (
                                <ul className="space-y-0.5">
                                  {detailMap[list.id].items.map((item) => (
                                    <li
                                      key={item.id}
                                      className="text-[11px] text-foreground"
                                    >
                                      {item.document.title}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                                指派對象
                              </p>
                              {detailMap[list.id].assignments.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground/60">尚未指派</p>
                              ) : (
                                <ul className="space-y-0.5">
                                  {detailMap[list.id].assignments.map((a) => (
                                    <li key={a.id} className="text-[11px] text-foreground">
                                      {a.user.name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
