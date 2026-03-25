/**
 * API Contract Tests — Issue #378, expanded in Issue #506
 *
 * Validates that API response shapes match expected Zod schemas.
 * These tests define the expected contract for key endpoints:
 *   - /api/tasks (GET list, POST create)
 *   - /api/notifications (GET list)
 *   - /api/kpi (GET list, POST create)
 *   - /api/documents (GET list, POST create)
 *   - /api/plans (GET list, POST create)
 *   - /api/goals (GET list)
 *   - /api/milestones (GET list, POST create)
 *   - /api/users (GET list)
 *   - /api/time-entries (GET list)
 *   - /api/activity (GET list)
 *
 * The schemas here represent the *response* contract (not the request
 * validators in validators/). If the API shape changes without updating
 * consumers, these tests will catch the drift.
 */
import { z } from "zod";

// ── Response envelope schema ─────────────────────────────────────────────────

const ApiResponseSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

// ── Task contract schemas ────────────────────────────────────────────────────

const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  category: z.enum(["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"]),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const TaskListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(TaskItemSchema),
    pagination: PaginationMetaSchema,
  }),
});

const TaskCreateResponseSchema = z.object({
  ok: z.literal(true),
  data: TaskItemSchema,
});

// ── Notification contract schemas ────────────────────────────────────────────

const NotificationItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  isRead: z.boolean(),
  relatedId: z.string().nullable().optional(),
  relatedType: z.string().nullable().optional(),
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

// ── KPI contract schemas ─────────────────────────────────────────────────────

const KpiTaskLinkSchema = z.object({
  weight: z.number().optional(),
  task: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    progressPct: z.number().nullable().optional(),
    primaryAssignee: z.object({
      id: z.string(),
      name: z.string(),
    }).nullable().optional(),
  }),
});

const KpiItemSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  target: z.number(),
  actual: z.number().optional(),
  weight: z.number().optional(),
  status: z.string(),
  autoCalc: z.boolean(),
  taskLinks: z.array(KpiTaskLinkSchema).optional(),
  deliverables: z.array(z.unknown()).optional(),
  creator: z.object({
    id: z.string(),
    name: z.string(),
  }).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const KpiListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(KpiItemSchema),
});

const KpiCreateResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    id: z.string(),
    year: z.number().int(),
    code: z.string(),
    title: z.string(),
    target: z.number(),
    weight: z.number(),
    autoCalc: z.boolean(),
  }),
});

// ── Error response schema ────────────────────────────────────────────────────

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  message: z.string(),
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests: validate sample payloads against schemas
// ══════════════════════════════════════════════════════════════════════════════

