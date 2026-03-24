# TITAN Code Review — v3

**Reviewed by:** Claude Sonnet 4.6 (automated senior-engineer review)
**Date:** 2026-03-24
**Repository:** cct08311github/titan
**Branch reviewed:** main
**Issue:** #146
**Previous review:** `docs/code-review.md` (v2, score 6.5/10, 3 Critical)

---

## Executive Summary

This third review verifies the fixes applied since v2 and re-evaluates the full codebase. Of the three Critical findings from v2, **two are fully resolved** (CR-01 IDOR, CR-02 unauthenticated notification generation). The third Critical (CR-03 unvalidated `changeType` enum) **remains open**. Beyond those, the team shipped several significant new security controls not present in v2 — CSRF protection, rate limiting, audit logging, and a two-layer Edge JWT defense-in-depth middleware — which substantially raise the security posture. Several Major findings from v2 were also fixed: transactions now wrap goal/KPI deletes (CR-11), the middleware matcher now covers all `/api/*` routes (CR-05), and all Pattern B auth routes have been migrated to the `withAuth`/`withManager` HOC (CR-04).

Remaining open issues include the unvalidated `changeType` field (Critical), missing ownership checks on task PUT/PATCH (Major, CR-10), unconditional document version snapshots (Major, CR-06), suspended-user notifications (Major, CR-07), subtask POST lacking Zod validation (Minor, CR-16), the `assignee=me` bug breaking the engineer dashboard (Minor, CR-19), the timesheet user-picker exposed to all roles (Minor, CR-21), and the weak `NEXTAUTH_SECRET` in docker-compose.dev.yml (Minor, CR-14). Several new issues were also identified in this review cycle.

**Score: 7.8 / 10** (up from 6.5/10)

---

## Score Breakdown

| Category | v2 Score | v3 Score | Delta |
|---|---|---|---|
| Correctness | 7/10 | 8/10 | +1 |
| Security | 5/10 | 8/10 | +3 |
| Performance | 7/10 | 7/10 | 0 |
| Maintainability | 6/10 | 7/10 | +1 |
| Best Practices | 7/10 | 8/10 | +1 |

---

## v2 Finding Status

| ID | Title | Status |
|---|---|---|
| CR-01 | IDOR on time entries | **FIXED** |
| CR-02 | Unauthenticated notification generation | **FIXED** |
| CR-03 | Unvalidated `changeType` enum | **OPEN** |
| CR-04 | Dual auth patterns (Pattern B routes) | **FIXED** |
| CR-05 | Middleware matcher missing `/plans`, `/kpi` | **FIXED (superseded)** |
| CR-06 | Unconditional document version snapshot | **OPEN** |
| CR-07 | Notification service fetches suspended users | **OPEN** |
| CR-08 | KPI achievement formula duplicated in 4 places | **OPEN (partial)** |
| CR-09 | `updateTaskSchema` rejects `null` dates | **OPEN** |
| CR-10 | Task PUT/PATCH: no ownership check | **OPEN** |
| CR-11 | Non-transactional goal/KPI delete | **FIXED** |
| CR-12 | ImportService N+1 individual creates | **OPEN** |
| CR-13 | `lib/auth.ts` dead code | **OPEN** |
| CR-14 | `docker-compose.dev.yml` weak hardcoded secret | **OPEN** |
| CR-15 | Zod error tree exposed to client | **OPEN** |
| CR-16 | Subtask POST: no Zod schema | **OPEN** |
| CR-17 | Permissions POST: no route-layer Zod schema | **FIXED (partially)** |
| CR-18 | Title-diff heuristic is weak | **OPEN (by design)** |
| CR-19 | `assignee=me` unresolved in engineer dashboard | **OPEN** |
| CR-20 | `markAllRead` fires N concurrent PATCHes | **OPEN** |
| CR-21 | Timesheet user-picker exposed to ENGINEERs | **OPEN** |
| CR-22 | `task-detail-modal.tsx` fragmented form state | **OPEN** |
| CR-23 | Dockerfile empty `public/` COPY | **OPEN** |
| CR-24 | Dev Docker target fragile | **OPEN** |

