"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  GanttChartSquare,
  BookOpen,
  Clock,
  BarChart2,
  Target,
  Crosshair,
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

  return (
    <aside className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
        <span className="text-lg font-medium tracking-[-0.04em] text-foreground">
          TITAN
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Version footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
          v1.0.0 — Sprint 4
        </p>
      </div>
    </aside>
  );
}
