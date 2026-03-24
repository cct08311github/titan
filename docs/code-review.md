# TITAN Code Review

**Reviewed by:** Claude Sonnet 4.6 (automated senior-engineer review)  
**Date:** 2026-03-24  
**Commit reviewed:** `883dc3b` (main)  
**Issue:** #114

---

## Summary

TITAN is a well-structured Next.js 14 project-management application with a solid foundation: typed Zod validators on every write path, a unified `apiHandler` error wrapper, pino structured logging, bcrypt password hashing, and thorough test coverage. The Prisma schema is clean and normalised. However, the review found three critical security issues — an IDOR on time entries, an unguarded notification-generation endpoint, and unvalidated enum input on the change-tracking route — alongside a pattern of inconsistent authentication (two competing patterns used across routes), a gap in the edge-layer middleware matcher, and several duplicated business-logic blocks that increase maintenance risk. No credentials are committed to source, and the Dockerfile follows multi-stage best practice.

---

## Code Quality Score: **6.5 / 10**

| Category | Score |
|---|---|
| Correctness | 7/10 |
| Security | 5/10 |
| Performance | 7/10 |
| Maintainability | 6/10 |
| Best Practices | 7/10 |

---

## Findings by Severity

### Critical

---

#### CR-01 — IDOR on Time Entries: any user can read/write another user's data

**Files:** `app/api/time-entries/route.ts`, `app/api/time-entries/stats/route.ts`

`GET /api/time-entries` and `GET /api/time-entries/stats` accept a `?userId=` query parameter and use it directly as the Prisma `userId` filter without checking whether the requesting user is the owner or a MANAGER:

```ts
// app/api/time-entries/route.ts  line 16
const userId = searchParams.get("userId") || session.user.id;
// …
const where: Record<string, unknown> = { userId };
```

Any authenticated ENGINEER can supply `?userId=<victim-id>` and receive another person's full time-entry history. The same flaw exists in the stats route. Neither route calls `requireOwnerOrManager()` — which already exists in `lib/rbac.ts` for exactly this purpose.

**Fix:** Validate that `userId === session.user.id` or `session.user.role === 'MANAGER'` before using the param, or call `await requireOwnerOrManager(userId)` from `lib/rbac.ts`.

---

#### CR-02 — Unauthenticated role gate on notification generation endpoint

**File:** `app/api/notifications/generate/route.ts`

The endpoint is authentication-gated (any logged-in user), but there is no role restriction:

```ts
const session = await getServerSession();
if (!session?.user?.id) throw new UnauthorizedError();
// No role check — ENGINEER can trigger this
const result = await svc.generateAll();
```

`generateAll()` fans out to every user in the system (`prisma.user.findMany`), creates `createMany` notification rows, and is designed for cron use. Any ENGINEER can call this endpoint repeatedly, generating spam notifications for the entire team or triggering a DB write storm.

**Fix:** Add `if (session.user.role !== 'MANAGER') throw new ForbiddenError();` after the auth check, or switch to `withManager()`.

---

#### CR-03 — Arbitrary `changeType` string accepted in manual change record endpoint

**File:** `app/api/tasks/[id]/changes/route.ts` lines 41-47

```ts
const change = await prisma.taskChange.create({
  data: {
    taskId: id,
    changeType,   // raw string from req.json() — not validated
    reason,
    ...
  },
});
```

The `changeType` field maps to a Prisma enum (`ChangeType: DELAY | SCOPE_CHANGE`). No Zod validation is applied to the request body here — the body is destructured directly from `req.json()`. A client can submit any arbitrary string (e.g., `"ADMIN"`, `""`, or an SQL fragment in a future ORM version). Prisma will reject invalid enum values at runtime, but the error will leak as an unhandled 500 rather than a clean 400, and there is no audit of what was attempted.

**Fix:** Apply a Zod schema: `z.object({ changeType: z.enum(['DELAY', 'SCOPE_CHANGE']), reason: z.string().min(1), ... })` via `validateBody()`.

---

### Major

---

#### CR-04 — Dual authentication patterns: `withAuth` vs raw `getServerSession()`