---

## New Controls Added Since v2 (Positive)

### CSRF Protection — `lib/csrf.ts`

A full Origin-vs-Host CSRF validator was added and wired into `apiHandler`. All mutating requests (POST/PUT/PATCH/DELETE) are validated before the route handler runs. NextAuth's own `/api/auth/*` routes are excluded. The implementation correctly handles the absent-Origin case (allows server-to-server), blocks mismatched origins, and throws a typed `CsrfError` (→ 403). This is a solid, correct implementation.

### Rate Limiting — `lib/rate-limiter.ts`

`rate-limiter-flexible` was integrated with Redis backend and in-memory fallback. Two strategies exist: login (5 attempts/60s per IP+username) and API (100 requests/60s per userId). The factory correctly degrades to memory when Redis is unavailable and emits a warning. The `checkRateLimit()` helper throws a typed `RateLimitError` (→ 429) with a `retryAfter` value. `apiHandler` handles this error type.

**Gap:** The rate limiters are defined and tested, but there is no evidence they are actually consumed in any route handler or in `apiHandler` itself. Neither `apiHandler` (`lib/api-handler.ts`) nor `withAuth`/`withManager` wrappers call `checkRateLimit()`. The infrastructure exists but is not enforced at runtime. (See NF-01 below.)

### Audit Logging — `services/audit-service.ts`

An `AuditService` was added with `log()` and `queryLogs()` methods. Audit logs are immutable (no update/delete), MANAGER-only query, and timestamped server-side. The design is correct.

**Gap:** Similar to rate limiting, `AuditService.log()` is not called from any route handler for security-relevant events (login, permission changes, task deletes, etc.). The service exists but is not integrated. (See NF-02 below.)

### Two-Layer Edge JWT Defense — `middleware.ts` + `lib/auth-depth.ts`

The middleware was refactored to use `checkEdgeJwt()`, which performs a lightweight HS256 JWT verification at the Edge runtime before requests reach Node.js route handlers. The matcher now covers `/api/:path*` (all API routes), making the previous CR-05 finding about missing `/plans` and `/kpi` page routes the only remaining gap for page-layer protection. The architecture comment correctly notes that `withAuth`/`withManager` are kept on route handlers as Layer 2. This is a well-structured defense-in-depth approach.

**Note:** `auth-depth.ts` correctly uses `jose` for Edge-compatible JWT verification (not `jsonwebtoken`, which cannot run in the Edge runtime). Good choice.

### Pattern B Auth Migration (CR-04)

All previously identified Pattern B routes (`time-entries`, `documents`, `goals`, `notifications`, `subtasks`, `kpi/*`, `tasks/gantt`, `tasks/[id]/changes`) have been migrated to `withAuth` or `withManager`. The codebase now has a single consistent HOC-based auth pattern. This significantly reduces cognitive overhead for reviewers.

---

## Open Findings (v3)

### Critical

---

#### CR-03 — Unvalidated `changeType` enum in manual change record endpoint (UNCHANGED)

**File:** `app/api/tasks/[id]/changes/route.ts` lines 29-48

The POST body is still destructured directly from `req.json()` with only a presence check — no Zod schema is applied:

```ts
const { changeType, reason, oldValue, newValue } = body;
if (!changeType || !reason) {
  throw new ValidationError("changeType 和 reason 為必填");
}
// changeType passed directly to prisma.taskChange.create — no enum validation
```

A client can submit any arbitrary string for `changeType`. Prisma will throw an unhandled 500 for invalid enum values instead of a clean 400. More importantly, this is the only write endpoint in the entire project that still bypasses the Zod validation pattern, making it an inconsistent weak point.

**Fix:**
```ts
import { z } from "zod";
const createChangeSchema = z.object({
  changeType: z.enum(["DELAY", "SCOPE_CHANGE"]),
  reason: z.string().min(1).max(1000),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});
// Then: const { changeType, reason, oldValue, newValue } = validateBody(createChangeSchema, body);
```

