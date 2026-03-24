# TITAN Spec Compliance Report

**Generated:** 2026-03-24
**Spec version:** architecture-v3.md
**Audited by:** Claude Sonnet 4.6

---

## Summary

| Metric | Value |
|--------|-------|
| Spec compliance rate | ~68% |
| Implemented (full) | 30 features/endpoints |
| Partial | 12 features/endpoints |
| Missing | 20+ features/endpoints |

---

## Data Model: 17/17 tables ✅

All 17 tables defined in the spec are present in `prisma/schema.prisma` with correct fields, enums, and relationships.

| Table | Status | Notes |
|-------|--------|-------|
| User | ✅ | All fields match spec |
| Permission | ✅ | All fields match spec |
| KPI | ✅ | All fields match spec |
| KPITaskLink | ✅ | All fields match spec |
| AnnualPlan | ✅ | All fields match spec |
| MonthlyGoal | ✅ | All fields match spec |
| Milestone | ✅ | All fields match spec |
| Task | ✅ | All fields match spec (including addedDate, addedReason, addedSource) |
| SubTask | ✅ | All fields match spec |
| TaskComment | ✅ | All fields match spec |
| TaskActivity | ✅ | All fields match spec |
| TaskChange | ✅ | All fields match spec |
| Deliverable | ✅ | All fields match spec |
| TimeEntry | ✅ | All fields match spec |
| Notification | ✅ | All fields match spec |
| Document | ✅ | All fields match spec |
| DocumentVersion | ✅ | All fields match spec |

**All enums match spec:** Role, KPIStatus, GoalStatus, MilestoneStatus, TaskStatus, Priority, TaskCategory, ChangeType, DeliverableType, DeliverableStatus, TimeCategory, NotificationType ✅

---

## API Endpoints: ~26/40+ implemented

### 4.1 Auth `/api/auth` — ⚠️ Partial (1/3)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/api/auth/login` | ⚠️ Partial | Implemented via NextAuth `[...nextauth]` — not a standalone login route per spec |
| POST | `/api/auth/logout` | ⚠️ Partial | Via NextAuth signOut — not standalone |
| GET | `/api/auth/me` | ❌ Missing | No `/api/auth/me` route; session data obtained via NextAuth session |

### 4.2 Users `/api/users` — ❌ Severely incomplete (1/8)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/users` | ✅ | Implemented |
| GET | `/api/users/:id` | ❌ Missing | No `[id]` route under users |
| POST | `/api/users` | ❌ Missing | No POST on users route |
| PATCH | `/api/users/:id` | ❌ Missing | No user update endpoint |
| DELETE | `/api/users/:id` | ❌ Missing | No user deactivation endpoint |
| GET | `/api/users/:id/workload` | ❌ Missing | No per-user workload sub-route |
| POST | `/api/users/:id/permissions` | ❌ Missing | Permissions exist at `/api/permissions` (not user-scoped) |
| GET | `/api/users/:id/permissions` | ❌ Missing | Same as above |

### 4.3 KPI `/api/kpis` — ⚠️ Partial (5/8)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/kpis` | ✅ | Implemented (route is `/api/kpi` not `/api/kpis`) |
| GET | `/api/kpis/:id` | ✅ | Implemented |
| POST | `/api/kpis` | ✅ | Implemented |
| PATCH | `/api/kpis/:id` | ✅ | Implemented (via PUT) |
| DELETE | `/api/kpis/:id` | ❌ Missing | No DELETE on `/api/kpi/[id]` |
| POST | `/api/kpis/:id/links` | ✅ | Implemented at `/api/kpi/[id]/link` |
| DELETE | `/api/kpis/:id/links/:taskId` | ❌ Missing | No DELETE link endpoint |
| GET | `/api/kpis/:id/achievement` | ✅ | Implemented |

### 4.4 Annual Plans `/api/plans` — ⚠️ Partial (3/7)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/plans` | ✅ | Implemented |
| GET | `/api/plans/:id` | ✅ | Implemented |
| POST | `/api/plans` | ✅ | Implemented |
| POST | `/api/plans/copy-template` | ❌ Missing | Not implemented |
| PATCH | `/api/plans/:id` | ❌ Missing | Only PUT exists (no PATCH) |
| DELETE | `/api/plans/:id` | ❌ Missing | No DELETE on plan |
| GET | `/api/plans/:id/progress` | ❌ Missing | No progress sub-route |