**Files:** All API routes

The codebase has two distinct authentication patterns:

**Pattern A (preferred, ~60% of routes):** `withAuth` / `withManager` HOC from `lib/auth-middleware.ts` which wraps routes with `apiHandler` + `requireAuth()`.

**Pattern B (~40% of routes):** Direct `getServerSession()` call at the top of `apiHandler()`.

Routes using pattern B include: `app/api/time-entries/*`, `app/api/documents/*`, `app/api/goals/*`, `app/api/notifications/*`, `app/api/subtasks/*`, `app/api/kpi/[id]/achievement/route.ts`, `app/api/kpi/[id]/link/route.ts`, `app/api/tasks/gantt/route.ts`, `app/api/tasks/[id]/changes/route.ts`.

The inconsistency creates cognitive overhead when reviewing — a reviewer cannot assume which pattern a route uses. Pattern B also calls `getServerSession()` without the `authOptions` argument (which is acceptable with next-auth v4 when there is a single handler, but is fragile if the config ever moves). Pattern A routes additionally get request logging via `requestLogger`, which pattern B routes do not.

**Fix:** Migrate all remaining pattern B routes to `withAuth()` or `withManager()`. The `lib/auth.ts` `requireAuth`/`requireManager` functions (which redirect to pages) are server-component utilities and should remain separate, but all API routes should use the HOC pattern.

---

#### CR-05 — `middleware.ts` matcher missing `/plans` and `/kpi` routes

**File:** `middleware.ts`

```ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
    // MISSING: "/plans/:path*"
    // MISSING: "/kpi/:path*"
  ],
};
```

The Next.js edge middleware (next-auth token check) does not protect `/plans` or `/kpi`. Unauthenticated users who know the URL can load the page shell. While the API routes do enforce auth, the page routes should be protected at the edge layer for consistency and to avoid rendering protected page chrome to anonymous users.

**Fix:** Add `"/plans/:path*"` and `"/kpi/:path*"` to the matcher array.

---

#### CR-06 — Document version snapshot created unconditionally on PUT even without content change

**File:** `app/api/documents/[id]/route.ts` lines 50-57

```ts
// Always creates a version, even if only title or parentId changed
await prisma.documentVersion.create({
  data: {
    documentId: id,
    content: existing.content,
    version: existing.version,
    createdBy: session.user.id,
  },
});
```

The route handler unconditionally creates a `DocumentVersion` snapshot and increments `version` on every `PUT`, regardless of whether `content` changed. This means renaming a document or re-parenting it fills the versions table with identical content blobs. The service layer (`document-service.ts`) correctly guards with `if (input.content !== undefined && input.content !== existing.content)`, but the API route bypasses the service and implements its own logic without the guard.

**Fix:** Add `if (content !== undefined && content !== existing.content)` guard around the `documentVersion.create` call, and only increment `version` when content actually changes.

---

#### CR-07 — `NotificationService.buildDueSoonMilestoneNotifications` fetches all users including suspended

**File:** `services/notification-service.ts` lines 106-107

```ts
const [milestones, allUsers] = await Promise.all([
  this.prisma.milestone.findMany({ ... }),
  this.prisma.user.findMany({ select: { id: true } }),  // no isActive filter
]);
```

Suspended users (`isActive: false`) receive milestone notifications. Every active milestone generates `O(total users)` notification rows, so a suspended-user accumulation over time inflates this further. For a 50-user team with 10 active milestones and 5 suspended users, each cron run creates 50 unnecessary rows.

**Fix:** Add `where: { isActive: true }` to the `user.findMany` call.

---

#### CR-08 — KPI achievement rate calculation duplicated in four locations

**Files:**
- `app/api/kpi/[id]/achievement/route.ts` lines 39-48
- `app/api/reports/kpi/route.ts` lines 29-36
- `app/api/reports/export/route.ts` lines 114-122
- `app/(app)/dashboard/page.tsx` lines 85-93 (client-side)

