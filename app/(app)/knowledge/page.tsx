"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentTree, type DocNode } from "@/app/components/document-tree";
import { MarkdownEditor } from "@/app/components/markdown-editor";
import { DocumentSearch } from "@/app/components/document-search";
import { VersionHistory } from "@/app/components/version-history";

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

export default function KnowledgePage() {
  const [docs, setDocs] = useState<DocNode[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<DocDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load doc tree
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) setDocs(await res.json());
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
          <h1 className="text-2xl font-medium tracking-[-0.04em]">知識庫</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Markdown 文件管理</p>
        </div>
        <button
          onClick={() => createDoc(null)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors border border-zinc-700"
        >
          <Plus className="h-3.5 w-3.5" />
          新增文件
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 gap-0 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <DocumentSearch onSelect={setSelectedId} />
          </div>

          {/* Tree */}
          {loadingDocs ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
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
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <p className="text-zinc-600 text-sm">從左側選擇文件</p>
                <p className="text-zinc-700 text-xs mt-1">或點擊 + 新增文件</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
            </div>
          ) : docDetail ? (
            <>
              {/* Editor header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="flex-1 bg-transparent text-base font-semibold text-zinc-100 focus:outline-none placeholder:text-zinc-600 border-b border-transparent focus:border-zinc-700 pb-0.5 transition-colors"
                  placeholder="文件標題..."
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {dirty && (
                    <span className="text-xs text-amber-400">未儲存</span>
                  )}
                  <button
                    onClick={save}
                    disabled={!dirty || saving}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                      dirty
                        ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                        : "bg-zinc-800 text-zinc-600 cursor-default"
                    )}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    儲存
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="px-4 py-1.5 border-b border-zinc-800/50 flex items-center gap-4 flex-shrink-0">
                <span className="text-xs text-zinc-600">
                  建立：{docDetail.creator.name}
                </span>
                <span className="text-xs text-zinc-600">
                  最後更新：{docDetail.updater.name}
                  　{new Date(docDetail.updatedAt).toLocaleDateString("zh-TW")}
                </span>
                <span className="text-xs text-zinc-700 ml-auto">v{docDetail.version}</span>
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
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              文件不存在
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