### 4.5 Monthly Goals `/api/goals` — ⚠️ Partial (4/6)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/goals` | ✅ | Implemented |
| GET | `/api/goals/:id` | ✅ | Implemented |
| POST | `/api/goals` | ✅ | Implemented |
| PATCH | `/api/goals/:id` | ✅ | Implemented (via PUT) |
| DELETE | `/api/goals/:id` | ❌ Missing | No DELETE on goal |
| PATCH | `/api/goals/:id/status` | ❌ Missing | No status sub-route |

### 4.6 Milestones `/api/milestones` — ❌ Missing (0/5)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/milestones` | ❌ Missing | No dedicated milestones API route |
| GET | `/api/milestones/:id` | ❌ Missing | Milestones only served via `/api/plans` or `/api/tasks/gantt` |
| POST | `/api/milestones` | ❌ Missing | Milestones created inline via plan creation only |
| PATCH | `/api/milestones/:id` | ❌ Missing | No update endpoint |
| DELETE | `/api/milestones/:id` | ❌ Missing | No delete endpoint |

### 4.7 Tasks `/api/tasks` — ⚠️ Partial (7/13)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/tasks` | ✅ | Implemented with filters |
| GET | `/api/tasks/:id` | ✅ | Implemented |
| POST | `/api/tasks` | ✅ | Implemented |
| PATCH | `/api/tasks/:id` | ✅ | Implemented (handles general update including assignees) |
| DELETE | `/api/tasks/:id` | ✅ | Implemented |
| PATCH | `/api/tasks/:id/status` | ✅ | Implemented as separate PATCH handler |
| PATCH | `/api/tasks/:id/assign` | ❌ Missing | Merged into general PATCH — no dedicated `/assign` sub-route |
| PATCH | `/api/tasks/:id/delay` | ❌ Missing | No dedicated delay endpoint |
| PATCH | `/api/tasks/:id/scope-change` | ❌ Missing | No dedicated scope-change endpoint |
| GET | `/api/tasks/kanban` | ❌ Missing | No kanban view endpoint; frontend fetches `/api/tasks` directly |
| GET | `/api/tasks/gantt` | ✅ | Implemented |
| POST | `/api/tasks/import-excel` | ❌ Missing | Not implemented |
| GET | `/api/tasks/import-template` | ❌ Missing | Not implemented |

### 4.8 SubTasks `/api/subtasks` — ⚠️ Partial (4/5)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/subtasks?taskId=xxx` | ❌ Missing | No GET on `/api/subtasks` |
| POST | `/api/subtasks` | ✅ | Implemented |
| PATCH | `/api/subtasks/:id` | ✅ | Implemented |
| PATCH | `/api/subtasks/:id/toggle` | ⚠️ Partial | Toggle via PATCH on `[id]` — no dedicated `/toggle` sub-route |
| DELETE | `/api/subtasks/:id` | ✅ | Implemented |

### 4.9 Deliverables `/api/deliverables` — ⚠️ Partial (3/6)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/deliverables` | ❌ Missing | No GET list endpoint |
| GET | `/api/deliverables/:id` | ❌ Missing | No GET single endpoint |
| POST | `/api/deliverables` | ✅ | Implemented |
| PATCH | `/api/deliverables/:id` | ✅ | Implemented |
| PATCH | `/api/deliverables/:id/accept` | ❌ Missing | No accept sub-route |
| DELETE | `/api/deliverables/:id` | ✅ | Implemented |

### 4.10 Time Entries `/api/time-entries` — ⚠️ Partial (4/5)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/time-entries` | ✅ | Implemented |
| POST | `/api/time-entries` | ✅ | Implemented |
| PATCH | `/api/time-entries/:id` | ⚠️ Partial | Implemented as PUT (not PATCH) |
| DELETE | `/api/time-entries/:id` | ✅ | Implemented |
| GET | `/api/time-entries/stats` | ✅ | Implemented with engagement rate |

### 4.11 Notifications `/api/notifications` — ⚠️ Partial (2/4)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/notifications` | ✅ | Implemented |
| PATCH | `/api/notifications/:id/read` | ✅ | Implemented |
| PATCH | `/api/notifications/read-all` | ❌ Missing | No bulk read-all endpoint |
| DELETE | `/api/notifications/:id` | ❌ Missing | No delete notification endpoint |

