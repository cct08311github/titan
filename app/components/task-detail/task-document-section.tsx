"use client";

/**
 * TaskDocumentSection — Issue #842 (KB-3)
 *
 * Displays linked documents and allows searching/adding/removing document links.
 */

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { DocumentSearch } from "../document-search";

type LinkedDoc = {
  id: string;
  outlineDocumentId: string;
  title: string;
  addedBy: string;
  createdAt: string;
};

interface TaskDocumentSectionProps {
  taskId: string;
}

export function TaskDocumentSection({ taskId }: TaskDocumentSectionProps) {
  const [docs, setDocs] = useState<LinkedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/documents`);
      if (res.ok) {
        const body = await res.json();
        setDocs(extractItems<LinkedDoc>(body));
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleAddDocument(documentId: string, docTitle?: string) {
    // Use provided title or fetch from document API
    let title = docTitle || "未知文件";
    if (!docTitle) {
      try {
        const docRes = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
        if (docRes.ok) {
          const body = await docRes.json();
          const doc = body?.data ?? body;
          title = doc?.title || "未知文件";
        }
      } catch { /* fallback to 未知文件 */ }
    }

    const res = await fetch(`/api/tasks/${taskId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlineDocumentId: documentId, title }),
    });

    if (res.ok) {
      await loadDocs();
      setShowSearch(false);
    } else {
      const errBody = await res.json().catch(() => ({}));
      alert(errBody?.message ?? "新增連結失敗");
    }
  }

  async function handleRemove(docId: string) {
    setRemoving(docId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          關聯文件
        </h3>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3 w-3" />
          連結文件
        </button>
      </div>

      {showSearch && (
        <DocumentSearch onSelect={handleAddDocument} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">尚未連結任何文件</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border",
                "hover:bg-accent/30 transition-colors group"
              )}
            >
              <a
                href={`/knowledge/${doc.outlineDocumentId}`}
                className="flex items-center gap-2 min-w-0 flex-1"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">
                  {doc.title}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  Outline
                </span>
              </a>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleRemove(doc.id);
                }}
                disabled={removing === doc.id}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                title="移除連結"
              >
                {removing === doc.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
