# TITAN — Comprehensive QA Verification Report

**Date:** 2026-03-24  
**Auditor:** QA Engineer (Claude Agent)  
**Codebase commit:** `883dc3b` (latest main)  
**Next.js version:** 15.2.3  
**Node/runtime:** Darwin 25.3.0

---

## Overall Quality Score: **6.5 / 10**

| Category | Score | Summary |
|---|---|---|
| Test Suite | 5/10 | 297 tests pass but 31/60 suites fail to run (JSX transform misconfiguration) |
| Type Safety | 7/10 | 3 TypeScript errors in production code, 0 `any` usage |
| Build | 4/10 | Build fails due to TypeScript route context type mismatch |
| Dependencies | 3/10 | Critical CVE in Next.js (unpatched); high-severity vuln in xlsx |
| Code Quality | 9/10 | No console.log, no hardcoded secrets, clean code |
| API Contracts | 8/10 | All routes have auth; ~54% missing Zod validation |
| Security | 6/10 | Passwords hashed; no rate limiting; middleware-only auth (CVE-29927 risk) |
| Accessibility | 4/10 | All 9 app pages missing ARIA attributes; sparse label coverage |

---

## 1. Test Suite Analysis

### Summary

| Metric | Value |
|---|---|
| Total test suites | 60 |
| Passing suites | 29 |
| Failing suites | 31 (all fail-to-run, not fail-to-pass) |
| Total tests | 297 |
| Passing tests | 297 (100% of runnable tests) |
| Failing tests | 0 |

### Coverage (services layer — only measured layer)

| File | Statements | Branch | Functions | Lines |
|---|---|---|---|---|
| All services | 79.9% | 59.27% | 97.45% | 89.44% |
| change-tracking-service.ts | 94.87% | 82.14% | 100% | 100% |
| deliverable-service.ts | 80% | 61.42% | 100% | 93.75% |
| document-service.ts | 74.19% | 41.66% | 100% | 84.61% |
| export-service.ts | 100% | 57.69% | 100% | 100% |
| goal-service.ts | 57.57% | 35.89% | 100% | 65.38% |
| import-service.ts | 90.9% | 74.66% | 100% | 90.19% |
| kpi-service.ts | 51.92% | 29.41% | 81.81% | 62.5% |
| milestone-service.ts | 80.48% | 74.07% | 100% | 93.33% |
| notification-service.ts | 98.11% | 76.47% | 90% | 100% |
| permission-service.ts | 80.76% | 65.38% | 100% | 95% |
| plan-service.ts | 86.48% | 75% | 100% | 100% |
| task-service.ts | 68.05% | 45.33% | 100% | 86.27% |
| time-entry-service.ts | 65% | 36.95% | 100% | 74.19% |
| user-service.ts | 86.53% | 80.76% | 100% | 100% |

### Root Cause of 31 Failing Suites

**All 31 failures are caused by a single misconfiguration:** `jest.config.ts` uses `preset: "ts-jest"` with `testEnvironment: "node"`, but does not configure a JSX transform for `.tsx` files. When any test file imports `__tests__/utils/test-utils.tsx` (which contains JSX `<>{children}</>`), Jest throws:

```
SyntaxError: Unexpected token '<'
/private/tmp/titan-qa/__tests__/utils/test-utils.tsx:27
    return <>{children}</>;
```

Affected test suites: all `__tests__/api/*.test.ts`, `__tests__/components/*.test.tsx`, `__tests__/pages/*.test.tsx` (31 files).

**Fix required:** Add `testEnvironment: "jsdom"` for `.tsx` files and configure the JSX pragma in `tsconfig` or ts-jest options, or split the jest config into two projects (node for API tests, jsdom for component/page tests).

### Untested Critical Paths

- `kpi-service.ts`: branch coverage only 29.41% — KPI aggregation and scoring logic undertested
- `goal-service.ts`: branch coverage only 35.89% — goal status transitions undertested
- `time-entry-service.ts`: branch coverage only 36.95% — overtime/overlap detection undertested
- `export-service.ts`: branch coverage only 57.69% — PDF/Excel column mapping edge cases uncovered
- No coverage measured for `app/` (pages, components), `lib/`, `validators/`, or `middleware.ts`

---

## 2. Type Safety Check

### TypeScript Errors (`npx tsc --noEmit`)

**3 production errors found:**

#### Error 1 — `app/api/deliverables/route.ts` (lines 25, 41)
```
Property 'errors' does not exist on type 'ZodError<...>'.
Parameter 'e' implicitly has an 'any' type.
```
**Root cause:** Zod v4 changed the error shape — `error.errors` is no longer the correct accessor. The correct path is `error.issues` in Zod v4 (the project uses `zod@^4.3.6`).

