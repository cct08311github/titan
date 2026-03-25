"use client";

import { useState, useCallback, useRef } from "react";
import { Search, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  snippet: string;
};

type DocumentSearchProps = {
  onSelect: (id: string) => void;
};

export function DocumentSearch({ onSelect }: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const body = await res.json();
        setResults(extractItems<SearchResult>(body));
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <Search className={cn("h-3.5 w-3.5 flex-shrink-0", loading ? "text-muted-foreground animate-pulse" : "text-muted-foreground")} />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="搜尋文件..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.snippet}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl px-4 py-3 text-sm text-muted-foreground">
          找不到相關文件
        </div>
      )}
    </div>
  );
}
