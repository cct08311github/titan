"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Save, Plus, BookOpen, ExternalLink, FileEdit, Globe, AlertCircle,
  Upload, Archive, FileText, ClipboardList, AlertTriangle, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirmDialog, usePromptDialog } from "@/app/components/ui/alert-dialog";
import { extractItems, extractData } from "@/lib/api-client";
import { DocumentTree, type DocNode } from "@/app/components/document-tree";
import { MarkdownEditor } from "@/app/components/markdown-editor";
import { DocumentSearch } from "@/app/components/document-search";
import { VersionHistory } from "@/app/components/version-history";
import { SpaceSidebar } from "@/app/components/space-sidebar";
import { DiffView } from "@/app/components/diff-view";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { formatDate } from "@/lib/format";

type DocVersion = {
  id: string;
  title: string | null;
  content: string;
  version: number;
  createdAt: string;
  creator: { id: string; name: string };
};

type DocDetail = {
  id: string;
  title: string;
  content: string;
  version: number;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED" | "RETIRED";
  parentId: string | null;
  spaceId: string | null;
  slug: string;
  creator: { id: string; name: string };
  updater: { id: string; name: string };
  verifier: { id: string; name: string } | null;
  verifiedAt: string | null;
  verifyIntervalDays: number | null;
  replacedBy: { id: string; title: string; slug: string } | null;
  space: { id: string; name: string } | null;
  updatedAt: string;
  versions: DocVersion[];
};

type ViewMode = "editor" | "outline";

