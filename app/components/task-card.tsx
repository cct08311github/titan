"use client";

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
} from "lucide-react";

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
};

const priorityConfig = {
  P0: { label: "P0", icon: AlertCircle, color: "text-red-400 bg-red-400/10 border-red-400/20" },
  P1: { label: "P1", icon: ArrowUp, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  P2: { label: "P2", icon: Minus, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  P3: { label: "P3", icon: ArrowDown, color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20" },
};

const categoryConfig = {
  PLANNED: { label: "規劃", icon: Layers, color: "text-blue-400" },
  ADDED: { label: "追加", icon: CheckSquare, color: "text-purple-400" },
  INCIDENT: { label: "突發", icon: Zap, color: "text-red-400" },
  SUPPORT: { label: "支援", icon: Users, color: "text-green-400" },
  ADMIN: { label: "行政", icon: BookOpen, color: "text-zinc-400" },
  LEARNING: { label: "學習", icon: BookOpen, color: "text-teal-400" },
};

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-300 overflow-hidden flex-shrink-0">
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

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const pConfig = priorityConfig[task.priority];
  const cConfig = categoryConfig[task.category];
  const PIcon = pConfig.icon;
  const CIcon = cConfig.icon;

  const doneSubtasks = task.subTasks?.filter((s) => s.done).length ?? 0;
  const totalSubtasks = task.subTasks?.length ?? task._count?.subTasks ?? 0;

  const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-pointer select-none",
        "hover:border-zinc-600 hover:bg-zinc-800/80 transition-all duration-150",
        isDragging && "opacity-50 rotate-1 scale-105 shadow-xl",
        task.priority === "P0" && "border-l-2 border-l-red-500"
      )}
    >
      {/* Header: priority + category */}
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
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 mb-2">
        {task.title}
      </p>

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
            <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
              <CheckSquare className="h-2.5 w-2.5" />
              {doneSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Estimated hours */}
          {task.estimatedHours && (
            <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
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
              dueInfo.overdue ? "text-red-400 font-medium" : dueInfo.soon ? "text-orange-400" : "text-zinc-500"
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
