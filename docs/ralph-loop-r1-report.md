# Ralph-Loop Round 1 Report — TITAN Code Review + API Boundary Testing

**Date**: 2026-04-01
**Reviewer**: Claude Opus 4.6 (Ralph-Loop)
**Scope**: Auth system, Core services, Security middleware, Database schema, API boundary tests

---

## Task A: Code Review Findings

### CRITICAL

| # | Severity | File:Line | Description | Issue |
|---|----------|-----------|-------------|-------|
| 1 | CRITICAL | `services/project-service.ts` | **No state machine on project status transitions** — status can jump from PROPOSED to COMPLETED, bypassing entire lifecycle (requirements, design, testing, UAT, deployment). Task/Goal/Milestone all have state machines but Project does not. | [#1204](https://github.com/cct08311github/titan/issues/1204) |
| 2 | CRITICAL | `services/project-service.ts` | **No sequential enforcement on gate review** — G2 can be PASSED while G1 is still PENDING. All 5 phase gates can be bypassed. Banking compliance critical. | [#1205](https://github.com/cct08311github/titan/issues/1205) |
| 3 | HIGH | `services/task-service.ts:204` | **XSS sanitization gap** — `createTask()` calls `sanitizeHtml()` but `updateTask()` does NOT. Stored XSS possible via task update. Same gap in plan-service, kpi-service, project-service. | [#1209](https://github.com/cct08311github/titan/issues/1209) |
| 4 | HIGH | `services/audit-service.ts:183` | **RBAC hierarchy bug** — `queryLogs` uses `callerRole !== "MANAGER"` instead of `hasMinimumRole()`. ADMIN (highest role) is denied access to audit logs. | [#1211](https://github.com/cct08311github/titan/issues/1211) |

### HIGH

| # | Severity | File:Line | Description | Issue |
|---|----------|-----------|-------------|-------|
| 5 | HIGH | `services/task-service.ts:441` | **deleteTask lacks transaction and null check** — delete + audit log not wrapped in `$transaction`. Missing null check before delete causes unhandled Prisma error instead of NotFoundError. | [#1213](https://github.com/cct08311github/titan/issues/1213) |
| 6 | HIGH | `services/project-service.ts` | **benefitScore no bounds validation** — accepts negative values, 100, 999. Feeds into priorityScore calculation, corrupting project prioritization. | [#1208](https://github.com/cct08311github/titan/issues/1208) |

### MEDIUM

| # | Severity | File:Line | Description |
|---|----------|-----------|-------------|
| 7 | MEDIUM | `services/task-service.ts:316` | **TaskActivity writes not in transaction** — `updateTask` writes field changes to TaskActivity in a loop outside the main update, risking partial writes if one fails. Compare with `updateTaskStatus` which correctly uses `$transaction`. |
| 8 | MEDIUM | `lib/security/sanitize.ts:135` | **CSS escape replacement too aggressive** — `result.replace(/\\/g, "\\\\")` doubles ALL backslashes in the entire HTML string, not just those in CSS contexts. Could corrupt legitimate content containing backslashes. |
| 9 | MEDIUM | `services/plan-service.ts:153` | **deletePlan no cascade safety check** — deletes plan without checking for linked tasks (via annualPlanId). Schema uses `onDelete: SetNull` so tasks won't be orphaned, but no audit trail of the disassociation. |
| 10 | MEDIUM | `lib/security-middleware.ts:111` | **getSessionUserId trusts X-User-Id header** — comment says "Prefer X-User-Id header injected by tests / other middleware". In production this header could be spoofed to bypass rate limiting. Should only be trusted in test environments. |

### LOW

| # | Severity | File:Line | Description |
|---|----------|-----------|-------------|
| 11 | LOW | `prisma/schema.prisma` Task | **No composite index on `[status, priority]`** — `listTasks` sorts by priority+dueDate and filters by status. A composite index would significantly improve query performance for the main Kanban view. |
| 12 | LOW | `prisma/schema.prisma` Notification | **No composite index on `[userId, isRead]`** — unread notification queries (common pattern) would benefit from this. |
| 13 | LOW | `services/kpi-service.ts:131` | **linkTask has no idempotency** — calling `linkTask` twice with same kpiId+taskId throws P2002 (unique constraint). Should use `upsert` or check existence first. |
| 14 | LOW | `lib/prisma.ts` | **Connection pool size hardcoded to 10** — should be configurable via env var for production tuning. |

---

## Task A: Auth System Assessment

### Strengths (Well-Implemented)
- **Two-layer JWT verification**: Edge middleware (Layer 1) + server-side auth() (Layer 2)
- **HKDF key derivation**: Correctly matches Auth.js v5's key derivation for JWE decryption
- **JWT blacklist**: Redis primary + in-memory fallback with TTL expiry
- **Session limiting**: Lua script for atomic Redis operations, per-platform limits
- **CSRF protection**: Origin-based validation in `lib/csrf.ts`, integrated into apiHandler
- **Rate limiting**: Differentiated rates (100/60s read, 20/60s write), Redis + memory fallback
- **Account lockout**: 5 failures / 30min lock, with proper failure auditing
- **Session timeout**: Server-side tracking (no client-side spoofing)
- **Password history**: 5 previous passwords tracked, bcrypt hashed
- **CSP with nonce**: Per-request cryptographic nonce, strict-dynamic in production

### No Critical Auth Vulnerabilities Found
The auth system is well-architected with defense-in-depth.

---

## Task B: API Boundary Test Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Project: name=1 char | PASS (201) | Accepted |
| 2 | Project: name=200 chars | PASS (201) | Accepted |
| 3 | Project: empty name | PASS (400) | Correctly rejected |
| 4 | Project: benefitScore=0 | PASS (201) | Accepted |
| 5 | Project: benefitScore=25 | PASS (201) | Accepted |
| 6 | Project: benefitScore=-1 | **FAIL** (201) | Should reject negative — [#1208] |
| 7 | Project: benefitScore=100 | **FAIL** (201) | Should reject over max — [#1208] |
| 8 | Project: benefitScore=999 | **FAIL** (201) | Should reject over max — [#1208] |
| 9 | Project: PROPOSED->COMPLETED | **FAIL** (200) | No state machine — [#1204] |
| 10 | Risk: 16 P*I combos | PASS | All riskScores correctly auto-calculated |
| 11 | Gate: PASS G2 while G1 PENDING | **FAIL** (200) | No sequential enforcement — [#1205] |
| 12 | Task: BACKLOG->DONE | PASS (400) | State machine correctly blocks |
| 13 | Task: optimistic concurrency (If-Match) | PASS (409) | Correctly returns conflict |
| 14 | Task: concurrent update (no If-Match) | PASS (200/200) | Both succeed (expected: no header = no OCC) |
| 15 | TimeEntry: hours=0 | PASS (400) | Correctly rejected |
| 16 | TimeEntry: hours=0.5 | PASS (201) | Minimum valid unit |
| 17 | TimeEntry: hours=0.3 | PASS (400) | Non-0.5 unit rejected |
| 18 | TimeEntry: hours=24 | PASS (400) | Daily limit enforced |
| 19 | TimeEntry: hours=25 | PASS (400) | Over max rejected |
| 20 | TimeEntry: hours=-1 | PASS (400) | Negative rejected |
| 21 | KPI: create | PASS (201) | Valid data accepted |
| 22 | KPI: achievement (DRAFT KPI) | PASS (400) | "僅啟用中的 KPI 可以填報" |
| 23 | Auth: garbage Bearer | PASS (401) | Rejected |
| 24 | Auth: empty Bearer | PASS (200) | Falls back to cookie (correct) |
| 25 | Search: % char | PASS (200) | Handled |
| 26 | Search: _ char | PASS (200) | Handled |
| 27 | Search: Unicode | PASS (200) | Handled |
| 28 | Search: SQL injection | PASS (200) | Parameterized queries protect |
| 29 | Search: XSS in param | PASS (200) | Handled |
| 30 | Search: 1000 char query | PASS (200) | Handled gracefully |

**Summary**: 24/30 PASS, 6 FAIL (all documented in issues above)

---

## GitHub Issues Created

| Issue | Title | Severity |
|-------|-------|----------|
| [#1204](https://github.com/cct08311github/titan/issues/1204) | bug(project): no state machine enforcement on project status transitions | CRITICAL |
| [#1205](https://github.com/cct08311github/titan/issues/1205) | bug(project): no sequential enforcement on gate review | CRITICAL |
| [#1208](https://github.com/cct08311github/titan/issues/1208) | bug(project): benefitScore accepts negative and unbounded values | HIGH |
| [#1209](https://github.com/cct08311github/titan/issues/1209) | sec(task): XSS sanitization only applied in createTask, not updateTask | HIGH |
| [#1211](https://github.com/cct08311github/titan/issues/1211) | sec(audit): queryLogs uses string comparison instead of RBAC hierarchy | HIGH |
| [#1213](https://github.com/cct08311github/titan/issues/1213) | bug(task): deleteTask lacks transaction and null check | HIGH |
