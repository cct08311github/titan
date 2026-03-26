"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Download, Paperclip, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import {
  FILE_UPLOAD_CONFIG,
  getAllowedExtensions,
  validateFileSize,
  validateMimeType,
} from "@/lib/security/file-validator";

type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploaderId: string;
  createdAt: string;
  uploader?: { id: string; name: string } | null;
};

interface TaskAttachmentSectionProps {
  taskId: string;
  attachments: Attachment[];
  onUpdate?: (attachments: Attachment[]) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskAttachmentSection({ taskId, attachments: initial, onUpdate }: TaskAttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxMB = FILE_UPLOAD_CONFIG.MAX_SIZE_BYTES / (1024 * 1024);

  const handleUpload = useCallback(async (file: File) => {
    setErrorMsg(null);

    // Client-side validation
    const sizeResult = validateFileSize(file.size);
    if (!sizeResult.valid) {
      setErrorMsg(sizeResult.error.message);
      return;
    }
    const mimeResult = validateMimeType(file.type);
    if (!mimeResult.valid) {
      setErrorMsg(mimeResult.error.message);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.message ?? "上傳失敗");
        return;
      }

      const body = await res.json();
      const created = extractData<Attachment>(body);
      const updated = [created, ...attachments];
      setAttachments(updated);
      onUpdate?.(updated);
    } catch {
      setErrorMsg("上傳失敗，請稍後重試");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [taskId, attachments, onUpdate]);

  async function handleDelete(attachmentId: string) {
    setDeleting(attachmentId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId }),
      });
      if (res.ok) {
        const updated = attachments.filter((a) => a.id !== attachmentId);
        setAttachments(updated);
        onUpdate?.(updated);
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.message ?? "刪除失敗");
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleDownload(attachment: Attachment) {
    // Use storagePath to construct download URL
    const url = `/api/tasks/${taskId}/attachments?download=${attachment.id}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.fileName;
    a.click();
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">
        附件 ({attachments.length})
      </h3>
      <div className="bg-muted/30 rounded-xl p-3 space-y-2">
        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={getAllowedExtensions()}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg border border-dashed",
              "border-border hover:border-ring/50 text-muted-foreground hover:text-foreground",
              "transition-colors disabled:opacity-50"
            )}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "上傳中..." : `上傳附件（最大 ${maxMB}MB）`}
          </button>
        </div>

        {/* Attachment list */}
        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md group",
                  "hover:bg-accent/30 transition-colors",
                  deleting === att.id && "opacity-50"
                )}
              >
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground truncate">{att.fileName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatFileSize(att.fileSize)}
                    {att.uploader && ` \u00B7 ${att.uploader.name}`}
                    {att.createdAt && ` \u00B7 ${formatDate(att.createdAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(att)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="下載"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(att.id)}
                    disabled={deleting === att.id}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                    title="刪除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && !uploading && (
          <div className="text-center text-xs text-muted-foreground/50 py-2">
            尚無附件
          </div>
        )}
      </div>
    </div>
  );
}
