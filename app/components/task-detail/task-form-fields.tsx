"use client";

import { useCallback } from "react";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

type User = { id: string; name: string; avatar?: string | null };
type MonthlyGoal = { id: string; title: string; month: number };

export type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  primaryAssigneeId: string;
  backupAssigneeId: string;
  monthlyGoalId: string;
  dueDate: string;
  estimatedHours: string;
};

export const initialForm: TaskForm = {
  title: "",
  description: "",
  status: "",
  priority: "",
  category: "",
  primaryAssigneeId: "",
  backupAssigneeId: "",
  monthlyGoalId: "",
  dueDate: "",
  estimatedHours: "",
};

export const statusOptions = [
  { value: "BACKLOG", label: "待辦清單" },
  { value: "TODO", label: "待處理" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "REVIEW", label: "審核中" },
  { value: "DONE", label: "已完成" },
];

export const priorityOptions = [
  { value: "P0", label: "P0 緊急" },
  { value: "P1", label: "P1 高" },
  { value: "P2", label: "P2 中" },
  { value: "P3", label: "P3 低" },
];

export const categoryOptions = [
  { value: "PLANNED", label: "原始規劃" },
  { value: "ADDED", label: "追加任務" },
  { value: "INCIDENT", label: "突發事件" },
  { value: "SUPPORT", label: "用戶支援" },
  { value: "ADMIN", label: "行政庶務" },
  { value: "LEARNING", label: "學習成長" },
];

const inputCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60";

const selectCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>;
}

interface TaskFormFieldsProps {
  form: TaskForm;
  onFieldChange: <K extends keyof TaskForm>(field: K, value: TaskForm[K]) => void;
  users: User[];
  goals: MonthlyGoal[];
}

export function TaskFormFields({ form, onFieldChange, users, goals }: TaskFormFieldsProps) {
  return (
    <>
      {/* Title */}
      <div>
        <Label>標題</Label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div>
        <Label>描述</Label>
        <textarea
          value={form.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          rows={3}
          placeholder="任務描述..."
          className={cn(inputCls, "resize-none")}
        />
      </div>

      {/* Status / Priority / Category */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>狀態</Label>
          <select value={form.status} onChange={(e) => onFieldChange("status", e.target.value)} className={selectCls}>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label>優先度</Label>
          <select value={form.priority} onChange={(e) => onFieldChange("priority", e.target.value)} className={selectCls}>
            {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <Label>分類</Label>
          <select value={form.category} onChange={(e) => onFieldChange("category", e.target.value)} className={selectCls}>
            {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* A角 / B角 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>A角（主要負責人）</Label>
          <select value={form.primaryAssigneeId} onChange={(e) => onFieldChange("primaryAssigneeId", e.target.value)} className={selectCls}>
            <option value="">未指派</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <Label>B角（備援負責人）</Label>
          <select value={form.backupAssigneeId} onChange={(e) => onFieldChange("backupAssigneeId", e.target.value)} className={selectCls}>
            <option value="">未指派</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Due date / Estimated hours */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>截止日期</Label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => onFieldChange("dueDate", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <Label>預估工時（小時）</Label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.estimatedHours}
            onChange={(e) => onFieldChange("estimatedHours", e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      {/* Monthly Goal link */}
      <div>
        <Label>
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            連結月度目標
          </span>
        </Label>
        <select value={form.monthlyGoalId} onChange={(e) => onFieldChange("monthlyGoalId", e.target.value)} className={selectCls}>
          <option value="">不連結</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.month}月 — {g.title}</option>
          ))}
        </select>
      </div>
    </>
  );
}