#### Error 2 — `app/api/reports/export/route.ts` (line 218)
```
Argument of type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit | null | undefined'.
```
**Root cause:** `new NextResponse(buffer, ...)` does not accept a Node.js `Buffer` directly as body in Next.js App Router. Must convert to `Uint8Array` or use `.buffer` property.

#### Test-only TypeScript Errors (4 test files)
`__tests__/api/documents.test.ts` and `__tests__/api/kpi.test.ts`, `notifications.test.ts` — type mismatches in mock setup (route context params typed as `Promise<Record<string, string>>` but test passes object literals). These do not affect production but indicate test maintainability risk.

### `any` Type Usage

**0 instances** of `: any` or `as any` found in production code (`app/`, `lib/`, `services/`, `validators/`, `types/`). Excellent.

---

## 3. Build Verification

**Build status: FAIL**

```
app/api/deliverables/[id]/route.ts
Type error: Route has an invalid "GET" export:
  Type "{ params: Promise<Record<string, string>>; } | undefined"
  is not a valid type for the function's second argument.
```

**Root cause:** `app/api/deliverables/[id]/route.ts` uses `apiHandler()` with an `undefined`-able context parameter. Next.js 15 requires route handler context to always be `{ params: Promise<{ id: string }> }` — it cannot be optional/undefined in dynamic route files.

**Additional warning:**
```
Invalid next.config.ts options detected: Unrecognized key(s): 'turbopack'
```
`turbopack: {}` at the top level is not a valid Next.js 15 config key. Turbopack is enabled via `--turbopack` CLI flag in Next.js 15 (it becomes a top-level config key only in Next.js 16).

---

## 4. Dependency Audit

### Vulnerabilities Found

| Package | Severity | CVE(s) | Fix Available |
|---|---|---|---|
| `next@15.2.3` | **CRITICAL** | CVE-2025-66478, CVE-2025-55182 (RCE), CVE-2025-55184 (DoS), CVE-2025-55183 (Source Exposure), CVE-2025-29927 (Auth Bypass), and 6 more | Yes — upgrade to `next@15.2.6` minimum |
| `xlsx@0.18.5` | **HIGH** | GHSA-4r6h-8v6p-xvw6 (Prototype Pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS) | No fix available — consider replacing with `exceljs` |

### Critical: CVE-2025-29927 — Middleware Authorization Bypass (CVSS 9.1)

The project relies on `middleware.ts` (next-auth middleware) as the authorization gate for all 8 dashboard routes. An attacker can bypass this entirely by sending:
```
x-middleware-subrequest: <crafted value>
```
This is patched in `next@15.2.3` at the middleware level, but **the underlying architectural risk remains**: middleware is the sole auth gate. API routes should re-validate sessions independently (many already do via `withAuth`/`getServerSession` — this is good but needs to be consistently applied everywhere).

### Critical: CVE-2025-55182 — Remote Code Execution (CVSS 10.0)

Next.js 15.2.3 is affected by an RCE vulnerability in the React Server Components flight protocol. Minimum safe version for 15.2.x is `next@15.2.6`.

---

## 5. Code Smell Detection

### console.log Statements

**0 instances** found in production code. Logging is properly handled via `pino` through `lib/logger.ts`.

### TODO/FIXME/HACK Comments

**0 genuine TODOs** found. Occurrences of `TODO` in the codebase are all string values in task status enums (e.g., `"TODO"` as a `TaskStatus` enum value) — not development comments.

### Hardcoded Values That Should Be Env Vars

**0 hardcoded secrets or API keys** found. All external references use `process.env.*`. The logger uses `process.env.LOG_LEVEL ?? "info"` appropriately.

### Unused Imports / Variables

**0 instances** of `: any` or unused-import patterns detected in production code. TypeScript strict mode appears to be enforced at the compiler level.

### Minor: `next.config.ts` invalid key

`turbopack: {}` is not valid for Next.js 15. Should be removed or replaced with the `--turbopack` CLI flag.

---

## 6. API Contract Verification

### Summary (39 route handlers across 30 route files)

| Check | Compliant | Non-Compliant |
|---|---|---|
| Has auth check | 39/39 (100%) | 0 |
| Has error handling (apiHandler/withAuth) | 39/39 (100%) | 0 |
| Returns consistent response format | 39/39 (100%) | 0 |
| Has input validation (Zod) | ~21/39 (54%) | ~18/39 (46%) |

### Routes Missing Zod Input Validation

The following routes accept query params or request bodies without Zod validation:

