// ── Shared KPI Types ──────────────────────────────────────────────────────

export interface KPITaskLink {
  taskId: string;
  weight: number;
  task: {
    id: string;
    title: string;
    status: string;
    progressPct: number;
    primaryAssignee?: { id: string; name: string } | null;
  };
}

export interface KPI {
  id: string;
  year: number;
  code: string;
  title: string;
  description?: string | null;
  measureMethod?: string | null;
  target: number;
  actual: number;
  weight: number;
  frequency: string;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
  visibility: string;
  status: string;
  autoCalc: boolean;
  taskLinks: KPITaskLink[];
  creator?: { id: string; name: string } | null;
}

export interface AvailableTask {
  id: string;
  title: string;
  status: string;
}

export interface KpiHistory {
  period: string;
  actual: number;
  note?: string | null;
}

export type KpiFormErrors = Partial<Record<string, string>>;

// ── Label Maps ────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "啟用",
  ACHIEVED: "達成",
  MISSED: "未達",
  CANCELLED: "停用",
};

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  ACTIVE: "text-success bg-success/10",
  ACHIEVED: "text-blue-400 bg-blue-500/10",
  MISSED: "text-danger bg-danger/10",
  CANCELLED: "text-muted-foreground bg-muted/50",
};

export const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "月報",
  QUARTERLY: "季報",
  YEARLY: "年報",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  ALL: "全員可見",
  MANAGER: "僅管理者",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "待辦",
  IN_PROGRESS: "進行中",
  DONE: "完成",
  BLOCKED: "封鎖",
};
