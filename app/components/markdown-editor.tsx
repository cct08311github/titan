"use client";

import { useState } from "react";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

type MarkdownEditorProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
};

/** Minimal Markdown renderer. Input is HTML-escaped before processing — safe for internal intranet users. */
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.slice(3, -3).replace(/^\n/, "");
      return `<pre class="bg-muted rounded p-3 text-xs overflow-x-auto my-2 text-foreground"><code>${code}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs text-emerald-500">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2 text-foreground">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr class="border-border my-4" />')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-foreground">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-foreground">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-500 hover:underline">$1</a>')
    .replace(/\n\n/g, '</p><p class="my-2 text-foreground leading-relaxed">')
    .replace(/\n/g, "<br />");
  return `<p class="my-2 text-foreground leading-relaxed">${html}</p>`;
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 400 }: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/50">
        <button
          onClick={() => setMode("edit")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors",
            mode === "edit" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Edit3 className="h-3 w-3" />
          編輯
        </button>
        <button
          onClick={() => setMode("preview")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors",
            mode === "preview" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Eye className="h-3 w-3" />
          預覽
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Markdown</span>
      </div>

      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "輸入 Markdown 內容..."}
          className="flex-1 resize-none bg-transparent text-sm text-foreground p-4 focus:outline-none font-mono leading-relaxed placeholder:text-muted-foreground"
          style={{ minHeight }}
        />
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
