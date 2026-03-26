"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, CheckSquare, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResultItem = {
  type: "document" | "task" | "comment";
  id: string;
  title: string;
  snippet: string;
  slug?: string;
  taskId?: string;
  authorName?: string;
  updatedAt?: string;
};

type SearchResponse = {
  tasks: SearchResultItem[];
  documents: SearchResultItem[];
  comments: SearchResultItem[];
};

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (type: string, id: string, slug?: string) => void;
}

/**
 * Sanitize snippet HTML — only allow <mark> tags, strip everything else.
 * This prevents XSS from any untrusted content in the snippet.
 */
function sanitizeSnippetHtml(html: string): string {
  return html
    .replace(/<(?!\/?mark\b)[^>]*>/gi, "") // strip all tags except <mark> and </mark>
    .replace(/on\w+=/gi, ""); // strip event handlers just in case
}

function HighlightSnippet({ snippet, query }: { snippet: string; query: string }) {
  // Parse the server-side <mark> tags safely
  const sanitized = sanitizeSnippetHtml(snippet);
  const parts = sanitized.split(/(<mark>.*?<\/mark>)/g);

  return (
    <span className="text-xs text-muted-foreground line-clamp-2">
      {parts.map((part, i) => {
        const markMatch = part.match(/^<mark>(.*?)<\/mark>$/);
        if (markMatch) {
          return (
            <mark key={i} className="bg-yellow-200/60 text-foreground rounded-sm px-0.5">
              {markMatch[1]}
            </mark>
          );
        }
        return part;
      })}
    </span>
  );
}

const typeIcons = {
  document: FileText,
  task: CheckSquare,
  comment: MessageSquare,
};

export function GlobalSearchModal({ open, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=all`);
      if (res.ok) {
        const body = await res.json();
        setResults(body.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  }

  function handleSelect(item: SearchResultItem) {
    onClose();
    onNavigate?.(item.type, item.type === "comment" ? item.taskId ?? item.id : item.id, item.slug);
  }

  if (!open) return null;

  const sections: { key: keyof SearchResponse; label: string }[] = [
    { key: "documents", label: "文件" },
    { key: "tasks", label: "任務" },
    { key: "comments", label: "評論" },
  ];

  const hasResults = results && (
    results.documents.length > 0 || results.tasks.length > 0 || results.comments.length > 0
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className={cn("h-4 w-4 flex-shrink-0", loading ? "text-primary animate-pulse" : "text-muted-foreground")} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="搜尋文件、任務、評論..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults(null); }}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length > 0 && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              請輸入至少 2 個字元
            </div>
          )}

          {hasResults && sections.map(({ key, label }) => {
            const items = results![key];
            if (!items || items.length === 0) return null;
            const Icon = typeIcons[key === "documents" ? "document" : key === "tasks" ? "task" : "comment"];
            return (
              <div key={key}>
                <div className="px-4 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-accent/30 border-b border-border/50">
                  {label} ({items.length})
                </div>
                {items.map((item) => (
                  <button
                    key={`${key}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </div>
                      <HighlightSnippet snippet={item.snippet} query={query} />
                      {item.authorName && (
                        <span className="text-[10px] text-muted-foreground">
                          by {item.authorName}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}

          {results && !hasResults && !loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              找不到相關結果
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
