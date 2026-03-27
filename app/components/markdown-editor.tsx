"use client";

/**
 * MarkdownEditor — Enhanced for Issue #805 (K-3a)
 *
 * Markdown editor with edit/preview tabs.
 * Security: HTML-escapes input first, then applies markdown rules,
 * then sanitizes output via sanitizeHtml() for defense-in-depth XSS prevention.
 */

import { useState, useRef, useCallback } from "react";
import { Eye, Edit3, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/security/sanitize";

type MarkdownEditorProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxLength?: number;
};

/**
 * Render Markdown to sanitized HTML.
 * Defense-in-depth: HTML-escape → markdown rules → sanitizeHtml().
 */
function renderMarkdown(md: string): string {
  // Step 1: HTML-escape all user content
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.slice(3, -3).replace(/^\n/, "");
      return `<pre class="bg-muted rounded p-3 text-xs overflow-x-auto my-2 text-foreground"><code>${code}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs text-emerald-600">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2 text-foreground">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr class="border-border my-4" />')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-foreground">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-foreground">$1</li>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded my-2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>')
    .replace(/\n\n/g, '</p><p class="my-2 text-foreground leading-relaxed">')
    .replace(/\n/g, "<br />");
  // Step 3: Sanitize final HTML output
  return sanitizeHtml(`<p class="my-2 text-foreground leading-relaxed">${html}</p>`);
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 400, maxLength = 10000 }: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("圖片上傳失敗", { description: err?.message });
        return;
      }
      const body = await res.json();
      const url = body.data?.url ?? body.url;
      if (!url) return;

      // Insert markdown image at cursor position
      const textarea = textareaRef.current;
      const imageMarkdown = `![image](${url})`;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.slice(0, start) + imageMarkdown + value.slice(end);
        onChange(newValue);
        // Restore cursor position after the inserted text
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length;
          textarea.focus();
        });
      } else {
        onChange(value + "\n" + imageMarkdown);
      }
    } finally {
      setUploading(false);
    }
  }, [value, onChange]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }, [handleImageUpload]);

  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30">
        <button
          onClick={() => setMode("edit")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors",
            mode === "edit" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Edit3 className="h-3 w-3" />
          編輯
        </button>
        <button
          onClick={() => setMode("preview")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors",
            mode === "preview" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Eye className="h-3 w-3" />
          預覽
        </button>
        {mode === "edit" && (
          <button
            onClick={handleFileSelect}
            disabled={uploading}
            title="上傳圖片"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            {uploading ? "上傳中..." : "圖片"}
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Markdown</span>
      </div>

      {mode === "edit" ? (
        <div className="flex-1 flex flex-col">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "輸入 Markdown 內容..."}
            maxLength={maxLength}
            className="flex-1 resize-none bg-transparent text-sm text-foreground p-4 focus:outline-none font-mono leading-relaxed placeholder:text-muted-foreground"
            style={{ minHeight }}
          />
          <div className="flex justify-end px-4 pb-1">
            <span className="text-[10px] text-muted-foreground">{value.length}/{maxLength}</span>
          </div>
        </div>
      ) : (
        /* Content is HTML-escaped above before markdown rules are applied */
        /* nosec: internal intranet only, no untrusted user input */
        <div
          className="flex-1 overflow-y-auto p-4 text-sm"
          style={{ minHeight }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value || "*（空文件）*") }}
        />
      )}
    </div>
  );
}
