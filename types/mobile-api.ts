/**
 * TITAN Mobile API Types — Auto-generated from prisma/schema.prisma
 * Generated: 2026-04-02
 *
 * DO NOT EDIT MANUALLY — run `npm run generate:mobile-types` to regenerate.
 * See scripts/generate-mobile-types.ts for the generator.
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

// ═══════════════════════════════════════════════════════════
// Enums (string unions — no runtime overhead)
// ═══════════════════════════════════════════════════════════

export type Role = "ADMIN" | "MANAGER" | "ENGINEER";
export type KPIStatus = "DRAFT" | "ACTIVE" | "ACHIEVED" | "MISSED" | "CANCELLED";
export type KPIFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type KPIVisibility = "ALL" | "MANAGER";
export type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
export type MilestoneType = "LAUNCH" | "AUDIT" | "CUSTOM";
export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskCategory = "PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";
export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";
export type CMChangeType = "NORMAL" | "STANDARD" | "EMERGENCY";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ChangeStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "VERIFYING" | "COMPLETED" | "ROLLED_BACK" | "CANCELLED";
export type ChangeType = "DELAY" | "SCOPE_CHANGE";
export type DeliverableType = "DOCUMENT" | "SYSTEM" | "REPORT" | "APPROVAL";
export type DeliverableStatus = "NOT_STARTED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED";
export type TimeCategory = "PLANNED_TASK" | "ADDED_TASK" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";
export type OvertimeType = "NONE" | "WEEKDAY" | "REST_DAY" | "HOLIDAY";
export type TimesheetApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type NotificationType = "TASK_ASSIGNED" | "TASK_DUE_SOON" | "TASK_OVERDUE" | "TASK_COMMENTED" | "MILESTONE_DUE" | "BACKUP_ACTIVATED" | "TASK_CHANGED" | "TIMESHEET_REMINDER" | "TIMESHEET_REJECTED" | "SLA_EXPIRING" | "VERIFICATION_DUE" | "MANAGER_FLAG";
export type DocumentStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED" | "RETIRED";
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApprovalType = "TASK_STATUS_CHANGE" | "DELIVERABLE_ACCEPTANCE" | "PLAN_MODIFICATION" | "CHANGE_REQUEST";
export type AlertStatus = "FIRING" | "RESOLVED" | "ACKNOWLEDGED";
export type SpaceRole = "OWNER" | "EDITOR" | "VIEWER";
export type LinkType = "REFERENCE" | "RELATED";
export type PushPlatform = "IOS" | "ANDROID";

// ═══════════════════════════════════════════════════════════
// Models (mobile-facing fields only)
// ═══════════════════════════════════════════════════════════

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KPI {
  id: string;
  year: number;
  code: string;
  title: string;
  description?: string;
  measureMethod?: string;
  target: number;
  actual: number;
  weight: number;
  frequency: KPIFrequency;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  visibility: KPIVisibility;
  status: KPIStatus;
  autoCalc: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIAchievement {
  id: string;
  kpiId: string;
  period: string;
  actualValue: number;
  note?: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualPlan {
  id: string;
  year: number;
  title: string;
  description?: string;
  vision?: string;
  implementationPlan?: string;
  progressPct: number;
  copiedFromYear?: number;
  archivedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  annualPlanId: string;
  month: number;
  title: string;
  description?: string;
  assigneeId?: string;
  retrospectiveNote?: string;
  status: GoalStatus;
  progressPct: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  annualPlanId: string;
  title: string;
  description?: string;
  type: MilestoneType;
  plannedStart?: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: MilestoneStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  annualPlanId?: string;
  monthlyGoalId?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  primaryAssigneeId?: string;
  backupAssigneeId?: string;
  creatorId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours: number;
  progressPct: number;
  position: number;
  tags?: string[];
  addedDate?: string;
  addedReason?: string;
  addedSource?: string;
  slaDeadline?: string;
  managerFlagged: boolean;
  flagReason?: string;
  flaggedAt?: string;
  flaggedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  order: number;
  assigneeId?: string;
  dueDate?: string;
  notes?: string;
  result?: string;
  completedAt?: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  detail?: unknown;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  attachmentUrl?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  kpiId?: string;
  annualPlanId?: string;
  monthlyGoalId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  taskId?: string;
  userId: string;
  date: string;
  hours: number;
  category: TimeCategory;
  description?: string;
  createdAt: string;
  updatedAt: string;
  startTime?: string;
  endTime?: string;
  overtime: boolean;
  overtimeType: OvertimeType;
  locked: boolean;
  approvalStatus: TimesheetApprovalStatus;
  isRunning: boolean;
  sortOrder: number;
  isDeleted: boolean;
  deletedAt?: string;
  subTaskId?: string;
}

export interface TimeEntryTemplate {
  id: string;
  name: string;
  userId: string;
  entries: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryTemplateItem {
  id: string;
  templateId: string;
  taskId?: string;
  hours: number;
  category: TimeCategory;
  description?: string;
  sortOrder: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  relatedId?: string;
  relatedType?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSpace {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  icon?: string;
  color?: string;
  visibility: string;
  sortOrder: number;
  updatedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  spaceId?: string;
  parentId?: string;
  title: string;
  content: string;
  slug: string;
  tags?: string[];
  status: DocumentStatus;
  createdBy: string;
  updatedBy: string;
  version: number;
  verifierId?: string;
  verifiedAt?: string;
  verifyIntervalDays?: number;
  verifyByDate?: string;
  categoryId?: string;
  summary?: string;
  pinned: boolean;
  coverImage?: string;
  publishedVersion?: number;
  publishedAt?: string;
  publishedBy?: string;
  archivedAt?: string;
  archivedBy?: string;
  wordCount: number;
  readTimeMin: number;
  visibility: string;
  replacedById?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

export interface MobileLoginResponse {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: Pick<User, "id" | "name" | "email" | "role">;
}

export interface MobileRefreshResponse {
  token?: string;
  refreshToken: string;
  expiresAt?: number;
  expiresIn: number;
  user: Pick<User, "id" | "name" | "email" | "role">;
}
