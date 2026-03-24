"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, Monitor, BarChart2, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

type DeliverableType = "DOCUMENT" | "SYSTEM" | "REPORT" | "APPROVAL";
type DeliverableStatus = "NOT_STARTED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED";

type Deliverable = {
  id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  attachmentUrl?: string | null;
};

const typeConfig: Record<DeliverableType, { label: string; icon: React.ElementType }> = {
  DOCUMENT: { label: "文件", icon: FileText },
  SYSTEM: { label: "系統", icon: Monitor },
  REPORT: { label: "報告", icon: BarChart2 },
  APPROVAL: { label: "簽核單", icon: Stamp },
};

const statusConfig: Record<DeliverableStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: "未開始", color: "text-muted-foreground bg-muted" },
  IN_PROGRESS: { label: "進行中", color: "text-blue-400 bg-blue-400/10" },
  DELIVERED: { label: "已交付", color: "text-orange-400 bg-orange-400/10" },
  ACCEPTED: { label: "已驗收", color: "text-emerald-400 bg-emerald-400/10" },
};

const statusOrder: DeliverableStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DELIVERED", "ACCEPTED"];

interface DeliverableListProps {
  deliverables: Deliverable[];
  taskId: string;
  onUpdate?: (deliverables: Deliverable[]) => void;
}

export function DeliverableList({ deliverables: initial, taskId, onUpdate }: DeliverableListProps) {
  const [items, setItems] = useState<Deliverable[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<DeliverableType>("DOCUMENT");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function cycleStatus(item: Deliverable) {
    const idx = statusOrder.indexOf(item.status);
    const next = statusOrder[(idx + 1) % statusOrder.length];
    setUpdating(item.id);
    try {
      const res = await fetch(`/api/deliverables/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const updated = items.map((d) => (d.id === item.id ? { ...d, status: next } : d));
        setItems(updated);
        onUpdate?.(updated);
      }
    } finally {
      setUpdating(null);
    }
  }

  async function deleteItem(id: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, { method: "DELETE" });
      if (res.ok) {
        const updated = items.filter((d) => d.id !== id);
        setItems(updated);
        onUpdate?.(updated);
      }
    } finally {
      setUpdating(null);
    }
  }

  async function addDeliverable() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), type: newType, taskId }),
      });
      if (res.ok) {
        const created = await res.json();
        const updated = [...items, created];
        setItems(updated);
        onUpdate?.(updated);
        setNewTitle("");
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const tConfig = typeConfig[item.type];
        const sConfig = statusConfig[item.status];
        const Icon = tConfig.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 group px-2 py-2 rounded-md hover:bg-accent/50 transition-colors",
              updating === item.id && "opacity-50"
            )}
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-sm text-foreground truncate">{item.title}</span>
            <span className="text-[10px] text-muted-foreground">{tConfig.label}</span>
            <button
              onClick={() => cycleStatus(item)}
              disabled={updating === item.id}
              className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer transition-opacity hover:opacity-80", sConfig.color)}
            >
              {sConfig.label}
            </button>
            <button
              onClick={() => deleteItem(item.id)}
              disabled={updating === item.id}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {showForm ? (
        <div className="flex items-center gap-2 mt-2 p-2 bg-accent/50 rounded-md">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDeliverable()}
            placeholder="交付項名稱..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as DeliverableType)}
            className="bg-background border border-border text-foreground text-xs rounded px-1.5 py-1 focus:outline-none"
          >
            {Object.entries(typeConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={addDeliverable}
            disabled={saving || !newTitle.trim()}
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 text-xs font-medium transition-colors"
          >
            新增
          </button>
          <button
            onClick={() => { setShowForm(false); setNewTitle(""); }}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <Plus className="h-3.5 w-3.5" />
          新增交付項
        </button>
      )}
    </div>
  );
}