---

### Major

---

#### NF-01 — Rate limiting infrastructure not wired into any route or middleware

**Files:** `lib/rate-limiter.ts`, `lib/api-handler.ts`, all route handlers

The `createLoginRateLimiter` and `createApiRateLimiter` factories and `checkRateLimit()` helper are fully implemented and tested in `__tests__/`, but no production code path calls them. `apiHandler` does not consume a rate limiter. The login route (`app/api/auth/[...nextauth]/route.ts`) does not call `checkRateLimit()`. The result is that the rate limiting infrastructure exists on paper but provides no runtime protection.

**Fix:** At minimum, wire the login limiter into the NextAuth `credentials` authorize callback, keyed by `IP:username`. Wire the API limiter into `apiHandler` (or into `withAuth`), keyed by `session.user.id`. Accept the in-memory fallback for single-instance deployments.

---

#### NF-02 — Audit logging not called for any security-relevant event

**Files:** `services/audit-service.ts`, all mutating route handlers

`AuditService.log()` is defined and the `AuditLog` Prisma model exists, but no route handler or service method calls it. Permission grants/revocations, task deletes, user role changes, and failed auth attempts are not logged. A MANAGER querying `/api/audit` (if such a route exists) would see an empty log.

**Fix:** Integrate `AuditService.log()` at minimum for: permission grant/revoke, task delete, user role update, and login failures. These are the highest-value audit events. Lower-priority events (task create/update) can follow.

---

#### CR-10 — `PUT /api/tasks/[id]` and `PATCH /api/tasks/[id]` have no ownership check (UNCHANGED)

**File:** `app/api/tasks/[id]/route.ts` lines 21-51

Both `PUT` (full update) and `PATCH` (status update) use `withAuth`, meaning any authenticated user (ENGINEER or MANAGER) can modify any task — including changing `primaryAssigneeId`, `status`, `priority`, and `monthlyGoalId`. The `DELETE` correctly requires MANAGER. No `requireOwnerOrManager()` call is made before the update.

**Fix:** Resolve the task first, then call `await requireOwnerOrManager(task.primaryAssigneeId ?? task.creatorId)` before the update. MANAGER bypasses this check automatically via the helper's existing logic.

---

#### CR-06 — Document version snapshot created unconditionally on PUT (UNCHANGED)

**File:** `app/api/documents/[id]/route.ts` lines 44-53

The route handler creates a `DocumentVersion` snapshot and increments `version` on every `PUT`, regardless of whether `content` actually changed. Renaming a document or changing `parentId` creates a content-identical version row. The `document-service.ts` service layer guards this correctly, but the route bypasses the service.

**Fix:** Add a content-change guard:
```ts
if (content !== undefined && content !== existing.content) {
  await prisma.documentVersion.create({ ... });
  updates.version = existing.version + 1;
} else {
  // Only metadata changed — do not create a version row
  delete updates.version;
}
```

---

#### CR-07 — Notification service fetches all users including suspended (UNCHANGED)

**File:** `services/notification-service.ts` line 106

`buildDueSoonMilestoneNotifications()` calls `prisma.user.findMany({ select: { id: true } })` with no `isActive` filter. Suspended users (`isActive: false`) receive milestone notifications. For a team with suspended users and many active milestones, each `generateAll()` run creates unnecessary notification rows.

**Fix:**
```ts
this.prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
```

---

#### CR-21 — Timesheet page user-picker exposed to all authenticated users (UNCHANGED)

**File:** `app/(app)/timesheet/page.tsx` lines 57-63, 193-199

The timesheet page fetches all active users (`GET /api/users`) and renders a `<select>` that allows any logged-in user to view any colleague's time entries. There is no role check in the component. The server-side fix (CR-01, now applied) correctly blocks the data at the API layer, but the picker still renders for ENGINEERs — they will select a colleague, receive a 403, and see an error state instead of data. The UX is broken and exposes the existence of all user accounts.

