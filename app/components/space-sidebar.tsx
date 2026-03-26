"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Plus, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

export type SpaceItem = {
  id: string;
  name: string;
  description: string | null;
  _count: { documents: number };
};

type SpaceSidebarProps = {
  selectedSpaceId: string | null;
  onSelectSpace: (id: string | null) => void;
  onCreateSpace: () => void;
};

export function SpaceSidebar({ selectedSpaceId, onSelectSpace, onCreateSpace }: SpaceSidebarProps) {
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const body = await res.json();
        const data = extractData<{ items: SpaceItem[] }>(body);
        setSpaces(data?.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spaces</span>
        <button
          onClick={onCreateSpace}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="新增 Space"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* All docs */}
      <button
        onClick={() => onSelectSpace(null)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs transition-colors w-full text-left",
          selectedSpaceId === null
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
        <span>所有文件</span>
      </button>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">尚無 Space</p>
            <button
              onClick={onCreateSpace}
              className="mt-1 text-xs text-primary hover:underline"
            >
              建立第一個 Space
            </button>
          </div>
        ) : (
          <div className="py-1">
            {spaces.map((space) => (
              <button
                key={space.id}
                onClick={() => onSelectSpace(space.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs transition-colors w-full text-left group",
                  selectedSpaceId === space.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                <span className="flex-1 truncate">{space.name}</span>
                <span className="text-[10px] text-muted-foreground/60">{space._count.documents}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