const OUTLINE_URL = process.env.NEXT_PUBLIC_OUTLINE_URL;
const isOutlineConfigured = Boolean(OUTLINE_URL);

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "草稿", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  IN_REVIEW: { label: "審核中", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  PUBLISHED: { label: "已發布", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  ARCHIVED: { label: "已歸檔", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  RETIRED: { label: "已退役", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 line-through" },
};

const TEMPLATE_OPTIONS = [
  { key: "sop", label: "SOP 標準作業程序", icon: ClipboardList },
  { key: "meeting-notes", label: "會議紀錄", icon: FileText },
  { key: "incident-report", label: "事件報告", icon: AlertTriangle },
  { key: "tech-doc", label: "技術文件", icon: Monitor },
] as const;

/** Outline iframe wrapper with loading + timeout error handling (Issue #1069) */
function OutlineIframeWrapper({ url, onFallback }: { url: string; onFallback: () => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "error" : s));
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  if (status === "error") {
    return (
      <div className="flex-1 min-h-0 border border-border rounded-xl flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive/40 mx-auto mb-3" />
          <h2 className="text-base font-medium text-foreground mb-1">無法連線至 Outline</h2>
          <p className="text-sm text-muted-foreground">
            Outline 服務可能尚未啟動或網路不可達，請確認服務狀態後重試。
          </p>
          <button
            onClick={onFallback}
            className="mt-4 text-sm font-medium px-4 py-2 bg-accent hover:bg-accent/80 text-accent-foreground rounded-md transition-colors"
          >
            切換至文件編輯器
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden relative">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={url}
        title="Outline 知識庫"
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setStatus("ready")}
      />
    </div>
  );
}

export default function KnowledgePage() {
  const { confirmDialog, ConfirmDialog } = useConfirmDialog();
  const { promptDialog, PromptDialog } = usePromptDialog();
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
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);

  // Load doc tree
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const url = selectedSpaceId
        ? `/api/documents?spaceId=${selectedSpaceId}`
        : "/api/documents";
      const res = await fetch(url);
      if (!res.ok) throw new Error("文件載入失敗");
      const body = await res.json();
      setDocs(extractItems<DocNode>(body));
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedSpaceId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Load selected document
  useEffect(() => {
    if (!selectedId) { setDocDetail(null); return; }
    setLoadingDetail(true);
    setDiffVersionId(null);
    fetch(`/api/documents/${selectedId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((raw) => {
        const d = raw ? extractData<DocDetail>(raw) : null;
        if (d) {
          setDocDetail(d);
          setEditTitle(d.title ?? "");
          setEditContent(d.content ?? "");
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
        const body = await res.json();
        const updated = extractData<DocDetail>(body);
        // Reload full detail to get versions
        const detailRes = await fetch(`/api/documents/${selectedId}`);
        if (detailRes.ok) {
          const detailBody = await detailRes.json();
          const full = extractData<DocDetail>(detailBody);
          setDocDetail(full);
        } else {
          setDocDetail(updated);
        }
        setDirty(false);
        setDocs((prev) =>
          prev.map((d) => d.id === selectedId ? { ...d, title: updated.title } : d)
        );
        toast.success("文件已儲存");
      }
    } finally {
      setSaving(false);
    }
  }

  async function publishDoc() {
    if (!selectedId) return;
    const res = await fetch(`/api/documents/${selectedId}/publish`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      const updated = extractData<DocDetail>(body);
      setDocDetail((prev) => prev ? { ...prev, status: updated.status } : prev);
      loadDocs();
      toast.success("文件已發佈");
    }
  }

  async function submitForReview() {
    if (!selectedId) return;
    const res = await fetch(`/api/documents/${selectedId}/submit-review`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      const updated = extractData<DocDetail>(body);
      setDocDetail((prev) => prev ? { ...prev, status: updated.status } : prev);
      loadDocs();
      toast.success("已送出審核");
    }
  }

  async function retireDoc() {
    if (!selectedId) return;
    const ok = await confirmDialog({ title: "確定將此文件標記為退役？", description: "此操作無法復原", confirmLabel: "確認", variant: "destructive" });
    if (!ok) return;
    const res = await fetch(`/api/documents/${selectedId}/retire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const body = await res.json();
      const updated = extractData<DocDetail>(body);
      setDocDetail((prev) => prev ? { ...prev, status: updated.status } : prev);
      loadDocs();
      toast.success("文件已退役");
    }
  }

  async function archiveDoc() {
    if (!selectedId) return;
    const ok = await confirmDialog({ title: "確定歸檔此文件？", description: "此操作無法復原", confirmLabel: "確認", variant: "destructive" });
    if (!ok) return;
    const res = await fetch(`/api/documents/${selectedId}/archive`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      const updated = extractData<DocDetail>(body);
      setDocDetail((prev) => prev ? { ...prev, status: updated.status } : prev);
      loadDocs();
      toast.success("文件已歸檔");
    }
  }

  async function createDoc(parentId: string | null, templateType?: string) {
    const title = templateType ? "" : await promptDialog({ title: "新文件標題", placeholder: "輸入文件名稱" });
    if (!templateType && !title?.trim()) return;
    setShowTemplates(false);

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId,
        spaceId: selectedSpaceId,
        title: title?.trim() ?? "",
        content: "",
        templateType,
      }),
    });
    if (res.ok) {
      const body = await res.json();
      const doc = extractData<{ id: string }>(body);
      await loadDocs();
      setSelectedId(doc.id);
      toast.success("文件已建立");
    } else {
      const errBody = await res.json().catch(() => ({}));
      toast.error(errBody?.message ?? "文件建立失敗");
    }
  }

  async function createSpace(): Promise<boolean> {
    const name = await promptDialog({ title: "新增 Space", placeholder: "輸入空間名稱" });
    if (!name?.trim()) return false;
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const body = await res.json();
      const space = extractData<{ id: string }>(body);
      setSelectedSpaceId(space.id);
      toast.success("空間已建立");
      return true;
    }
    return false;
  }

  async function deleteDoc(id: string) {
    const ok = await confirmDialog({ title: "確定刪除此文件？", description: "子文件將一起刪除。此操作無法復原", confirmLabel: "確認", variant: "destructive" });
    if (!ok) return;
    const delRes = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (delRes.ok) toast.success("文件已刪除");
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

  // Find version for diff
  const diffVersion = diffVersionId && docDetail
    ? docDetail.versions.find((v) => v.id === diffVersionId)
    : null;

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">知識庫</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {viewMode === "editor" ? "Markdown 文件管理" : "Outline 協作知識庫"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
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
            {isOutlineConfigured && (
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
            )}
          </div>

          {viewMode === "editor" && (
            <div className="relative">
              <button
                onClick={() => createDoc(null)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
              >
                <Plus className="h-3.5 w-3.5" />
                新增文件
              </button>
            </div>
          )}

          {viewMode === "editor" && (
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
              >
                <FileText className="h-3.5 w-3.5" />
                使用範本
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  {TEMPLATE_OPTIONS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => createDoc(null, key)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === "outline" && isOutlineConfigured && (
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

      {/* Outline iframe view with error handling (Issue #1069) */}
      {viewMode === "outline" && isOutlineConfigured && (
        <OutlineIframeWrapper url={OUTLINE_URL!} onFallback={() => setViewMode("editor")} />
      )}

      {/* Outline not configured fallback */}
      {viewMode === "outline" && !isOutlineConfigured && (
        <div className="flex-1 min-h-0 border border-border rounded-xl flex items-center justify-center">
          <div className="text-center max-w-sm">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h2 className="text-base font-medium text-foreground mb-1">Outline wiki 未部署</h2>
            <p className="text-sm text-muted-foreground">
              請設定 <code className="text-xs bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_OUTLINE_URL</code> 環境變數以啟用 Outline 整合。
            </p>
            <button
              onClick={() => setViewMode("editor")}
              className="mt-4 text-sm font-medium px-4 py-2 bg-accent hover:bg-accent/80 text-accent-foreground rounded-md transition-colors"
            >
              切換至文件編輯器
            </button>
          </div>
        </div>
      )}

      {/* Built-in editor view */}
      {viewMode === "editor" && (
        <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-0 border border-border rounded-xl overflow-hidden">
          {/* Space sidebar */}
          <div className="w-full md:w-44 flex-shrink-0 border-b md:border-b-0 md:border-r border-border bg-muted/30 max-h-32 md:max-h-none">
            <SpaceSidebar
              selectedSpaceId={selectedSpaceId}
              onSelectSpace={setSelectedSpaceId}
              onCreateSpace={createSpace}
            />
          </div>

          {/* Doc tree sidebar */}
          <div className="w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col bg-sidebar-background max-h-48 md:max-h-none">
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
                    {/* Status badge */}
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full",
                      STATUS_LABELS[docDetail.status]?.className ?? ""
                    )}>
                      {STATUS_LABELS[docDetail.status]?.label ?? docDetail.status}
                    </span>

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

                    {/* Submit for review button (DRAFT only) */}
                    {docDetail.status === "DRAFT" && (
                      <button
                        onClick={submitForReview}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        <Upload className="h-3 w-3" />
                        提交審核
                      </button>
                    )}

                    {/* Publish button (DRAFT or IN_REVIEW) */}
                    {(docDetail.status === "DRAFT" || docDetail.status === "IN_REVIEW") && (
                      <button
                        onClick={publishDoc}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
                      >
                        <Upload className="h-3 w-3" />
                        發布
                      </button>
                    )}

                    {/* Archive button */}
                    {docDetail.status !== "ARCHIVED" && docDetail.status !== "RETIRED" && (
                      <button
                        onClick={archiveDoc}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Archive className="h-3 w-3" />
                        歸檔
                      </button>
                    )}

                    {/* Retire button (PUBLISHED or ARCHIVED) */}
                    {(docDetail.status === "PUBLISHED" || docDetail.status === "ARCHIVED") && (
                      <button
                        onClick={retireDoc}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Archive className="h-3 w-3" />
                        退役
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-4 flex-shrink-0 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    建立：{docDetail.creator.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    最後更新：{docDetail.updater.name}
                    {"\u3000"}{formatDate(docDetail.updatedAt)}
                  </span>
                  {docDetail.space && (
                    <span className="text-xs text-primary">
                      Space: {docDetail.space.name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/60 ml-auto">v{docDetail.version}</span>
                </div>

                {/* Retired replacement notice */}
                {docDetail.status === "RETIRED" && (
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-900/30 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs text-red-700 dark:text-red-400">
                      此文件已退役
                      {docDetail.replacedBy && (
                        <>
                          ，已由{" "}
                          <button
                            onClick={() => setSelectedId(docDetail.replacedBy!.id)}
                            className="font-medium underline hover:no-underline"
                          >
                            {docDetail.replacedBy.title}
                          </button>
                          {" "}取代
                        </>
                      )}
                    </span>
                  </div>
                )}

                {/* Diff view or editor */}
                {diffVersion ? (
                  <div className="flex-1 overflow-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">
                        版本比較：v{diffVersion.version} vs 目前 (v{docDetail.version})
                      </h3>
                      <button
                        onClick={() => setDiffVersionId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
                      >
                        關閉比較
                      </button>
                    </div>
                    <DiffView
                      oldText={diffVersion.content}
                      newText={editContent}
                      oldLabel={`v${diffVersion.version} (${diffVersion.creator.name})`}
                      newLabel={`v${docDetail.version} (目前)`}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden">
                    <MarkdownEditor
                      value={editContent}
                      onChange={handleContentChange}
                      placeholder="開始撰寫 Markdown..."
                    />
                  </div>
                )}

                {/* Revision history with diff support */}
                <div className="flex-shrink-0 border-t border-border">
                  <RevisionHistoryPanel
                    versions={docDetail.versions}
                    currentVersion={docDetail.version}
                    onRestore={handleRestore}
                    onDiff={setDiffVersionId}
                    activeDiffId={diffVersionId}
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
      <ConfirmDialog />
      <PromptDialog />
    </div>
  );
}

// ── Inline Revision History Panel with Diff ──

function RevisionHistoryPanel({
  versions,
  currentVersion,
  onRestore,
  onDiff,
  activeDiffId,
}: {
  versions: DocVersion[];
  currentVersion: number;
  onRestore: (content: string) => void;
  onDiff: (versionId: string | null) => void;
  activeDiffId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>版本歷史（v{currentVersion}，{versions.length} 個版本）</span>
        <span className="ml-auto text-[10px]">{open ? "收合" : "展開"}</span>
      </button>

      {open && (
        <div className="border-t border-border max-h-64 overflow-y-auto">
          {versions.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">尚無歷史版本</div>
          )}
          {versions.map((v) => (
            <div key={v.id} className="border-b border-border/50 last:border-0">
              <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">v{v.version}</span>
                  <span className="text-xs text-muted-foreground ml-2">{v.creator.name}</span>
                  {v.title && (
                    <span className="text-xs text-muted-foreground/60 ml-2">「{v.title}」</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(v.createdAt)}
                </span>
              </div>

              {expandedId === v.id && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button
                    onClick={() => { onRestore(v.content); setOpen(false); }}
                    className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    還原此版本
                  </button>
                  <button
                    onClick={() => onDiff(activeDiffId === v.id ? null : v.id)}
                    className={cn(
                      "text-xs px-3 py-1 rounded border transition-colors",
                      activeDiffId === v.id
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {activeDiffId === v.id ? "關閉比較" : "比較差異"}
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
