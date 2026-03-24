# TITAN Architecture Review Report

**Review Date:** 2026-03-24
**Reviewer:** Independent Senior Systems Architect
**Codebase Version:** main branch as of 2026-03-24
**Scope:** Full-stack architecture review of the TITAN IT team work management system
**Context:** Banking environment -- security and reliability are paramount

---

## Executive Summary

TITAN is a well-structured Next.js 15 application with a clean layered architecture (Route -> Service -> Prisma), strong type safety via TypeScript strict mode, and thoughtful separation of concerns. The codebase demonstrates professional engineering practices: consistent error handling, Zod-based input validation, structured logging with pino, and comprehensive test coverage across services, API routes, validators, and components. However, several **critical security gaps** exist that are unacceptable for a banking environment -- most notably, inconsistent auth enforcement across API routes, missing RBAC on sensitive endpoints, absence of rate limiting, no CSRF protection, and hardcoded secrets in docker-compose.dev.yml. The data model is sound but lacks database indexes for common query patterns, and the report endpoints contain significant code duplication and bypass the service layer. These issues are fixable without rearchitecting, but must be addressed before any production deployment.

---

## Architecture Score: 6.5 / 10

| Dimension | Score | Weight | Rationale |
|-----------|-------|--------|-----------|
| Architecture Patterns | 7 | 15% | Clean layering with some inconsistencies |
| Data Model | 7.5 | 15% | Well-normalized, missing indexes |
| Security | 4 | 25% | Critical gaps for banking context |
| Scalability & Performance | 6 | 10% | Adequate for 5-person team, no caching |
| Error Handling & Resilience | 7.5 | 10% | Good unified pattern, edge cases missing |
| Code Quality | 7 | 10% | TypeScript strict, some duplication |
| Deployment & Operations | 7.5 | 10% | Strong Docker setup, good monitoring |
| Testing | 7 | 5% | Good coverage, missing integration tests |

---

## 1. Architecture Patterns

### 1.1 Layered Architecture Consistency

**Finding: MAJOR -- Inconsistent use of the service layer**

The architecture spec defines a clean `Route -> Service -> Prisma` pattern. Most routes follow this correctly:

- `app/api/tasks/route.ts` -> `TaskService` -> Prisma (correct)
- `app/api/plans/route.ts` -> `PlanService` -> Prisma (correct)
- `app/api/users/route.ts` -> `UserService` -> Prisma (correct)
- `app/api/kpi/route.ts` -> direct Prisma calls (violation)

**Routes that bypass the service layer entirely:**

| Route | Issue |
|-------|-------|
| `app/api/notifications/route.ts` | Direct `prisma.notification.findMany` |
| `app/api/notifications/generate/route.ts` | Uses service, but auth is inline |
| `app/api/documents/route.ts` | Direct Prisma calls for both GET and POST |
| `app/api/documents/[id]/route.ts` | Direct Prisma calls with inline versioning logic |
| `app/api/documents/search/route.ts` | Raw SQL query directly in route |
| `app/api/time-entries/route.ts` | Direct Prisma calls |
| `app/api/time-entries/stats/route.ts` | Direct Prisma calls with inline aggregation |
| `app/api/kpi/route.ts` | Direct Prisma calls (despite `KPIService` existing) |
| `app/api/reports/monthly/route.ts` | Multiple direct Prisma calls with complex inline logic |
| `app/api/reports/weekly/route.ts` | Same pattern -- fat route handler |
| `app/api/reports/workload/route.ts` | Same pattern |
| `app/api/reports/kpi/route.ts` | Same pattern, duplicates KPI achievement calculation |
| `app/api/reports/export/route.ts` | ~225 lines of inline data fetching + formatting |
| `app/api/tasks/[id]/changes/route.ts` | POST uses direct `prisma.taskChange.create` |
| `app/api/permissions/route.ts` | Uses service but auth is manual/inline |

**Impact:** Business logic scattered across route handlers makes it untestable in isolation, increases duplication risk, and makes future refactoring harder.

**Recommendation:** Extract all direct Prisma calls from routes into their respective services. The report endpoints are the worst offenders -- a `ReportService` should encapsulate that logic.