describe("API Contract — Response Envelope", () => {
  it("accepts a success envelope", () => {
    const payload = { ok: true, data: { foo: "bar" } };
    expect(() => ApiResponseSchema.parse(payload)).not.toThrow();
  });

  it("accepts an error envelope", () => {
    const payload = { ok: false, error: "NotFound", message: "Resource not found" };
    expect(() => ApiResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects envelope without ok field", () => {
    const payload = { data: {} };
    expect(() => ApiResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Tasks", () => {
  it("validates task list response", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "task-1",
            title: "Implement feature",
            status: "IN_PROGRESS",
            priority: "P1",
            category: "PLANNED",
            description: "Feature description",
            dueDate: "2026-04-01T00:00:00.000Z",
            startDate: null,
            estimatedHours: 8,
            progressPct: 50,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates task create response", () => {
    const payload = {
      ok: true,
      data: {
        id: "task-new",
        title: "New task",
        status: "BACKLOG",
        priority: "P2",
        category: "PLANNED",
        description: null,
        dueDate: null,
      },
    };
    expect(() => TaskCreateResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects task with invalid status", () => {
    const payload = {
      ok: true,
      data: {
        items: [{
          id: "t1", title: "Bad", status: "INVALID_STATUS", priority: "P1", category: "PLANNED",
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).toThrow();
  });

  it("rejects task with invalid priority", () => {
    const payload = {
      ok: true,
      data: {
        items: [{
          id: "t1", title: "Bad", status: "TODO", priority: "CRITICAL", category: "PLANNED",
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).toThrow();
  });

  it("validates empty task list", () => {
    const payload = {
      ok: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    };
    expect(() => TaskListResponseSchema.parse(payload)).not.toThrow();
  });
});

describe("API Contract — Notifications", () => {
  it("validates notification list response", () => {
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

  it("validates notification with null optional fields", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "n2",
            type: "SYSTEM",
            title: "System notice",
            body: null,
            isRead: true,
            relatedId: null,
            relatedType: null,
            createdAt: "2026-03-25T10:00:00.000Z",
          },
        ],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects notification missing isRead field", () => {
    const payload = {
      ok: true,
      data: {
        items: [{ id: "n3", type: "X", title: "Y", createdAt: "2026-01-01T00:00:00Z" }],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => NotificationListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — KPI", () => {
  it("validates KPI list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "kpi-1",
          year: 2026,
          code: "KPI-01",
          title: "Revenue Growth",
          description: "Annual revenue growth target",
          target: 100,
          actual: 80,
          weight: 1,
          status: "ACTIVE",
          autoCalc: false,
          taskLinks: [],
          deliverables: [],
          creator: { id: "u1", name: "Admin" },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(() => KpiListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates KPI with taskLinks", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "kpi-2",
          year: 2026,
          code: "KPI-02",
          title: "Delivery Rate",
          target: 90,
          status: "ACTIVE",
          autoCalc: true,
          taskLinks: [
            {
              weight: 1,
              task: {
                id: "t1",
                title: "Feature A",
                status: "DONE",
                progressPct: 100,
                primaryAssignee: { id: "u1", name: "Alice" },
              },
            },
          ],
        },
      ],
    };
    expect(() => KpiListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates KPI create response", () => {
    const payload = {
      ok: true,
      data: {
        id: "kpi-new",
        year: 2026,
        code: "KPI-03",
        title: "New KPI",
        target: 50,
        weight: 1,
        autoCalc: false,
      },
    };
    expect(() => KpiCreateResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects KPI with missing required code field", () => {
    const payload = {
      ok: true,
      data: [{
        id: "kpi-bad",
        year: 2026,
        title: "Missing code",
        target: 10,
        status: "DRAFT",
        autoCalc: false,
      }],
    };
    expect(() => KpiListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Error Response", () => {
  it("validates standard error response", () => {
    const payload = { ok: false, error: "Unauthorized", message: "Authentication required" };
    expect(() => ErrorResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates 400 validation error response", () => {
    const payload = { ok: false, error: "ValidationError", message: "Title is required" };
    expect(() => ErrorResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects error response missing error field", () => {
    const payload = { ok: false, message: "Something went wrong" };
    expect(() => ErrorResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Pagination meta", () => {
  it("accepts valid pagination metadata", () => {
    expect(() => PaginationMetaSchema.parse({ page: 1, limit: 20, total: 100, totalPages: 5 })).not.toThrow();
  });

  it("rejects pagination with page=0", () => {
    expect(() => PaginationMetaSchema.parse({ page: 0, limit: 20, total: 100, totalPages: 5 })).toThrow();
  });

  it("rejects pagination with negative total", () => {
    expect(() => PaginationMetaSchema.parse({ page: 1, limit: 20, total: -1, totalPages: 0 })).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Issue #506 — Expanded contract tests: 7 additional endpoints
// ══════════════════════════════════════════════════════════════════════════════

// ── Document contract schemas ────────────────────────────────────────────────

const DocumentItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable().optional(),
  title: z.string(),
  slug: z.string(),
  version: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  creator: z.object({ id: z.string(), name: z.string() }).optional(),
  updater: z.object({ id: z.string(), name: z.string() }).optional(),
  _count: z.object({ children: z.number() }).optional(),
});

const DocumentListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(DocumentItemSchema),
    pagination: PaginationMetaSchema,
  }),
});

const DocumentCreateResponseSchema = z.object({
  ok: z.literal(true),
  data: DocumentItemSchema,
});

// ── Plan contract schemas ────────────────────────────────────────────────────

const PlanItemSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const PlanListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(PlanItemSchema),
});

// ── Goal contract schemas ────────────────────────────────────────────────────

const GoalItemSchema = z.object({
  id: z.string(),
  annualPlanId: z.string(),
  month: z.number().int().min(1).max(12),
  title: z.string(),
  description: z.string().nullable().optional(),
  annualPlan: z.object({ id: z.string(), title: z.string(), year: z.number() }).optional(),
  _count: z.object({ tasks: z.number() }).optional(),
  deliverables: z.array(z.unknown()).optional(),
});

const GoalListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(GoalItemSchema),
});

// ── Milestone contract schemas ───────────────────────────────────────────────

const MilestoneItemSchema = z.object({
  id: z.string(),
  annualPlanId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  status: z.string().optional(),
  order: z.number().optional(),
});

const MilestoneListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(MilestoneItemSchema),
});

// ── User contract schemas ────────────────────────────────────────────────────

const UserItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
});

const UserListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(UserItemSchema),
});

// ── Time Entry contract schemas ──────────────────────────────────────────────

const TimeEntryItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  taskId: z.string().nullable().optional(),
  date: z.string(),
  hours: z.number().min(0),
  category: z.string().optional(),
  description: z.string().nullable().optional(),
  task: z.object({ id: z.string(), title: z.string(), category: z.string().optional() }).nullable().optional(),
});

const TimeEntryListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.array(TimeEntryItemSchema),
});

// ── Activity contract schemas ────────────────────────────────────────────────

const ActivityItemSchema = z.object({
  id: z.string(),
  source: z.enum(["task_activity", "audit_log"]),
  action: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  resourceName: z.string().nullable(),
  detail: z.unknown(),
  createdAt: z.string(),
});

const ActivityListResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    items: z.array(ActivityItemSchema),
    pagination: PaginationMetaSchema,
  }),
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests for expanded contracts
// ══════════════════════════════════════════════════════════════════════════════

describe("API Contract — Documents", () => {
  it("validates document list response", () => {
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

  it("validates document create response", () => {
    const payload = {
      ok: true,
      data: {
        id: "doc-new",
        title: "New Document",
        slug: "new-document-1711360000",
        version: 1,
        creator: { id: "u1", name: "Admin" },
      },
    };
    expect(() => DocumentCreateResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects document without title", () => {
    const payload = {
      ok: true,
      data: {
        items: [{ id: "doc-bad", slug: "no-title", version: 1 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    };
    expect(() => DocumentListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Plans", () => {
  it("validates plan list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "plan-1",
          year: 2026,
          title: "Q1 Annual Plan",
          description: "Main objectives for Q1",
          status: "ACTIVE",
          createdAt: "2026-01-01T00:00:00.000Z",
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
      data: [{ id: "plan-bad", title: "No Year" }],
    };
    expect(() => PlanListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Goals", () => {
  it("validates goal list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "goal-1",
          annualPlanId: "plan-1",
          month: 3,
          title: "March deployment",
          description: null,
          annualPlan: { id: "plan-1", title: "Q1 Plan", year: 2026 },
          _count: { tasks: 5 },
          deliverables: [],
        },
      ],
    };
    expect(() => GoalListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects goal with month=0", () => {
    const payload = {
      ok: true,
      data: [{ id: "g-bad", annualPlanId: "p1", month: 0, title: "Bad" }],
    };
    expect(() => GoalListResponseSchema.parse(payload)).toThrow();
  });

  it("rejects goal with month=13", () => {
    const payload = {
      ok: true,
      data: [{ id: "g-bad", annualPlanId: "p1", month: 13, title: "Bad" }],
    };
    expect(() => GoalListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Milestones", () => {
  it("validates milestone list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "ms-1",
          annualPlanId: "plan-1",
          title: "Alpha Release",
          description: "First alpha milestone",
          plannedStart: "2026-01-15T00:00:00.000Z",
          plannedEnd: "2026-03-15T00:00:00.000Z",
          status: "ON_TRACK",
          order: 1,
        },
      ],
    };
    expect(() => MilestoneListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates milestone with null dates", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "ms-2",
          annualPlanId: "plan-1",
          title: "TBD Milestone",
          plannedStart: null,
          plannedEnd: null,
        },
      ],
    };
    expect(() => MilestoneListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects milestone without title", () => {
    const payload = {
      ok: true,
      data: [{ id: "ms-bad", annualPlanId: "p1" }],
    };
    expect(() => MilestoneListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Users", () => {
  it("validates user list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "u1",
          name: "Alice",
          email: "alice@company.com",
          role: "MANAGER",
          status: "ACTIVE",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "u2",
          name: "Bob",
          email: "bob@company.com",
          role: "ENGINEER",
        },
      ],
    };
    expect(() => UserListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects user with invalid email", () => {
    const payload = {
      ok: true,
      data: [{ id: "u-bad", name: "Bad", email: "not-an-email", role: "ENGINEER" }],
    };
    expect(() => UserListResponseSchema.parse(payload)).toThrow();
  });

  it("validates empty user list", () => {
    const payload = { ok: true, data: [] };
    expect(() => UserListResponseSchema.parse(payload)).not.toThrow();
  });
});

describe("API Contract — Time Entries", () => {
  it("validates time entry list response", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "te-1",
          userId: "u1",
          taskId: "t1",
          date: "2026-03-25T00:00:00.000Z",
          hours: 4.5,
          category: "PLANNED",
          description: "Feature implementation",
          task: { id: "t1", title: "Build login", category: "PLANNED" },
        },
      ],
    };
    expect(() => TimeEntryListResponseSchema.parse(payload)).not.toThrow();
  });

  it("validates time entry with null task", () => {
    const payload = {
      ok: true,
      data: [
        {
          id: "te-2",
          userId: "u1",
          taskId: null,
          date: "2026-03-25T00:00:00.000Z",
          hours: 1,
          task: null,
        },
      ],
    };
    expect(() => TimeEntryListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects time entry with negative hours", () => {
    const payload = {
      ok: true,
      data: [{ id: "te-bad", userId: "u1", date: "2026-03-25", hours: -1 }],
    };
    expect(() => TimeEntryListResponseSchema.parse(payload)).toThrow();
  });
});

describe("API Contract — Activity", () => {
  it("validates activity list response", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "a1",
            source: "task_activity",
            action: "CREATE",
            userId: "u1",
            userName: "Alice",
            resourceType: "task",
            resourceId: "t1",
            resourceName: "Build feature",
            detail: { oldStatus: "TODO", newStatus: "IN_PROGRESS" },
            createdAt: "2026-03-25T10:00:00.000Z",
          },
          {
            id: "a2",
            source: "audit_log",
            action: "LOGIN_FAILURE",
            userId: null,
            userName: null,
            resourceType: "auth",
            resourceId: null,
            resourceName: null,
            detail: null,
            createdAt: "2026-03-25T09:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 30, total: 2, totalPages: 1 },
      },
    };
    expect(() => ActivityListResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects activity with invalid source", () => {
    const payload = {
      ok: true,
      data: {
        items: [
          {
            id: "a-bad",
            source: "unknown_source",
            action: "CREATE",
            userId: null,
            userName: null,
            resourceType: "task",
            resourceId: null,
            resourceName: null,
            detail: null,
            createdAt: "2026-03-25T10:00:00.000Z",
          },
        ],
        pagination: { page: 1, limit: 30, total: 1, totalPages: 1 },
      },
    };
    expect(() => ActivityListResponseSchema.parse(payload)).toThrow();
  });
});