All four blocks implement the same weighted-progress formula independently. Any change to the business logic (e.g., treating `REVIEW` tasks differently from `IN_PROGRESS`) must be applied in four places. The server-side instances should delegate to `KPIService.calculateAchievement()`, which already exists but is only called from a dedicated endpoint.

**Fix:** Extract the formula into a pure utility function (e.g., `lib/kpi-calc.ts`) shared by all callers. The dashboard client-side instance is acceptable as a read-only display duplicate but should be documented as such.

---

#### CR-09 — `updateTaskSchema` does not accept `null` for nullable date fields

**File:** `validators/task-validators.ts` lines 49-50

```ts
dueDate: z.string().datetime().optional(),
startDate: z.string().datetime().optional(),
```

`.optional()` means the field can be absent, but if a client sends `dueDate: null` to clear the date, Zod will reject the `null` value (since `z.string()` does not accept `null`). The service layer and Prisma schema both support `null` for these fields. The correct schema is `z.string().datetime().nullable().optional()` (or `z.coerce.date().nullable().optional()`).

**Fix:**
```ts
dueDate: z.string().datetime().nullable().optional(),
startDate: z.string().datetime().nullable().optional(),
```

---

#### CR-10 — `PUT /api/tasks/[id]` updates task without any ownership or role check

**File:** `app/api/tasks/[id]/route.ts` lines 21-30

```ts
export const PUT = withAuth(async (req, context) => {
  const { id } = await context!.params;
  // No check: is the caller the owner, assignee, or a MANAGER?
  const task = await taskService.updateTask(id, body);
  ...
});
```

Any authenticated user (ENGINEER or MANAGER) can `PUT` any task, including changing its `primaryAssigneeId`, `status`, `priority`, and `monthlyGoalId`. The `PATCH` (status update) similarly has no ownership check. The `DELETE` correctly requires MANAGER. The intended access model (based on the `requireOwnerOrManager` utility and RBAC docs in `lib/rbac.ts`) suggests that ENGINEERs should only be able to modify tasks they are assigned to.

**Fix:** Resolve the task first, then call `requireOwnerOrManager(task.primaryAssigneeId ?? task.creatorId)` before performing the update.

---

#### CR-11 — `GoalService.deleteGoal` uses two separate queries instead of a transaction

**File:** `services/goal-service.ts` lines 107-111

```ts
await this.prisma.task.updateMany({
  where: { monthlyGoalId: id },
  data: { monthlyGoalId: null },
});
return this.prisma.monthlyGoal.delete({ where: { id } });
```

If the server crashes or the process is killed between the two queries, tasks will have `monthlyGoalId: null` but the goal will still exist (or vice versa), leaving the database in an inconsistent state. The same pattern appears in `KPIService.deleteKPI` (`deleteMany` links then `delete` KPI).

**Fix:** Wrap both operations in `prisma.$transaction([...])`. Prisma interactive transactions or batch transactions both work here.

---

#### CR-12 — `ImportService.importTasks` performs N individual `prisma.task.create` calls

**File:** `services/import-service.ts` lines 147-188

For each valid row, a separate `task.create` is awaited sequentially inside a `for` loop. For a 500-row import this is 500 round trips to PostgreSQL.

**Fix:** Collect valid rows, resolve all assignee emails with a single `user.findMany({ where: { email: { in: emails } } })` call, then use `prisma.task.createMany(...)`. Note that `createMany` does not support nested relations, which is acceptable here since the import only creates top-level task fields.

---

### Minor

---

#### CR-13 — `lib/auth.ts` `requireManager` function is dead code

**File:** `lib/auth.ts` lines 16-22

`requireManager()` is a page-level redirect helper but there are no Server Component pages that import it — all pages are `"use client"` and use `useSession()`. The API layer uses `lib/rbac.ts` `requireRole()` instead. This file's `requireAuth` is also shadowed by the rbac version. The file adds confusion about which auth helper to use.

**Recommendation:** Either document that `lib/auth.ts` is for future server components only, or remove it and consolidate into `lib/rbac.ts`.

---

#### CR-14 — `docker-compose.dev.yml` hardcodes a named weak secret

**File:** `docker-compose.dev.yml` line 41