- `GET /api/tasks/gantt` — query params (year, assignee) parsed without schema
- `GET /api/tasks/[id]/changes` — no input validation
- `POST /api/tasks/[id]/changes` — body parsed without Zod schema
- `POST /api/tasks/import` — body not validated with Zod (delegates to import-service)
- `GET/POST/DELETE /api/permissions` — no Zod schema on query/body
- `POST /api/subtasks` — body not validated with Zod
- `PATCH/DELETE /api/subtasks/[id]` — no Zod schema
- `GET/PATCH/DELETE /api/deliverables/[id]` — no Zod schema
- `GET /api/kpi/[id]/achievement` — no Zod schema
- `POST /api/kpi/[id]/link` — no Zod schema
- `GET /api/documents/search` — query not validated
- `GET /api/documents/[id]/versions` — no validation
- `GET /api/time-entries/stats` — query not validated
- `GET/PATCH /api/notifications/*` — no Zod schema
- `GET /api/reports/*` (5 endpoints) — query params not validated with Zod

### Note: Inconsistent Auth Pattern

Two auth patterns are used across the codebase:
1. **`withAuth()` / `withManager()` HOF wrappers** (newer, preferred) — used in tasks, plans, users, kpi, reports
2. **`getServerSession()` inline** (older pattern) — used in goals, permissions, subtasks, deliverables, milestones, notifications, changes, gantt

Both patterns provide auth protection but the inconsistency creates maintenance risk. The `getServerSession()` calls in many routes also lack the `authOptions` argument, which may fall back to incorrect session resolution depending on next-auth configuration.

---

## 7. Security Checklist

| Check | Status | Notes |
|---|---|---|
| Passwords hashed with bcrypt | PASS | `bcryptjs` used in `user-service.ts` and `auth/[...nextauth]/route.ts` |
| No secrets in code | PASS | All secrets via `process.env.*`; logger redacts sensitive fields |
| Sensitive fields redacted in logs | PASS | `lib/logger.ts` redacts: password, authorization, cookie, secret, token, apiKey, api_key |
| CSRF protection | PASS | Handled by next-auth |
| Rate limiting | FAIL | **No rate limiting found** on any API route or auth endpoint |
| Input sanitization | PARTIAL | Zod validation on ~54% of routes; remaining routes rely on Prisma type safety only |
| Auth on all routes | PASS | All 39 handlers have auth checks |
| Middleware CVE (CVE-2025-29927) | FAIL | `next@15.2.3` is affected; must upgrade to `>=15.2.6` |
| RCE vulnerability (CVE-2025-55182) | FAIL | `next@15.2.3` is affected; must upgrade to `>=15.2.6` |
| xlsx prototype pollution | FAIL | `xlsx@0.18.5` has no fix; evaluate replacing with `exceljs` |

### Missing: Rate Limiting

No rate limiting middleware exists anywhere in the codebase. The login endpoint (`POST /api/auth/[...nextauth]`) is vulnerable to brute-force attacks. Recommendation: add rate limiting via `@upstash/ratelimit` or a custom middleware using a Redis counter, at minimum on the auth endpoint.

---

## 8. Accessibility & UX

### ARIA / Semantic HTML

**All 9 app pages** (`dashboard`, `kanban`, `gantt`, `knowledge`, `kpi`, `plans`, `reports`, `timesheet`, `login`) are missing `aria-label`, `role`, and other ARIA attributes.

Only 2 components (`notification-bell.tsx`, `topbar.tsx`) have any ARIA attributes.

### Form Labels

- `login/page.tsx`: has `<label htmlFor="password">` and email label — **PASS**
- `task-detail-modal.tsx`: has some `htmlFor` labels — **PARTIAL**
- `kpi/page.tsx`: has some labels — **PARTIAL**
- `time-entry-cell.tsx`: has labels — **PASS**
- All other pages/components: **no form labels found**

### Keyboard Navigation

No `onKeyDown`/`onKeyPress` handlers or `tabIndex` attributes detected in interactive components outside of Radix UI primitives. Radix UI components (`@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`) provide built-in keyboard navigation, which partially mitigates this.

### Color Contrast (Dark Theme)

The project uses a CSS variable-based dark theme via Tailwind. No automated contrast checking was performed. The use of `text-foreground`/`bg-background` tokens suggests design-system consistency, but manual verification of all color pairs is recommended.

---

## Bug List

### Critical

| ID | File | Description |
|---|---|---|
| BUG-01 | `next@15.2.3` | RCE vulnerability CVE-2025-55182 (CVSS 10.0) — upgrade to `next@15.2.6+` immediately |
| BUG-02 | `next@15.2.3` | Auth middleware bypass CVE-2025-29927 (CVSS 9.1) — upgrade to `next@15.2.6+` immediately |
| BUG-03 | `app/api/deliverables/[id]/route.ts` | Build failure: invalid route context type; production build cannot complete |

