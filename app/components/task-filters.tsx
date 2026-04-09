"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, X, ArrowUpDown, Bookmark, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems, extractData } from "@/lib/api-client";
import { useRouter, usePathname } from "next/navigation";

export type TaskFilters = {
  assignee: string;
  priority: string;
  category: string;
  tags: string[];
  dueDateFrom: string;
  dueDateTo: string;
  createdAtFrom: string;
  createdAtTo: string;
  completedAtFrom: string;
  completedAtTo: string;
  sortBy: string;
  sortOrder: string;
};

export const emptyFilters: TaskFilters = {
  assignee: "",
  priority: "",
  category: "",
  tags: [],
  dueDateFrom: "",
  dueDateTo: "",
  createdAtFrom: "",
  createdAtTo: "",
  completedAtFrom: "",
  completedAtTo: "",
  sortBy: "",
  sortOrder: "",
};

const SORT_OPTIONS = [
  { value: "", label: "預設排序" },
  { value: "dueDate:asc", label: "到期日（近→遠）" },
  { value: "dueDate:desc", label: "到期日（遠→近）" },
  { value: "priority:asc", label: "優先度（高→低）" },
  { value: "createdAt:desc", label: "建立日期（新→舊）" },
];

type User = { id: string; name: string };
type TagOption = { name: string; color: string };

type SavedFilter = {
  id: string;
  name: string;
  scope: "kanban" | "timesheet" | "plans";
  filters: Record<string, unknown>;
  createdAt: string;
};

interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  /** Total tasks count (before filter) */
  totalCount?: number;
  /** Filtered tasks count */
  filteredCount?: number;
  /** Whether to sync filters to URL query string */
  syncUrl?: boolean;
  /** Scope for saved filters (default: 'kanban') */
  scope?: "kanban" | "timesheet" | "plans";
}

const priorities = [
  { value: "", label: "所有優先度" },
  { value: "P0", label: "P0 緊急" },
  { value: "P1", label: "P1 高" },
  { value: "P2", label: "P2 中" },
  { value: "P3", label: "P3 低" },
];

const categories = [
  { value: "", label: "所有分類" },
  { value: "PLANNED", label: "原始規劃" },
  { value: "ADDED", label: "追加任務" },
  { value: "INCIDENT", label: "突發事件" },
  { value: "SUPPORT", label: "用戶支援" },
  { value: "ADMIN", label: "行政庶務" },
  { value: "LEARNING", label: "學習成長" },
];

/**
 * Parse filters from URL search params.
 */
export function parseFiltersFromUrl(searchParams: URLSearchParams): TaskFilters {
  const sortBy = searchParams.get("sortBy") ?? "";
  const sortOrder = searchParams.get("order") ?? "";
  return {
    assignee: searchParams.get("assignee") ?? "",
    priority: searchParams.get("priority") ?? "",
    category: searchParams.get("category") ?? "",
    tags: searchParams.get("tags")?.split(",").filter(Boolean) ?? [],
    dueDateFrom: searchParams.get("dueDateFrom") ?? "",
    dueDateTo: searchParams.get("dueDateTo") ?? "",
    createdAtFrom: searchParams.get("createdAtFrom") ?? "",
    createdAtTo: searchParams.get("createdAtTo") ?? "",
    completedAtFrom: searchParams.get("completedAtFrom") ?? "",
    completedAtTo: searchParams.get("completedAtTo") ?? "",
    sortBy,
    sortOrder,
  };
}

/**
 * Serialize filters to URL search params string.
 */
export function serializeFiltersToUrl(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.category) params.set("category", filters.category);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
  if (filters.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
  if (filters.createdAtFrom) params.set("createdAtFrom", filters.createdAtFrom);
  if (filters.createdAtTo) params.set("createdAtTo", filters.createdAtTo);
  if (filters.completedAtFrom) params.set("completedAtFrom", filters.completedAtFrom);
  if (filters.completedAtTo) params.set("completedAtTo", filters.completedAtTo);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("order", filters.sortOrder);
  return params.toString();
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return !!(
    filters.assignee ||
    filters.priority ||
    filters.category ||
    filters.tags.length > 0 ||
    filters.dueDateFrom ||
    filters.dueDateTo ||
    filters.createdAtFrom ||
    filters.createdAtTo ||
    filters.completedAtFrom ||
    filters.completedAtTo ||
    filters.sortBy
  );
}

