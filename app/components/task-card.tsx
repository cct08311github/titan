"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  Calendar,
  CheckSquare,
  Zap,
  Users,
  BookOpen,
  Clock,
  Layers,
  AlertTriangle,
  Tag,
} from "lucide-react";
import { FlagBadge } from "@/app/components/flag-badge";

export type IncidentSeverityType = "SEV1" | "SEV2" | "SEV3" | "SEV4";

export type TaskCardData = {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  category: "PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  dueDate?: string | null;
  estimatedHours?: number | null;
  primaryAssignee?: { id: string; name: string; avatar?: string | null } | null;
  backupAssignee?: { id: string; name: string; avatar?: string | null } | null;
  subTasks?: { done: boolean }[];
  _count?: { subTasks?: number; comments?: number };
  incidentRecord?: { severity: IncidentSeverityType } | null;
  tags?: string[];
  position?: number;
  managerFlagged?: boolean;
  flagReason?: string | null;
};

const severityBorderColors: Record<IncidentSeverityType, string> = {
  SEV1: "border-l-[#DC2626]",
  SEV2: "border-l-[#EA580C]",
  SEV3: "border-l-[#CA8A04]",
  SEV4: "border-l-[#6B7280]",
};

const severityBadgeColors: Record<IncidentSeverityType, string> = {
  SEV1: "text-[#DC2626] bg-red-50 border-red-200",
  SEV2: "text-[#EA580C] bg-orange-50 border-orange-200",
  SEV3: "text-[#CA8A04] bg-yellow-50 border-yellow-200",
  SEV4: "text-[#6B7280] bg-gray-50 border-gray-200",
};

const priorityConfig = {
  P0: { label: "P0", icon: AlertCircle, color: "text-danger bg-danger/10" },
  P1: { label: "P1", icon: ArrowUp, color: "text-warning bg-warning/10" },
  P2: { label: "P2", icon: Minus, color: "text-muted-foreground bg-muted" },
  P3: { label: "P3", icon: ArrowDown, color: "text-muted-foreground bg-muted border-border" },
};

const categoryConfig = {
  PLANNED: { label: "規劃", icon: Layers, color: "text-primary" },
  ADDED: { label: "追加", icon: CheckSquare, color: "text-purple-400" },
  INCIDENT: { label: "突發", icon: Zap, color: "text-red-400" },
  SUPPORT: { label: "支援", icon: Users, color: "text-green-400" },
  ADMIN: { label: "行政", icon: BookOpen, color: "text-muted-foreground" },
  LEARNING: { label: "學習", icon: BookOpen, color: "text-teal-400" },
};

/** Default tag color mapping — Issue #804 (K-2) */
const DEFAULT_TAG_COLORS: Record<string, string> = {
  "維運": "#3B82F6",
  "開發": "#10B981",
  "資安": "#EF4444",
  "稽核": "#F59E0B",
  "文件": "#8B5CF6",
  "測試": "#06B6D4",
  "會議": "#6B7280",
  "教育訓練": "#EC4899",
};

function getTagColor(tagName: string): string {
  if (DEFAULT_TAG_COLORS[tagName]) return DEFAULT_TAG_COLORS[tagName];
  // Deterministic color for custom tags
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash + tagName.charCodeAt(i)) | 0;
  }
  const colors = ["#0EA5E9", "#14B8A6", "#A855F7", "#F97316", "#84CC16", "#E11D48", "#6366F1", "#D946EF"];
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Check if a task has all required fields filled.
 * Missing: assignee, dueDate, or tags → "資料不完整"
 */
function isTaskIncomplete(task: TaskCardData): boolean {
  return !task.primaryAssignee || !task.dueDate || !task.tags || task.tags.length === 0;
}

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground overflow-hidden flex-shrink-0">
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const mmdd = `${date.getMonth() + 1}/${date.getDate()}`;
  if (days < 0) return { label: mmdd, overdue: true };
  if (days <= 3) return { label: mmdd, soon: true };
  return { label: mmdd, overdue: false, soon: false };
}

interface TaskCardProps {
  task: TaskCardData;
  onClick?: (task: TaskCardData) => void;
  isDragging?: boolean;
}

function TaskCardComponent({ task, onClick, isDragging }: TaskCardProps) {
  const pConfig = priorityConfig[task.priority];
  const cConfig = categoryConfig[task.category];
  const PIcon = pConfig.icon;
  const CIcon = cConfig.icon;

  const doneSubtasks = task.subTasks?.filter((s) => s.done).length ?? 0;
  const totalSubtasks = task.subTasks?.length ?? task._count?.subTasks ?? 0;

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
  const incidentSeverity = task.incidentRecord?.severity;

  const borderClass = incidentSeverity
    ? `border-l-[3px] ${severityBorderColors[incidentSeverity]}`
    : task.priority === "P0"
      ? "border-l-[3px] border-l-danger"
      : "";

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "bg-card rounded-xl p-3.5 cursor-pointer select-none shadow-card",
        "hover:shadow-card-hover hover:-translate-y-px transition-all duration-150",
        isDragging && "opacity-50 rotate-1 scale-105 shadow-xl",
        borderClass
      )}
    >
      {/* Header: priority + category + severity badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border",
            pConfig.color
          )}
        >
          <PIcon className="h-2.5 w-2.5" />
          {pConfig.label}
        </span>
        <span className={cn("inline-flex items-center gap-0.5 text-[10px]", cConfig.color)}>
          <CIcon className="h-2.5 w-2.5" />
          {cConfig.label}
        </span>
        {incidentSeverity && (
          <span
            className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border",
              severityBadgeColors[incidentSeverity]
            )}
          >
            {incidentSeverity}
          </span>
        )}
        {task.managerFlagged && (
          <FlagBadge reason={task.flagReason} />
        )}
      </div>

      {/* Incomplete data warning — Issue #804 */}
      {isTaskIncomplete(task) && (
        <div className="flex items-center gap-1 mb-1.5">
          <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
          <span className="text-[10px] text-warning font-medium">資料不完整</span>
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Tags — Issue #804 */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{
                color: getTagColor(tag),
                backgroundColor: `${getTagColor(tag)}15`,
                borderColor: `${getTagColor(tag)}30`,
              }}
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
          {task.tags.length > 4 && (
            <span className="text-[9px] text-muted-foreground px-1">
              +{task.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Assignees */}
          {(task.primaryAssignee || task.backupAssignee) && (
            <div className="flex items-center -space-x-1">
              {task.primaryAssignee && (
                <div title={`A角: ${task.primaryAssignee.name}`}>
                  <Avatar name={task.primaryAssignee.name} avatar={task.primaryAssignee.avatar} />
                </div>
              )}
              {task.backupAssignee && (
                <div title={`B角: ${task.backupAssignee.name}`} className="opacity-60">
                  <Avatar name={task.backupAssignee.name} avatar={task.backupAssignee.avatar} />
                </div>
              )}
            </div>
          )}

          {/* Subtask progress */}
          {totalSubtasks > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <CheckSquare className="h-2.5 w-2.5" />
              {doneSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Estimated hours */}
          {task.estimatedHours && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {task.estimatedHours}h
            </span>
          )}
        </div>

        {/* Due date */}
        {dueInfo && (
          <span
            className={cn(
              "text-[10px] flex items-center gap-0.5",
              dueInfo.overdue ? "text-danger font-medium" : dueInfo.soon ? "text-warning" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {dueInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
