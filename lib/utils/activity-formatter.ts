/**
 * Activity event description formatter — Issue #810 (AF-2)
 *
 * Converts raw activity log entries into human-readable Chinese descriptions.
 * Example: "王小明 將任務『修復登入 bug』狀態從 進行中 改為 待審核"
 */

// ── Action → Label mapping ─────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  // General CRUD
  CREATE: "建立了",
  UPDATE: "更新了",
  DELETE: "刪除了",
  // Task
  STATUS_CHANGE: "變更了狀態",
  STATUS_CHANGED: "變更了狀態",
  PRIORITY_CHANGED: "變更了優先度",
  ASSIGNEE_CHANGED: "變更了負責人",
  DUE_DATE_CHANGED: "變更了截止日",
  COMMENT: "留言於",
  ASSIGN: "指派了",
  POST_TASKS: "建立了任務",
  PATCH_TASKS: "更新了任務",
  DELETE_TASK: "刪除了任務",
  GANTT_DATE_CHANGE: "調整了甘特圖日期",
  // Auth / User
  LOGIN: "登入了系統",
  LOGOUT: "登出了系統",
  LOGIN_FAILURE: "登入失敗",
  ROLE_CHANGE: "變更了角色",
  PASSWORD_CHANGE: "變更了密碼",
  PASSWORD_RESET_TOKEN_GENERATED: "產生了密碼重設連結",
  PASSWORD_RESET_COMPLETED: "完成了密碼重設",
  ACCOUNT_UNLOCK: "解鎖了帳號",
  CREATE_USER: "建立了使用者",
  UPDATE_USER: "更新了使用者",
  SUSPEND_USER: "停用了使用者",
  UNSUSPEND_USER: "恢復了使用者",
  // Time entries
  UPDATE_TIME_ENTRY: "更新了工時",
  DELETE_TIME_ENTRY: "刪除了工時",
  BATCH_APPROVE_TIME_ENTRIES: "批次核准了工時",
  BATCH_REJECT_TIME_ENTRIES: "批次退回了工時",
  REQUEST_UNLOCK_TIME_ENTRY: "申請了工時解鎖",
  // Documents
  DELETE_DOCUMENT: "刪除了文件",
  APPROVE: "核准了",
  REJECT: "退回了",
  // KPI / Permissions / Incidents
  UPSERT_KPI_ACHIEVEMENT: "更新了 KPI 達成紀錄",
  GRANT_PERMISSION: "授予了權限",
  REVOKE_PERMISSION: "撤銷了權限",
  CREATE_INCIDENT_RECORD: "建立了事件紀錄",
  UPDATE_INCIDENT_RECORD: "更新了事件紀錄",
  CREATE_CHANGE_RECORD: "建立了變更紀錄",
  UPDATE_CHANGE_RECORD: "更新了變更紀錄",
  // Other
  KUDOS: "給了讚",
  FRONTEND_ERROR: "回報了前端錯誤",
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "待排",
  TODO: "待辦",
  IN_PROGRESS: "進行中",
  REVIEW: "待審核",
  DONE: "已完成",
};

const RESOURCE_LABELS: Record<string, string> = {
  Task: "任務",
  User: "使用者",
  Document: "文件",
  AnnualPlan: "年度計畫",
  MonthlyGoal: "月目標",
  KPI: "KPI",
  TimeEntry: "工時紀錄",
};

// ── Formatter ──────────────────────────────────────────────────────────────

interface ActivityData {
  action: string;
  userName: string | null;
  resourceType: string;
  resourceName: string | null;
  detail: unknown;
  metadata: unknown;
}

/**
 * Format an activity event into a human-readable description.
 */
export function formatActivityDescription(item: ActivityData): string {
  const who = item.userName ?? "系統";
  const actionLabel = ACTION_LABELS[item.action] ?? item.action;
  const resourceLabel = RESOURCE_LABELS[item.resourceType] ?? item.resourceType;
  const resourceName = item.resourceName ? `『${item.resourceName}』` : "";

  // Special handling for status changes with detail
  if (
    (item.action === "STATUS_CHANGE" || item.action === "STATUS_CHANGED") &&
    item.detail &&
    typeof item.detail === "object"
  ) {
    const d = item.detail as Record<string, unknown>;
    const from = d.from || d.oldStatus;
    const to = d.to || d.status || d.newStatus;

    if (from && to) {
      const fromLabel = STATUS_LABELS[from as string] ?? from;
      const toLabel = STATUS_LABELS[to as string] ?? to;
      return `${who} 將${resourceLabel}${resourceName}狀態從 ${fromLabel} 改為 ${toLabel}`;
    }

    if (to) {
      const toLabel = STATUS_LABELS[to as string] ?? to;
      return `${who} 將${resourceLabel}${resourceName}狀態改為 ${toLabel}`;
    }
  }

  // Priority change with detail
  if (item.action === "PRIORITY_CHANGED" && item.detail && typeof item.detail === "object") {
    const d = item.detail as Record<string, unknown>;
    const from = d.from || d.oldPriority;
    const to = d.to || d.priority || d.newPriority;
    if (from && to) {
      return `${who} 將${resourceLabel}${resourceName}優先度從 ${from} 改為 ${to}`;
    }
  }

  // Assignee change with detail
  if (item.action === "ASSIGNEE_CHANGED" && item.detail && typeof item.detail === "object") {
    const d = item.detail as Record<string, unknown>;
    const to = d.assigneeName || d.to;
    if (to) {
      return `${who} 將${resourceLabel}${resourceName}指派給 ${to}`;
    }
  }

  // Generic format
  return `${who} ${actionLabel}${resourceLabel}${resourceName}`;
}

/**
 * Group activity items by date label (今天、昨天、更早).
 * Uses Asia/Taipei timezone.
 */
export function getDateGroupLabel(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Get dates in Asia/Taipei
  const dateTaipei = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );
  const nowTaipei = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );

  const dateDay = new Date(
    dateTaipei.getFullYear(),
    dateTaipei.getMonth(),
    dateTaipei.getDate()
  );
  const today = new Date(
    nowTaipei.getFullYear(),
    nowTaipei.getMonth(),
    nowTaipei.getDate()
  );

  const diffDays = Math.floor(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays <= 7) return `${diffDays} 天前`;

  return date.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Taipei",
  });
}
