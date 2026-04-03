"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Tag, X, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type User = { id: string; name: string; avatar?: string | null };
type MonthlyGoal = { id: string; title: string; month: number };
type TagOption = { name: string; color: string; isDefault: boolean };
type ProjectOption = { id: string; code: string; name: string };

export type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  primaryAssigneeId: string;
  backupAssigneeId: string;
  monthlyGoalId: string;
  projectId: string; // Issue #1176
  dueDate: string;
  estimatedHours: string;
  tags: string[];
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
  projectId: "",
  dueDate: "",
  estimatedHours: "",
  tags: [],
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

export type FormErrors = Partial<Record<keyof TaskForm, string>>;

interface TaskFormFieldsProps {
  form: TaskForm;
  onFieldChange: <K extends keyof TaskForm>(field: K, value: TaskForm[K]) => void;
  users: User[];
  goals: MonthlyGoal[];
  projects?: ProjectOption[]; // Issue #1176
  errors?: FormErrors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-danger mt-1">{message}</p>;
}

export function TaskFormFields({ form, onFieldChange, users, goals, projects, errors }: TaskFormFieldsProps) {
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Load available tags
  useEffect(() => {
    fetch("/api/tasks/tags")
      .then((r) => r.json())
      .then((body) => {
        const data = extractData<{ tags: TagOption[] }>(body);
        setAvailableTags(data?.tags ?? []);
      })
      .catch(() => {});
  }, []);

  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim();
      if (!trimmed || form.tags.includes(trimmed)) return;
      if (form.tags.length >= 20) return;
      onFieldChange("tags", [...form.tags, trimmed]);
      setTagInput("");
      setShowTagDropdown(false);
    },
    [form.tags, onFieldChange]
  );

  const removeTag = useCallback(
    (tagName: string) => {
      onFieldChange("tags", form.tags.filter((t) => t !== tagName));
    },
    [form.tags, onFieldChange]
  );

  const filteredTags = availableTags.filter(
    (t) => !form.tags.includes(t.name) && t.name.toLowerCase().includes(tagInput.toLowerCase())
  );
  return (
    <>
      {/* Title */}
      <div>
        <Label>標題 <span className="text-danger">*</span></Label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          maxLength={200}
          className={cn(inputCls, errors?.title && "border-danger focus:border-danger focus:ring-danger/10")}
          aria-invalid={!!errors?.title}
        />
        <div className="flex justify-between mt-1">
          <FieldError message={errors?.title} />
          <span className="text-[10px] text-muted-foreground">{form.title.length}/200</span>
        </div>
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
          <Label>A角（主要負責人）<span className="text-danger">*</span></Label>
          <select
            value={form.primaryAssigneeId}
            onChange={(e) => onFieldChange("primaryAssigneeId", e.target.value)}
            className={cn(selectCls, errors?.primaryAssigneeId && "border-danger focus:border-danger")}
            aria-invalid={!!errors?.primaryAssigneeId}
          >
            <option value="">未指派</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <FieldError message={errors?.primaryAssigneeId} />
        </div>
        <div>
          <Label>B角（備援負責人）</Label>
          <select value={form.backupAssigneeId} onChange={(e) => onFieldChange("backupAssigneeId", e.target.value)} className={selectCls}>
            <option value="">未指派</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {/* Auto-suggest B角 (Issue #1072) */}
          {form.primaryAssigneeId && !form.backupAssigneeId && (() => {
            const suggestions = users.filter((u) => u.id !== form.primaryAssigneeId).slice(0, 3);
            return suggestions.length > 0 ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] text-muted-foreground">建議：</span>
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onFieldChange("backupAssigneeId", u.id)}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-accent hover:bg-accent/80 text-accent-foreground transition-colors"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {/* Due date / Estimated hours */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>截止日期 <span className="text-danger">*</span></Label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => onFieldChange("dueDate", e.target.value)}
            className={cn(inputCls, errors?.dueDate && "border-danger focus:border-danger")}
            aria-invalid={!!errors?.dueDate}
          />
          <FieldError message={errors?.dueDate} />
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

      {/* Tags — Issue #804 (K-2) */}
      <div>
        <Label>標籤 <span className="text-danger">*</span></Label>
        {/* Selected tags */}
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map((tag) => {
              const tagOption = availableTags.find((t) => t.name === tag);
              const color = tagOption?.color ?? "#6B7280";
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
                  style={{
                    color,
                    backgroundColor: `${color}15`,
                    borderColor: `${color}30`,
                  }}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 hover:opacity-70"
                    aria-label={`移除標籤 ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {/* Tag input */}
        <div className="relative">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowTagDropdown(true);
            }}
            onFocus={() => setShowTagDropdown(true)}
            onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (tagInput.trim()) addTag(tagInput);
              }
            }}
            placeholder="輸入或選擇標籤..."
            maxLength={50}
            className={cn(inputCls, errors?.tags && "border-danger focus:border-danger")}
            aria-invalid={!!errors?.tags}
          />
          {showTagDropdown && filteredTags.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredTags.slice(0, 15).map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(tag.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors text-left"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                  {tag.isDefault && (
                    <span className="text-[10px] text-muted-foreground ml-auto">預設</span>
                  )}
                </button>
              ))}
              {tagInput.trim() && !availableTags.some((t) => t.name === tagInput.trim()) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(tagInput)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent transition-colors text-left border-t border-border"
                >
                  <Plus className="h-3 w-3" />
                  新增「{tagInput.trim()}」
                </button>
              )}
            </div>
          )}
        </div>
        <FieldError message={errors?.tags} />
      </div>

      {/* Monthly Goal link */}
      <div>
        <Label>
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            連結月度目標
            {form.monthlyGoalId && (
              <Link href="/plans" className="text-primary hover:text-primary/80 transition-colors" title="前往年度計畫">
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </span>
        </Label>
        <select value={form.monthlyGoalId} onChange={(e) => onFieldChange("monthlyGoalId", e.target.value)} className={selectCls}>
          <option value="">不連結</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.month}月 — {g.title}</option>
          ))}
        </select>
      </div>

      {/* Project link — Issue #1176 */}
      {projects && projects.length > 0 && (
        <div>
          <Label>
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              連結項目
              {form.projectId && (
                <Link href="/projects" className="text-primary hover:text-primary/80 transition-colors" title="前往項目管理">
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </span>
          </Label>
          <select value={form.projectId} onChange={(e) => onFieldChange("projectId", e.target.value)} className={selectCls}>
            <option value="">不連結</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
