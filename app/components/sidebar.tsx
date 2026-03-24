"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, KanbanSquare, GanttChartSquare, BookOpen,
  Clock, BarChart2, Target, Crosshair, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "概覽",
    items: [
      { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
      { href: "/kanban", label: "看板", icon: KanbanSquare },
      { href: "/gantt", label: "甘特圖", icon: GanttChartSquare },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/plans", label: "年度計畫", icon: Target },
      { href: "/kpi", label: "KPI", icon: Crosshair },
      { href: "/knowledge", label: "知識庫", icon: BookOpen },
    ],
  },
  {
    label: "紀錄",
    items: [
      { href: "/timesheet", label: "工時紀錄", icon: Clock },
      { href: "/reports", label: "報表", icon: BarChart2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse on projector/small viewports (≤1024px) — Issue #197
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    setCollapsed(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <aside
      role="navigation"
      aria-label="主選單"
      className={cn(
        "flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">TITAN</span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-xs font-bold text-primary-foreground">T</span>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="收合側邊欄" title="收合側邊欄">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="頁面導航">
        {collapsed ? (
          <div className="space-y-1">
            {navGroups.flatMap((g) => g.items).map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} title={label} aria-current={isActive ? "page" : undefined}
                  className={cn("flex items-center justify-center w-full h-9 rounded-lg transition-colors",
                    isActive ? "bg-[hsl(var(--sidebar-accent))] text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                  )}>
                  <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link key={href} href={href} aria-current={isActive ? "page" : undefined}
                        className={cn("flex items-center gap-3 rounded-lg text-sm h-9 px-3 transition-all duration-150",
                          isActive
                            ? "bg-[hsl(var(--sidebar-accent))] text-sidebar-accent-foreground font-medium border-l-[3px] border-l-primary -ml-[3px] pl-[calc(0.75rem+3px)]"
                            : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                        )}>
                        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="flex items-center justify-center w-full h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="展開側邊欄" title="展開側邊欄">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground/60 tabular-nums px-3 py-1">v1.0.0</p>
        )}
      </div>
    </aside>
  );
}
