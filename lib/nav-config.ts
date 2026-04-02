import {
  KanbanSquare, GanttChartSquare, BookOpen,
  Clock, BarChart2, Target, Crosshair,
  Activity, Settings, ShieldCheck, Gauge, Sun,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If set, only users with one of these roles see this item */
  roles?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─── Shared navigation data (Issue #1019) ────────────────────────────────────
// Single source of truth consumed by Sidebar, Topbar mobile nav, Breadcrumb,
// and Command Palette.

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "My Day",
    items: [
      { href: "/cockpit", label: "駕駛艙", icon: Gauge, roles: ["MANAGER", "ADMIN"] },
      { href: "/dashboard", label: "今日總覽", icon: Sun },
    ],
  },
  {
    label: "Big Picture",
    items: [
      { href: "/plans", label: "年度計畫", icon: Target },
      { href: "/kpi", label: "KPI", icon: Crosshair },
      { href: "/projects", label: "項目管理", icon: Briefcase, roles: ["MANAGER", "ADMIN"] },
      { href: "/gantt", label: "甘特圖", icon: GanttChartSquare },
    ],
  },
  {
    label: "Get It Done",
    items: [
      { href: "/kanban", label: "任務看板", icon: KanbanSquare },
      { href: "/activity", label: "團隊動態", icon: Activity },
    ],
  },
  {
    label: "Track Time",
    items: [
      { href: "/timesheet", label: "工時紀錄", icon: Clock },
      { href: "/reports", label: "報表分析", icon: BarChart2 },
    ],
  },
  {
    label: "Know More",
    items: [
      { href: "/knowledge", label: "知識庫", icon: BookOpen },
    ],
  },
  {
    label: "帳號",
    items: [
      { href: "/settings", label: "個人設定", icon: Settings },
      { href: "/admin", label: "系統管理", icon: ShieldCheck, roles: ["MANAGER", "ADMIN"] },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Filter nav groups by user role, removing items the user shouldn't see and
 *  dropping empty groups. */
export function getNavGroupsForRole(role?: string | null): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (role && item.roles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list of all nav items (role-filtered). Useful for mobile nav. */
export function getFlatNavItems(role?: string | null): NavItem[] {
  return getNavGroupsForRole(role).flatMap((g) => g.items);
}

/** Build a lookup map from href to label. Includes all items regardless of role
 *  so breadcrumbs can always resolve labels. */
export function buildLabelMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      map[item.href] = item.label;
    }
  }
  return map;
}
