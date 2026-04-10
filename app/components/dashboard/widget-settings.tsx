"use client";

import { useState, useEffect, useRef } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "flagged-tasks", label: "標記任務", visible: true },
  { id: "due-today", label: "今日到期", visible: true },
  { id: "in-progress", label: "進行中", visible: true },
  { id: "today-hours", label: "今日工時", visible: true },
  { id: "monthly-goals", label: "本月目標", visible: true },
  { id: "my-projects", label: "我的項目", visible: true },
  { id: "stale-tasks", label: "停滯任務", visible: true },
  { id: "time-suggestions", label: "時間建議", visible: true },
];

interface WidgetSettingsProps {
  onChange?: (widgets: WidgetConfig[]) => void;
}

/**
 * WidgetSettings — gear icon dropdown to toggle dashboard widget visibility.
 * Persists selection to /api/users/me/dashboard-layout.
 */
export default function WidgetSettings({ onChange }: WidgetSettingsProps) {
  const [open, setOpen] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved layout on mount
  useEffect(() => {
    fetch("/api/users/me/dashboard-layout")
      .then((r) => r.json())
      .then((body) => {
        const layout = body?.data?.layout as Array<{ id: string; visible: boolean }> | undefined;
        if (!Array.isArray(layout) || layout.length === 0) return;
        setWidgets((prev) =>
          prev.map((w) => {
            const saved = layout.find((s) => s.id === w.id);
            return saved !== undefined ? { ...w, visible: saved.visible } : w;
          })
        );
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = async (id: string) => {
    const next = widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );
    setWidgets(next);
    onChange?.(next);

    setSaving(true);
    try {
      const payload = next.map(({ id: wId, visible }) => ({ id: wId, visible }));
      const res = await fetch("/api/users/me/dashboard-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("儲存失敗");
    } catch {
      toast.error("Widget 設定儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        aria-label="Widget 設定"
        title="Widget 設定"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          saving && "opacity-50 cursor-not-allowed"
        )}
        disabled={saving}
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-popover border border-border rounded-lg shadow-lg py-1">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">顯示的 Widget</p>
          {widgets.map((w) => (
            <label
              key={w.id}
              className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-accent/60 transition-colors"
            >
              <input
                type="checkbox"
                checked={w.visible}
                onChange={() => toggle(w.id)}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-foreground">{w.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_WIDGETS };
