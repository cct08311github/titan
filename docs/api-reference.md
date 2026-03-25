# TITAN API Reference

> Auto-generated from source code. Last updated: 2026-03-25.

All endpoints return JSON with the standard shape:

```json
{ "ok": true, "data": <payload> }
// or on error:
{ "ok": false, "error": "<ErrorName>", "message": "<description>" }
```

Authentication is JWT-based (NextAuth). Include the `next-auth.session-token` cookie.

---

## Table of Contents

- [Auth](#auth)
- [Users](#users)
- [Tasks](#tasks)
- [Subtasks](#subtasks)
- [Time Entries](#time-entries)
- [KPIs](#kpis)
- [Plans (Annual)](#plans-annual)
- [Goals (Monthly)](#goals-monthly)
- [Milestones](#milestones)
- [Deliverables](#deliverables)
- [Documents](#documents)
- [Notifications](#notifications)
- [Reports](#reports)
- [Permissions](#permissions)
- [Audit](#audit)
- [Admin](#admin)
- [Observability](#observability)

---

## Auth

### POST /api/auth/[...nextauth]

NextAuth credential-based login. Standard NextAuth endpoints (signIn, signOut, session, csrf).

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | User email |
| `password` | string | Yes | User password |

**Security:** Rate limited (5 attempts/min per IP+username). Account lockout after 10 failures (15 min). Audit logged.

---

### POST /api/auth/change-password

Change the authenticated user's password.

| Auth | Role |
|---|---|
| Required | Any |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | New password (must meet policy) |

**Response:** `{ message: "密碼變更成功" }`

**Notes:** Validates against password policy. Checks last 5 password hashes to prevent reuse. Updates `passwordChangedAt`, clears `mustChangePassword`.

---

## Users

### GET /api/users

List all users.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `includeSuspended` | boolean | `false` | Include suspended users |

---

### POST /api/users

Create a new user.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ name, email, password, role }` — validated by `createUserSchema`.

---

### GET /api/users/:id

Get a single user by ID.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/users/:id

Update a user.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** Validated by `updateUserSchema` (name, email, role, isActive, etc.).

---

### DELETE /api/users/:id

Suspend a user (soft delete). Pass `?action=unsuspend` to reactivate.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `action` | string | `unsuspend` to reactivate |

---

### GET /api/users/:id/workload

Get a user's workload (active tasks + time entries for period).

| Auth | Role |
|---|---|
| Required | Any (own data) / MANAGER (any user) |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date | 1st of current month | Period start |
| `endDate` | ISO date | End of current month | Period end |

**Response:** `{ userId, userName, period, taskCount, totalHours, estimatedHours, loadPct, activeTasks }`

---

## Tasks

### GET /api/tasks

List tasks with optional filters.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `assignee` | string | `me` or user ID |
| `status` | TaskStatus | `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE` |
| `priority` | Priority | `P0`, `P1`, `P2`, `P3` |
| `category` | TaskCategory | `PLANNED`, `ADDED`, `INCIDENT`, `SUPPORT`, `ADMIN`, `LEARNING` |
| `monthlyGoalId` | string | Filter by monthly goal |

---

### POST /api/tasks

Create a new task.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** Validated by `createTaskSchema`. `creatorId` is set from session.

---

### GET /api/tasks/:id

Get a single task with full relations.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/tasks/:id

Update a task.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** Validated by `updateTaskSchema`.

---

### PATCH /api/tasks/:id

Update task status only.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** `{ status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | ... }`

---

### DELETE /api/tasks/:id

Delete a task.

| Auth | Role |
|---|---|
| Required | MANAGER |

---

### GET /api/tasks/:id/changes

Get delay/scope change history for a task.

| Auth | Role |
|---|---|
| Required | Any |

**Response:** `{ changes, delayCount, scopeChangeCount }`

---

### POST /api/tasks/:id/changes

Record a delay or scope change.

| Auth | Role |
|---|---|
| Required | Any |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `changeType` | enum | Yes | `DELAY` or `SCOPE_CHANGE` |
| `reason` | string | Yes | Explanation |
| `oldValue` | string | No | Previous value |
| `newValue` | string | No | New value |

---

### GET /api/tasks/gantt

Get Gantt chart data (annual plan + milestones + tasks).

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | Plan year |
| `assignee` | string | — | Filter by assignee ID |

---

### POST /api/tasks/import

Bulk import tasks from an Excel file.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | .xlsx | Yes | Excel file with task data |

**Excel columns:** title, description, assigneeEmail, status, priority, category, dueDate, estimatedHours

**Response:** `{ created: number, errors: RowValidationError[] }`

---

## Subtasks

### POST /api/subtasks

Create a subtask.

| Auth | Role |
|---|---|
| Required | Any |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `taskId` | string | Yes | Parent task ID |
| `title` | string | Yes | Subtask title |
| `assigneeId` | string | No | Assignee |
| `dueDate` | ISO date | No | Due date |
| `order` | number | No | Sort order (default 0) |

---

### PATCH /api/subtasks/:id

Update a subtask (toggle done, rename, reassign).

| Auth | Role |
|---|---|
| Required | Any |

**Body:** `{ done?, title?, assigneeId?, dueDate? }`

---

### DELETE /api/subtasks/:id

Delete a subtask.

| Auth | Role |
|---|---|
| Required | Any |

---

## Time Entries

### GET /api/time-entries

List time entries for the authenticated user (or specified user for managers).

| Auth | Role |
|---|---|
| Required | Any (own) / MANAGER (any user) |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `userId` | string | Target user (MANAGER only) |
| `weekStart` | ISO date | Start of week to filter |

---

### POST /api/time-entries

Create a time entry.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** Validated by `createTimeEntrySchema`.

| Field | Type | Required | Description |
|---|---|---|---|
| `taskId` | string | No | Related task |
| `date` | ISO date | Yes | Entry date |
| `hours` | number | Yes | Hours worked |
| `category` | TimeCategory | No | Default: `PLANNED_TASK` |
| `description` | string | No | Notes |

---

### PUT /api/time-entries/:id

Update a time entry (own entries only).

| Auth | Role |
|---|---|
| Required | Any (own only) |

**Body:** `{ taskId?, date?, hours?, category?, description? }`

---

### DELETE /api/time-entries/:id

Delete a time entry (own entries only).

| Auth | Role |
|---|---|
| Required | Any (own only) |

---

### GET /api/time-entries/stats

Get time entry statistics (total hours, breakdown by category).

| Auth | Role |
|---|---|
| Required | Any (own) / MANAGER (any user) |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `userId` | string | Target user (MANAGER only) |
| `startDate` | ISO date | Period start |
| `endDate` | ISO date | Period end |

**Response:** `{ totalHours, breakdown, taskInvestmentRate, entryCount }`

---

## KPIs

### GET /api/kpi

List KPIs for a year with task links and deliverables.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | KPI year |

---

### POST /api/kpi

Create a KPI.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** Validated by `createKpiSchema`.

| Field | Type | Required | Description |
|---|---|---|---|
| `year` | number | Yes | Year |
| `code` | string | Yes | e.g., `KPI-2026-01` |
| `title` | string | Yes | KPI title |
| `description` | string | No | Description |
| `target` | number | Yes | Target value |
| `weight` | number | No | Weight (default 1) |
| `autoCalc` | boolean | No | Auto-calculate from tasks |

---

### GET /api/kpi/:id

Get a single KPI with task links and deliverables.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/kpi/:id

Update a KPI.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ title?, description?, target?, actual?, weight?, status?, autoCalc? }`

---

### DELETE /api/kpi/:id

Delete a KPI and its task links.

| Auth | Role |
|---|---|
| Required | MANAGER |

---

### GET /api/kpi/:id/achievement

Get computed achievement rate for a KPI.

| Auth | Role |
|---|---|
| Required | Any |

**Response:** `{ kpiId, target, actual, achievementRate, linkedTaskCount, completedTaskCount, autoCalc }`

---

### POST /api/kpi/:id/link

Link/unlink a task to a KPI.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `taskId` | string | Yes | Task to link |
| `weight` | number | No | Link weight (default 1) |
| `remove` | boolean | No | Set `true` to unlink |

---

## Plans (Annual)

### GET /api/plans

List annual plans.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `year` | number | Filter by year |

---

### POST /api/plans

Create an annual plan.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** Validated by `createPlanSchema`. `{ year, title, description?, implementationPlan? }`

---

### GET /api/plans/:id

Get a plan with milestones, monthly goals, tasks, and deliverables.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/plans/:id

Update a plan.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ title?, description?, implementationPlan?, progressPct? }`

---

### DELETE /api/plans/:id

Delete a plan (cascades to goals and milestones).

| Auth | Role |
|---|---|
| Required | MANAGER |

---

### POST /api/plans/copy-template

Copy an existing plan as a template for a new year.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `sourcePlanId` | string | Yes | Source plan ID |
| `targetYear` | number | Yes | Target year |

---

## Goals (Monthly)

### GET /api/goals

List monthly goals.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `planId` | string | Filter by annual plan |
| `month` | number | Filter by month (1-12) |

---

### POST /api/goals

Create a monthly goal.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `annualPlanId` | string | Yes | Parent plan |
| `month` | number | Yes | Month (1-12) |
| `title` | string | Yes | Goal title |
| `description` | string | No | Description |

---

### GET /api/goals/:id

Get a goal with tasks, subtasks, and deliverables.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/goals/:id

Update a goal.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ title?, description?, status?, progressPct? }`

---

### DELETE /api/goals/:id

Delete a goal (unlinks tasks, does not delete them).

| Auth | Role |
|---|---|
| Required | MANAGER |

---

## Milestones

### GET /api/milestones

List milestones.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `planId` | string | Filter by annual plan |

---

### POST /api/milestones

Create a milestone.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** Validated by `createMilestoneSchema`. `{ annualPlanId, title, description?, plannedStart?, plannedEnd, order? }`

---

### GET /api/milestones/:id

Get a single milestone.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/milestones/:id

Update a milestone.

| Auth | Role |
|---|---|
| Required | Any |

**Body:** `{ title?, description?, plannedStart?, plannedEnd?, actualStart?, actualEnd?, status?, order? }`

---

### DELETE /api/milestones/:id

Delete a milestone.

| Auth | Role |
|---|---|
| Required | Any |

---

## Deliverables

### GET /api/deliverables

List deliverables with optional filters.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `taskId` | string | Filter by task |
| `kpiId` | string | Filter by KPI |
| `annualPlanId` | string | Filter by plan |
| `monthlyGoalId` | string | Filter by goal |
| `status` | string | Filter by status |
| `type` | string | Filter by type |

---

### POST /api/deliverables

Create a deliverable.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** Validated by `createDeliverableSchema`.

---

### GET /api/deliverables/:id

Get a single deliverable.

| Auth | Role |
|---|---|
| Required | Any |

---

### PATCH /api/deliverables/:id

Update a deliverable (status, title, attachmentUrl, acceptance).

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ status?, title?, attachmentUrl?, acceptedBy?, acceptedAt? }`

---

### DELETE /api/deliverables/:id

Delete a deliverable.

| Auth | Role |
|---|---|
| Required | MANAGER |

---

## Documents

### GET /api/documents

List all documents (tree structure with parent/child).

| Auth | Role |
|---|---|
| Required | Any |

---

### POST /api/documents

Create a document.

| Auth | Role |
|---|---|
| Required | Any |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Document title |
| `content` | string | No | Markdown content |
| `parentId` | string | No | Parent document ID |

---

### GET /api/documents/:id

Get a document with children.

| Auth | Role |
|---|---|
| Required | Any |

---

### PUT /api/documents/:id

Update a document (auto-creates a version snapshot).

| Auth | Role |
|---|---|
| Required | Any |

**Body:** `{ title?, content?, parentId? }`

---

### DELETE /api/documents/:id

Delete a document.

| Auth | Role |
|---|---|
| Required | MANAGER |

---

### GET /api/documents/:id/versions

Get version history for a document.

| Auth | Role |
|---|---|
| Required | Any |

---

### GET /api/documents/search

Full-text search across documents.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | Yes | Search query |

**Response:** Array of `{ id, title, slug, parentId, snippet }`

---

## Notifications

### GET /api/notifications

Get notifications for the authenticated user.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 20 | Max notifications to return |

**Response:** `{ notifications, unreadCount }`

---

### PATCH /api/notifications/:id/read

Mark a single notification as read.

| Auth | Role |
|---|---|
| Required | Any (own only) |

---

### PATCH /api/notifications/read-all

Mark all unread notifications as read.

| Auth | Role |
|---|---|
| Required | Any |

**Response:** `{ updatedCount }`

---

### POST /api/notifications/generate

Generate notifications for overdue tasks and upcoming due dates. Intended for cron jobs.

| Auth | Role |
|---|---|
| Required | MANAGER |

---

## Reports

### GET /api/reports/weekly

Weekly report: completed tasks, hours, overdue, changes.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `date` | ISO date | Today | Reference date for the week |

**Response:** `{ period, completedTasks, completedCount, totalHours, hoursByCategory, overdueTasks, overdueCount, changes, delayCount, scopeChangeCount }`

**Note:** MANAGER sees all users; ENGINEER sees only their own data.

---

### GET /api/reports/monthly

Monthly report: tasks, completion rate, hours, goals, changes.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `month` | string | Current month | Format: `YYYY-MM` |

**Response:** `{ period, totalTasks, completedTasks, completionRate, totalHours, hoursByCategory, monthlyGoals, changes, delayCount, scopeChangeCount }`

---

### GET /api/reports/kpi

KPI achievement report with computed rates.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | KPI year |

**Response:** `{ year, kpis, avgAchievement, achievedCount, totalCount }`

---

### GET /api/reports/workload

Workload analysis: planned vs unplanned hours, per-person breakdown.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date | 1st of current month | Period start |
| `endDate` | ISO date | End of current month | Period end |

**Response:** `{ period, totalHours, plannedHours, unplannedHours, plannedRate, unplannedRate, hoursByCategory, byPerson, unplannedTasks, unplannedBySource }`

---

### GET /api/reports/delay-change

Delay and scope change analysis over a date range.

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date | 1st of current month | Period start |
| `endDate` | ISO date | End of current month | Period end |

**Response:** `{ period, delayCount, scopeChangeCount, total, byDate, changes }`

---

### GET /api/reports/trends

Cross-year trend comparison (monthly aggregated).

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `metric` | string | `kpi` | `kpi`, `workload`, or `delays` |
| `years` | string | Current year | Comma-separated years, e.g., `2025,2026` |

**Response:** `{ metric, years, data: { [year]: [{ month, value }] } }`

---

### GET /api/reports/export

Export reports as Excel (.xlsx) or HTML (PDF-printable).

| Auth | Role |
|---|---|
| Required | Any |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `type` | string | `weekly` | `weekly`, `monthly`, `kpi`, `workload` |
| `format` | string | `xlsx` | `xlsx` or `pdf` |
| `date` | ISO date | — | For weekly reports |
| `month` | string | — | For monthly reports (`YYYY-MM`) |
| `year` | number | — | For KPI reports |
| `startDate` | ISO date | — | For workload reports |
| `endDate` | ISO date | — | For workload reports |

---

## Permissions

### GET /api/permissions

List all permissions.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Query params:**

| Param | Type | Description |
|---|---|---|
| `granteeId` | string | Filter by grantee |
| `permType` | string | `VIEW_TEAM` or `VIEW_PERSON` |
| `isActive` | boolean | Filter by active status |

---

### POST /api/permissions

Grant a permission.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `granteeId` | string | Yes | Engineer user ID |
| `permType` | string | Yes | `VIEW_TEAM` or `VIEW_PERSON` |
| `targetId` | string | No | Target user ID (for `VIEW_PERSON`) |
| `expiresAt` | ISO date | No | Expiration date |

---

### DELETE /api/permissions

Revoke a permission.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Body:** `{ granteeId, permType, targetId? }`

---

## Audit

### GET /api/audit

Query audit logs.

| Auth | Role |
|---|---|
| Required | MANAGER |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `action` | string | — | Filter by action |
| `userId` | string | — | Filter by user |
| `resourceType` | string | — | Filter by resource type |
| `limit` | number | 200 | Max results |

---

## Admin

### GET /api/admin/backup-status

Get backup status summary (reads from backup directory).

| Auth | Role |
|---|---|
| Required | MANAGER |

**Response:** `{ backupRoot, lastBackupTime, backupCount, totalSizeMB, recentBackups, lastLogLines }`

---

## Observability

### GET /api/metrics

Prometheus-compatible metrics endpoint. Returns text exposition format.

| Auth | Role |
|---|---|
| Not required | Public |

---

### POST /api/error-report

Client-side error reporting. Persists frontend errors to audit log.

| Auth | Role |
|---|---|
| Not required | Public |

**Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | Error message |
| `digest` | string | No | Error digest |
| `source` | string | No | Error source |
| `url` | string | No | Page URL where error occurred |