```yaml
NEXTAUTH_SECRET: dev_secret_change_in_production
```

The value is descriptively named but will realistically be copy-pasted into staging or CI environments unchanged. It is committed to the repository, so it is now a public known weak secret.

**Recommendation:** Replace with a placeholder like `NEXTAUTH_SECRET: CHANGE_ME_generate_with_openssl_rand_hex_32` and add a startup check (or a `scripts/auth-init.sh` call) that validates the secret is not the placeholder value before starting the app.

---

#### CR-15 — `validateBody` error message exposes full Zod format tree to client

**File:** `lib/validate.ts` lines 10-11

```ts
const formatted = (result.error as ZodError).format();
throw new ValidationError(JSON.stringify(formatted));
```

`ZodError.format()` returns a deeply nested object that may include field paths and internal type information. This is returned verbatim to the client as the error `message`. While not a critical security issue, it leaks schema structure and produces poor UX on the frontend.

**Recommendation:** Map to a flat list of human-readable messages: `result.error.issues.map(i => i.message).join('; ')`.

---

#### CR-16 — Subtask `POST /api/subtasks` has no Zod validation schema

**File:** `app/api/subtasks/route.ts` lines 12-13

```ts
const { taskId, title, assigneeId, dueDate, order } = body;
if (!taskId || !title) { throw new ValidationError("..."); }
```

The body is destructured raw from `req.json()` with a single manual presence check. There is no Zod schema, so type coercion, length limits, and format validation (e.g., `dueDate` is a valid ISO date) are absent. This is inconsistent with every other write endpoint in the project.

**Fix:** Create `validators/subtask-validators.ts` and call `validateBody(createSubtaskSchema, raw)` as done in all other routes.

---

#### CR-17 — `permissions/route.ts` POST does not validate `permType` against enum at the API layer

**File:** `app/api/permissions/route.ts` lines 40-46

The `permType` field is passed directly to `PermissionService.grantPermission()`, which does validate it against `VALID_SCOPES`. However, the route itself does not apply a Zod schema, and if the service changes or is bypassed the gate is lost. Also, the schema in `permission-service.ts` defines `VALID_SCOPES = ["VIEW_TEAM", "VIEW_OWN"]` but the Prisma schema's `Permission.permType` field comment says `"VIEW_TEAM" | "VIEW_PERSON"` — a discrepancy that should be resolved.

**Fix:** Apply a Zod schema at the route layer; resolve the `VIEW_OWN` vs `VIEW_PERSON` naming inconsistency in the schema comment.

---

#### CR-18 — `ChangeTrackingService.isTitleSignificantlyChanged` algorithm is a weak heuristic

**File:** `services/change-tracking-service.ts` lines 29-41

The similarity algorithm compares characters positionally (index 0 vs index 0, index 1 vs index 1), not by common subsequence. Renaming "Fix login bug" to "Fix login error" would register as a very high similarity (most characters match by position) despite being a meaningful title change, while reordering words would register as a large change. The threshold (40%) is a magic number with no documented rationale.

**Recommendation:** Document the heuristic's known limitations in a code comment, or replace with a simple token-overlap approach. This is a minor UX issue, not a correctness bug.

---

#### CR-19 — `EngineerDashboard` fetches `assignee=me` but the API does not understand `"me"`

**File:** `app/(app)/dashboard/page.tsx` line 336

```ts
fetch("/api/tasks?assignee=me&status=TODO,IN_PROGRESS")
```

The tasks API (`GET /api/tasks`) passes `assignee` directly to `TaskService.listTasks()` which uses it as a literal `primaryAssigneeId` or `backupAssigneeId` value. There is no `"me"` alias resolution. The query will return zero results because no user has `id === "me"`. The engineer dashboard will always show an empty task list.

**Fix:** Either resolve `"me"` to `session.user.id` on the server, or pass the actual user ID from the client: `fetch(`/api/tasks?assignee=${session?.user?.id}&...`)`.

---

#### CR-20 — `notification-bell.tsx` `markAllRead` fires N sequential PATCH requests

