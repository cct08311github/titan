"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageEmpty, ListSkeleton } from "@/app/components/page-states";
import { ActivityItem, type ActivityItemData } from "@/app/components/activity-item";
import { getDateGroupLabel } from "@/lib/utils/activity-formatter";

// ── Types ──────────────────────────────────────────────────────────────────

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ActivityResponse {
  items: ActivityItemData[];
  pagination: PaginationMeta;
}

// ── Date Group Separator ───────────────────────────────────────────────────

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function ActivityTimeline() {
  const [items, setItems] = useState<ActivityItemData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Keep latest scroll-guard state in refs so the observer callback always
  // reads fresh values without being recreated on every render.
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  const pageRef = useRef(page);

  // Sync refs on every render
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  loadingRef.current = loading;
  pageRef.current = page;

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const res = await fetch(
          `/api/activity?page=${pageNum}&limit=${PAGE_SIZE}`
        );
        if (!res.ok) throw new Error("活動紀錄載入失敗");
        const body = await res.json();
        const data = extractData<ActivityResponse>(body);
        const newItems = data?.items ?? [];
        const pagination = data?.pagination;

        if (append) {
          setItems((prev) => {
            // Deduplicate by composite key (source + id)
            const existingKeys = new Set(
              prev.map((it) => `${it.source}-${it.id}`)
            );
            const unique = newItems.filter(
              (it) => !existingKeys.has(`${it.source}-${it.id}`)
            );
            return [...prev, ...unique];
          });
        } else {
          setItems(newItems);
        }

        const totalPages = pagination?.totalPages ?? 1;
        setHasMore(pageNum < totalPages);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "載入失敗");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  // Infinite scroll: build observer once; read latest state through refs.
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          hasMoreRef.current &&
          !loadingMoreRef.current &&
          !loadingRef.current
        ) {
          const nextPage = pageRef.current + 1;
          setPage(nextPage);
          fetchPage(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]); // fetchPage is stable (useCallback with empty deps)

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading && items.length === 0) {
    return <ListSkeleton rows={8} />;
  }

  if (fetchError && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <button
          onClick={() => {
            setPage(1);
            fetchPage(1, false);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm hover:shadow transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重試
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <PageEmpty
        icon={<Activity className="h-10 w-10" />}
        title="尚無活動紀錄"
        description="系統尚未記錄任何操作，當團隊開始使用後將自動紀錄"
      />
    );
  }

  // Group items by date
  const grouped: { label: string; items: ActivityItemData[] }[] = [];
  let currentLabel = "";

  for (const item of items) {
    const label = getDateGroupLabel(item.createdAt);
    if (label !== currentLabel) {
      currentLabel = label;
      grouped.push({ label, items: [item] });
    } else {
      grouped[grouped.length - 1].items.push(item);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {grouped.map((group) => (
        <div key={group.label}>
          <DateGroupHeader label={group.label} />
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <ActivityItem
                key={`${item.source}-${item.id}`}
                item={item}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="ml-2 text-xs text-muted-foreground">載入更多...</span>
        </div>
      )}

      {/* Error during load more */}
      {fetchError && items.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <button
            onClick={() => fetchPage(page, true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border"
          >
            <RefreshCw className="h-3 w-3" />
            載入失敗，點擊重試
          </button>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loadingMore && !fetchError && (
        <div ref={sentinelRef} className="h-4" />
      )}

      {/* End of list */}
      {!hasMore && items.length > 0 && (
        <div className="flex items-center justify-center py-6">
          <span className="text-xs text-muted-foreground/50">— 已載入全部紀錄 —</span>
        </div>
      )}
    </div>
  );
}
