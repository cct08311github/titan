# TITAN API Reference

> **Base URL**: `/api`
> **Version**: 1.0 (Next.js 15 App Router)
> **Last updated**: 2026-03-25

---

## Table of Contents

1. [Authentication](#authentication)
2. [Response Format](#response-format)
3. [Error Handling](#error-handling)
4. [Endpoints by Resource](#endpoints-by-resource)
   - [Auth](#auth)
   - [Users](#users)
   - [Tasks](#tasks)
   - [SubTasks](#subtasks)
   - [KPIs](#kpis)
   - [Plans (Annual Plans)](#plans-annual-plans)
   - [Goals (Monthly Goals)](#goals-monthly-goals)
   - [Milestones](#milestones)
   - [Documents](#documents)
   - [Deliverables](#deliverables)
   - [Time Entries](#time-entries)
   - [Notifications](#notifications)
   - [Permissions](#permissions)
   - [Reports](#reports)
   - [Audit Logs](#audit-logs)
   - [Metrics](#metrics)
   - [Error Report](#error-report)

---

## Authentication

TITAN uses **NextAuth.js** with a **Credentials provider** and **JWT session strategy**.

### Flow

1. Client sends `POST /api/auth/callback/credentials` with `username` (email) and `password`.
2. Server validates credentials against the database (bcrypt comparison).
3. On success, a **JWT** is issued as an `HttpOnly`, `SameSite=Strict` cookie named `next-auth.session-token`.
4. JWT contains: `id`, `role` (`MANAGER` | `ENGINEER`), `mustChangePassword`, `sessionId`.
5. Session expires after **8 hours** (bank workday).

### Security Controls

| Control | Detail |
|---|---|
| Rate limiting | 5 login attempts per minute per IP+username |
| Account lockout | 10 consecutive failures locks account for 15 minutes |
| Password policy | Min length + complexity rules (uppercase, lowercase, digit, special char) |
| Password history | Cannot reuse last 5 passwords |
| Password expiry | Forced change on expiry or `mustChangePassword` flag |
| Single session | New login invalidates previous session |
| Audit logging | All login success/failure events persisted to AuditLog |

### Authorization Levels

| Middleware | Access |
|---|---|
| `withAuth` | Any authenticated user (MANAGER or ENGINEER) |
| `withManager` | MANAGER role only |

---

## Response Format

All API responses follow a consistent JSON envelope:

### Success Response

```json
{
  "ok": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "ok": false,
  "error": "ErrorType",
  "message": "Human-readable error description"
}
```

For validation errors with field-level detail:

```json
{
  "ok": false,
  "error": "ValidationError",
  "message": "Validation failed",
  "fields": {
    "fieldName": ["error message"]
  }
}
```

---

## Error Handling

| HTTP Status | Error Type | Description |
|---|---|---|
| 400 | `ValidationError` | Invalid input / missing required fields |
| 401 | `UnauthorizedError` | Not authenticated |
| 403 | `ForbiddenError` | Insufficient permissions |
| 404 | `NotFoundError` | Resource not found |
| 500 | Internal Error | Unhandled server error |

---

## Endpoints by Resource

### Auth

#### POST `/api/auth/callback/credentials`

NextAuth.js built-in endpoint for credential-based login.

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | Yes | User email address |
| `password` | string | Yes | User password |

**Response**: Sets `next-auth.session-token` cookie on success. Redirects per NextAuth flow.

---

#### GET/POST `/api/auth/[...nextauth]`

NextAuth.js catch-all handler for session management (`/api/auth/session`, `/api/auth/csrf`, `/api/auth/signout`, etc.).

---

#### POST `/api/auth/change-password`

Change the authenticated user's password.

**Auth**: `withAuth` (any authenticated user via session cookie)

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | New password (must satisfy password policy) |

**Validation Rules**:
- New password must differ from current password
- Must satisfy complexity policy (min length, uppercase, lowercase, digit, special char)
- Cannot match any of the last 5 passwords

**Success Response** (200):

```json
{
  "ok": true,
  "data": { "message": "密碼變更成功" }
}
```

**Error Responses**:

| Status | Condition |
|---|---|
| 400 | Missing fields, same password, policy violation, incorrect current password, password history match |
| 401 | Not authenticated |
| 404 | User not found |

---

### Users

#### GET `/api/users`

List all users.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `includeSuspended` | `"true"` | `"false"` | Include suspended users in results |

**Success Response** (200):

```json
{
  "ok": true,
  "data": [
    {
      "id": "cuid",
      "name": "string",
      "email": "string",
      "role": "MANAGER | ENGINEER",
      "isActive": true,
      "avatar": "string | null"
    }
  ]
}
```

---

#### POST `/api/users`

Create a new user.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | Yes | - | Display name |
| `email` | string | Yes | - | Email (unique, used for login) |
| `password` | string | Yes | - | Must satisfy password policy |
| `role` | `"MANAGER"` \| `"ENGINEER"` | No | `"ENGINEER"` | User role |
| `avatar` | string | No | - | Avatar URL |

**Success Response** (201): Created user object.

---

#### GET `/api/users/:id`

Get a single user by ID.

**Auth**: `withAuth`

**Path Parameters**: `id` (string) - User ID

**Success Response** (200): User object.

---

#### PUT `/api/users/:id`

Update a user.

**Auth**: `withManager`

**Path Parameters**: `id` (string) - User ID

**Request Body** (all fields optional):

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name |
| `email` | string | Email address |
| `password` | string | New password (must satisfy policy) |
| `avatar` | string | Avatar URL |
| `role` | `"MANAGER"` \| `"ENGINEER"` | User role |
| `isActive` | boolean | Active status |

**Success Response** (200): Updated user object.

---

#### DELETE `/api/users/:id`

Suspend a user (soft delete). Pass `?action=unsuspend` to reactivate.

**Auth**: `withManager`

**Path Parameters**: `id` (string) - User ID

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `action` | `"unsuspend"` | If set, reactivates the user instead of suspending |

**Success Response** (200): Updated user object.

---

#### GET `/api/users/:id/workload`

Get workload statistics for a user.

**Auth**: `withAuth` (members can only view their own; managers can view any)

**Path Parameters**: `id` (string) - User ID

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date string | First day of current month | Period start |
| `endDate` | ISO date string | Last day of current month | Period end |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "userId": "string",
    "userName": "string",
    "period": { "start": "datetime", "end": "datetime" },
    "taskCount": 5,
    "totalHours": 120.5,
    "estimatedHours": 80,
    "loadPct": 75.3,
    "activeTasks": [
      {
        "id": "string",
        "title": "string",
        "status": "IN_PROGRESS",
        "priority": "P1",
        "estimatedHours": 16,
        "dueDate": "datetime | null"
      }
    ]
  }
}
```

---

### Tasks

#### GET `/api/tasks`

List tasks with optional filters.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `assignee` | string | Filter by primary assignee ID |
| `status` | `BACKLOG` \| `TODO` \| `IN_PROGRESS` \| `REVIEW` \| `DONE` | Filter by status |
| `priority` | `P0` \| `P1` \| `P2` \| `P3` | Filter by priority |
| `category` | `PLANNED` \| `ADDED` \| `INCIDENT` \| `SUPPORT` \| `ADMIN` \| `LEARNING` | Filter by category |
| `monthlyGoalId` | string | Filter by monthly goal |

**Success Response** (200): Array of task objects.

---

#### POST `/api/tasks`

Create a new task.

**Auth**: `withAuth` (creator is auto-set from session)

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | string | Yes | - | Task title |
| `description` | string | No | - | Task description |
| `monthlyGoalId` | string | No | - | Link to monthly goal |
| `primaryAssigneeId` | string | No | - | Primary assignee user ID |
| `backupAssigneeId` | string | No | - | Backup assignee user ID |
| `status` | TaskStatus | No | `BACKLOG` | Initial status |
| `priority` | Priority | No | `P2` | Priority level |
| `category` | TaskCategory | No | `PLANNED` | Task category |
| `dueDate` | ISO datetime | No | - | Due date |
| `startDate` | ISO datetime | No | - | Start date |
| `estimatedHours` | number (>=0) | No | - | Estimated hours |
| `tags` | string[] | No | - | Tags array |
| `addedDate` | ISO datetime | No | - | Date task was added (for unplanned tasks) |
| `addedReason` | string | No | - | Reason task was added |
| `addedSource` | string | No | - | Source of unplanned task |

**Success Response** (201): Created task object.

---

#### GET `/api/tasks/:id`

Get a single task by ID.

**Auth**: `withAuth`

**Success Response** (200): Task object with full details.

---

#### PUT `/api/tasks/:id`

Update a task (full update).

**Auth**: `withAuth`

**Request Body**: Same fields as create, all optional. Additional fields:

| Field | Type | Description |
|---|---|---|
| `progressPct` | number (0-100) | Progress percentage |
| `changedBy` | string | ID of user making the change |
| `changeReason` | string | Reason for the change |

**Success Response** (200): Updated task object.

---

#### PATCH `/api/tasks/:id`

Update task status only.

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `BACKLOG` \| `TODO` \| `IN_PROGRESS` \| `REVIEW` \| `DONE` | Yes | New status |

**Success Response** (200): Updated task object.

---

#### DELETE `/api/tasks/:id`

Delete a task.

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "success": true } }
```

---

#### GET `/api/tasks/:id/changes`

Get change history (delays and scope changes) for a task.

**Auth**: `withAuth`

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "changes": [
      {
        "id": "string",
        "taskId": "string",
        "changeType": "DELAY | SCOPE_CHANGE",
        "reason": "string",
        "oldValue": "string | null",
        "newValue": "string | null",
        "changedBy": "string",
        "changedAt": "datetime",
        "changedByUser": { "id": "string", "name": "string" }
      }
    ],
    "delayCount": 2,
    "scopeChangeCount": 1
  }
}
```

---

#### POST `/api/tasks/:id/changes`

Record a task change (delay or scope change).

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `changeType` | `"DELAY"` \| `"SCOPE_CHANGE"` | Yes | Type of change |
| `reason` | string | Yes | Reason for the change |
| `oldValue` | string | No | Previous value |
| `newValue` | string | No | New value |

**Success Response** (201): Created TaskChange object.

---

#### GET `/api/tasks/gantt`

Get tasks formatted for Gantt chart display, organized by annual plan, monthly goals, and milestones.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | Annual plan year |
| `assignee` | string | - | Filter by assignee ID |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "annualPlan": { "id": "string", "title": "string", "year": 2026, "milestones": [...], "monthlyGoals": [...] },
    "year": 2026
  }
}
```

---

#### POST `/api/tasks/import`

Bulk import tasks from an Excel (.xlsx) file.

**Auth**: `withManager`

**Content-Type**: `multipart/form-data`

**Form Fields**:

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File (.xlsx) | Yes | Excel workbook with columns: `title`, `description`, `assigneeEmail`, `status`, `priority`, `category`, `dueDate`, `estimatedHours` |

**Success Response** (201):

```json
{
  "ok": true,
  "data": {
    "created": 15,
    "errors": [
      { "row": 3, "field": "assigneeEmail", "message": "User not found" }
    ]
  }
}
```

---

### SubTasks

#### POST `/api/subtasks`

Create a subtask for a task.

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `taskId` | string | Yes | - | Parent task ID |
| `title` | string | Yes | - | Subtask title |
| `assigneeId` | string | No | null | Assignee user ID |
| `dueDate` | ISO datetime | No | null | Due date |
| `order` | number | No | 0 | Display order |

**Success Response** (201): Created subtask object.

---

#### PATCH `/api/subtasks/:id`

Update a subtask.

**Auth**: `withAuth`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `done` | boolean | Completion status |
| `title` | string | Subtask title |
| `assigneeId` | string \| null | Assignee user ID |
| `dueDate` | ISO datetime \| null | Due date |

**Success Response** (200): Updated subtask object.

---

#### DELETE `/api/subtasks/:id`

Delete a subtask.

**Auth**: `withAuth`

**Success Response** (200):

```json
{ "ok": true, "data": { "success": true } }
```

---

### KPIs

#### GET `/api/kpi`

List all KPIs for a given year with linked tasks and deliverables.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | KPI year |

**Success Response** (200): Array of KPI objects with `taskLinks`, `deliverables`, `creator`.

---

#### POST `/api/kpi`

Create a new KPI.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `year` | number | Yes | - | Year (2000-2100) |
| `code` | string | Yes | - | KPI code identifier |
| `title` | string | Yes | - | KPI title |
| `description` | string | No | null | Description |
| `target` | number (>=0) | Yes | - | Target value |
| `weight` | number (>0) | No | 1 | Weight for calculations |
| `autoCalc` | boolean | No | false | Auto-calculate from linked tasks |

**Success Response** (201): Created KPI object.

---

#### GET `/api/kpi/:id`

Get a single KPI with full details.

**Auth**: `withAuth`

**Success Response** (200): KPI object with `taskLinks`, `deliverables`, `creator`.

---

#### PUT `/api/kpi/:id`

Update a KPI.

**Auth**: `withManager`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `title` | string | KPI title |
| `description` | string | Description |
| `target` | number (>=0) | Target value |
| `actual` | number (>=0) | Actual value |
| `weight` | number (>0) | Weight |
| `status` | `DRAFT` \| `ACTIVE` \| `ACHIEVED` \| `MISSED` \| `CANCELLED` | KPI status |
| `autoCalc` | boolean | Auto-calculate from tasks |

**Success Response** (200): Updated KPI object.

---

#### DELETE `/api/kpi/:id`

Delete a KPI and all its task links.

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "deleted": true } }
```

---

#### GET `/api/kpi/:id/achievement`

Get computed achievement rate for a KPI.

**Auth**: `withAuth`

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "kpiId": "string",
    "target": 100,
    "actual": 85,
    "achievementRate": 85.0,
    "linkedTaskCount": 5,
    "completedTaskCount": 3,
    "autoCalc": true
  }
}
```

**Achievement Calculation**:
- If `autoCalc=true`: Weighted average of linked task progress
- If `autoCalc=false`: `(actual / target) * 100`

---

#### POST `/api/kpi/:id/link`

Link or unlink a task to/from a KPI.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `taskId` | string | Yes | - | Task ID to link |
| `weight` | number | No | 1 | Link weight for calculation |
| `remove` | boolean | No | false | If true, removes the link |

**Success Response** (201 for link, 200 for unlink): Link object or success message.

---

### Plans (Annual Plans)

#### GET `/api/plans`

List annual plans.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `year` | number | - | Filter by year |

**Success Response** (200): Array of plan objects.

---

#### POST `/api/plans`

Create a new annual plan.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `year` | number | Yes | - | Year (2000-2100) |
| `title` | string | Yes | - | Plan title |
| `description` | string | No | - | Description |
| `implementationPlan` | string | No | - | Implementation details |
| `copiedFromYear` | number | No | - | Source year if copied |

**Success Response** (201): Created plan object.

---

#### GET `/api/plans/:id`

Get a single plan with milestones, monthly goals, tasks, and deliverables.

**Auth**: `withAuth`

**Success Response** (200): Full plan object with nested relations.

---

#### PUT `/api/plans/:id`

Update an annual plan.

**Auth**: `withManager`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `title` | string | Plan title |
| `description` | string | Description |
| `implementationPlan` | string | Implementation details |
| `progressPct` | number (0-100) | Overall progress |

**Success Response** (200): Updated plan object with milestones and monthly goals.

---

#### DELETE `/api/plans/:id`

Delete an annual plan (cascading delete).

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "deleted": true } }
```

---

#### POST `/api/plans/copy-template`

Copy an existing plan as a template for a new year.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `sourcePlanId` | string | Yes | ID of the plan to copy |
| `targetYear` | number | Yes | Target year (2000-2100) |

**Success Response** (201): Newly created plan object.

---

### Goals (Monthly Goals)

#### GET `/api/goals`

List monthly goals with optional filters.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `planId` | string | Filter by annual plan ID |
| `month` | number (1-12) | Filter by month |

**Success Response** (200): Array of goal objects with plan info, task count, and deliverables.

---

#### POST `/api/goals`

Create a monthly goal.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `annualPlanId` | string | Yes | Parent annual plan ID |
| `month` | number (1-12) | Yes | Month number |
| `title` | string | Yes | Goal title |
| `description` | string | No | Description |

**Success Response** (201): Created goal object.

---

#### GET `/api/goals/:id`

Get a single goal with tasks (including assignees, subtasks, deliverables).

**Auth**: `withAuth`

**Success Response** (200): Goal object with full task details.

---

#### PUT `/api/goals/:id`

Update a monthly goal.

**Auth**: `withManager`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `title` | string | Goal title |
| `description` | string | Description |
| `status` | `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` | Goal status |
| `progressPct` | number (0-100) | Progress percentage |

**Success Response** (200): Updated goal object.

---

#### DELETE `/api/goals/:id`

Delete a monthly goal. Tasks linked to this goal have their `monthlyGoalId` set to null (not deleted).

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "deleted": true } }
```

---

### Milestones

#### GET `/api/milestones`

List milestones.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `planId` | string | Filter by annual plan ID |

**Success Response** (200): Array of milestone objects.

---

#### POST `/api/milestones`

Create a milestone.

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `annualPlanId` | string | Yes | Parent annual plan ID |
| `title` | string | Yes | Milestone title |
| `description` | string | No | Description |
| `plannedStart` | date | No | Planned start date |
| `plannedEnd` | date | Yes | Planned end date |
| `order` | integer (>=0) | No | Display order |

**Validation**: `plannedStart` must be before `plannedEnd` if both provided.

**Success Response** (201): Created milestone object.

---

#### GET `/api/milestones/:id`

Get a single milestone.

**Auth**: `withAuth`

**Success Response** (200): Milestone object.

---

#### PUT `/api/milestones/:id`

Update a milestone.

**Auth**: `withAuth`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `title` | string | Milestone title |
| `description` | string | Description |
| `plannedStart` | date | Planned start |
| `plannedEnd` | date | Planned end |
| `actualStart` | date | Actual start |
| `actualEnd` | date | Actual end |
| `status` | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` \| `DELAYED` \| `CANCELLED` | Status |
| `order` | integer (>=0) | Display order |

**Success Response** (200): Updated milestone object.

---

#### DELETE `/api/milestones/:id`

Delete a milestone.

**Auth**: `withAuth`

**Success Response** (200):

```json
{ "ok": true, "data": { "id": "deleted-id" } }
```

---

### Documents

#### GET `/api/documents`

List all documents (summary view without content).

**Auth**: `withAuth`

**Success Response** (200): Array of document summaries with `id`, `parentId`, `title`, `slug`, `version`, timestamps, `creator`, `updater`, `childrenCount`.

---

#### POST `/api/documents`

Create a new document.

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | string | Yes | - | Document title |
| `content` | string | No | `""` | Document content (Markdown) |
| `parentId` | string | No | null | Parent document ID (for hierarchy) |

**Success Response** (201): Created document object with `creator`, `updater`.

---

#### GET `/api/documents/:id`

Get a single document with full content and child documents.

**Auth**: `withAuth`

**Success Response** (200): Document object with `content`, `children`, `creator`, `updater`.

---

#### PUT `/api/documents/:id`

Update a document. Automatically creates a version snapshot of the previous content.

**Auth**: `withAuth`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `title` | string | Document title |
| `content` | string | Document content |
| `parentId` | string | Parent document ID |

**Side effects**: Increments `version`, creates `DocumentVersion` record with previous content.

**Success Response** (200): Updated document object.

---

#### DELETE `/api/documents/:id`

Delete a document.

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "success": true } }
```

---

#### GET `/api/documents/:id/versions`

List version history for a document, ordered newest first.

**Auth**: `withAuth`

**Success Response** (200): Array of `DocumentVersion` objects with `version`, `content`, `creator`, `createdAt`.

---

#### GET `/api/documents/search`

Full-text search across document titles and content (PostgreSQL `tsvector`).

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | Yes | Search query |

**Success Response** (200): Array of up to 20 results:

```json
{
  "ok": true,
  "data": [
    {
      "id": "string",
      "title": "string",
      "slug": "string",
      "parentId": "string | null",
      "snippet": "first 200 chars of content"
    }
  ]
}
```

---

### Deliverables

#### GET `/api/deliverables`

List deliverables with optional filters.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `taskId` | string | Filter by task |
| `kpiId` | string | Filter by KPI |
| `annualPlanId` | string | Filter by annual plan |
| `monthlyGoalId` | string | Filter by monthly goal |
| `status` | `NOT_STARTED` \| `IN_PROGRESS` \| `DELIVERED` \| `ACCEPTED` | Filter by status |
| `type` | `DOCUMENT` \| `SYSTEM` \| `REPORT` \| `APPROVAL` | Filter by type |

**Success Response** (200): Array of deliverable objects.

---

#### POST `/api/deliverables`

Create a deliverable.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Deliverable title |
| `type` | `DOCUMENT` \| `SYSTEM` \| `REPORT` \| `APPROVAL` | Yes | Deliverable type |
| `taskId` | string | No | Link to task |
| `kpiId` | string | No | Link to KPI |
| `annualPlanId` | string | No | Link to annual plan |
| `monthlyGoalId` | string | No | Link to monthly goal |
| `attachmentUrl` | URL string | No | Attachment URL |

**Success Response** (201): Created deliverable object.

---

#### GET `/api/deliverables/:id`

Get a single deliverable.

**Auth**: `withAuth`

**Success Response** (200): Deliverable object.

---

#### PATCH `/api/deliverables/:id`

Update a deliverable.

**Auth**: `withManager`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `status` | DeliverableStatus | Status update |
| `title` | string | Title |
| `attachmentUrl` | string | Attachment URL |
| `acceptedBy` | string | ID of user who accepted |
| `acceptedAt` | ISO datetime \| null | Acceptance timestamp |

**Success Response** (200): Updated deliverable object.

---

#### DELETE `/api/deliverables/:id`

Delete a deliverable.

**Auth**: `withManager`

**Success Response** (200):

```json
{ "ok": true, "data": { "success": true } }
```

---

### Time Entries

#### GET `/api/time-entries`

List time entries. Non-privileged users can only see their own entries.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `userId` | string | Filter by user (MANAGER/ADMIN only for other users) |
| `weekStart` | ISO date string | Filter by week (returns 7-day window) |

**Access Control**: Engineers can only query their own entries. Managers/Admins can query any user.

**Success Response** (200): Array of time entry objects with `task` details.

---

#### POST `/api/time-entries`

Create a time entry (always owned by the authenticated user).

**Auth**: `withAuth`

**Request Body**:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `date` | date string (YYYY-MM-DD) | Yes | - | Entry date |
| `hours` | number (0-24) | Yes | - | Hours worked |
| `taskId` | string | No | null | Associated task |
| `category` | `PLANNED_TASK` \| `ADDED_TASK` \| `INCIDENT` \| `SUPPORT` \| `ADMIN` \| `LEARNING` | No | `PLANNED_TASK` | Time category |
| `description` | string | No | null | Description |

**Success Response** (201): Created time entry object.

---

#### PUT `/api/time-entries/:id`

Update a time entry. Users can only edit their own entries (IDOR protection).

**Auth**: `withAuth`

**Request Body** (all optional):

| Field | Type | Description |
|---|---|---|
| `date` | date string | Entry date |
| `hours` | number (0-24) | Hours worked |
| `taskId` | string | Associated task |
| `category` | TimeCategory | Time category |
| `description` | string | Description |

**Success Response** (200): Updated time entry object.

**Error**: 403 if attempting to edit another user's entry.

---

#### DELETE `/api/time-entries/:id`

Delete a time entry. Users can only delete their own entries.

**Auth**: `withAuth`

**Success Response** (200):

```json
{ "ok": true, "data": { "success": true } }
```

---

#### GET `/api/time-entries/stats`

Get aggregated time statistics with breakdown by category.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `userId` | string | Filter by user (MANAGER/ADMIN only for others) |
| `startDate` | ISO date string | Period start |
| `endDate` | ISO date string | Period end |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "totalHours": 160,
    "breakdown": [
      { "category": "PLANNED_TASK", "hours": 120, "pct": 75 },
      { "category": "INCIDENT", "hours": 20, "pct": 13 }
    ],
    "taskInvestmentRate": 75,
    "entryCount": 42
  }
}
```

---

### Notifications

#### GET `/api/notifications`

List notifications for the authenticated user.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 20 | Maximum results |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "notifications": [
      {
        "id": "string",
        "userId": "string",
        "type": "string",
        "title": "string",
        "message": "string",
        "relatedId": "string | null",
        "isRead": false,
        "createdAt": "datetime"
      }
    ],
    "unreadCount": 3
  }
}
```

---

#### PATCH `/api/notifications/:id/read`

Mark a single notification as read.

**Auth**: `withAuth` (can only mark own notifications)

**Success Response** (200): Updated notification object.

---

#### PATCH `/api/notifications/read-all`

Mark all unread notifications as read for the authenticated user.

**Auth**: `withAuth`

**Success Response** (200):

```json
{ "ok": true, "data": { "updatedCount": 5 } }
```

---

#### POST `/api/notifications/generate`

Generate notifications for upcoming/overdue tasks and milestones. Intended for cron job or manual trigger.

**Auth**: `withManager`

**Request Body**: None required.

**Success Response** (200): Generation result summary.

---

### Permissions

#### GET `/api/permissions`

List all granted permissions.

**Auth**: `withManager`

**Query Parameters**:

| Parameter | Type | Description |
|---|---|---|
| `granteeId` | string | Filter by grantee user ID |
| `permType` | string | Filter by permission type |
| `isActive` | `"true"` \| `"false"` | Filter by active status |

**Success Response** (200): Array of permission objects.

---

#### POST `/api/permissions`

Grant a permission to a user. Creates an audit log entry.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `granteeId` | string | Yes | User receiving the permission |
| `permType` | string | Yes | Permission type identifier |
| `targetId` | string | No | Target resource ID (null = global) |
| `expiresAt` | ISO datetime | No | Expiration date |

**Success Response** (201): Created permission object.

---

#### DELETE `/api/permissions`

Revoke a permission. Creates an audit log entry.

**Auth**: `withManager`

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `granteeId` | string | Yes | User whose permission is revoked |
| `permType` | string | Yes | Permission type to revoke |
| `targetId` | string | No | Target resource ID (null = global) |

**Success Response** (200):

```json
{ "ok": true, "data": { "message": "已撤銷授權" } }
```

---

### Reports

#### GET `/api/reports/weekly`

Weekly report with completed tasks, time entries, overdue tasks, and changes.

**Auth**: `withAuth` (engineers see only their data; managers see all)

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `date` | ISO date string | Today | Any date within the target week (Mon-Sun bounds auto-calculated) |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "period": { "start": "datetime", "end": "datetime" },
    "completedTasks": [...],
    "completedCount": 8,
    "totalHours": 40,
    "hoursByCategory": { "PLANNED_TASK": 32, "INCIDENT": 8 },
    "overdueTasks": [...],
    "overdueCount": 2,
    "changes": [...],
    "delayCount": 1,
    "scopeChangeCount": 0
  }
}
```

---

#### GET `/api/reports/monthly`

Monthly report with task completion rate, time distribution, and goal progress.

**Auth**: `withAuth` (engineers see only their data; managers see all)

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `month` | string (YYYY-MM) | Current month | Target month |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "period": { "year": 2026, "month": 3, "start": "datetime", "end": "datetime" },
    "totalTasks": 25,
    "completedTasks": 20,
    "completionRate": 80,
    "totalHours": 160,
    "hoursByCategory": { ... },
    "monthlyGoals": [...],
    "changes": [...],
    "delayCount": 2,
    "scopeChangeCount": 1
  }
}
```

---

#### GET `/api/reports/kpi`

KPI achievement report for a given year.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `year` | number | Current year | KPI year |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "year": 2026,
    "kpis": [ { "...kpi fields", "achievementRate": 85.5 } ],
    "avgAchievement": 82.3,
    "achievedCount": 4,
    "totalCount": 6
  }
}
```

---

#### GET `/api/reports/workload`

Workload distribution report with planned vs. unplanned hours breakdown.

**Auth**: `withAuth` (engineers see only their data; managers see all)

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date string | First of current month | Period start |
| `endDate` | ISO date string | End of current month | Period end |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "period": { "start": "datetime", "end": "datetime" },
    "totalHours": 640,
    "plannedHours": 480,
    "unplannedHours": 120,
    "plannedRate": 75.0,
    "unplannedRate": 18.8,
    "hoursByCategory": { ... },
    "byPerson": [
      { "userId": "string", "name": "string", "total": 160, "planned": 120, "unplanned": 30 }
    ],
    "unplannedTasks": [...],
    "unplannedBySource": { "客戶需求": 3, "資安事件": 1 }
  }
}
```

---

#### GET `/api/reports/delay-change`

Delay and scope change analysis report.

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `startDate` | ISO date string | First of current month | Period start |
| `endDate` | ISO date string | End of current month | Period end |

**Success Response** (200):

```json
{
  "ok": true,
  "data": {
    "period": { "start": "datetime", "end": "datetime" },
    "delayCount": 5,
    "scopeChangeCount": 3,
    "total": 8,
    "byDate": [
      { "date": "2026-03-15", "delayCount": 2, "scopeChangeCount": 1, "total": 3 }
    ],
    "changes": [...]
  }
}
```

---

#### GET `/api/reports/trends`

Cross-year trend comparison with monthly aggregated data.

**Auth**: `withAuth` (uses `requireAuth` directly)

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `metric` | `"kpi"` \| `"workload"` \| `"delays"` | `"kpi"` | Metric type |
| `years` | comma-separated numbers | Current year | Years to compare (e.g., `"2025,2026"`) |

**Success Response** (200):

```json
{
  "metric": "kpi",
  "years": [2025, 2026],
  "data": {
    "2025": [ { "month": 1, "value": 78.5 }, ... ],
    "2026": [ { "month": 1, "value": 82.3 }, ... ]
  }
}
```

> Note: This endpoint returns raw `NextResponse.json()` without the `{ ok, data }` envelope.

---

#### GET `/api/reports/export`

Export reports as Excel (.xlsx) or PDF (rendered as HTML).

**Auth**: `withAuth`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | `"weekly"` \| `"monthly"` \| `"kpi"` \| `"workload"` | `"weekly"` | Report type |
| `format` | `"xlsx"` \| `"pdf"` | `"xlsx"` | Output format |
| `date` | ISO date string | Today | For weekly reports |
| `month` | string (YYYY-MM) | Current month | For monthly reports |
| `year` | number | Current year | For KPI reports |
| `startDate` | ISO date string | First of month | For workload reports |
| `endDate` | ISO date string | End of month | For workload reports |

**Success Response**:
- **xlsx**: Binary response with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **pdf**: HTML response with `Content-Type: text/html; charset=utf-8`

---

### Audit Logs

#### GET `/api/audit`

Query audit log entries.

**Auth**: `withManager`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `action` | string | - | Filter by action (e.g., `LOGIN_SUCCESS`, `PASSWORD_CHANGE`, `GRANT_PERMISSION`) |
| `userId` | string | - | Filter by user ID |
| `resourceType` | string | - | Filter by resource type (e.g., `Auth`, `User`, `Permission`) |
| `limit` | number | 200 | Maximum results |

**Success Response** (200): Array of audit log entries.

---

### Metrics

#### GET `/api/metrics`

Prometheus-compatible application metrics endpoint.

**Auth**: None (public endpoint)

**Success Response** (200):

```
Content-Type: text/plain; version=0.0.4; charset=utf-8

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
...
```

---

### Error Report

#### POST `/api/error-report`

Client-side error reporting. Persists frontend errors to AuditLog. No authentication required (errors may occur before/during auth flows).

**Auth**: None

**Request Body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | Yes | Error message (truncated to 2000 chars) |
| `digest` | string | No | Error digest/hash |
| `source` | string | No | Error source component |
| `url` | string | No | Page URL where error occurred |

**Success Response** (200):

```json
{ "ok": true }
```

---

## Enum Reference

### TaskStatus

`BACKLOG` | `TODO` | `IN_PROGRESS` | `REVIEW` | `DONE`

### Priority

`P0` | `P1` | `P2` | `P3`

### TaskCategory

`PLANNED` | `ADDED` | `INCIDENT` | `SUPPORT` | `ADMIN` | `LEARNING`

### TimeCategory

`PLANNED_TASK` | `ADDED_TASK` | `INCIDENT` | `SUPPORT` | `ADMIN` | `LEARNING`

### KpiStatus

`DRAFT` | `ACTIVE` | `ACHIEVED` | `MISSED` | `CANCELLED`

### GoalStatus

`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED` | `CANCELLED`

### MilestoneStatus

`PENDING` | `IN_PROGRESS` | `COMPLETED` | `DELAYED` | `CANCELLED`

### DeliverableType

`DOCUMENT` | `SYSTEM` | `REPORT` | `APPROVAL`

### DeliverableStatus

`NOT_STARTED` | `IN_PROGRESS` | `DELIVERED` | `ACCEPTED`

### UserRole

`MANAGER` | `ENGINEER`
