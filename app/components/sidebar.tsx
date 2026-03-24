"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  KanbanSquare,
  GanttChartSquare,
  BookOpen,
  Clock,
  BarChart2,
  Target,
  Crosshair,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
  { href: "/kanban", label: "看板", icon: KanbanSquare },
  { href: "/plans", label: "年度計畫", icon: Target },
  { href: "/gantt", label: "甘特圖", icon: GanttChartSquare },
  { href: "/knowledge", label: "知識庫", icon: BookOpen },
  { href: "/timesheet", label: "工時紀錄", icon: Clock },
  { href: "/kpi", label: "KPI", icon: Crosshair },
  { href: "/reports", label: "報表", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      role="navigation"
      aria-label="主選單"
      className={cn(
        "flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo + collapse toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-medium tracking-[-0.04em] text-foreground pl-2">
            TITAN
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          title={collapsed ? "展開側邊欄" : "收合側邊欄"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="頁面導航">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Version footer */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            v1.0.0 — Sprint 4
          </p>
        </div>
      )}
    </aside>
  );
}