**File:** `app/components/notification-bell.tsx` lines 82-84

```ts
async function markAllRead() {
  const unread = notifications.filter((n) => !n.isRead);
  await Promise.all(unread.map((n) => markRead(n.id)));
}
```

`Promise.all` fires N concurrent PATCH requests. For a user with 15 unread notifications, this is 15 simultaneous API calls. There is no backend `PATCH /api/notifications/mark-all-read` bulk endpoint.

**Recommendation:** Add a `PATCH /api/notifications` bulk-mark-read endpoint and call it once. Until then, sequential `for...of` is preferable to avoid saturating the browser's connection pool.

---

#### CR-21 — `timesheet/page.tsx` allows any user to view any other user's time entries

**File:** `app/(app)/timesheet/page.tsx` lines 59-63, 193-199

The timesheet page renders a user picker (`<select>`) populated from `GET /api/users` (all active users) and passes the selected `userId` to `GET /api/time-entries?userId=<id>`. No role check is performed in the component — any ENGINEER can select any colleague from the dropdown and view their detailed weekly time entries. This is the client-side exposure of CR-01.

**Fix:** Conditional render: only MANAGERs should see the user picker. ENGINEERs should always see only their own data.

---

#### CR-22 — `task-detail-modal.tsx` uses 10+ separate `useState` hooks for form fields

**File:** `app/components/task-detail-modal.tsx` lines 85-94

Ten individual state variables are declared for a single form. This makes it easy to miss a field reset when initialising from fetched data, as seen: `save()` on line 125 constructs the payload from individual variables, which may diverge from the loaded task if the component mounts but the `loadTask` effect has not yet resolved.

**Recommendation:** Consolidate form state into a single `useReducer` or a `useState<FormState>` object. This also makes dirty-state detection (whether to show a save confirmation on close) straightforward.

---

#### CR-23 — `Dockerfile` runner stage copies full `public/` directory but no static assets exist

**File:** `Dockerfile` line 33

```dockerfile
COPY --from=builder /app/public ./public
```

The project has no `public/` directory in the repository (only `.next/static`). This `COPY` will succeed silently (Docker creates an empty dir) but is misleading and adds a layer. Minor hygiene issue.

---

#### CR-24 — `docker-compose.dev.yml` `titan-app` service uses `deps` build target, not a dev image

**File:** `docker-compose.dev.yml` lines 29-30

```yaml
build:
  target: deps   # deps stage for dev
```

The `deps` stage only installs `node_modules`. No `CMD` is defined in that stage; `command: npm run dev` is provided, but the working directory will not have the source code copied (the builder stage does `COPY . .`). The volume mount `- .:/app` compensates at runtime, but this is a fragile setup. If the volume fails or the image is run without compose, there is no source in the container.

**Recommendation:** Create a dedicated `dev` stage in the Dockerfile that copies source and sets `CMD ["npm", "run", "dev"]`.

---

## File-by-File Notable Issues

