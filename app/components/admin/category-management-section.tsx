"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/app/components/ui/alert-dialog";
import {
  Tag,
  Plus,
  Pencil,
  X,
  Loader2,
  RefreshCw,
  Check,
  ToggleLeft,
  ToggleRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CategoryManagementSection() {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Inline create form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const { ConfirmDialog, confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showInactive
        ? "/api/project-categories?includeInactive=true"
        : "/api/project-categories";
      const res = await fetch(url);
      if (!res.ok) throw new Error("載入類別失敗");
      const body = await res.json();
      setCategories(extractData<ProjectCategory[]>(body) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/project-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message || "新增失敗");
        return;
      }
      toast.success(`已新增類別「${newName.trim()}」`);
      setNewName("");
      await load();
    } catch {
      toast.error("新增失敗");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: ProjectCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sortOrder);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/project-categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), sortOrder: editSortOrder }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message || "更新失敗");
        return;
      }
      toast.success("類別已更新");
      setEditingId(null);
      await load();
    } catch {
      toast.error("更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat: ProjectCategory) {
    const action = cat.isActive ? "停用" : "啟用";
    if (cat.isActive) {
      const ok = await confirmDialog({
        title: `確定要停用「${cat.name}」？`,
        description: "停用後此類別將不再出現在下拉選單中",
        confirmLabel: "停用",
        cancelLabel: "取消",
        variant: "destructive",
      });
      if (!ok) return;
    }

    try {
      if (cat.isActive) {
        const res = await fetch(`/api/project-categories/${cat.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(`/api/project-categories/${cat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        if (!res.ok) throw new Error();
      }
      toast.success(`已${action}「${cat.name}」`);
      await load();
    } catch {
      toast.error(`${action}失敗`);
    }
  }

  if (loading) return <PageLoading message="載入類別..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          項目類別管理
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-border"
            />
            顯示停用
          </label>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            重新整理
          </button>
        </div>
      </div>

      {/* Inline add form */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="輸入新類別名稱..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          新增類別
        </button>
      </div>

      {/* Category table */}
      {categories.length === 0 ? (
        <PageEmpty
          icon={<Tag className="h-6 w-6" />}
          title="尚無項目類別"
          description="點擊「新增類別」建立第一個類別"
          className="py-8"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-12">排序</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">名稱</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground w-20">狀態</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((cat) => (
                  <tr key={cat.id} className={cn("hover:bg-accent/20 transition-colors", !cat.isActive && "opacity-50")}>
                    {editingId === cat.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={editSortOrder}
                            onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            className="w-full max-w-xs px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                            cat.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {cat.isActive ? "啟用" : "停用"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="儲存"
                            >
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-muted-foreground hover:bg-accent rounded transition-colors"
                              title="取消"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                            {cat.sortOrder}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">{cat.name}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                            cat.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {cat.isActive ? "啟用" : "停用"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(cat)}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                              title="編輯"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => toggleActive(cat)}
                              className={cn(
                                "p-1 rounded transition-colors",
                                cat.isActive
                                  ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                  : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              )}
                              title={cat.isActive ? "停用" : "啟用"}
                            >
                              {cat.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