### 1.2 Dependency Injection

**Finding: MINOR -- Singleton services at module scope**

Services are instantiated as module-level singletons in each route file:

```typescript
const taskService = new TaskService(prisma);
```

This is acceptable for Next.js route handlers and correctly injects the Prisma singleton. However, some routes create services inline per-request:

```typescript
// app/api/deliverables/route.ts
const service = new DeliverableService(prisma);  // inside each handler
```

This inconsistency is minor but should be standardized.

### 1.3 Cross-Cutting Concerns

**Finding: MAJOR -- Two competing auth patterns**

The codebase has two authentication approaches used inconsistently:

1. **`withAuth` / `withManager` wrappers** (from `lib/auth-middleware.ts`) -- used in tasks, plans, users, KPI, reports, milestones, goals
2. **Manual inline `getServerSession()` checks** -- used in notifications, documents, permissions, time-entries, deliverables, task changes

This creates two problems:
- Routes using `apiHandler` directly (without `withAuth`) must manually handle auth, leading to repetitive boilerplate and potential omissions
- The `withAuth` wrapper calls `requireAuth()` from `lib/rbac.ts`, but some routes import `requireAuth` from `lib/auth.ts` (a different module with different behavior -- `redirect` vs `throw`)

The `lib/auth.ts` file contains page-level auth helpers that `redirect()` on failure. The `lib/rbac.ts` file contains API-level helpers that `throw` errors. Mixing these is dangerous -- calling `redirect()` inside an API route would produce unexpected behavior.

---

## 2. Data Model

### 2.1 Schema Design

**Finding: MINOR -- Well-designed, room for improvement**

The Prisma schema is well-normalized with proper relationships. Positive observations:
- Proper use of `@@unique` constraints (e.g., `[year, code]` on KPI, `[kpiId, taskId]` on KPITaskLink)
- Appropriate use of `onDelete: Cascade` for parent-child relationships (SubTask, TaskComment, etc.)
- `@@map` for snake_case table names (PostgreSQL convention)
- CUID primary keys (collision-resistant, URL-safe)

### 2.2 Missing Indexes

**Finding: MAJOR -- No explicit indexes for common query patterns**

The schema defines zero explicit `@@index` directives. Given the query patterns observed in the codebase, the following indexes are critically needed:

| Table | Columns | Query Pattern |
|-------|---------|---------------|
| `tasks` | `primaryAssigneeId` | Filter by assignee (kanban, reports) |
| `tasks` | `backupAssigneeId` | Filter by backup assignee |
| `tasks` | `status` | Filter by status (very frequent) |
| `tasks` | `monthlyGoalId` | Join with monthly goals |
| `tasks` | `dueDate` | Overdue/due-soon notifications |
| `tasks` | `createdAt` | Report date range queries |
| `time_entries` | `userId, date` | Timesheet lookups (composite) |
| `time_entries` | `date` | Report date range queries |
| `notifications` | `userId, isRead` | Notification bell queries (composite) |
| `task_changes` | `taskId` | Change history lookups |
| `task_changes` | `changedAt` | Report date range queries |
| `documents` | Full-text index on `title, content` | Document search uses raw `to_tsvector` without a GIN index |
| `monthly_goals` | `annualPlanId, month` | Goal lookups by plan+month |
| `permissions` | `granteeId, isActive` | Permission checks (composite) |

While PostgreSQL auto-creates indexes for unique constraints and primary keys, foreign key columns are NOT automatically indexed. For a 5-person team the data volume is small, but as history accumulates over years, these will matter.

**Critical:** The document search route (`app/api/documents/search/route.ts`) uses raw SQL with `to_tsvector('simple', title || ' ' || content)`. Without a GIN index on this expression, every search triggers a full table scan. This will degrade significantly as the knowledge base grows.

### 2.3 Potential N+1 Query Issues

**Finding: MINOR -- Mostly well-handled**

Prisma's `include` is used consistently to eager-load relationships, avoiding N+1 in most cases. However:

