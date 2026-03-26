"use client";

import { useState, useCallback, useMemo } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

type PresetId = "this-week" | "this-month" | "this-quarter" | "this-year" | "custom";

interface Preset {
  id: PresetId;
  label: string;
  getRange: () => DateRange;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTaipeiNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
}

function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  result.setDate(result.getDate() - day + (day === 0 ? -6 : 1));
  return result;
}

function getSunday(d: Date): Date {
  const mon = getMonday(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return sun;
}

function getQuarterStart(d: Date): Date {
  const month = d.getMonth();
  const qStart = month - (month % 3);
  return new Date(d.getFullYear(), qStart, 1);
}

function getQuarterEnd(d: Date): Date {
  const month = d.getMonth();
  const qEnd = month - (month % 3) + 2;
  return new Date(d.getFullYear(), qEnd + 1, 0);
}

const PRESETS: Preset[] = [
  {
    id: "this-week",
    label: "本週",
    getRange: () => {
      const now = getTaipeiNow();
      return { from: toDateStr(getMonday(now)), to: toDateStr(getSunday(now)) };
    },
  },
  {
    id: "this-month",
    label: "本月",
    getRange: () => {
      const now = getTaipeiNow();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateStr(start), to: toDateStr(end) };
    },
  },
  {
    id: "this-quarter",
    label: "本季",
    getRange: () => {
      const now = getTaipeiNow();
      return { from: toDateStr(getQuarterStart(now)), to: toDateStr(getQuarterEnd(now)) };
    },
  },
  {
    id: "this-year",
    label: "本年",
    getRange: () => {
      const now = getTaipeiNow();
      return { from: toDateStr(new Date(now.getFullYear(), 0, 1)), to: toDateStr(new Date(now.getFullYear(), 11, 31)) };
    },
  },
];

const MAX_RANGE_DAYS = 366; // 1 year max

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetId>("this-month");
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  const handlePreset = useCallback((preset: Preset) => {
    setActivePreset(preset.id);
    setShowCustom(false);
    setError(null);
    onChange(preset.getRange());
  }, [onChange]);

  const handleCustom = useCallback(() => {
    setActivePreset("custom");
    setShowCustom(true);
  }, []);

  const applyCustom = useCallback(() => {
    if (!customFrom || !customTo) { setError("請選擇起始和結束日期"); return; }
    if (customFrom > customTo) { setError("起始日不可晚於結束日"); return; }
    const diff = (new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24);
    if (diff > MAX_RANGE_DAYS) { setError("日期範圍不可超過 1 年"); return; }
    setError(null);
    onChange({ from: customFrom, to: customTo });
  }, [customFrom, customTo, onChange]);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => handlePreset(p)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
            activePreset === p.id
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-accent"
          )}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={handleCustom}
        className={cn(
          "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
          activePreset === "custom"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-foreground hover:bg-accent"
        )}
      >
        自訂
      </button>

      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground"
          />
          <button
            onClick={applyCustom}
            className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            套用
          </button>
        </div>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}

      <span className="text-[10px] text-muted-foreground ml-auto">
        {value.from} ~ {value.to}
      </span>
    </div>
  );
}

/** Helper: get default date range (this month) */
export function getDefaultDateRange(): DateRange {
  return PRESETS[1].getRange(); // this-month
}