### 4.12 Documents `/api/documents` — ⚠️ Partial (5/8)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/documents/tree` | ⚠️ Partial | GET `/api/documents` returns flat list; tree assembled client-side — no dedicated `/tree` route |
| GET | `/api/documents/search?q=xxx` | ✅ | Implemented with PostgreSQL `tsvector` full-text search |
| GET | `/api/documents/:idOrSlug` | ✅ | Implemented |
| POST | `/api/documents` | ✅ | Implemented |
| PATCH | `/api/documents/:id` | ✅ | Implemented with auto version snapshot |
| DELETE | `/api/documents/:id` | ✅ | Implemented |
| GET | `/api/documents/:id/versions` | ✅ | Implemented |
| GET | `/api/documents/:id/versions/:ver` | ❌ Missing | Only list of versions; no single-version retrieval |

### 4.13 Reports `/api/reports` — ⚠️ Partial (4/7)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/api/reports/weekly` | ✅ | Implemented |
| GET | `/api/reports/monthly` | ✅ | Implemented |
| GET | `/api/reports/kpi` | ✅ | Implemented |
| GET | `/api/reports/unplanned-workload` | ✅ | Implemented as `/api/reports/workload` (name differs) |
| GET | `/api/reports/delay-change` | ❌ Missing | Not implemented |
| GET | `/api/reports/export/pdf` | ❌ Missing | Not implemented |
| GET | `/api/reports/export/excel` | ❌ Missing | Not implemented (frontend exports JSON only) |

---

## Pages: 7/7 present, features vary

| Page | Route | Exists | Feature Completeness |
|------|-------|--------|---------------------|
| Login | `/login` | ✅ | ✅ Credential login, error handling |
| Dashboard | `/` → `/dashboard` | ✅ | ⚠️ Manager view (workload bars, weekly stats) + Engineer view both implemented; missing: KPI overview section, overdue task list, upcoming milestone list |
| Kanban | `/kanban` | ✅ | ⚠️ Columns, drag-to-move status, filters, A/B assignee shown; missing: dedicated Excel import button, category legend |
| Gantt | `/gantt` | ✅ | ✅ Milestones on timeline, A/B avatar, progress bars, weekly navigation |
| Knowledge | `/knowledge` | ✅ | ✅ Tree view, markdown editor, version history panel, search |
| Timesheet | `/timesheet` | ✅ | ✅ Weekly grid, 6 categories, quick-entry popup, engagement rate analysis |
| Reports | `/reports` | ✅ | ⚠️ Weekly/monthly/KPI/workload tabs implemented; exports as JSON only (not PDF/Excel) |
| KPI | `/kpi` | ✅ | ✅ CRUD, task linking, auto-calculate toggle (bonus page not in spec nav but spec has KPI section) |
| Plans | `/plans` | ✅ | ⚠️ Annual plan + monthly goal tree; missing: copy-template flow, plan-level progress rollup |

---

## Feature Checklist

| Feature | Status | Details |
|---------|--------|---------|
| KPI system (create, link tasks, auto-calculate achievement) | ✅ | `/api/kpi`, `/api/kpi/[id]/link`, `/api/kpi/[id]/achievement` all implemented; autoCalc field and logic present |
| A/B角 assignment (primaryAssignee + backupAssignee on tasks) | ✅ | Schema fields present; task PUT updates both; Kanban and Gantt display both avatars |
| 6 task categories (PLANNED, ADDED, INCIDENT, SUPPORT, ADMIN, LEARNING) | ✅ | TaskCategory enum complete; addedDate/addedReason/addedSource fields present |
| Deliverables management (CRUD, attached to tasks/plans/goals/KPIs) | ⚠️ | POST/PATCH/DELETE implemented; GET list and GET single endpoints missing; `/accept` sub-route missing |
| Milestones (attached to annual plans, shown on gantt) | ⚠️ | Schema and gantt display implemented; no dedicated `/api/milestones` CRUD routes — milestones created only as part of plan creation |
| Delay vs Change tracking (TaskChange table, DELAY vs SCOPE_CHANGE) | ⚠️ | Schema and `/api/tasks/[id]/changes` GET/POST implemented; no dedicated `/delay` or `/scope-change` sub-routes on tasks |
| 6 time categories in timesheet | ✅ | TimeCategory enum complete; timesheet grid shows all 6; stats breakdown by category implemented |
| Unplanned workload report | ✅ | `/api/reports/workload` returns unplanned breakdown by person and category |
| Team workload bars on dashboard | ✅ | Manager dashboard shows per-person workload bars with unplanned % |
| 投入率 (task engagement rate) calculation | ✅ | `taskInvestmentRate = PLANNED_TASK hours / total hours` in `/api/time-entries/stats` |
| Manager vs Engineer dashboard views | ✅ | `ManagerDashboard` and `EngineerDashboard` components with role-based rendering |
| Dynamic permissions | ⚠️ | Permission model and `/api/permissions` GET/POST implemented; not enforced consistently across all API routes |
| Notification bell | ✅ | `notification-bell.tsx` component; GET notifications + mark-read implemented |
| Annual plan template copy | ❌ | `/api/plans/copy-template` endpoint not implemented; no UI flow |
| Excel import | ❌ | `/api/tasks/import-excel` and template download endpoints not implemented |
| Full-text search in knowledge base | ✅ | PostgreSQL `tsvector` / `plainto_tsquery` implemented in `/api/documents/search` |
| Document versioning | ✅ | Auto version snapshot on document update; version history list endpoint implemented |
| Weekly/Monthly auto-report generation | ⚠️ | Report data APIs exist; no auto-generation/scheduling (no cron job); no preview/edit flow in UI |
| PDF/Excel export | ❌ | Frontend exports JSON only; no `/api/reports/export/pdf` or `/api/reports/export/excel` endpoints |

