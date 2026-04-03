/**
 * PMO Project Management — shared constants (Issue #1168 / #1178)
 */

export const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "提案",
  EVALUATING: "評估中",
  APPROVED: "已核准",
  SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析",
  DESIGN: "系統設計",
  DEVELOPMENT: "開發中",
  TESTING: "測試中",
  DEPLOYMENT: "部署中",
  WARRANTY: "保固期",
  COMPLETED: "已完成",
  POST_REVIEW: "後評價",
  CLOSED: "已關閉",
  ON_HOLD: "暫停",
  CANCELLED: "已取消",
};

export const STATUS_COLORS: Record<string, string> = {
  PROPOSED:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  EVALUATING:
    "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  APPROVED:
    "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  SCHEDULED:
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  REQUIREMENTS:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DESIGN:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DEVELOPMENT:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  TESTING:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DEPLOYMENT:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  WARRANTY:
    "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400",
  COMPLETED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST_REVIEW:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CLOSED: "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  ON_HOLD:
    "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
  CANCELLED:
    "bg-red-200 text-red-500 dark:bg-red-900/40 dark:text-red-500",
};

export const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 緊急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
};

export const PRIORITY_COLORS: Record<string, string> = {
  P0: "text-red-500",
  P1: "text-orange-500",
  P2: "text-blue-500",
  P3: "text-gray-400",
};

export const RISK_SCORE_COLOR = (score: number) => {
  if (score >= 12) return "bg-red-500/10 text-red-500";
  if (score >= 8) return "bg-orange-500/10 text-orange-500";
  if (score >= 4) return "bg-yellow-500/10 text-yellow-600";
  return "bg-emerald-500/10 text-emerald-500";
};

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: "text-emerald-500",
  MEDIUM: "text-yellow-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-red-500",
};

export const GATE_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-border bg-muted text-muted-foreground",
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  BLOCKED: "border-red-500/30 bg-red-500/10 text-red-500",
  WAIVED: "border-amber-500/30 bg-amber-500/10 text-amber-500",
};

export const STATUS_FLOW = [
  "PROPOSED",
  "EVALUATING",
  "APPROVED",
  "SCHEDULED",
  "REQUIREMENTS",
  "DESIGN",
  "DEVELOPMENT",
  "TESTING",
  "DEPLOYMENT",
  "WARRANTY",
  "COMPLETED",
  "POST_REVIEW",
  "CLOSED",
];

export const MD_STAGES = [
  { key: "mdProjectMgmt", label: "專案管理" },
  { key: "mdRequirements", label: "需求分析" },
  { key: "mdDesign", label: "系統設計/架構" },
  { key: "mdDevelopment", label: "程式開發" },
  { key: "mdTesting", label: "測試(SIT+UAT)" },
  { key: "mdDeployment", label: "部署上線" },
  { key: "mdDocumentation", label: "文件撰寫" },
  { key: "mdTraining", label: "教育訓練" },
  { key: "mdMaintenance", label: "維護保固" },
  { key: "mdOther", label: "其他" },
] as const;

export const BUDGET_FIELDS = [
  { key: "budgetInternal", label: "內部人力" },
  { key: "budgetExternal", label: "外部委外" },
  { key: "budgetHardware", label: "硬體/設備" },
  { key: "budgetLicense", label: "軟體授權" },
  { key: "budgetOther", label: "其他" },
] as const;