### Major

| ID | File | Description |
|---|---|---|
| BUG-04 | `jest.config.ts` | 31/60 test suites fail to run due to missing JSX/jsdom configuration; all component, page, and API test suites are completely non-functional |
| BUG-05 | `app/api/deliverables/route.ts:25,41` | Zod v4 API mismatch: `error.errors` does not exist; should be `error.issues`; TypeScript error blocks build |
| BUG-06 | `app/api/reports/export/route.ts:218` | `Buffer` not assignable to `BodyInit`; Excel export endpoint broken in App Router; must convert to `Uint8Array` |
| BUG-07 | (all routes) | No rate limiting on auth or any API endpoint; brute-force login attacks are unmitigated |
| BUG-08 | `xlsx@0.18.5` | High-severity prototype pollution vulnerability with no upstream fix; import/export features are a supply-chain risk |

### Minor

| ID | File | Description |
|---|---|---|
| BUG-09 | `next.config.ts` | `turbopack: {}` is an unrecognized key in Next.js 15; causes build warning |
| BUG-10 | ~18 API routes | Missing Zod input validation; relies solely on Prisma type coercion for unvalidated inputs |
| BUG-11 | Multiple API routes | `getServerSession()` called without `authOptions` argument; may resolve to `null` session in edge cases |
| BUG-12 | All 9 app pages | No ARIA attributes; screen reader and keyboard navigation accessibility is poor |
| BUG-13 | `goal-service.ts`, `kpi-service.ts` | Branch coverage below 36%; critical business logic (KPI scoring, goal transitions) inadequately tested |

---

## Security Findings Summary

| Severity | Finding | Recommendation |
|---|---|---|
| CRITICAL | Next.js 15.2.3 — RCE (CVE-2025-55182, CVSS 10.0) | Upgrade to `next@15.2.6` immediately |
| CRITICAL | Next.js 15.2.3 — Auth Bypass (CVE-2025-29927, CVSS 9.1) | Upgrade to `next@15.2.6` immediately |
| HIGH | Next.js 15.2.3 — DoS (CVE-2025-55184) + Source Exposure (CVE-2025-55183) | Upgrade to `next@15.2.6` immediately |
| HIGH | `xlsx@0.18.5` — Prototype Pollution + ReDoS | Replace with `exceljs`; no upstream fix available |
| HIGH | No rate limiting on auth endpoint | Add rate limiting (e.g., `@upstash/ratelimit`) |
| MEDIUM | `getServerSession()` without `authOptions` in ~12 routes | Pass `authOptions` explicitly or use `withAuth` wrapper consistently |
| LOW | Inconsistent auth pattern (HOF vs inline) | Standardize on `withAuth`/`withManager` across all routes |

---

## Recommendations

### Immediate (P0 — Production Blockers)

1. **Upgrade Next.js**: `npm install next@15.2.6` — fixes RCE, auth bypass, DoS, and source exposure CVEs
2. **Fix build failure**: Update `app/api/deliverables/[id]/route.ts` to use non-optional route context type
3. **Fix Zod v4 API**: Replace `.errors` with `.issues` in `app/api/deliverables/route.ts`
4. **Fix Buffer export**: Convert `Buffer` to `Uint8Array` in `app/api/reports/export/route.ts`

### Short-term (P1 — Quality & Security)

5. **Fix Jest JSX configuration**: Add `testEnvironment: "jsdom"` and configure ts-jest JSX transform for `.tsx` test files; this will unlock all 31 currently non-runnable test suites
6. **Add rate limiting**: Implement at minimum on `POST /api/auth/[...nextauth]` using Redis or an in-memory counter
7. **Replace xlsx**: Migrate to `exceljs` to eliminate the high-severity prototype pollution vulnerability
8. **Fix `next.config.ts`**: Remove the invalid `turbopack: {}` key

### Medium-term (P2 — Maintainability)

9. **Standardize auth pattern**: Migrate all `getServerSession()` inline calls to `withAuth()`/`withManager()` HOF wrappers, and always pass `authOptions`
10. **Add Zod validation to remaining 18 routes**: Especially for mutation endpoints (POST/PATCH/PUT/DELETE)
11. **Increase branch coverage**: Focus on `kpi-service.ts` (29% branch), `goal-service.ts` (36%), and `time-entry-service.ts` (37%)

### Long-term (P3 — Accessibility & UX)

12. **Add ARIA attributes** to all pages: at minimum `main`, `nav`, `header` landmarks and `aria-label` on icon buttons
13. **Audit color contrast**: Run automated contrast checks against the dark theme token palette
14. **Keyboard navigation testing**: Verify all interactive elements are reachable and operable via keyboard without mouse