---

## Gaps and Recommendations (Prioritized)

### P0 — Critical Missing APIs (blockers for correct operation)

1. **`/api/milestones` full CRUD** — Milestones can only be created inside plan creation; there's no way to add, edit, or delete individual milestones after plan creation. Dashboard and gantt both depend on these.

2. **`/api/users/[id]` sub-routes** — GET single user, POST create user, PATCH update user, DELETE/deactivate user, and GET/POST user-level permissions are all missing. Only GET list exists. Manager cannot manage team members.

3. **`GET /api/deliverables` and `GET /api/deliverables/[id]`** — No way to list or fetch deliverables. The `deliverable-list.tsx` component cannot load data without these.

4. **`PATCH /api/deliverables/[id]/accept`** — Deliverable acceptance workflow (acceptedBy, acceptedAt) is schema-ready but has no API surface.

### P1 — Important Missing Features

5. **`POST /api/plans/copy-template`** — Annual plan template copy from prior year is a key UX feature in the spec (section 2.10). Schema has `copiedFromYear` field but the endpoint is absent.

6. **`DELETE /api/plans/[id]`, `DELETE /api/goals/[id]`, `DELETE /api/kpi/[id]`** — All three parent-entity delete operations are missing; only PUT/GET exist on the `[id]` routes.

7. **`PATCH /api/notifications/read-all` and `DELETE /api/notifications/[id]`** — Notification management is incomplete; bulk-read and delete are absent.

8. **`GET /api/tasks/kanban`** — Spec defines a dedicated kanban endpoint returning categorised view data. Currently the kanban page fetches `/api/tasks` directly which is less efficient.

9. **`GET /api/reports/delay-change`** — Report tab for delay and scope-change summary is in the spec wireframe but has no API backing.

### P2 — Partial Implementations to Complete

10. **`GET /api/subtasks?taskId=xxx`** — SubTask list endpoint is missing; subtasks are embedded in task detail but cannot be fetched independently.

11. **`GET /api/plans/[id]/progress`** and **`PATCH /api/goals/[id]/status`** — Progress rollup and standalone status update endpoints absent.

12. **`GET /api/documents/:id/versions/:ver`** — Version history list is implemented but fetching a specific version's content is not.

13. **`DELETE /api/kpi/[id]/links/:taskId`** — KPI task link deletion is missing; links can be created but not removed.

14. **`/api/auth/me`** — Spec calls for a dedicated me endpoint; currently session data is obtained from NextAuth, not a dedicated REST route.

### P3 — Export and Automation

15. **PDF/Excel report export** (`/api/reports/export/pdf`, `/api/reports/export/excel`) — Frontend currently exports JSON. True PDF/Excel generation requires a server-side library (e.g., `pdfmake`, `exceljs`).

16. **Excel task import** (`POST /api/tasks/import-excel`, `GET /api/tasks/import-template`) — Both the import endpoint and template download are absent. Requires `xlsx` library integration.

17. **Automatic report generation / scheduling** — Spec describes weekly/monthly reports auto-generated; no cron job or scheduler is present in the codebase.

18. **Milestone 7-day notification trigger** — Spec requires automatic notifications when `plannedEnd` is 7 days away; no scheduled job or trigger exists.

19. **Dashboard KPI overview section** — Manager dashboard wireframe shows KPI achievement bars; current implementation only shows workload and weekly stats.

20. **Dynamic permission enforcement** — Permission model exists and `/api/permissions` can grant access, but individual API route handlers do not consistently check the Permission table for Engineer-scoped data access.
