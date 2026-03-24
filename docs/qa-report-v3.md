# TITAN — QA Verification Report v3

**Date:** 2026-03-24
**Auditor:** QA Engineer (Claude Agent)
**Codebase commit:** `7970cad` (latest main, after all fixes merged)
**Next.js version:** 15.2.6
**Node/runtime:** Darwin 25.3.0
**Previous QA score:** 6.5 / 10 (v1, 2026-03-24)

---

## Overall Quality Score: **7.8 / 10** (↑ +1.3 from v1)

| Category | v1 Score | v3 Score | Delta | Summary |
|---|---|---|---|---|
| Test Suite | 5/10 | 8/10 | +3 | JSX fixed; 641/680 pass; 13 suites still failing |
| Type Safety | 7/10 | 7/10 | 0 | No regression observed |
| Build | 4/10 | 9/10 | +5 | Build succeeds; all 37 static pages compiled |
| Dependencies | 3/10 | 4/10 | +1 | 2 high CVEs remain (next@15.2.6, xlsx) |
| Code Quality | 9/10 | 9/10 | 0 | Clean code maintained |
| API Contracts | 8/10 | 8/10 | 0 | No regression |
| Security | 6/10 | 8/10 | +2 | Rate limiting + account lockout + auth depth added |
| Accessibility | 4/10 | 4/10 | 0 | Still missing ARIA attributes across pages |

---

## 1. Test Suite Analysis

### Summary

| Metric | v1 | v3 | Change |
|---|---|---|---|
| Total test suites | 60 | 68 | +8 new suites |
| Passing suites | 29 | 55 | +26 ✓ |
| Failing suites | 31 | 13 | -18 ✓ |
| Total tests | 297 | 680 | +383 new tests |
| Passing tests | 297 (100%) | 641 (94.3%) | +344 ✓ |
| Failing tests | 0 | 39 | 39 new failures |
| Pass rate | 100% of runnable | **94.3%** | |

**Key improvement:** The JSX transform misconfiguration from v1 has been fixed. 55 suites now pass vs 29 in v1. A total of 680 tests are now exercised, up from 297.

### Coverage (All Files)

| Metric | v1 | v3 | Change |
|---|---|---|---|
| Statements | 79.9% (services only) | **81.17%** (all files) | ↑ expanded scope |
| Branches | 59.27% | **61.54%** | ↑ +2.27% |
| Functions | 97.45% | **96.45%** | ↓ -1% (more functions tracked) |
| Lines | 89.44% | **89.16%** | stable |

Coverage now covers all files (not just services layer), providing a more realistic picture.

### Remaining Failures: 13 Suites / 39 Tests

#### Root causes

**1. Mock contract mismatch — Prisma model methods** (affects: `time-entries`, `tasks`, `subtasks`, `kpi`, `goals`, `plans`, `permissions`, `documents`, `deliverables`, `notifications`)

Tests use `prisma.timeEntry.findUnique` etc., but the mock does not expose these model-level methods:

```
TypeError: _prisma.prisma.timeEntry.findUnique is not a function
```

Affected files are testing routes that call Prisma directly instead of through service layer. The mock in `__mocks__/prisma.ts` needs to be extended to include all Prisma model stubs used by the route handlers.

**2. API response shape mismatch — Reports** (`__tests__/api/reports.test.ts`)

```
expect(received).toHaveProperty(path)
Expected path: "period"
Received path: []
```

The report route returns a `data` wrapper but the tests assert on root-level `period` field.

**3. Component rendering regression** (`__tests__/pages/kanban.test.tsx`, `__tests__/pages/timesheet.test.tsx`)

Kanban: `waitFor` timeout — component never renders `待辦清單` in test environment.
Timesheet: Rendering assertion fails after recent page refactor.

### Untested / Low-Coverage Areas

| Area | Status |
|---|---|
| `app/` pages and components | Coverage now measured (included in 81.17% all-files) |
| `validators/` | Included in all-files coverage |
| `middleware.ts` | Included |
| `lib/api-handler.ts` | Partially covered via integration tests |
| Goal/KPI branch logic | Branch coverage still low (~30-35% per service) |

---

## 2. Build

### Status: PASS ✓

```
✓ Compiled successfully
✓ Generating static pages (37/37)
```

