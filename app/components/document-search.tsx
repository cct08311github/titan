"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, FileText, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  snippet: string;
  /** Source: "local" (built-in DB) or "outline" */
  source?: string;
};

type DocumentSearchProps = {
  onSelect: (id: string, title?: string) => void;
};

const SEARCH_HISTORY_KEY = "titan-doc-search-history";
const MAX_HISTORY = 5;

/** Load search history from localStorage */
function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a search term to history */
function saveToHistory(term: string) {
  if (typeof window === "undefined") return;
  try {
    const history = loadHistory().filter((h) => h !== term);
    history.unshift(term);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Highlight keyword matches in text.
 * Returns an array of React nodes with <mark> around matches.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  // Escape regex special chars in query
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200/60 text-foreground rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function DocumentSearch({ onSelect }: DocumentSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        setShowHistory(false);
        // Save to history
        saveToHistory(q.trim());
        setHistory(loadHistory());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(id: string, title?: string) {
    onSelect(id, title);
    setOpen(false);
    setShowHistory(false);
    setQuery("");
    setResults([]);
  }

  function handleHistoryClick(term: string) {
    setQuery(term);
    setShowHistory(false);
    search(term);
  }

  function handleFocus() {
    if (results.length > 0) {
      setOpen(true);
    } else if (!query.trim() && history.length > 0) {
      setShowHistory(true);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <Search className={cn("h-3.5 w-3.5 flex-shrink-0", loading ? "text-muted-foreground animate-pulse" : "text-muted-foreground")} />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="搜尋文件..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); setShowHistory(false); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Search history dropdown */}
      {showHistory && history.length > 0 && !open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50">
            最近搜尋
          </div>
          {history.map((term) => (
            <button
              key={term}
              onClick={() => handleHistoryClick(term)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-accent transition-colors text-left"
            >
              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate">{term}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-auto" />
            </button>
          ))}
        </div>
      )}

      {/* Search results */}
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id, r.title)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {highlightText(r.title, query)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {highlightText(r.snippet, query)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty results */}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl px-4 py-3 text-sm text-muted-foreground">
          找不到相關文件
        </div>
      )}
    </div>
  );
}