- `NotificationService.buildDueSoonMilestoneNotifications` fetches ALL users (`prisma.user.findMany`) to generate notifications for every milestone, creating a cartesian product. For 5 users this is fine; for growth, it would be problematic.
- `ImportService.importTasks` resolves assignee email one-by-one inside a loop (`prisma.user.findUnique` per row). For batch imports, this should use a single `findMany` with all emails, then map locally.
- `TimeEntryService.getStats` calls `listTimeEntries` (which includes relations), then reduces in JS. A Prisma `aggregate` or `groupBy` would be more efficient.

### 2.4 Schema Extensibility

**Finding: MINOR -- Good foundation, some gaps**

- **Audit trail**: The `TaskActivity` and `TaskChange` tables cover task-level auditing, but there is no general audit log for other entities (user changes, permission grants, document edits). For banking compliance, a generic audit table or event sourcing pattern would be valuable.
- **Soft delete**: Users have `isActive` for soft-delete, but tasks and other entities use hard delete (`prisma.task.delete`). In a banking context, hard deletes destroy audit trails. All entities should support soft delete.
- **Permission model**: The `permType` field is a raw `String` rather than an enum. The spec mentions `VIEW_TEAM` and `VIEW_PERSON`, but the code only validates `VIEW_TEAM` and `VIEW_OWN`. This mismatch between spec and implementation could cause authorization bypasses.

---

## 3. Security

### 3.1 Authentication Enforcement

**Finding: CRITICAL -- Middleware does not protect API routes**

The Next.js middleware (`middleware.ts`) only protects page routes:

```typescript
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
  ],
};
```

**API routes (`/api/*`) are NOT included in the middleware matcher.** Authentication for API routes relies entirely on each route handler calling `requireAuth()`, `withAuth()`, or manually checking `getServerSession()`. This is a defense-in-depth failure -- a single forgotten auth check exposes an endpoint.

**Recommendation:** Add `/api/:path*` to the middleware matcher (excluding `/api/auth/`), enforcing authentication at the infrastructure level regardless of individual route handlers.

### 3.2 RBAC Consistency

**Finding: CRITICAL -- Several routes missing proper role checks**

| Route | HTTP Method | Current Auth | Expected Auth | Issue |
|-------|-------------|-------------|---------------|-------|
| `POST /api/tasks/[id]/changes` | POST | `requireAuth` only | `withAuth` or `withManager` | Any authenticated user can create manual change records |
| `DELETE /api/documents/[id]` | DELETE | `requireAuth` only | `withManager` | Any user can delete any document |
| `POST /api/notifications/generate` | POST | `requireAuth` only | `withManager` or cron-token | Any user can trigger notification generation |
| `GET /api/time-entries` | GET | `requireAuth` only | Owner or Manager | Any user can query any user's time entries via `?userId=X` |
| `GET /api/time-entries/stats` | GET | `requireAuth` only | Owner or Manager | Same -- `?userId=X` exposes anyone's stats |
| `PUT /api/tasks/[id]` | PUT | `withAuth` | `withAuth` + ownership check | Any authenticated user can update any task |
| `POST /api/deliverables` | POST | `requireAuth` only | `withAuth` | No role check at all |
| `GET /api/deliverables` | GET | `requireAuth` only | `withAuth` | No role check |

The spec states Engineers can only see their own data unless granted permission. This is not enforced on most endpoints.

### 3.3 Rate Limiting

**Finding: CRITICAL -- No rate limiting on any endpoint**

There is no rate limiting middleware. The login endpoint (`/api/auth/[...nextauth]`) is vulnerable to brute-force attacks. For a banking application, this is unacceptable.

**Recommendation:** Implement rate limiting at minimum on:
- Login endpoint (e.g., 5 attempts per minute per IP)
- All mutation endpoints (POST/PUT/DELETE)
- File upload endpoint (`/api/tasks/import`)

### 3.4 CSRF Protection

**Finding: MAJOR -- No CSRF protection beyond NextAuth's built-in**

NextAuth provides CSRF tokens for its own endpoints, but custom API routes have no CSRF protection. Since the session uses JWT in cookies (via NextAuth), any authenticated browser request from a malicious site could forge API calls.

