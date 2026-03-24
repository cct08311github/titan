"use client";

import { useState, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskFilters = {
  assignee: string;
  priority: string;
  category: string;
};

type User = { id: string; name: string };

interface TaskFiltersProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

const priorities = [
  { value: "", label: "所有優先度" },
  { value: "P0", label: "P0 緊急" },
  { value: "P1", label: "P1 高" },
  { value: "P2", label: "P2 中" },
  { value: "P3", label: "P3 低" },
];

const categories = [
  { value: "", label: "所有分類" },
  { value: "PLANNED", label: "原始規劃" },
  { value: "ADDED", label: "追加任務" },
  { value: "INCIDENT", label: "突發事件" },
  { value: "SUPPORT", label: "用戶支援" },
  { value: "ADMIN", label: "行政庶務" },
  { value: "LEARNING", label: "學習成長" },
];

export function TaskFilters({ filters, onChange }: TaskFiltersProps) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const hasActiveFilters = filters.assignee || filters.priority || filters.category;

  const clearFilters = () => onChange({ assignee: "", priority: "", category: "" });

  const selectCls =
    "bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 cursor-pointer hover:border-zinc-600 transition-colors";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-zinc-400">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">篩選</span>
      </div>

      {/* Assignee */}
      <select
        value={filters.assignee}
        onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
        className={selectCls}
      >
        <option value="">所有成員</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value })}
        className={selectCls}
      >
        {priorities.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
        className={selectCls}
      >
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className={cn(
            "flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors",
            "px-2 py-1.5 rounded-md border border-zinc-700 hover:border-zinc-600 bg-zinc-900"
          )}
        >
          <X className="h-3 w-3" />
          清除篩選
        </button>
      )}
    </div>
  );
}
