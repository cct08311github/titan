"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Plus, BookOpen, ExternalLink, FileEdit, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentTree, type DocNode } from "@/app/components/document-tree";
import { MarkdownEditor } from "@/app/components/markdown-editor";
import { DocumentSearch } from "@/app/components/document-search";
import { VersionHistory } from "@/app/components/version-history";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { formatDate } from "@/lib/format";

type DocDetail = {
  id: string;
  title: string;
  content: string;
  version: number;
  parentId: string | null;
  slug: string;
  creator: { id: string; name: string };
  updater: { id: string; name: string };
  updatedAt: string;
};

type ViewMode = "editor" | "outline";

const OUTLINE_URL = process.env.NEXT_PUBLIC_OUTLINE_URL || "";
/** Outline is considered available if the env var is set to a non-empty value */
const OUTLINE_AVAILABLE = OUTLINE_URL.length > 0;

export default function KnowledgePage() {
  const [docs, setDocs] = useState<DocNode[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<DocDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");

  // Load doc tree
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("文件載入失敗");
      const json = await res.json();
      // Support paginated response { data: { items, pagination } } and legacy array
      const payload = json?.data ?? json;
      setDocs(Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Load selected document
  useEffect(() => {
    if (!selectedId) { setDocDetail(null); return; }
    setLoadingDetail(true);
    fetch(`/api/documents/${selectedId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setDocDetail(d);
          setEditTitle(d.title);
          setEditContent(d.content);
          setDirty(false);
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  async function save() {
    if (!selectedId || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDocDetail(updated);
        setDirty(false);
        setDocs((prev) =>
          prev.map((d) => d.id === selectedId ? { ...d, title: updated.title } : d)
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function createDoc(parentId: string | null) {
    const title = prompt("新文件標題：");
    if (!title?.trim()) return;
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, title: title.trim(), content: "" }),
    });
    if (res.ok) {
      const doc = await res.json();
      await loadDocs();
      setSelectedId(doc.id);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("確定刪除此文件？子文件將一起刪除。")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await loadDocs();
  }

  function handleTitleChange(v: string) {
    setEditTitle(v);
    setDirty(true);
  }

  function handleContentChange(v: string) {
    setEditContent(v);
    setDirty(true);
  }

  function handleRestore(content: string) {
    setEditContent(content);
    setDirty(true);
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Top bar */}
      <div className="flex items-center justify-between pb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">知識庫</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {viewMode === "editor" ? "Markdown 文件管理" : "Outline 協作知識庫"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle — only show if Outline is available */}
          {OUTLINE_AVAILABLE && (
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("editor")}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                  viewMode === "editor"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileEdit className="h-3.5 w-3.5" />
                文件編輯器
              </button>
              <button
                onClick={() => setViewMode("outline")}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                  viewMode === "outline"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Outline Wiki
              </button>
            </div>
          )}

          {viewMode === "editor" && (
            <button
              onClick={() => createDoc(null)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
            >
              <Plus className="h-3.5 w-3.5" />
              新增文件
            </button>
          )}

          {viewMode === "outline" && OUTLINE_AVAILABLE && (
            <a
              href={OUTLINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              開啟完整 Outline
            </a>
          )}
        </div>
      </div>

      {/* Outline iframe view */}
      {viewMode === "outline" && OUTLINE_AVAILABLE && (
        <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden">
          <iframe
            src={OUTLINE_URL}
            title="Outline 知識庫"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      )}

      {/* Built-in editor view */}
      {viewMode === "editor" && (
        <div className="flex flex-1 min-h-0 gap-0 border border-border rounded-xl overflow-hidden">
          {/* Left sidebar */}
          <div className="w-56 flex-shrink-0 border-r border-border flex flex-col bg-sidebar-background">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <DocumentSearch onSelect={setSelectedId} />
            </div>

            {/* Tree */}
            {loadingDocs ? (
              <div className="flex-1 flex items-center justify-center">
                <PageLoading message="載入文件..." className="py-6" />
              </div>
            ) : docsError ? (
              <div className="flex-1 flex items-center justify-center p-2">
                <PageError message={docsError} onRetry={loadDocs} className="py-4" />
              </div>
            ) : docs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-2">
                <PageEmpty
                  icon={<BookOpen className="h-7 w-7" />}
                  title="尚無文件"
                  description="點擊 + 新增文件"
                  className="py-4"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <DocumentTree
                  docs={docs}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onNewDoc={createDoc}
                  onDelete={deleteDoc}
                />
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-card">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <p className="text-muted-foreground text-sm">從左側選擇文件</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">或點擊 + 新增文件</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : docDetail ? (
              <>
                {/* Editor header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="flex-1 bg-transparent text-base font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground border-b border-transparent focus:border-border pb-0.5 transition-colors"
                    placeholder="文件標題..."
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dirty && (
                      <span className="text-xs text-amber-500">未儲存</span>
                    )}
                    <button
                      onClick={save}
                      disabled={!dirty || saving}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                        dirty
                          ? "bg-accent hover:bg-accent/80 text-accent-foreground"
                          : "bg-muted text-muted-foreground cursor-default"
                      )}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      儲存
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    建立：{docDetail.creator.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    最後更新：{docDetail.updater.name}
                    　{formatDate(docDetail.updatedAt)}
                  </span>
                  <span className="text-xs text-muted-foreground/60 ml-auto">v{docDetail.version}</span>
                </div>

                {/* Markdown editor */}
                <div className="flex-1 overflow-hidden">
                  <MarkdownEditor
                    value={editContent}
                    onChange={handleContentChange}
                    placeholder="開始撰寫 Markdown..."
                  />
                </div>

                {/* Version history */}
                <div className="flex-shrink-0">
                  <VersionHistory
                    documentId={docDetail.id}
                    currentVersion={docDetail.version}
                    onRestore={handleRestore}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                文件不存在
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