**Recommendation:** Implement CSRF token validation on all state-changing API routes, or switch to a `SameSite=Strict` cookie policy.

### 3.5 Input Validation Coverage

**Finding: MAJOR -- Inconsistent validation**

Routes using `withAuth`/`withManager` consistently use `validateBody()` with Zod schemas. Routes using inline auth do NOT always validate:

| Route | Validation Status |
|-------|------------------|
| `POST /api/permissions` | Manual field checking (`if (!granteeId)`) -- no Zod |
| `POST /api/tasks/[id]/changes` | Manual field checking -- no Zod |
| `DELETE /api/permissions` | Manual field checking -- no Zod |

These routes accept raw JSON without sanitization.

### 3.6 Raw SQL Injection

**Finding: MINOR -- Properly parameterized**

The single raw SQL query in `app/api/documents/search/route.ts` correctly uses Prisma's tagged template literal for parameterization:

```typescript
prisma.$queryRaw`... WHERE ... @@ plainto_tsquery('simple', ${q}) ...`
```

This is safe against SQL injection. Prisma's ORM queries throughout the rest of the codebase are also safe by design.

### 3.7 Sensitive Data Exposure

**Finding: MAJOR -- Password hash accessible in some paths**

The `User` model includes the `password` field (bcrypt hash). While `UserService` consistently uses `select` to exclude passwords from responses, several routes bypass the service and could inadvertently expose password hashes if include patterns are modified. The schema should enforce this at the Prisma level using `@omit` or a view.

Additionally, `docker-compose.dev.yml` contains hardcoded credentials:

```yaml
POSTGRES_PASSWORD: titan_dev_password
NEXTAUTH_SECRET: dev_secret_change_in_production
```

While these are dev-only values, they should still use environment variables to establish good practices.

### 3.8 Session Configuration

**Finding: MINOR -- Acceptable with caveats**

Session configuration in the NextAuth handler:
- JWT strategy with 8-hour max age (appropriate for bank workday)
- `isActive` check in `authorize()` prevents suspended users from logging in
- However, there is no session revocation mechanism -- a suspended user's existing JWT remains valid until expiration

**Recommendation:** Implement a session validation callback that checks `isActive` on every request, not just at login time.

---

## 4. Scalability & Performance

### 4.1 Database Connection Handling

**Finding: MINOR -- Correct singleton pattern**

`lib/prisma.ts` uses the standard Next.js Prisma singleton pattern with `globalThis` caching in development:

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({...});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

This is correct and prevents connection exhaustion during hot-module replacement. For production, Prisma's default connection pool (pool_size derived from `connection_limit` in the connection string) applies.

**Recommendation:** Explicitly configure `connection_limit` in the DATABASE_URL for production (e.g., `?connection_limit=10` for a 5-user system).

### 4.2 Caching Strategy

**Finding: MAJOR -- No caching layer**

There is zero caching in the application. While the team size is small, frequently accessed data like user lists, annual plans, and KPI definitions are fetched from the database on every request. The production Docker Compose includes Redis (for Outline), which could be leveraged.

**Recommendation:** Implement at minimum:
- In-memory cache for user list and role lookups (refresh every 5 minutes)
- Cache KPI and plan data with short TTL (1-2 minutes)
- Consider Redis for session storage when moving to production

### 4.3 Report Endpoint Performance

**Finding: MAJOR -- Reports execute multiple unoptimized queries**

The report endpoints (`/api/reports/monthly`, `/api/reports/weekly`, `/api/reports/workload`, `/api/reports/export`) each execute 3-5 separate database queries sequentially, then aggregate in JavaScript. For example, the monthly report:

1. `prisma.task.findMany` with complex WHERE
2. `prisma.timeEntry.findMany`
3. `prisma.monthlyGoal.findMany` with nested tasks
4. `prisma.taskChange.findMany`

These could be parallelized with `Promise.all` (as done in `NotificationService.generateAll`), and the JavaScript aggregation could use database-level `groupBy`/`aggregate`.

The export route (`/api/reports/export`) is particularly problematic at ~225 lines -- it duplicates query logic from the individual report routes rather than reusing them.

