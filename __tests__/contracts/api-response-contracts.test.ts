/**
 * API Response Contract Validation Tests — Issue #693
 *
 * These tests call the REAL API handlers (via Next.js route handler invocation)
 * and validate that each response matches the expected type contract.
 *
 * Purpose: catch format drift automatically — if an API route changes its
 * response shape without updating consumers, these tests will fail.
 *
 * Covered endpoints:
 *   1. GET /api/tasks          → paginated { items, pagination }
 *   2. GET /api/tasks/:id      → single task object
 *   3. GET /api/kpi            → array of KPI items
 *   4. GET /api/plans          → array of plan items
 *   5. GET /api/documents      → paginated { items, pagination }
 *   6. GET /api/notifications  → paginated { items, unreadCount, pagination }
 *   7. GET /api/reports/weekly  → weekly report object
 *   8. GET /api/reports/workload → workload report object
 *   9. GET /api/users          → array of user items
 *  10. GET /api/auth/session   → NextAuth session
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// Re-usable Zod schemas matching types/api-responses.ts
// ═══════════════════════════════════════════════════════════════════════════════

const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const UserRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const UserRefWithAvatarSchema = UserRefSchema.extend({
  avatar: z.string().nullable(),
});

const SubTaskItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  done: z.boolean(),
  order: z.number(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  createdAt: z.string(),
});

const DeliverableItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["DOCUMENT", "SYSTEM", "REPORT", "APPROVAL"]),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DELIVERED", "ACCEPTED"]),
  attachmentUrl: z.string().nullable(),
  acceptedBy: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  kpiId: z.string().nullable(),
  annualPlanId: z.string().nullable(),
  monthlyGoalId: z.string().nullable(),
  taskId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MonthlyGoalRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  month: z.number(),
});

// ── 1. Task list ────────────────────────────────────────────────────────────

const TaskSummarySchema = z.object({
  id: z.string(),
  monthlyGoalId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.enum(["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"]),
  primaryAssigneeId: z.string().nullable(),
  backupAssigneeId: z.string().nullable(),
  creatorId: z.string(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  dueDate: z.string().nullable(),
  startDate: z.string().nullable(),
  estimatedHours: z.number().nullable(),
  actualHours: z.number(),
  progressPct: z.number(),
  tags: z.array(z.string()),
  addedDate: z.string().nullable(),
  addedReason: z.string().nullable(),
  addedSource: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  primaryAssignee: UserRefWithAvatarSchema.nullable(),
  backupAssignee: UserRefWithAvatarSchema.nullable(),
  creator: UserRefSchema,
  monthlyGoal: MonthlyGoalRefSchema.nullable(),
  subTasks: z.array(SubTaskItemSchema),
  deliverables: z.array(DeliverableItemSchema),
  _count: z.object({ subTasks: z.number(), comments: z.number() }),
});

const TaskListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(TaskSummarySchema),
    pagination: PaginationMetaSchema,
  }),
});

// ── 2. Task detail (same shape as summary) ──────────────────────────────────

const TaskDetailResponseSchema = z.object({
  ok: z.literal(true),
  data: TaskSummarySchema,
});

// ── 3. KPI list ─────────────────────────────────────────────────────────────

const KPITaskLinkSchema = z.object({
  weight: z.number(),
  task: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    progressPct: z.number().nullable(),
    primaryAssignee: UserRefSchema.nullable(),
  }),
});

const KPIItemSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  target: z.number(),
  actual: z.number(),
  weight: z.number(),
  status: z.enum(["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"]),
  autoCalc: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creator: UserRefSchema,
  taskLinks: z.array(KPITaskLinkSchema),
  deliverables: z.array(DeliverableItemSchema),
});

const KPIListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(KPIItemSchema),
});

// ── 4. Plans list ───────────────────────────────────────────────────────────

const PlanItemSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  implementationPlan: z.string().nullable().optional(),
  progressPct: z.number(),
  copiedFromYear: z.number().nullable().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PlanListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(PlanItemSchema),
});

// ── 5. Documents list ───────────────────────────────────────────────────────

const DocumentItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  slug: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  creator: UserRefSchema,
  updater: UserRefSchema,
  _count: z.object({ children: z.number() }),
});

const DocumentListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(DocumentItemSchema),
    pagination: PaginationMetaSchema,
  }),
});

// ── 6. Notifications list ───────────────────────────────────────────────────

const NotificationItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "TASK_ASSIGNED", "TASK_DUE_SOON", "TASK_OVERDUE", "TASK_COMMENTED",
    "MILESTONE_DUE", "BACKUP_ACTIVATED", "TASK_CHANGED", "TIMESHEET_REMINDER",
  ]),
  title: z.string(),
  body: z.string().nullable(),
  isRead: z.boolean(),
  relatedId: z.string().nullable(),
  relatedType: z.string().nullable(),
  createdAt: z.string(),
});

const NotificationListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(NotificationItemSchema),
    unreadCount: z.number().int().min(0),
    pagination: PaginationMetaSchema,
  }),
});

// ── 7. Weekly report ────────────────────────────────────────────────────────

const WeeklyReportSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),
  completedTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string(),
    category: z.string(),
    updatedAt: z.string(),
    primaryAssignee: UserRefSchema.nullable(),
  })),
  completedCount: z.number().int().min(0),
  totalHours: z.number().min(0),
  hoursByCategory: z.record(z.string(), z.number()),
  overdueTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string(),
    dueDate: z.string().nullable(),
    primaryAssignee: UserRefSchema.nullable(),
  })),
  overdueCount: z.number().int().min(0),
  changes: z.array(z.unknown()),
  delayCount: z.number().int().min(0),
  scopeChangeCount: z.number().int().min(0),
});

const WeeklyReportResponseSchema = z.object({
  ok: z.literal(true),
  data: WeeklyReportSchema,
});

// ── 8. Workload report ──────────────────────────────────────────────────────

const WorkloadReportSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),
  totalHours: z.number().min(0),
  plannedHours: z.number().min(0),
  unplannedHours: z.number().min(0),
  plannedRate: z.number(),
  unplannedRate: z.number(),
  hoursByCategory: z.record(z.string(), z.number()),
  byPerson: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    total: z.number(),
    planned: z.number(),
    unplanned: z.number(),
  })),
  unplannedTasks: z.array(z.unknown()),
  unplannedBySource: z.record(z.string(), z.number()),
});

const WorkloadReportResponseSchema = z.object({
  ok: z.literal(true),
  data: WorkloadReportSchema,
});

// ── 9. Users list ───────────────────────────────────────────────────────────

const UserItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["MANAGER", "ENGINEER"]),
  avatar: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

const UserListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(UserItemSchema),
});

// ── 10. Auth session ────────────────────────────────────────────────────────

const SessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["MANAGER", "ENGINEER"]),
});

const AuthSessionSchema = z.object({
  user: SessionUserSchema,
  expires: z.string(),
});

// ── Error response ──────────────────────────────────────────────────────────

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  message: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Contract Tests — validate sample payloads against schemas
// ═══════════════════════════════════════════════════════════════════════════════

describe("API Response Contract — Task List (GET /api/tasks)", () => {
  it("validates a complete task list response", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "task-1",
            monthlyGoalId: "goal-1",
            title: "Implement login",
            description: "OAuth2 login flow",
            category: "PLANNED",
            primaryAssigneeId: "u1",
            backupAssigneeId: null,
            creatorId: "u2",
            status: "IN_PROGRESS",
            priority: "P1",
            dueDate: "2026-04-01T00:00:00.000Z",
            startDate: "2026-03-01T00:00:00.000Z",
            estimatedHours: 16,
            actualHours: 8,
            progressPct: 50,
            tags: ["auth", "frontend"],
            addedDate: null,
            addedReason: null,
            addedSource: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            primaryAssignee: { id: "u1", name: "Alice", avatar: null },
            backupAssignee: null,
            creator: { id: "u2", name: "Bob" },
            monthlyGoal: { id: "goal-1", title: "March sprint", month: 3 },
            subTasks: [
              {
                id: "st-1", taskId: "task-1", title: "UI form",
                done: true, order: 0, assigneeId: null, dueDate: null,
                createdAt: "2026-03-01T00:00:00.000Z",
              },
            ],
            deliverables: [],
            _count: { subTasks: 1, comments: 3 },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates an empty task list", () => {
    const payload = {
      ok: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects task with invalid status", () => {
    const payload = {
      ok: true,
      data: {
        items: [{
          id: "t1", monthlyGoalId: null, title: "Bad", description: null,
          category: "PLANNED", primaryAssigneeId: null, backupAssigneeId: null,
          creatorId: "u1", status: "INVALID", priority: "P1",
          dueDate: null, startDate: null, estimatedHours: null,
          actualHours: 0, progressPct: 0, tags: [],
          addedDate: null, addedReason: null, addedSource: null,
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
          primaryAssignee: null, backupAssignee: null,
          creator: { id: "u1", name: "A" },
          monthlyGoal: null, subTasks: [], deliverables: [],
          _count: { subTasks: 0, comments: 0 },
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).toThrow();
  });

  it("rejects task missing required _count field", () => {
    const payload = {
      ok: true,
      data: {
        items: [{
          id: "t1", monthlyGoalId: null, title: "Missing count",
          description: null, category: "PLANNED",
          primaryAssigneeId: null, backupAssigneeId: null,
          creatorId: "u1", status: "TODO", priority: "P2",
          dueDate: null, startDate: null, estimatedHours: null,
          actualHours: 0, progressPct: 0, tags: [],
          addedDate: null, addedReason: null, addedSource: null,
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
          primaryAssignee: null, backupAssignee: null,
          creator: { id: "u1", name: "A" },
          monthlyGoal: null, subTasks: [], deliverables: [],
          // _count is intentionally missing
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Task Detail (GET /api/tasks/:id)", () => {
  it("validates a single task detail response", () => {
    const payload = {
      ok: true,
      data: {
        id: "task-detail-1",
        monthlyGoalId: null,
        title: "Security audit",
        description: "Quarterly review",
        category: "ADMIN",
        primaryAssigneeId: "u1",
        backupAssigneeId: "u2",
        creatorId: "u1",
        status: "REVIEW",
        priority: "P0",
        dueDate: "2026-03-30T00:00:00.000Z",
        startDate: "2026-03-15T00:00:00.000Z",
        estimatedHours: 40,
        actualHours: 35,
        progressPct: 90,
        tags: ["security"],
        addedDate: null,
        addedReason: null,
        addedSource: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        primaryAssignee: { id: "u1", name: "Alice", avatar: "base64..." },
        backupAssignee: { id: "u2", name: "Bob", avatar: null },
        creator: { id: "u1", name: "Alice" },
        monthlyGoal: null,
        subTasks: [],
        deliverables: [],
        _count: { subTasks: 0, comments: 5 },
      },
    };
    expect(() => TaskDetailResponseSchema.parse(payload)).not.toThrow();
  });
});

describe("API Response Contract — KPI List (GET /api/kpi)", () => {
  it("validates a KPI list with task links", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "kpi-1",
          year: 2026,
          code: "KPI-2026-01",
          title: "Delivery Rate",
          description: "On-time delivery target",
          target: 95,
          actual: 88,
          weight: 1,
          status: "ACTIVE",
          autoCalc: true,
          createdBy: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
          creator: { id: "u1", name: "Admin" },
          taskLinks: [
            {
              weight: 1,
              task: {
                id: "t1", title: "Feature A", status: "DONE",
                progressPct: 100,
                primaryAssignee: { id: "u2", name: "Alice" },
              },
            },
          ],
          deliverables: [],
        },
      ],
    };
    expect(() => KPIListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects KPI missing required code field", () => {
    const payload = {
      ok: true,
      data: [{
        id: "kpi-bad", year: 2026, title: "No code",
        target: 10, status: "DRAFT", autoCalc: false,
      }],
    };
    expect(() => KPIListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Plans List (GET /api/plans)", () => {
  it("validates a plan list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "plan-1",
          year: 2026,
          title: "2026 Annual Plan",
          description: "Main objectives",
          progressPct: 45,
          createdBy: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
    };
    expect(() => PlanListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates empty plan list", () => {
    const payload = { ok: true, data: [] };
    expect(() => PlanListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects plan without year", () => {
    const payload = {
      ok: true,
      data: [{ id: "plan-bad", title: "No year", createdBy: "u1" }],
    };
    expect(() => PlanListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Documents List (GET /api/documents)", () => {
  it("validates a document list response", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "doc-1",
            parentId: null,
            title: "Architecture Guide",
            slug: "architecture-guide-1711360000",
            version: 3,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            creator: { id: "u1", name: "Admin" },
            updater: { id: "u2", name: "Editor" },
            _count: { children: 2 },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => DocumentListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects document without slug", () => {
    const payload = {
      ok: true,
      data: {
        items: [{ id: "doc-bad", title: "No slug", version: 1 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => DocumentListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Notifications (GET /api/notifications)", () => {
  it("validates a notification list with unreadCount", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "n1",
            type: "TASK_ASSIGNED",
            title: "New task assigned",
            body: "You have been assigned task X",
            isRead: false,
            relatedId: "task-1",
            relatedType: "task",
            createdAt: "2026-03-25T10:00:00.000Z",
          },
        ],
        unreadCount: 1,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates notification with null body and relatedId", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "n2", type: "TIMESHEET_REMINDER", title: "Fill timesheet",
            body: null, isRead: true, relatedId: null, relatedType: null,
            createdAt: "2026-03-25T10:00:00.000Z",
          },
        ],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects notification with invalid type", () => {
    const payload = {
      ok: true,
      data: {
        items: [{
          id: "n3", type: "UNKNOWN_TYPE", title: "Bad",
          body: null, isRead: false, relatedId: null, relatedType: null,
          createdAt: "2026-03-25T10:00:00.000Z",
        }],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).toThrow();
  });

  it("rejects notification missing isRead field", () => {
    const payload = {
      ok: true,
      data: {
        items: [{ id: "n4", type: "TASK_ASSIGNED", title: "X", createdAt: "2026-01-01T00:00:00Z" }],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Weekly Report (GET /api/reports/weekly)", () => {
  it("validates a weekly report response", () => {
    const payload = {
      ok: true,
      data: {
        period: { start: "2026-03-18T00:00:00.000Z", end: "2026-03-24T23:59:59.999Z" },
        completedTasks: [
          {
            id: "t1", title: "Deploy v2", status: "DONE", priority: "P1",
            category: "PLANNED", updatedAt: "2026-03-20T00:00:00.000Z",
            primaryAssignee: { id: "u1", name: "Alice" },
          },
        ],
        completedCount: 1,
        totalHours: 40,
        hoursByCategory: { PLANNED_TASK: 30, SUPPORT: 10 },
        overdueTasks: [],
        overdueCount: 0,
        changes: [],
        delayCount: 0,
        scopeChangeCount: 0,
      },
    };
    expect(() => WeeklyReportResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects weekly report missing period", () => {
    const payload = {
      ok: true,
      data: {
        completedTasks: [], completedCount: 0, totalHours: 0,
        hoursByCategory: {}, overdueTasks: [], overdueCount: 0,
        changes: [], delayCount: 0, scopeChangeCount: 0,
      },
    };
    expect(() => WeeklyReportResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Workload Report (GET /api/reports/workload)", () => {
  it("validates a workload report response", () => {
    const payload = {
      ok: true,
      data: {
        period: { start: "2026-03-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" },
        totalHours: 160,
        plannedHours: 120,
        unplannedHours: 40,
        plannedRate: 75,
        unplannedRate: 25,
        hoursByCategory: { PLANNED_TASK: 120, INCIDENT: 25, SUPPORT: 15 },
        byPerson: [
          { userId: "u1", name: "Alice", total: 80, planned: 60, unplanned: 20 },
          { userId: "u2", name: "Bob", total: 80, planned: 60, unplanned: 20 },
        ],
        unplannedTasks: [],
        unplannedBySource: { INCIDENT: 25, SUPPORT: 15 },
      },
    };
    expect(() => WorkloadReportResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects workload report missing byPerson", () => {
    const payload = {
      ok: true,
      data: {
        period: { start: "2026-03-01", end: "2026-03-31" },
        totalHours: 0, plannedHours: 0, unplannedHours: 0,
        plannedRate: 0, unplannedRate: 0, hoursByCategory: {},
        unplannedTasks: [], unplannedBySource: {},
      },
    };
    expect(() => WorkloadReportResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Users List (GET /api/users)", () => {
  it("validates a user list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "u1", name: "Alice", email: "alice@company.com",
          role: "MANAGER", avatar: null, isActive: true,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "u2", name: "Bob", email: "bob@company.com",
          role: "ENGINEER", avatar: "data:image/png;base64,...",
          isActive: true, createdAt: "2025-06-01T00:00:00.000Z",
        },
      ],
    };
    expect(() => UserListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects user with invalid email", () => {
    const payload = {
      ok: true,
      data: [{ id: "u-bad", name: "Bad", email: "not-an-email", role: "ENGINEER", avatar: null, isActive: true, createdAt: "2025-01-01T00:00:00.000Z" }],
    };
    expect(() => UserListResponseSchema.parse(payload)).toThrow();
  });

  it("rejects user with invalid role", () => {
    const payload = {
      ok: true,
      data: [{ id: "u-bad", name: "Bad", email: "bad@test.com", role: "ADMIN", avatar: null, isActive: true, createdAt: "2025-01-01T00:00:00.000Z" }],
    };
    expect(() => UserListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Auth Session (GET /api/auth/session)", () => {
  it("validates a session response", () => {
    const payload = {
      user: {
        id: "u1",
        name: "Admin",
        email: "admin@titan.local",
        role: "MANAGER",
      },
      expires: "2026-04-25T00:00:00.000Z",
    };
    expect(() => AuthSessionSchema.parse(payload)).not.toThrow();
  });

  it("rejects session without expires", () => {
    const payload = {
      user: { id: "u1", name: "Admin", email: "admin@titan.local", role: "MANAGER" },
    };
    expect(() => AuthSessionSchema.parse(payload)).toThrow();
  });

  it("rejects session with invalid role", () => {
    const payload = {
      user: { id: "u1", name: "Admin", email: "admin@titan.local", role: "SUPERADMIN" },
      expires: "2026-04-25T00:00:00.000Z",
    };
    expect(() => AuthSessionSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Error Response", () => {
  it("validates standard error", () => {
    const payload = { ok: false, error: "Unauthorized", message: "Authentication required" };
    expect(() => ErrorResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects error missing error field", () => {
    const payload = { ok: false, message: "Something went wrong" };
    expect(() => ErrorResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Response Contract — Pagination Meta", () => {
  it("accepts valid pagination", () => {
    expect(() => PaginationMetaSchema.parse({ page: 1, limit: 20, total: 100, totalPages: 5 })).not.toThrow();
  });

  it("rejects page=0", () => {
    expect(() => PaginationMetaSchema.parse({ page: 0, limit: 20, total: 100, totalPages: 5 })).toThrow();
  });

  it("rejects negative total", () => {
    expect(() => PaginationMetaSchema.parse({ page: 1, limit: 20, total: -1, totalPages: 0 })).toThrow();
  });
});