**Fix:** Retrieve session role in the component (`useSession()`) and conditionally render the picker only when `session.user.role === 'MANAGER'`. ENGINEERs should see only their own data with no picker visible.

---

### Minor

---

#### CR-09 — `updateTaskSchema` does not accept `null` for date fields (UNCHANGED)

**File:** `validators/task-validators.ts` lines 49-50

```ts
dueDate: z.string().datetime().optional(),
startDate: z.string().datetime().optional(),
```

`.optional()` allows the field to be absent but rejects `null`. Clients sending `dueDate: null` to clear a date receive a Zod validation error. The Prisma schema and service both support `null` for these fields.

**Fix:**
```ts
dueDate: z.string().datetime().nullable().optional(),
startDate: z.string().datetime().nullable().optional(),
```

---

#### CR-12 — `ImportService.importTasks` performs N individual `user.findUnique` + `task.create` calls (UNCHANGED)

**File:** `services/import-service.ts` lines 147-189

For each valid row, the service sequentially awaits `prisma.user.findUnique` (assignee lookup) and `prisma.task.create`. A 200-row import = up to 400 sequential round trips. The email lookups are the easiest to batch: collect all unique `assigneeEmail` values, resolve with a single `user.findMany({ where: { email: { in: emails } } })`, then build a lookup map before the loop.

---

#### CR-14 — `docker-compose.dev.yml` hardcodes a weak `NEXTAUTH_SECRET` (UNCHANGED)

**File:** `docker-compose.dev.yml` line 41

```yaml
NEXTAUTH_SECRET: dev_secret_change_in_production
```

This is a committed, publicly known secret. While named as a dev secret, it is routinely copy-pasted into staging environments. The new Edge JWT layer (`auth-depth.ts`) signs tokens with this same secret, making it security-relevant at the cryptographic level.

**Fix:** Replace with `NEXTAUTH_SECRET: CHANGE_ME_generate_with_openssl_rand_hex_32` and add a startup assertion that rejects the placeholder value.

---

#### CR-16 — Subtask POST has no Zod validation schema (UNCHANGED)

**File:** `app/api/subtasks/route.ts` lines 9-14

The only write endpoint in the project (besides the now-fixed changes endpoint) that still uses manual presence checks instead of Zod. No length limits, type coercion, or format validation for `dueDate`.

**Fix:** Create `validators/subtask-validators.ts` with a `createSubtaskSchema` and call `validateBody()`.

---

#### CR-19 — `assignee=me` not resolved in engineer dashboard (UNCHANGED)

**File:** `app/(app)/dashboard/page.tsx` line 336

```ts
fetch("/api/tasks?assignee=me&status=TODO,IN_PROGRESS")
```

The tasks API uses `assignee` as a literal database ID. No user has `id === "me"`. The engineer dashboard always renders an empty task list. This is a functional bug that makes a primary user-facing view entirely broken for ENGINEERs.

**Fix:** Use the actual session user ID:
```ts
fetch(`/api/tasks?assignee=${session?.user?.id}&status=TODO,IN_PROGRESS`)
```

---

#### CR-20 — `markAllRead` fires N concurrent PATCH requests (UNCHANGED)

**File:** `app/components/notification-bell.tsx` lines 82-85

```ts
async function markAllRead() {
  const unread = notifications.filter((n) => !n.isRead);
  await Promise.all(unread.map((n) => markRead(n.id)));
}
```

For a user with 15 unread notifications this fires 15 simultaneous API calls. No bulk mark-all-read endpoint exists.

**Recommendation:** Add `PATCH /api/notifications` bulk endpoint; call once. Until then, sequential `for...of` avoids browser connection pool saturation.

---

#### NF-03 — Goals API `POST /api/goals` allows any authenticated user to create goals

**File:** `app/api/goals/route.ts` line 29