| File | Issues |
|---|---|
| `app/api/time-entries/route.ts` | CR-01 (IDOR), Pattern B auth |
| `app/api/time-entries/stats/route.ts` | CR-01 (IDOR), Pattern B auth |
| `app/api/time-entries/[id]/route.ts` | Pattern B auth — no ownership check on DELETE |
| `app/api/notifications/generate/route.ts` | CR-02 (missing role gate) |
| `app/api/tasks/[id]/changes/route.ts` | CR-03 (unvalidated enum), Pattern B auth |
| `app/api/documents/[id]/route.ts` | CR-06 (unconditional version snapshot) |
| `app/api/documents/route.ts` | Pattern B auth |
| `app/api/goals/route.ts` | Pattern B auth, POST lacks role check |
| `app/api/goals/[id]/route.ts` | PUT has no role check — any user can update any goal |
| `app/api/subtasks/route.ts` | CR-16 (no Zod schema) |
| `app/api/subtasks/[id]/route.ts` | Pattern B auth, PATCH/DELETE have no ownership check |
| `app/api/permissions/route.ts` | CR-17 (schema-level validation missing) |
| `app/api/kpi/[id]/achievement/route.ts` | CR-08 (duplicated calc), Pattern B auth |
| `app/api/kpi/[id]/link/route.ts` | Pattern B auth |
| `app/api/reports/kpi/route.ts` | CR-08 (duplicated calc) |
| `app/api/reports/export/route.ts` | CR-08 (duplicated calc) |
| `app/api/tasks/[id]/route.ts` | CR-10 (no ownership check on PUT/PATCH) |
| `app/api/tasks/gantt/route.ts` | Pattern B auth |
| `middleware.ts` | CR-05 (missing /plans, /kpi) |
| `lib/auth.ts` | CR-13 (dead code / shadowed functions) |
| `lib/validate.ts` | CR-15 (Zod error tree exposed to client) |
| `services/notification-service.ts` | CR-07 (fetches suspended users) |
| `services/goal-service.ts` | CR-11 (non-transactional delete) |
| `services/kpi-service.ts` | CR-11 (non-transactional delete), CR-08 partial |
| `services/import-service.ts` | CR-12 (N+1 individual creates) |
| `services/change-tracking-service.ts` | CR-18 (weak title-diff heuristic) |
| `validators/task-validators.ts` | CR-09 (null not accepted for date fields) |
| `app/(app)/dashboard/page.tsx` | CR-19 (`assignee=me` unresolved), CR-08 duplicate |
| `app/(app)/timesheet/page.tsx` | CR-21 (user picker exposed to ENGINEERs) |
| `app/components/task-detail-modal.tsx` | CR-22 (fragmented form state) |
| `app/components/notification-bell.tsx` | CR-20 (N concurrent PATCH requests) |
| `docker-compose.dev.yml` | CR-14 (hardcoded weak secret), CR-24 (fragile dev target) |
| `Dockerfile` | CR-23 (empty public dir copy) |

---

## Recommendations (Prioritised)

### Immediate (block next deploy)

1. **CR-01** — Add ownership/role check to `GET /api/time-entries` and `GET /api/time-entries/stats`.
2. **CR-02** — Add MANAGER role gate to `POST /api/notifications/generate`.
3. **CR-03** — Add Zod validation to `POST /api/tasks/[id]/changes` request body.
4. **CR-19** — Fix `assignee=me` — ENGINEERs always see empty task list on their dashboard.

### Short-term (next sprint)

5. **CR-05** — Add `/plans` and `/kpi` to `middleware.ts` matcher.
6. **CR-10** — Add ownership checks to `PUT /api/tasks/[id]` and `PATCH /api/tasks/[id]`.
7. **CR-06** — Guard document version snapshot behind content-change check.
8. **CR-09** — Fix `nullable()` on date fields in `updateTaskSchema`.
9. **CR-11** — Wrap `deleteGoal` and `deleteKPI` in Prisma transactions.
10. **CR-21** — Hide user picker from ENGINEERs on timesheet page.

### Medium-term (tech debt)

11. **CR-04** — Migrate all pattern B routes to `withAuth`/`withManager` HOC.
12. **CR-08** — Extract KPI achievement formula into a shared utility.
13. **CR-12** — Replace N-sequential creates in ImportService with `createMany`.
14. **CR-16** — Add Zod schema for subtask POST.
15. **CR-07** — Filter `isActive: true` in milestone notification user fetch.
16. **CR-15** — Improve Zod error serialisation to flat message list.
17. **CR-20** — Add bulk mark-all-read API endpoint.

### Low priority / hygiene

18. **CR-13** — Remove or document `lib/auth.ts` dead code.
19. **CR-14** — Replace `docker-compose.dev.yml` hardcoded secret with a placeholder.
20. **CR-17** — Add route-layer Zod schema for permissions POST; fix schema comment `VIEW_PERSON` vs `VIEW_OWN`.
21. **CR-22** — Consolidate `task-detail-modal` form state into a single object.
22. **CR-23** — Remove or conditionalise the `COPY public/` Dockerfile line.
23. **CR-24** — Create a proper dev Dockerfile stage.
24. **CR-18** — Document or improve the title-diff heuristic.