**v1 status:** FAIL (TypeScript route context type mismatch)
**v3 status:** SUCCESS — all pages compiled, build artifact produced

No TypeScript errors blocking build. All 37 static pages generated.

---

## 3. Dependencies / Security Audit

### `npm audit` Result

```
2 high severity vulnerabilities
```

| Package | Severity | CVE(s) | Fix Available |
|---|---|---|---|
| `next@15.2.6` | HIGH | GHSA-g5qg-72qw-gw5v, GHSA-xv57-4mr9-wg8v, GHSA-4342-x723-ch2f, GHSA-w37m-7fhw-fmv9, GHSA-mwv6-3258-q52c, GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8 | `npm audit fix` |
| `xlsx` | HIGH | GHSA-4r6h-8v6p-xvw6 (Prototype Pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS) | No fix available |

**Context from Next.js security advisory:**
`next@15.2.6` is the current minimum safe version for the 15.2.x line per the official advisory table, but several cache/image/middleware CVEs still apply. Upgrade path: `npm install next@latest` to move to `15.5.x+` or `16.x`.

**xlsx:** No upstream fix available. Evaluate replacing with `exceljs` or `papaparse` depending on use case.

**v1 comparison:** Same 2 vulnerabilities remain. No new vulnerabilities introduced.

---

## 4. Security Improvements (v1 → v3)

The following security fixes were merged between v1 and v3:

| Fix | PR | Description |
|---|---|---|
| Rate limiting + account lockout | #143 | Redis-backed rate limiter; in-memory fallback; account lock after N failures |
| Auth defense in depth | #142 | Edge JWT check + route-level DB session re-validation |
| DB indexes + transactions | #141 | Query performance + atomic operations |
| Session management | #140 | Improved session lifecycle handling |
| RBAC | #139 | Role-based access control completion |
| Audit log | #138 | Security event logging |

Rate limiting tests confirm correct behavior:
- Rate limit exceeded: `retryAfter` returned in response
- Redis unavailable: falls back to in-memory limiter (graceful degradation)
- Account lockout: fires after 10 failures

**Remaining security concern:** `next@15.2.6` carries `GHSA-29927` (Middleware Authorization Bypass). Defense-in-depth at route level (added in #142) mitigates this, but upstream patch is still recommended.

---

## 5. Code Quality

No regressions. Maintained from v1:
- No `console.log` in production code
- No hardcoded secrets
- No `any` type usage

---

## 6. Accessibility

No change from v1. All 9 app pages remain without ARIA attributes. This is the lowest-scoring area with no improvement. Recommend creating a dedicated issue to add:
- `aria-label` on interactive elements
- `role` attributes on landmark regions
- Screen reader announcements for dynamic state changes (Kanban card moves, etc.)

---

## 7. Comparison Table: v1 vs v3

| Dimension | v1 (2026-03-24) | v3 (2026-03-24) |
|---|---|---|
| Overall score | **6.5 / 10** | **7.8 / 10** |
| Build | FAIL | PASS ✓ |
| Test suites passing | 29 / 60 | 55 / 68 |
| Tests passing | 297 / 297 (100%) | 641 / 680 (94.3%) |
| Statement coverage | 79.9% (services only) | 81.17% (all files) |
| High vulnerabilities | 2 | 2 |
| Rate limiting | No | Yes ✓ |
| Auth depth | Middleware only | Edge + DB ✓ |
| Account lockout | No | Yes ✓ |

---

## 8. Recommended Next Steps (Priority Order)

| Priority | Action | Issue Scope |
|---|---|---|
| P0 | Upgrade `next` to `15.3.x+` or `16.x` to patch CVEs | New issue |
| P1 | Fix Prisma mock contract — extend `__mocks__/prisma.ts` to include all model stubs | New issue |
| P1 | Fix report API response shape (add `period` to root or fix test assertion) | New issue |
| P1 | Fix Kanban/Timesheet component test regressions | New issue |
| P2 | Replace `xlsx` with maintained alternative | New issue |
| P3 | Add ARIA attributes across all 9 app pages | New issue |
| P3 | Improve branch coverage for goal/KPI/time-entry services (currently 30-35%) | New issue |

---

*Generated by QA Agent. Closes #144.*