Goal creation uses `withAuth` (any authenticated user). Creating a monthly goal is a planning-level operation that should be MANAGER-only, consistent with how plan creation, KPI creation, and milestone management are all gated with `withManager`. An ENGINEER can currently create goals under any plan.

**Fix:** Change `withAuth` to `withManager` for the POST handler.

---

#### NF-04 — Goals API `PUT /api/goals/[id]` has no role restriction

**File:** `app/api/goals/[id]/route.ts` line 35

Similar to NF-03: any authenticated ENGINEER can update any goal's `title`, `description`, `status`, or `progressPct`. The `DELETE` correctly uses `withManager` but the `PUT` uses `withAuth`.

**Fix:** Change `withAuth` to `withManager` for the PUT handler, or implement a `requireOwnerOrManager` check if progress updates by ENGINEERs are intentionally permitted.

---

#### NF-05 — `lib/auth.ts` `requireAuth` shadows `lib/rbac.ts` `requireAuth` (UNCHANGED — CR-13)

**File:** `lib/auth.ts`

Two different functions named `requireAuth` exist: one in `lib/auth.ts` (redirects to `/login`, for Server Components) and one in `lib/rbac.ts` (throws `UnauthorizedError`, for API routes). Import confusion between the two can silently swap page-redirect behavior for API error-throwing behavior. Both are currently imported in different contexts but the naming collision is a maintenance hazard.

**Recommendation:** Rename `lib/auth.ts`'s exports to `requireAuthPage` and `requireManagerPage` to make the redirect semantics explicit and eliminate the naming collision.

---

#### NF-06 — `lib/validate.ts` exposes full Zod format tree to clients (UNCHANGED — CR-15)

**File:** `lib/validate.ts` lines 10-11

```ts
const formatted = (result.error as ZodError).format();
throw new ValidationError(JSON.stringify(formatted));
```

`ZodError.format()` returns a deeply nested object with field paths and internal type names. This is returned verbatim to API clients. While not a critical security issue, it leaks schema structure and is poor UX.

**Fix:**
```ts
const messages = result.error.issues.map((i) => i.message).join("; ");
throw new ValidationError(messages);
```

---

## File-by-File Status Summary

| File | v2 Status | v3 Status |
|---|---|---|
| `app/api/time-entries/route.ts` | CR-01 IDOR, Pattern B | **Clean** |
| `app/api/time-entries/stats/route.ts` | CR-01 IDOR, Pattern B | **Clean** |
| `app/api/notifications/generate/route.ts` | CR-02 no role gate | **Clean** — `withManager` |
| `app/api/tasks/[id]/changes/route.ts` | CR-03 unvalidated enum | **CR-03 OPEN** |
| `app/api/tasks/[id]/route.ts` | CR-10 no ownership | **CR-10 OPEN** |
| `app/api/documents/[id]/route.ts` | CR-06 unconditional version | **CR-06 OPEN** |
| `app/api/goals/route.ts` | Pattern B auth | **NF-03 OPEN** (POST allows any user) |
| `app/api/goals/[id]/route.ts` | Pattern B, no role on PUT | **NF-04 OPEN** (PUT allows any user) |
| `app/api/subtasks/route.ts` | CR-16 no Zod | **CR-16 OPEN** |
| `app/api/subtasks/[id]/route.ts` | Pattern B, no ownership | **Clean** (withAuth, no IDOR exposure) |
| `app/api/permissions/route.ts` | CR-17 no Zod | **Fixed** (withManager on all verbs) |
| `app/api/kpi/[id]/achievement/route.ts` | Pattern B, CR-08 dup calc | **Clean** (withAuth, calc unchanged) |
| `app/api/kpi/[id]/link/route.ts` | Pattern B auth | **Clean** — `withManager` |
| `app/api/tasks/gantt/route.ts` | Pattern B auth | **Clean** — `withAuth` |
| `middleware.ts` | CR-05 missing routes | **Fixed** — covers `/api/:path*` |
| `lib/csrf.ts` | Not present in v2 | **New — correct implementation** |
| `lib/rate-limiter.ts` | Not present in v2 | **New — NF-01 not wired** |
| `lib/auth-depth.ts` | Not present in v2 | **New — correct Edge JWT** |
| `lib/auth.ts` | CR-13 dead code / name collision | **NF-05 OPEN** |
| `lib/validate.ts` | CR-15 Zod tree exposed | **NF-06 OPEN** |
| `services/audit-service.ts` | Not present in v2 | **New — NF-02 not wired** |
| `services/notification-service.ts` | CR-07 suspended users | **CR-07 OPEN** |
| `services/goal-service.ts` | CR-11 non-transactional | **Fixed** — `$transaction` |
| `services/kpi-service.ts` | CR-11 non-transactional | **Fixed** — `$transaction` |
| `services/import-service.ts` | CR-12 N+1 creates | **CR-12 OPEN** |
| `validators/task-validators.ts` | CR-09 null date rejection | **CR-09 OPEN** |
| `app/(app)/dashboard/page.tsx` | CR-19 `assignee=me` bug | **CR-19 OPEN** |
| `app/(app)/timesheet/page.tsx` | CR-21 user picker exposed | **CR-21 OPEN** |
| `app/components/notification-bell.tsx` | CR-20 N concurrent PATCHes | **CR-20 OPEN** |
| `docker-compose.dev.yml` | CR-14 weak secret | **CR-14 OPEN** |

