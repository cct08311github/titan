"use client";

import { useState, useEffect } from "react";
import { History, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type DocVersion = {
  id: string;
  version: number;
  content: string;
  createdAt: string;
  creator: { id: string; name: string };
};

type VersionHistoryProps = {
  documentId: string;
  currentVersion: number;
  onRestore: (content: string) => void;
};

export function VersionHistory({ documentId, currentVersion, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        <span>版本歷史（v{currentVersion}）</span>
        <span className="ml-auto">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</span>
      </button>

      {open && (
        <div className="border-t border-border max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">載入中...</div>
          )}
          {!loading && versions.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">尚無歷史版本</div>
          )}
          {versions.map((v) => (
            <div
              key={v.id}
              className="border-b border-border/50 last:border-0"
            >
              <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">v{v.version}</span>
                  <span className="text-xs text-muted-foreground ml-2">{v.creator.name}</span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(v.createdAt).toLocaleDateString("zh-TW", {
                    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                {expandedId === v.id
                  ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
              </div>

              {expandedId === v.id && (
                <div className="px-4 pb-3">
                  <pre className="bg-muted border border-border rounded p-3 text-xs text-muted-foreground overflow-x-auto max-h-32 whitespace-pre-wrap">
                    {v.content.slice(0, 500)}{v.content.length > 500 ? "..." : ""}
                  </pre>
                  <button
                    onClick={() => { onRestore(v.content); setOpen(false); }}
                    className={cn(
                      "mt-2 text-xs px-3 py-1 rounded border border-border",
                      "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    )}
                  >
                    還原此版本
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
