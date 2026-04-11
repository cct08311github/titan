"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Link2, Pencil, BarChart2, TrendingUp, Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safePct } from "@/lib/safe-number";
import { calculateAchievement } from "@/lib/kpi-calculator";
import Link from "next/link";
import { EditKPIForm } from "./kpi-form-modal";
import { TrendChart } from "./kpi-chart";
import { AchievementForm } from "./kpi-achievement-form";
import { LinkTaskDialog } from "./kpi-link-dialog";
import {
  type KPI,
  STATUS_LABEL,
  STATUS_COLOR,
  FREQUENCY_LABEL,
  VISIBILITY_LABEL,
  TASK_STATUS_LABEL,
} from "./kpi-types";

// ── Shared ProgressBar ─────────────────────────────────────────────────────

export function ProgressBar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

export interface KPICardProps {
  kpi: KPI;
  isManager: boolean;
  currentUserId?: string;
  onUnlink: (kpiId: string, taskId: string) => Promise<void>;
  onRefresh: () => void;
  onStatusChange: (kpiId: string, newStatus: string) => Promise<void>;
  onKpiUpdated: (kpi: KPI) => void;
  onToast: (message: string, type: "success" | "error") => void;
}

export function KPICard({
  kpi, isManager, currentUserId, onUnlink, onRefresh, onStatusChange, onKpiUpdated, onToast,
}: KPICardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showAchievement, setShowAchievement] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  const rate = calculateAchievement(kpi);
  const canReport = isManager || kpi.creator?.id === currentUserId;

  const barColor =
    rate >= 100 ? "bg-success" :
    rate >= 60  ? "bg-primary" :
    rate >= 30  ? "bg-warning" :
                  "bg-danger";

  function handleEditSaved(updated: KPI) {
    onKpiUpdated(updated);
    setShowEdit(false);
    onToast("KPI 已更新", "success");
  }

  function handleLinked() {
    onRefresh();
    onToast("任務已連結", "success");
  }

  function handleReported() {
    onRefresh();
    setShowAchievement(false);
    onToast("達成值已回報", "success");
  }

  return (
    <>
      {showLinkDialog && (
        <LinkTaskDialog
          kpiId={kpi.id}
          onLinked={handleLinked}
          onClose={() => setShowLinkDialog(false)}
        />
      )}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        {/* Header (collapsible) */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left p-4 hover:bg-accent/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">{kpi.code}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      STATUS_COLOR[kpi.status] ?? "text-muted-foreground bg-accent"
                    )}
                  >
                    {STATUS_LABEL[kpi.status] ?? kpi.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {FREQUENCY_LABEL[kpi.frequency] ?? kpi.frequency}
                  </span>
                  {kpi.visibility === "MANAGER" && (
                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                      {VISIBILITY_LABEL.MANAGER}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground mt-0.5">{kpi.title}</p>
                {kpi.measureMethod && (
                  <p className="text-xs text-muted-foreground mt-0.5">衡量: {kpi.measureMethod}</p>
                )}
                {kpi.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.description}</p>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-semibold tabular-nums">{safePct(rate, 0)}%</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {kpi.actual} / {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-3 px-6">
            <ProgressBar pct={rate} color={barColor} />
          </div>
          <div className="mt-2 px-6 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>連結任務 {kpi.taskLinks.length} 項</span>
            <span>權重 {kpi.weight}%</span>
            {kpi.minValue != null && kpi.maxValue != null && (
              <span>值域 {kpi.minValue}–{kpi.maxValue}{kpi.unit || ""}</span>
            )}
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              {isManager && kpi.status === "DRAFT" && (
                <button
                  onClick={() => onStatusChange(kpi.id, "ACTIVE")}
                  className="text-xs px-3 py-1 bg-success/10 text-success rounded-md hover:bg-success/20 transition-colors"
                >
                  啟用
                </button>
              )}
              {isManager && kpi.status === "ACTIVE" && (
                <button
                  onClick={() => onStatusChange(kpi.id, "CANCELLED")}
                  className="text-xs px-3 py-1 bg-danger/10 text-danger rounded-md hover:bg-danger/20 transition-colors"
                >
                  停用
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => { setShowEdit((v) => !v); setShowAchievement(false); setShowTrend(false); }}
                  className={cn(
                    "text-xs px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                    showEdit
                      ? "bg-primary/20 text-primary"
                      : "bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/70"
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  編輯
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => setShowLinkDialog(true)}
                  className="text-xs px-3 py-1 bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/70 rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Link2 className="h-3 w-3" />
                  連結任務
                </button>
              )}
              {canReport && (
                <button
                  onClick={() => { setShowAchievement((v) => !v); setShowEdit(false); setShowTrend(false); }}
                  className={cn(
                    "text-xs px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                    showAchievement
                      ? "bg-primary/20 text-primary"
                      : "bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/70"
                  )}
                >
                  <BarChart2 className="h-3 w-3" />
                  回報達成值
                </button>
              )}
              <button
                onClick={() => { setShowTrend((v) => !v); setShowEdit(false); setShowAchievement(false); }}
                className={cn(
                  "text-xs px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                  showTrend
                    ? "bg-primary/20 text-primary"
                    : "bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/70"
                )}
              >
                <TrendingUp className="h-3 w-3" />
                趨勢
              </button>
            </div>

            {showEdit && (
              <EditKPIForm kpi={kpi} onSaved={handleEditSaved} onCancel={() => setShowEdit(false)} />
            )}
            {showAchievement && (
              <AchievementForm kpiId={kpi.id} onReported={handleReported} onCancel={() => setShowAchievement(false)} />
            )}
            {showTrend && (
              <TrendChart kpiId={kpi.id} kpiUnit={kpi.unit} target={kpi.target} onClose={() => setShowTrend(false)} />
            )}

            {/* Linked tasks list */}
            <p className="text-xs font-medium text-muted-foreground mb-2">連結任務</p>
            {kpi.taskLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未連結任務</p>
            ) : (
              kpi.taskLinks.map((link) => (
                <Link
                  key={link.taskId}
                  href={`/kanban?task=${link.taskId}`}
                  className="flex items-center gap-3 p-2.5 bg-accent/40 rounded-md hover:bg-accent/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{link.task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {TASK_STATUS_LABEL[link.task.status] ?? link.task.status}
                      </span>
                      {link.task.primaryAssignee && (
                        <span className="text-[10px] text-muted-foreground">
                          {link.task.primaryAssignee.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs tabular-nums font-medium">
                        {link.task.status === "DONE" ? 100 : link.task.progressPct}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">w:{link.weight}</p>
                    </div>
                    {isManager && (
                      <button
                        onClick={() => onUnlink(kpi.id, link.taskId)}
                        className="p-1 rounded text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                        title="移除連結"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