### 4.4 File Upload Handling

**Finding: MINOR -- No size limit enforcement**

The Excel import endpoint (`/api/tasks/import`) reads the entire file into memory (`Buffer.from(await file.arrayBuffer())`). There is no file size limit, which could lead to memory exhaustion with a large file.

**Recommendation:** Enforce a maximum file size (e.g., 5MB) before parsing.

---

## 5. Error Handling & Resilience

### 5.1 Unified Error Handling

**Finding: Positive -- Well-implemented**

The `apiHandler` wrapper in `lib/api-handler.ts` provides excellent centralized error handling:
- Maps custom error types to HTTP status codes (400, 401, 403, 404)
- Logs unexpected errors server-side with pino
- Never exposes internal details to clients (`"伺服器錯誤"` for 500s)
- Consistent response shape (`{ ok, data?, error?, message? }`)

### 5.2 Missing Edge Cases

**Finding: MAJOR -- No optimistic concurrency control**

Multiple users can update the same task simultaneously without conflict detection. The update pattern is:

```typescript
const existing = await prisma.task.findUnique({ where: { id } });
// ... time passes ...
const task = await prisma.task.update({ where: { id }, data: updates });
```

Between the `findUnique` and `update`, another user could modify the same record. For a banking tool where task status and progress tracking matter, this is a data integrity risk.

**Recommendation:** Add an `updatedAt` or `version` field to the update WHERE clause for optimistic locking.

### 5.3 Transaction Usage

**Finding: MAJOR -- No transactions for multi-step operations**

Several operations involve multiple database writes that should be atomic:

- `DocumentService.updateDocument` -- creates a version snapshot, then updates the document. If the update fails, an orphan version is created.
- `TaskService.updateTask` -- updates the task, then creates change tracking records. If change tracking fails, the task is updated but the audit trail is incomplete.
- `GoalService.deleteGoal` -- nullifies task references, then deletes the goal. If the delete fails, tasks are orphaned.
- `KPIService.deleteKPI` -- deletes task links, then deletes the KPI. Same issue.
- `ImportService.importTasks` -- creates tasks one-by-one in a loop. A partial failure leaves the database in an inconsistent state.

**Recommendation:** Wrap multi-step operations in `prisma.$transaction()`.

---

## 6. Code Quality

### 6.1 TypeScript Strictness

**Finding: Positive -- Strict mode enabled**

`tsconfig.json` has `"strict": true`, which is the correct baseline. Type augmentation for NextAuth session (`types/next-auth.d.ts`) is properly done.

### 6.2 Code Duplication

**Finding: MAJOR -- Significant duplication in report routes**

The KPI achievement calculation appears in three places with slight variations:
1. `services/kpi-service.ts` -- `calculateAchievement()`
2. `app/api/reports/kpi/route.ts` -- inline calculation
3. `app/api/reports/export/route.ts` -- inline calculation (different formula for `achievementRate`)

The weekly report date-range calculation (Monday-Sunday week bounds) is duplicated in:
1. `app/api/reports/weekly/route.ts`
2. `app/api/reports/export/route.ts` (weekly section)

The user-filter logic (`isManager ? {} : { primaryAssigneeId: session.user.id }`) is duplicated across all four report routes.

### 6.3 Unused Imports / Dead Code

**Finding: MINOR**

- `app/api/tasks/route.ts` imports `withManager` but only uses `withAuth`
- `app/api/tasks/[id]/route.ts` imports `withManager` (used for DELETE) but also imports unused `requireAuth`
- `lib/auth.ts` exports `requireAuth` and `requireManager` that duplicate functionality in `lib/rbac.ts` with different semantics (redirect vs throw)

### 6.4 Type Safety Gaps

**Finding: MINOR -- Enum casting without validation**

Several services cast strings to Prisma enums without runtime validation:

```typescript
status: (input.status ?? "BACKLOG") as TaskStatus,
category: input.category as TimeCategory,
```

While Zod validators at the route layer protect against invalid values, the service layer accepts raw strings and casts them. If a service is ever called without going through a validated route (e.g., from a cron job or test), invalid enum values could be inserted.

---