---

## Prioritised Recommendations

### Immediate (block next deploy)

1. **CR-03** — Add Zod schema to `POST /api/tasks/[id]/changes`. One file change, five minutes.
2. **CR-19** — Fix `assignee=me` — the engineer dashboard is functionally broken. One line change.
3. **NF-01** — Wire rate limiter into the login route and `apiHandler`. Infrastructure exists; it just needs to be called.

### Short-term (next sprint)

4. **NF-02** — Integrate `AuditService.log()` for permission changes, task deletes, and login failures.
5. **CR-10** — Add `requireOwnerOrManager()` to `PUT /api/tasks/[id]` and `PATCH /api/tasks/[id]`.
6. **NF-03 / NF-04** — Restrict goal create and update to MANAGER role.
7. **CR-21** — Hide timesheet user-picker from ENGINEERs.
8. **CR-09** — Add `.nullable()` to date fields in `updateTaskSchema`.
9. **CR-06** — Guard document version creation behind content-change check.
10. **CR-07** — Add `isActive: true` filter to milestone notification user fetch.

### Medium-term (tech debt)

11. **CR-12** — Batch email lookups and use `createMany` in `ImportService`.
12. **CR-08** — Extract KPI achievement formula into a shared utility function.
13. **CR-16** — Add Zod schema for subtask POST.
14. **NF-05** — Rename `lib/auth.ts` exports to eliminate `requireAuth` name collision.
15. **NF-06** — Replace `ZodError.format()` with flat message list in `lib/validate.ts`.
16. **CR-20** — Add bulk mark-all-read API endpoint.

### Low priority / hygiene

17. **CR-14** — Replace `NEXTAUTH_SECRET` in docker-compose.dev.yml with placeholder.
18. **CR-23** — Remove or guard the `COPY public/` Dockerfile line.
19. **CR-24** — Create a proper dev stage in Dockerfile.
20. **CR-13 / NF-05** — Remove or document `lib/auth.ts`.

---

## Comparison: v2 vs v3

| Metric | v2 | v3 |
|---|---|---|
| Overall score | 6.5/10 | 7.8/10 |
| Critical findings | 3 | 1 (CR-03) |
| Major findings | 8 | 5 (CR-10, NF-01, NF-02, CR-06, CR-07) |
| Minor findings | 13 | 10 |
| New positive controls | — | CSRF, rate limiting (infra), audit logging (infra), Edge JWT, transaction fixes |
| Auth pattern consistency | ~60% HOC | 100% HOC |
| Middleware coverage | 6 page routes | All `/api/*` + 6 page routes |
