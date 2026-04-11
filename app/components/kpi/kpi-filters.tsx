"use client";

import { Search, Filter } from "lucide-react";

export interface KpiFiltersProps {
  searchQuery: string;
  statusFilter: string;
  frequencyFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onFrequencyChange: (value: string) => void;
}

export function KpiFilters({
  searchQuery,
  statusFilter,
  frequencyFilter,
  onSearchChange,
  onStatusChange,
  onFrequencyChange,
}: KpiFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜尋 KPI 名稱或代碼..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="bg-accent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">全部狀態</option>
          <option value="DRAFT">草稿</option>
          <option value="ACTIVE">啟用</option>
          <option value="ACHIEVED">達成</option>
          <option value="MISSED">未達</option>
          <option value="CANCELLED">停用</option>
        </select>
        <select
          value={frequencyFilter}
          onChange={(e) => onFrequencyChange(e.target.value)}
          className="bg-accent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">全部頻率</option>
          <option value="MONTHLY">月報</option>
          <option value="QUARTERLY">季報</option>
          <option value="YEARLY">年報</option>
        </select>
      </div>
    </div>
  );
}