## 7. Deployment & Operations

### 7.1 Docker Configuration

**Finding: Positive -- Production-quality**

The Dockerfile uses a proper multi-stage build:
1. `deps` -- installs node_modules
2. `builder` -- generates Prisma client and builds Next.js
3. `runner` -- minimal production image with non-root user (`nextjs:nodejs`)

The production `docker-compose.yml` demonstrates strong security practices:
- Non-root users for all services
- Resource limits (`deploy.resources.limits`)
- Internal-only networking (no external port exposure on DB, Redis, MinIO)
- Health checks on all services
- Pinned image versions (critical for air-gapped deployment)

### 7.2 Monitoring Stack

**Finding: Positive -- Comprehensive**

The `docker-compose.monitoring.yml` includes a full observability stack:
- Prometheus for metrics collection
- Grafana for dashboards
- Alertmanager for alert routing
- Node Exporter (host metrics)
- cAdvisor (container metrics)
- PostgreSQL Exporter
- Redis Exporter
- Uptime Kuma (service health)

This is well-suited for a bank's air-gapped environment.

### 7.3 Missing Application Health Check

**Finding: MAJOR -- No application-level health endpoint**

The Next.js application has no `/api/health` or `/api/readiness` endpoint. The Dockerfile `EXPOSE`s port 3100 but there is no health check configured in the container. Uptime Kuma and load balancers need an endpoint to probe.

**Recommendation:** Add a `GET /api/health` endpoint that:
- Returns 200 with `{ status: "ok", timestamp }` when healthy
- Checks database connectivity (`prisma.$queryRaw\`SELECT 1\``)
- Is excluded from authentication

### 7.4 Environment Variable Management

**Finding: MINOR -- Good practices with room for improvement**

- `.env.example` is comprehensive with clear documentation
- `.gitignore` correctly excludes `.env` and `.env.local`
- Production compose uses `${VAR:?required}` syntax for mandatory secrets
- `docker-compose.dev.yml` hardcodes `NEXTAUTH_SECRET: dev_secret_change_in_production` -- should use env var

### 7.5 Logging

**Finding: Positive -- Well-structured**

- Pino logger with structured JSON output
- Sensitive field masking (`sanitizeData()`)
- Request/response logging middleware (`requestLogger`)
- Sensitive header redaction (authorization, cookie)
- Configurable log level via `LOG_LEVEL` env var

### 7.6 Missing Database Migrations

**Finding: MAJOR -- Migrations excluded from version control**

`.gitignore` includes `prisma/migrations/`. For a banking application, database migrations must be version-controlled, reviewed, and applied deterministically. Using `prisma db push` in production is dangerous.

**Recommendation:** Remove `prisma/migrations/` from `.gitignore` and commit migration files.

---

## 8. Testing

### 8.1 Test Coverage

**Finding: Positive -- Broad coverage**

The test suite covers:
- **17 service tests** (all services covered)
- **12 API route tests** (major routes covered)
- **12 component tests** (all major UI components)
- **7 page tests** (all pages)
- **8 validator tests** (all validators)
- **3 lib tests** (api-handler, logger, rbac)

Jest configuration correctly maps `@/` aliases and collects coverage from services.

### 8.2 Test Quality

**Finding: MAJOR -- Tests are shallow mocks, no integration tests**

All tests use jest mocks to isolate units. While this is valid for unit testing, there are no:
- **Integration tests** that test the full Route -> Service -> Database flow
- **Database tests** with a test PostgreSQL instance
- **Auth flow tests** that verify the complete login -> session -> protected-route chain
- **Concurrency tests** for race conditions

The API route tests mock Prisma at the module level, meaning they don't actually test the service layer -- just that the route handler calls the right mock methods.

Example from `__tests__/api/tasks.test.ts`:
```typescript
// This test bypasses TaskService entirely
jest.mock("@/lib/prisma", () => ({
  prisma: { task: mockTask, ... },
}));
```

### 8.3 Missing Critical Test Scenarios

