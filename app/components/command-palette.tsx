"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const ROUTES = [
  { href: "/dashboard", label: "儀表板", shortcut: "G D", keywords: ["dashboard", "首頁"] },
  { href: "/kanban", label: "看板", shortcut: "G K", keywords: ["kanban", "任務"] },
  { href: "/gantt", label: "甘特圖", shortcut: "G G", keywords: ["gantt", "排程"] },
  { href: "/plans", label: "年度計畫", shortcut: "G P", keywords: ["plans", "計畫"] },
  { href: "/kpi", label: "KPI", shortcut: "G I", keywords: ["kpi", "指標"] },
  { href: "/knowledge", label: "知識庫", shortcut: "G B", keywords: ["knowledge", "文件"] },
  { href: "/timesheet", label: "工時紀錄", shortcut: "G T", keywords: ["timesheet", "工時"] },
  { href: "/reports", label: "報表", shortcut: "G R", keywords: ["reports", "統計"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = ROUTES.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.label.toLowerCase().includes(q) ||
      r.href.includes(q) ||
      r.keywords.some((k) => k.includes(q))
    );
  });

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

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
      if (open) return; // Don't capture when palette is open
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

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation within palette
  function onPaletteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    }
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
        aria-label="快速導航"
        onKeyDown={onPaletteKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="搜尋頁面…"
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <ul className="max-h-64 overflow-y-auto py-1">
          {filtered.map((route, i) => (
            <li key={route.href}>
              <button
                onClick={() => navigate(route.href)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span>{route.label}</span>
                <kbd className="text-[10px] text-muted-foreground font-mono">{route.shortcut}</kbd>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              找不到符合的頁面
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
