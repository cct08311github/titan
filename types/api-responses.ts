/**
 * API Response Type Definitions — Issue #692
 *
 * TypeScript types for the top 10 most-used API endpoints.
 * These serve as the contract between API routes and frontend consumers.
 *
 * Covered endpoints:
 *   1. GET /api/tasks          (paginated)
 *   2. GET /api/tasks/:id      (detail)
 *   3. GET /api/kpi            (array)
 *   4. GET /api/plans          (array)
 *   5. GET /api/documents      (paginated)
 *   6. GET /api/notifications  (paginated + unreadCount)
 *   7. GET /api/reports/weekly
 *   8. GET /api/reports/workload
 *   9. GET /api/users          (array)
 *  10. GET /api/auth/session   (NextAuth)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Standard envelopes
// ═══════════════════════════════════════════════════════════════════════════════

/** Every successful API response wraps data in this envelope. */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Successful response — ok is always true. */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

/** Error response — ok is always false. */
export interface ApiErrorResponse {
  ok: false;
  error: string;
  message: string;
}

/** Standard pagination metadata returned by paginated endpoints. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Generic paginated data shape. */
export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Generic paginated API response. */
export type PaginatedResponse<T> = ApiSuccessResponse<PaginatedData<T>>;

// ═══════════════════════════════════════════════════════════════════════════════
// Shared sub-types (referenced by multiple endpoints)
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimal user reference embedded in related objects. */
export interface UserRef {
  id: string;
  name: string;
}

/** User reference with avatar (used in task assignees). */
export interface UserRefWithAvatar extends UserRef {
  avatar: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/tasks — Paginated task list
// ═══════════════════════════════════════════════════════════════════════════════

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskCategory = "PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";

export interface SubTaskItem {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  order: number;
  assigneeId: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface DeliverableItem {
  id: string;
  title: string;
  type: "DOCUMENT" | "SYSTEM" | "REPORT" | "APPROVAL";
  status: "NOT_STARTED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED";
  attachmentUrl: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  kpiId: string | null;
  annualPlanId: string | null;
  monthlyGoalId: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoalRef {
  id: string;
  title: string;
  month: number;
}

/** Single task item as returned in the paginated list. */
export interface TaskSummary {
  id: string;
  monthlyGoalId: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  primaryAssigneeId: string | null;
  backupAssigneeId: string | null;
  creatorId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  estimatedHours: number | null;
  actualHours: number;
  progressPct: number;
  tags: string[];
  addedDate: string | null;
  addedReason: string | null;
  addedSource: string | null;
  createdAt: string;
  updatedAt: string;
  primaryAssignee: UserRefWithAvatar | null;
  backupAssignee: UserRefWithAvatar | null;
  creator: UserRef;
  monthlyGoal: MonthlyGoalRef | null;
  subTasks: SubTaskItem[];
  deliverables: DeliverableItem[];
  _count: { subTasks: number; comments: number };
}

/** GET /api/tasks response type. */
export type TaskListResponse = PaginatedResponse<TaskSummary>;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/tasks/:id — Task detail
// ═══════════════════════════════════════════════════════════════════════════════

/** Task detail has the same shape as the list item (full include). */
export type TaskDetailResponse = ApiSuccessResponse<TaskSummary>;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GET /api/kpi — KPI list (array, not paginated)
// ═══════════════════════════════════════════════════════════════════════════════

export type KPIStatus = "DRAFT" | "ACTIVE" | "ACHIEVED" | "MISSED" | "CANCELLED";

export interface KPITaskLink {
  weight: number;
  task: {
    id: string;
    title: string;
    status: string;
    progressPct: number | null;
    primaryAssignee: UserRef | null;
  };
}

export interface KPIItem {
  id: string;
  year: number;
  code: string;
  title: string;
  description: string | null;
  target: number;
  actual: number;
  weight: number;
  status: KPIStatus;
  autoCalc: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: UserRef;
  taskLinks: KPITaskLink[];
  deliverables: DeliverableItem[];
}

/** GET /api/kpi response type. */
export type KPIListResponse = ApiSuccessResponse<KPIItem[]>;

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GET /api/plans — Annual plan list (array, not paginated)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanItem {
  id: string;
  year: number;
  title: string;
  description: string | null;
  implementationPlan: string | null;
  progressPct: number;
  copiedFromYear: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/plans response type. */
export type PlanListResponse = ApiSuccessResponse<PlanItem[]>;

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GET /api/documents — Paginated document list
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentItem {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  creator: UserRef;
  updater: UserRef;
  _count: { children: number };
}

/** GET /api/documents response type. */
export type DocumentListResponse = PaginatedResponse<DocumentItem>;

// ═══════════════════════════════════════════════════════════════════════════════
// 6. GET /api/notifications — Paginated with unreadCount
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "TASK_COMMENTED"
  | "MILESTONE_DUE"
  | "BACKUP_ACTIVATED"
  | "TASK_CHANGED"
  | "TIMESHEET_REMINDER";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  relatedId: string | null;
  relatedType: string | null;
  createdAt: string;
}

/** Notifications have a special data shape with unreadCount alongside pagination. */
export interface NotificationListData {
  items: NotificationItem[];
  unreadCount: number;
  pagination: PaginationMeta;
}

/** GET /api/notifications response type. */
export type NotificationListResponse = ApiSuccessResponse<NotificationListData>;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. GET /api/reports/weekly
// ═══════════════════════════════════════════════════════════════════════════════

export interface WeeklyReportData {
  period: { start: string; end: string };
  completedTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    updatedAt: string;
    primaryAssignee: UserRef | null;
  }>;
  completedCount: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  overdueTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    primaryAssignee: UserRef | null;
  }>;
  overdueCount: number;
  changes: Array<{
    id: string;
    taskId: string;
    changeType: "DELAY" | "SCOPE_CHANGE";
    reason: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
    changedAt: string;
    task: { id: string; title: string };
    changedByUser: UserRef;
  }>;
  delayCount: number;
  scopeChangeCount: number;
}

/** GET /api/reports/weekly response type. */
export type WeeklyReportResponse = ApiSuccessResponse<WeeklyReportData>;

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GET /api/reports/workload
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkloadByPerson {
  userId: string;
  name: string;
  total: number;
  planned: number;
  unplanned: number;
}

export interface WorkloadReportData {
  period: { start: string; end: string };
  totalHours: number;
  plannedHours: number;
  unplannedHours: number;
  plannedRate: number;
  unplannedRate: number;
  hoursByCategory: Record<string, number>;
  byPerson: WorkloadByPerson[];
  unplannedTasks: unknown[];
  unplannedBySource: Record<string, number>;
}

/** GET /api/reports/workload response type. */
export type WorkloadReportResponse = ApiSuccessResponse<WorkloadReportData>;

// ═══════════════════════════════════════════════════════════════════════════════
// 9. GET /api/users — User list (array, not paginated)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "MANAGER" | "ENGINEER";
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
}

/** GET /api/users response type. */
export type UserListResponse = ApiSuccessResponse<UserItem[]>;

// ═══════════════════════════════════════════════════════════════════════════════
// 10. GET /api/auth/session — NextAuth session
// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "MANAGER" | "ENGINEER";
}

export interface SessionData {
  user: SessionUser;
  expires: string;
}

/**
 * GET /api/auth/session response type.
 * NextAuth returns the session directly (not wrapped in ok/data envelope).
 */
export type AuthSessionResponse = SessionData;
