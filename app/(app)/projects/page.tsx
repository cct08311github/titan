"use client";

/**
 * PMO Project Management Page — Issue #1168
 *
 * Orchestrator: list, filters, pagination, export, header.
 * Heavy sub-components are in app/components/projects/:
 *   - DashboardBar
 *   - CreateProjectModal
 *   - DetailPanel
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  FolderKanban,
  Plus,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { RiskHeatmap } from "@/app/components/risk-heatmap";
import { DashboardBar } from "@/app/components/projects/project-dashboard";
import { CreateProjectModal } from "@/app/components/projects/project-form-modal";
import { DetailPanel } from "@/app/components/projects/project-detail-panel";

import type {
  ProjectListItem,
  DashboardStats,
  UserOption,
} from "./types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "./constants";

// ── Helpers ────────────────────────────────────────────────────────────────

function checkIsManager(session: { user?: { role?: string } } | null): boolean {
  const role = session?.user?.role;
  return role === "MANAGER" || role === "ADMIN";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return d.split("T")[0];
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("zh-TW");
}

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Sort Header ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  col,
  current,
  order,
  onSort,
  className,
}: {
  label: string;
  col: string;
  current: string;
  order: "asc" | "desc";
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = current === col;
  return (
    <th
      className={cn(
        "py-3 px-3 font-medium cursor-pointer hover:text-foreground select-none",
        className
      )}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-primary text-[10px]">
            {order === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </span>
    </th>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isManager = checkIsManager(session);

  const currentYear = new Date().getFullYear();

  // List state
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal / Panel
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Users for forms
  const [users, setUsers] = useState<UserOption[]>([]);

  // Fetch users
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const list = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];
        setUsers(
          list.map((u: { id: string; name: string }) => ({
            id: u.id,
            name: u.name,
          }))
        );
      })
      .catch(() => { toast.warning("使用者清單載入失敗"); });
  }, []);

  // Fetch dashboard stats
  useEffect(() => {
    fetch(`/api/projects/dashboard?year=${yearFilter}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (body) => body && setStats(extractData<DashboardStats>(body))
      )
      .catch(() => { toast.warning("儀表板統計載入失敗"); });
  }, [yearFilter]);

  // Fetch project list
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set("year", yearFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (deptFilter) params.set("requestDept", deptFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error("項目載入失敗");
      const body = await res.json();
      const data = extractData<{ items: ProjectListItem[]; total: number }>(body);
      setProjects(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [yearFilter, statusFilter, deptFilter, priorityFilter, search, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Export (CSV or Excel)
  async function handleExport(type?: "full" | "summary") {
    const params = new URLSearchParams();
    if (yearFilter) params.set("year", yearFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (deptFilter) params.set("requestDept", deptFilter);
    if (type) params.set("type", type);

    const res = await fetch(`/api/projects/export?${params}`);
    if (!res.ok) {
      toast.error("匯出失敗");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    a.download = type ? `projects-${type}-${dateStr}.xlsx` : `projects-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(type ? "Excel 已匯出" : "CSV 已匯出");
  }

  // Sort toggle
  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            項目管理
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            PMO 企業級項目全生命週期管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-background border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              匯出
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-1 right-0 z-50 w-48 bg-card border border-border rounded-lg shadow-xl p-1">
                <button
                  onClick={() => { handleExport("full"); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors"
                >
                  Excel 完整版
                </button>
                <button
                  onClick={() => { handleExport("summary"); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors"
                >
                  Excel 摘要版
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { handleExport(); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors text-muted-foreground"
                >
                  CSV
                </button>
              </div>
            )}
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              新增項目
            </button>
          )}
        </div>
      </div>

      {/* Dashboard summary */}
      <DashboardBar stats={stats} />

      {/* Risk Heatmap toggle + panel */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setShowRiskHeatmap((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors",
            showRiskHeatmap
              ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400"
              : "bg-background border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          風險總覽
        </button>
      </div>
      {showRiskHeatmap && (
        <div className="bg-card rounded-xl shadow-card p-4 mb-4">
          <RiskHeatmap year={yearFilter} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <select
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          <option value="">全部優先級</option>
          <option value="P0">P0 緊急</option>
          <option value="P1">P1 高</option>
          <option value="P2">P2 中</option>
          <option value="P3">P3 低</option>
        </select>
        <input
          type="text"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
          placeholder="需求部門"
          className="px-3 py-2 text-sm border border-border rounded-md bg-background w-28"
        />
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜尋名稱或編號..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <PageLoading message="載入項目..." />
      ) : fetchError ? (
        <PageError message={fetchError} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        <PageEmpty
          icon={<FolderKanban className="h-10 w-10" />}
          title="尚無項目"
          description={
            isManager
              ? "點擊「新增項目」建立第一個項目"
              : "目前沒有任何項目"
          }
        />
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-xs text-muted-foreground border-b border-border">
                <SortHeader label="編號" col="code" current={sortBy} order={sortOrder} onSort={toggleSort} />
                <th className="text-left py-3 px-3 font-medium">名稱</th>
                <th className="text-left py-3 px-3 font-medium">類別</th>
                <th className="text-left py-3 px-3 font-medium">需求部門</th>
                <SortHeader label="狀態" col="status" current={sortBy} order={sortOrder} onSort={toggleSort} />
                <SortHeader label="優先級" col="priority" current={sortBy} order={sortOrder} onSort={toggleSort} />
                <th className="text-right py-3 px-3 font-medium">效益分</th>
                <th className="text-right py-3 px-3 font-medium">預估人天</th>
                <th className="text-right py-3 px-3 font-medium">實際人天</th>
                <th className="text-right py-3 px-3 font-medium">預算(千)</th>
                <SortHeader label="進度%" col="progressPct" current={sortBy} order={sortOrder} onSort={toggleSort} className="text-right" />
                <th className="text-left py-3 px-3 font-medium">負責人</th>
                <SortHeader label="預計完成" col="plannedEnd" current={sortBy} order={sortOrder} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {projects.map((proj) => (
                <tr
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                    {proj.code}
                  </td>
                  <td className="py-3 px-3 font-medium max-w-[200px] truncate">
                    {proj.name}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {proj.category ?? "—"}
                  </td>
                  <td className="py-3 px-3">{proj.requestDept}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={proj.status} />
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "font-medium",
                        PRIORITY_COLORS[proj.priority] ?? ""
                      )}
                    >
                      {proj.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {proj.benefitScore ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtNum(proj.mdTotalEstimated)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtNum(proj.mdActualTotal)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-xs">
                    {proj.budgetTotal ? `${Math.round(proj.budgetTotal / 1000)}K` : "—"}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="h-1.5 w-16 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(proj.progressPct, 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs w-8 text-right">
                        {proj.progressPct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">{proj.owner.name}</td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {fmtDate(proj.plannedEnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0 text-sm">
          <span className="text-muted-foreground">共 {total} 個項目</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-sm transition-colors",
                    page === pageNum
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-muted-foreground"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchProjects}
        users={users}
      />

      {/* Detail panel */}
      {selectedProjectId && (
        <DetailPanel
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          isManager={isManager}
          users={users}
          onRefreshList={fetchProjects}
        />
      )}
    </div>
  );
}