- **Authorization bypass tests**: No tests verify that ENGINEER users are blocked from MANAGER-only endpoints
- **Input validation edge cases**: No tests for XSS payloads, extremely long strings, or Unicode edge cases in task titles
- **File upload security**: No tests for malicious file uploads (non-xlsx files with .xlsx extension, zip bombs)
- **Concurrent update tests**: No tests for race conditions in task updates

### 8.4 Test Environment

**Finding: MINOR**

Jest is configured with `testEnvironment: "node"` but component tests use `jsdom` (via `@testing-library/jest-dom`). The config may need per-test environment annotations, which are present in some test files (`@jest-environment node`).

---

## Architecture Diagram Assessment

The spec includes an ASCII system map and a hierarchical task model:

```
KPI -> AnnualPlan -> MonthlyGoal -> Task -> SubTask
```

**Assessment:** The implementation faithfully follows this hierarchy. The data model correctly implements:
- KPI <-> Task many-to-many via KPITaskLink
- AnnualPlan -> MonthlyGoal -> Task cascade
- Deliverables attached at all four levels (KPI, AnnualPlan, MonthlyGoal, Task)
- A/B assignee pattern (primaryAssignee, backupAssignee)
- Change tracking (TaskChange) and activity logging (TaskActivity)

**Gap:** The spec mentions "SubTask completion rate influencing parent Task progress" and "MonthlyGoal progress auto-calculated from Task completion." Neither auto-calculation is implemented -- `progressPct` is manually updated. This is a spec-implementation divergence.

---

## Prioritized Recommendations

### P0 -- Critical (Must fix before production)

1. **Add `/api/:path*` to middleware matcher** to enforce authentication at infrastructure level
2. **Implement rate limiting** on login and all mutation endpoints
3. **Add RBAC checks to all unprotected endpoints** (documents DELETE, time-entries GET, notifications generate, deliverables, task changes)
4. **Add CSRF protection** on state-changing API routes
5. **Check `isActive` on every authenticated request**, not just at login
6. **Commit database migrations** to version control (remove `prisma/migrations/` from `.gitignore`)
7. **Wrap multi-step DB operations in transactions** (`$transaction`)
8. **Add a `/api/health` endpoint** for container orchestration and monitoring

### P1 -- Major (Should fix before production)

9. **Add database indexes** for all foreign keys and common query patterns (see Section 2.2)
10. **Create a GIN index** for document full-text search
11. **Standardize auth pattern** -- use `withAuth`/`withManager` consistently; remove or deprecate `lib/auth.ts`
12. **Extract report logic into a `ReportService`** -- eliminate code duplication
13. **Add optimistic concurrency control** (version field in update WHERE clause)
14. **Implement soft delete** for all entities, not just Users
15. **Remove hardcoded secrets** from `docker-compose.dev.yml`
16. **Enforce file upload size limits** on the import endpoint
17. **Add Zod validation** to all routes that currently use manual checks (permissions, task changes)

### P2 -- Minor (Technical debt, address in upcoming sprints)

18. **Standardize service instantiation** (module-level singleton vs per-request)
19. **Add integration tests** with a test database
20. **Implement caching** for frequently-read data (user list, plans, KPIs)
21. **Parallelize report queries** with `Promise.all`
22. **Clean up unused imports** and dead code
23. **Add authorization bypass tests** to prevent regression
24. **Implement auto-calculation** for progressPct (spec requirement)
25. **Batch user lookups** in ImportService instead of per-row queries

---

## Appendix: Files Reviewed

| Category | Files |
|----------|-------|
| Spec | `docs/architecture-v3.md` |
| Schema | `prisma/schema.prisma` |
| Services | 15 files in `services/` |
| Validators | 9 files in `validators/` |
| Lib/Middleware | 11 files in `lib/` + `middleware.ts` |
| API Routes | 30 route files in `app/api/` |
| Pages | 9 page/layout files in `app/(app)/` + `app/(auth)/` |
| Tests | 50+ test files across `__tests__/`, `services/__tests__/`, `validators/__tests__/`, `lib/__tests__/` |
| Config | `package.json`, `tsconfig.json`, `jest.config.ts`, `next.config.ts` |
| Docker | `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.monitoring.yml` |
| Security | `.gitignore`, `.env.example` |
