# TITAN Test Coverage Report

Generated: 2026-03-25
Tool: `npx jest --coverage --forceExit`

## Summary

| Metric     | Coverage |
|------------|----------|
| Statements | 84.28%   |
| Branches   | 75.11%   |
| Functions  | 88.17%   |
| Lines      | 86.79%   |

## Test Results

- **Test Suites**: 80 passed, 28 failed, 108 total
- **Tests**: 1189 passed, 231 failed, 1420 total

### Failure Root Cause

All 28 failing suites share one root cause: missing `rate-limiter-flexible` module dependency at test time. The module is imported by `lib/rate-limiter.ts` but not resolved in the Jest environment. Installing the package or adding a Jest module mock would resolve all failures.

## Per-File Breakdown (services)

| File                        | % Stmts | % Branch | % Funcs | % Lines |
|-----------------------------|---------|----------|---------|---------|
| **All files**               | 84.28   | 75.11    | 88.17   | 86.79   |
| audit-service.ts            | 92.85   | 80.95    | 100     | 100     |
| change-tracking-service.ts  | 98.27   | 87.67    | 100     | 100     |
| deliverable-service.ts      | 100     | 97.91    | 100     | 100     |
| document-service.ts         | 94.11   | 92.85    | 100     | 96.42   |
| errors.ts                   | 100     | 0        | 100     | 100     |
| export-service.ts           | 100     | 92.85    | 100     | 100     |
| goal-service.ts             | 100     | 100      | 100     | 100     |
| import-service.ts           | 43.04   | 33.73    | 44.11   | 44.92   |
| kpi-service.ts              | 100     | 100      | 100     | 100     |
| milestone-service.ts        | 82.92   | 80       | 100     | 93.33   |
| notification-service.ts     | 67.70   | 54.05    | 77.77   | 69.66   |
| permission-service.ts       | 80.76   | 70       | 100     | 95      |
| plan-service.ts             | 87.80   | 76       | 100     | 100     |
| report-service.ts           | 99.06   | 100      | 96.66   | 100     |
| session-service.ts          | 93.61   | 76.92    | 100     | 97.56   |
| task-service.ts             | 100     | 90.32    | 100     | 100     |
| time-entry-service.ts       | 88      | 74.46    | 100     | 97.61   |
| user-service.ts             | 88.46   | 74.35    | 100     | 95.58   |

## Phase 2 Stubs

The following components are stubs and **not production-ready**:

| File | Status | Tracking Issue |
|------|--------|---------------|
| `lib/push-notification.ts` | PHASE 2 STUB — Not connected to any real push service | #379 |
| `app/api/approvals/route.ts` | PHASE 2 STUB — Basic CRUD only, no workflow engine | #382 |
| `public/manifest.json` | PHASE 2 — PWA offline/install capabilities not implemented; manifest exists for metadata only | — |

## Key Observations

1. **Branch coverage is 75.11%**, below the claimed 90% target. The gap is primarily in `import-service.ts` (33.73%), `notification-service.ts` (54.05%), and `permission-service.ts` (70%).
2. **import-service.ts** has the lowest coverage across all metrics (43% stmts, 34% branch) — many error/edge-case paths are untested.
3. **notification-service.ts** at 67.7% statement coverage needs additional tests for fallback/error paths.
4. Fixing the `rate-limiter-flexible` mock would unlock 28 additional test suites and likely improve overall numbers.
