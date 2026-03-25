"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { extractData } from "@/lib/api-client";
import {
  Search,
  ClipboardList,
  FileText,
  Target,
  User,
  Clock,
  Loader2,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface SearchResultItem {
  id: string;
  type: "route" | "task" | "document" | "kpi" | "user";
  label: string;
  sub?: string;
  href: string;
  shortcut?: string;
}

interface ApiSearchResponse {
  ok: boolean;
  data?: {
    tasks: Array<{ id: string; title: string; status: string; priority: string }>;
    documents: Array<{ id: string; title: string; slug: string }>;
    kpis: Array<{ id: string; code: string; title: string; year: number }>;
    users: Array<{ id: string; name: string; email: string; role: string }>;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROUTES: SearchResultItem[] = [
  { id: "r-dashboard", type: "route", href: "/dashboard", label: "儀表板", shortcut: "G D" },
  { id: "r-kanban", type: "route", href: "/kanban", label: "看板", shortcut: "G K" },
  { id: "r-gantt", type: "route", href: "/gantt", label: "甘特圖", shortcut: "G G" },
  { id: "r-plans", type: "route", href: "/plans", label: "年度計畫", shortcut: "G P" },
  { id: "r-kpi", type: "route", href: "/kpi", label: "KPI", shortcut: "G I" },
  { id: "r-knowledge", type: "route", href: "/knowledge", label: "知識庫", shortcut: "G B" },
  { id: "r-timesheet", type: "route", href: "/timesheet", label: "工時紀錄", shortcut: "G T" },
  { id: "r-reports", type: "route", href: "/reports", label: "報表", shortcut: "G R" },
];

const ROUTE_KEYWORDS: Record<string, string[]> = {
  "/dashboard": ["dashboard", "首頁"],
  "/kanban": ["kanban", "任務"],
  "/gantt": ["gantt", "排程"],
  "/plans": ["plans", "計畫"],
  "/kpi": ["kpi", "指標"],
  "/knowledge": ["knowledge", "文件"],
  "/timesheet": ["timesheet", "工時"],
  "/reports": ["reports", "統計"],
};

const RECENT_SEARCH_KEY = "titan-recent-searches";
const MAX_RECENT = 5;

const TYPE_ICON: Record<string, React.ReactNode> = {
  task: <ClipboardList className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  kpi: <Target className="h-3.5 w-3.5" />,
  user: <User className="h-3.5 w-3.5" />,
  route: <Search className="h-3.5 w-3.5" />,
};

const TYPE_LABEL: Record<string, string> = {
  task: "任務",
  document: "文件",
  kpi: "KPI",
  user: "使用者",
  route: "頁面",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(q: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== q);
    recent.unshift(q);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  // Filter route items locally
  const filteredRoutes = ROUTES.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const keywords = ROUTE_KEYWORDS[r.href] ?? [];
    return (
      r.label.toLowerCase().includes(q) ||
      r.href.includes(q) ||
      keywords.some((k) => k.includes(q))
    );
  });

  // Combined results: routes first, then API search results
  const allResults: SearchResultItem[] = query
    ? [...filteredRoutes, ...searchResults]
    : filteredRoutes;

  const navigate = useCallback(
    (href: string) => {
      if (query.trim()) {
        saveRecentSearch(query.trim());
      }
      setOpen(false);
      setQuery("");
      setSearchResults([]);
      router.push(href);
    },
    [router, query]
  );

  // Debounced API search when query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const body = await res.json();
        const json = { ...body, data: extractData<ApiSearchResponse["data"]>(body) };
        if (!json.data) {
          setSearchResults([]);
          return;
        }

        const items: SearchResultItem[] = [];
        for (const t of json.data.tasks) {
          items.push({
            id: `task-${t.id}`,
            type: "task",
            label: t.title,
            sub: `${t.status} · ${t.priority}`,
            href: `/kanban?task=${t.id}`,
          });
        }
        for (const d of json.data.documents) {
          items.push({
            id: `doc-${d.id}`,
            type: "document",
            label: d.title,
            sub: d.slug,
            href: `/knowledge/${d.slug}`,
          });
        }
        for (const k of json.data.kpis) {
          items.push({
            id: `kpi-${k.id}`,
            type: "kpi",
            label: `${k.code} — ${k.title}`,
            sub: `${k.year} 年度`,
            href: `/kpi?id=${k.id}`,
          });
        }
        for (const u of json.data.users) {
          items.push({
            id: `user-${u.id}`,
            type: "user",
            label: u.name,
            sub: `${u.email} · ${u.role}`,
            href: `/admin/users?id=${u.id}`,
          });
        }
        setSearchResults(items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Ctrl+K / Cmd+K to open, Escape to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // G + letter shortcuts for direct navigation
  useEffect(() => {
    let lastKey = "";
    let timer: ReturnType<typeof setTimeout>;

    function onKeyDown(e: KeyboardEvent) {
      if (open) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const key = e.key.toUpperCase();
      if (lastKey === "G") {
        const route = ROUTES.find((r) => r.shortcut === `G ${key}`);
        if (route) {
          e.preventDefault();
          navigate(route.href);
        }
        lastKey = "";
        return;
      }
      lastKey = key;
      clearTimeout(timer);
      timer = setTimeout(() => { lastKey = ""; }, 500);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [open, navigate]);

  // Focus input when opened, load recent searches
  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setQuery("");
      setSearchResults([]);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation within palette
  function onPaletteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      navigate(allResults[selectedIndex].href);
    }
  }

  function handleRecentClick(recent: string) {
    setQuery(recent);
    setSelectedIndex(0);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="快速搜尋"
        onKeyDown={onPaletteKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="搜尋頁面、任務、文件、KPI、使用者…"
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searching && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Recent searches (only when no query) */}
        {!query && recentSearches.length > 0 && (
          <div className="border-b border-border px-4 py-2">
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> 最近搜尋
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleRecentClick(s)}
                  className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <ul className="max-h-72 overflow-y-auto py-1">
          {allResults.map((item, i) => (
            <li key={item.id}>
              <button
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span className="text-muted-foreground flex-shrink-0">
                  {TYPE_ICON[item.type]}
                </span>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.sub && (
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 truncate max-w-[120px]">
                    {item.sub}
                  </span>
                )}
                {item.shortcut && (
                  <kbd className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{item.shortcut}</kbd>
                )}
                <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">
                  {TYPE_LABEL[item.type]}
                </span>
              </button>
            </li>
          ))}
          {allResults.length === 0 && !searching && (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              找不到符合的結果
            </li>
          )}
          {allResults.length === 0 && searching && (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 搜尋中…
            </li>
          )}
        </ul>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">↑↓</kbd> 選擇</span>
          <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">Enter</kbd> 前往</span>
          <span><kbd className="border border-border rounded px-1 py-0.5 mr-0.5">G</kbd>+<kbd className="border border-border rounded px-1 py-0.5 ml-0.5">字母</kbd> 快速導航</span>
        </div>
      </div>
    </div>
  );
}