export function TaskFilters({ filters, onChange, totalCount, filteredCount, syncUrl, scope = "kanban" }: TaskFiltersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedFilterOpen, setSavedFilterOpen] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => setUsers(extractItems<User>(body)))
      .catch(() => { toast.error("使用者清單載入失敗"); });
  }, []);

  useEffect(() => {
    fetch("/api/tasks/tags")
      .then((r) => r.json())
      .then((body) => {
        const data = extractData<{ tags: TagOption[] }>(body);
        setTags(data?.tags ?? []);
      })
      .catch(() => { toast.error("標籤清單載入失敗"); });
  }, []);

  // Sync filters to URL
  useEffect(() => {
    if (!syncUrl) return;
    const qs = serializeFiltersToUrl(filters);
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [filters, syncUrl, pathname, router]);

  // Load saved filters on mount
  useEffect(() => {
    fetch("/api/users/me/filters")
      .then((r) => r.json())
      .then((body) => {
        const data = extractData<{ filters: SavedFilter[] }>(body);
        if (data?.filters) setSavedFilters(data.filters);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  const persistSavedFilters = useCallback(async (next: SavedFilter[]) => {
    try {
      const res = await fetch("/api/users/me/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
      setSavedFilters(next);
    } catch {
      toast.error("儲存篩選條件失敗");
    }
  }, []);

  const handleSaveFilter = useCallback(async () => {
    const name = savingName.trim();
    if (!name) return;
    const newEntry: SavedFilter = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      scope,
      filters: filters as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    await persistSavedFilters([...savedFilters, newEntry]);
    setSavingName("");
    setShowSaveInput(false);
    toast.success(`已儲存篩選「${name}」`);
  }, [savingName, scope, filters, savedFilters, persistSavedFilters]);

  const handleDeleteSavedFilter = useCallback(async (id: string) => {
    await persistSavedFilters(savedFilters.filter((f) => f.id !== id));
  }, [savedFilters, persistSavedFilters]);

  const handleApplySavedFilter = useCallback((saved: SavedFilter) => {
    onChange(saved.filters as unknown as TaskFilters);
    setSavedFilterOpen(false);
  }, [onChange]);

  const scopedSaved = savedFilters.filter((f) => f.scope === scope);

  const active = hasActiveFilters(filters);

  const clearFilters = () => onChange({ ...emptyFilters });

  function toggleTag(tagName: string) {
    const newTags = filters.tags.includes(tagName)
      ? filters.tags.filter((t) => t !== tagName)
      : [...filters.tags, tagName];
    onChange({ ...filters, tags: newTags });
  }

  const selectCls =
    "h-9 bg-card border border-border text-foreground text-sm rounded-lg px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer hover:border-muted-foreground/30 transition-all shadow-sm";

  const dateCls =
    "h-9 bg-card border border-border text-foreground text-sm rounded-lg px-2.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Saved filters */}
        <div className="relative">
          <button
            onClick={() => setSavedFilterOpen((v) => !v)}
            className={cn(
              selectCls,
              "flex items-center gap-1.5",
              scopedSaved.length > 0 && savedFilterOpen && "border-primary/50"
            )}
            title="儲存的篩選條件"
          >
            <Bookmark className="h-3.5 w-3.5" />
            {scopedSaved.length > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground">{scopedSaved.length}</span>
            )}
          </button>
          {savedFilterOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-56 bg-card border border-border rounded-lg shadow-xl p-2">
              {scopedSaved.length === 0 && !showSaveInput && (
                <div className="text-xs text-muted-foreground px-2 py-1">尚無儲存的篩選</div>
              )}
              {scopedSaved.map((sf) => (
                <div key={sf.id} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded hover:bg-accent/30 group">
                  <button
                    className="flex-1 text-left text-xs text-foreground truncate"
                    onClick={() => handleApplySavedFilter(sf)}
                  >
                    {sf.name}
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => handleDeleteSavedFilter(sf.id)}
                    title="刪除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {showSaveInput ? (
                <div className="flex items-center gap-1 mt-1 px-1">
                  <input
                    autoFocus
                    value={savingName}
                    onChange={(e) => setSavingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveFilter(); if (e.key === "Escape") { setShowSaveInput(false); setSavingName(""); } }}
                    placeholder="篩選名稱"
                    maxLength={50}
                    className="flex-1 h-7 text-xs bg-background border border-border rounded px-2 focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleSaveFilter}
                    className="text-xs text-primary hover:underline"
                  >
                    儲存
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 w-full mt-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  儲存目前篩選
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">篩選</span>
        </div>

        {/* Assignee */}
        <select
          aria-label="篩選負責人"
          value={filters.assignee}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
          className={selectCls}
        >
          <option value="">所有成員</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Priority */}
        <select
          aria-label="篩選優先度"
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value })}
          className={selectCls}
        >
          {priorities.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Category */}
        <select
          aria-label="篩選分類"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className={selectCls}
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Tags multi-select dropdown */}
        <div className="relative">
          <button
            onClick={() => setTagDropdownOpen((v) => !v)}
            className={cn(
              selectCls,
              "flex items-center gap-1.5 min-w-[100px]",
              filters.tags.length > 0 && "border-primary/50"
            )}
          >
            標籤
            {filters.tags.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {filters.tags.length}
              </span>
            )}
          </button>
          {tagDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 z-50 w-48 bg-card border border-border rounded-lg shadow-xl p-2 max-h-48 overflow-y-auto">
              {tags.map((tag) => (
                <label
                  key={tag.name}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(tag.name)}
                    onChange={() => toggleTag(tag.name)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-foreground">{tag.name}</span>
                </label>
              ))}
              {tags.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">無標籤</div>
              )}
            </div>
          )}
        </div>

        {/* Due date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="到期日起始"
            value={filters.dueDateFrom}
            onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value })}
            className={dateCls}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="到期日結束"
            value={filters.dueDateTo}
            onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value })}
            className={dateCls}
          />
        </div>

        {/* Created date range — Issue #861 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">建立</span>
          <input
            type="date"
            aria-label="建立日期起始"
            value={filters.createdAtFrom}
            onChange={(e) => onChange({ ...filters, createdAtFrom: e.target.value })}
            className={dateCls}
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="建立日期結束"
            value={filters.createdAtTo}
            onChange={(e) => onChange({ ...filters, createdAtTo: e.target.value })}
            className={dateCls}
          />
        </div>

        {/* Quick date buttons — Issue #861 */}
        <div className="flex items-center gap-1">
          {[
            { label: "近7天", days: 7 },
            { label: "近30天", days: 30 },
            { label: "近3個月", days: 90 },
            { label: "近6個月", days: 180 },
          ].map(({ label, days }) => (
            <button
              key={days}
              onClick={() => {
                const to = new Date();
                const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
                onChange({
                  ...filters,
                  createdAtFrom: from.toISOString().split("T")[0],
                  createdAtTo: to.toISOString().split("T")[0],
                });
              }}
              className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            aria-label="排序方式"
            value={filters.sortBy && filters.sortOrder ? `${filters.sortBy}:${filters.sortOrder}` : filters.sortBy}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onChange({ ...filters, sortBy: "", sortOrder: "" });
              } else {
                const [sortBy, sortOrder] = val.split(":");
                onChange({ ...filters, sortBy, sortOrder: sortOrder ?? "" });
              }
            }}
            className={selectCls}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {active && (
          <button
            onClick={clearFilters}
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors",
              "px-2 py-1.5 rounded-md border border-border hover:border-border/60 bg-background"
            )}
          >
            <X className="h-3 w-3" />
            清除篩選
          </button>
        )}
      </div>

      {/* Filter count indicator */}
      {active && totalCount !== undefined && filteredCount !== undefined && (
        <div className="text-xs text-muted-foreground">
          顯示 {filteredCount}/{totalCount} 筆任務
        </div>
      )}
    </div>
  );
}
