"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageError, PageEmpty, ListSkeleton } from "@/app/components/page-states";
import { formatRelative } from "@/lib/format";

interface ActivityItem {
  id: string;
  source: "task_activity" | "audit_log";
  action: string;
  userId: string | null;
  userName: string | null;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  detail: unknown;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "建立",
  UPDATE: "更新",
  DELETE: "刪除",
  STATUS_CHANGE: "變更狀態",
  COMMENT: "留言",
  ASSIGN: "指派",
  POST_TASKS: "建立任務",
  PATCH_TASKS: "更新任務",
  DELETE_TASK: "刪除任務",
  ROLE_CHANGE: "角色變更",
  PASSWORD_CHANGE: "密碼變更",
  LOGIN_FAILURE: "登入失敗",
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  task_activity: { label: "任務", className: "bg-blue-500/10 text-blue-500" },
  audit_log: { label: "系統", className: "bg-amber-500/10 text-amber-500" },
};

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/activity?page=${page}&limit=30`);
      if (!res.ok) throw new Error("活動紀錄載入失敗");
      const json = await res.json();
      const data = json?.data ?? json;
      setItems(data.items ?? []);
      setPagination(data.pagination ?? null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">團隊動態</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          查看團隊成員的最新操作紀錄
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <ListSkeleton rows={8} />
      ) : fetchError ? (
        <PageError message={fetchError} onRetry={fetchActivity} />
      ) : items.length === 0 ? (
        <PageEmpty
          icon={<Activity className="h-10 w-10" />}
          title="尚無活動紀錄"
          description="系統尚未記錄任何操作"
        />
      ) : (
        <>
          {/* Activity list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {items.map((item) => {
              const badge = SOURCE_BADGE[item.source];
              return (
                <div
                  key={`${item.source}-${item.id}`}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Who */}
                      <span className="text-sm font-medium text-foreground">
                        {item.userName ?? "系統"}
                      </span>

                      {/* Action */}
                      <span className="text-sm text-muted-foreground">
                        {getActionLabel(item.action)}
                      </span>

                      {/* Resource */}
                      {item.resourceName && (
                        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                          {item.resourceName}
                        </span>
                      )}

                      {/* Source badge */}
                      {badge && (
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>

                    {/* Detail */}
                    {typeof item.detail === "string" && item.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.detail}
                      </p>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {formatRelative(item.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                共 {pagination.total} 筆，第 {pagination.page}/{pagination.totalPages} 頁
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="上一頁"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="下一頁"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
