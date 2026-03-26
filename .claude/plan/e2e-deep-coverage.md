# E2E Deep Coverage Plan — TITAN

## Current State

| Metric | Value |
|--------|-------|
| Existing specs | 42 files, ~6,897 lines |
| Pages covered | 10/11 (missing: `/admin` dedicated spec) |
| CRUD tests | Task, KPI, Plan (3/6 resources) |
| Auth tests | 6 specs (login, logout, negative, rate-limit, password) |
| Accessibility | 14 pages via axe-core |
| Visual regression | Screenshot baselines for 7 pages |
| CI integration | GitHub Actions, chromium + mobile |

## Gap Analysis

### A. Missing CRUD Lifecycle Tests

| Resource | Create | Read | Update | Delete | Status |
|----------|--------|------|--------|--------|--------|
| Task | ✓ | ✓ | ✓ | ✓ | Covered |
| KPI | ✓ | ✓ | ✓ | ✓ | Covered |
| Plan | ✓ | ✓ | ✓ | ✓ | Covered |
| Document | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Time Entry | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Subtask | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Deliverable | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Monthly Goal | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Notification Pref | ✗ | ✗ | ✗ | — | **GAP** |

### B. Missing Interaction Tests

| Feature | Current Coverage | Gap |
|---------|-----------------|-----|
| Kanban drag & drop | Not tested | Column-to-column drag |
| Gantt drag reschedule | Not tested | Drag start/end date |
| Timesheet cell editing | Partial (features spec) | Full CRUD in grid cells |
| Timer widget | Not tested | Start/stop/task select |
| Command Palette search | Not tested (only open/close) | Type query → navigate |
| Bulk operations | 81-line spec | Needs multi-select + batch action |
| Task detail modal fields | Not tested end-to-end | Edit all fields → save → verify |
| Document version history | Not tested | Create → edit → view versions |
| Notification mark read | Not tested | Bell → mark read → verify count |
| Dark mode persistence | Not tested | Toggle → reload → verify |
| Sidebar collapse persistence | Not tested | Collapse → navigate → verify |

### C. Missing Cross-Cutting Tests

| Area | Gap |
|------|-----|
| API error handling | No tests for 4xx/5xx error UI |
| Concurrent session | Issue #387 — no E2E test |
| Password expiry flow | Force change modal not tested |
| Offline/network error | No service worker test |
| Data import (Excel) | Import template → verify data |
| Report export download | Click export → verify file |
| Approval workflow | `/api/approvals` — no E2E |

### D. Architecture Improvements

| Issue | Current | Proposed |
|-------|---------|----------|
| No Page Object Model | Selectors hardcoded per spec | Extract POM per page |
| No custom fixtures | Raw `test()` everywhere | `test.extend()` with helpers |
| No API test helpers | Inline fetch calls | Centralized API client |
| No test data factory | Manual SQL in seed.ts | Factory functions |

---

## Implementation Plan

### Step 1: Test Infrastructure (Foundation)

**Deliverable**: `e2e/fixtures/`, `e2e/pages/`, `e2e/api/`

#### 1.1 Custom Fixtures (`e2e/fixtures/titan.ts`)
```typescript
// Extend base test with common helpers
export const test = base.extend<{
  managerPage: Page;
  engineerPage: Page;
  api: TitanAPI;
  seed: TestSeed;
}>({ ... });
```

#### 1.2 Page Object Models (`e2e/pages/`)
Create POM for each page:

| File | Encapsulates |
|------|-------------|
| `e2e/pages/login.page.ts` | Login form fill, submit, error check |
| `e2e/pages/kanban.page.ts` | Add task, filter, drag card, open detail |
| `e2e/pages/gantt.page.ts` | Year nav, filter, drag task bar |
| `e2e/pages/timesheet.page.ts` | Cell edit, view toggle, timer, week nav |
| `e2e/pages/reports.page.ts` | Tab switch, export, print |
| `e2e/pages/plans.page.ts` | Create plan/goal, expand tree |
| `e2e/pages/kpi.page.ts` | Create KPI, link task, year filter |
| `e2e/pages/knowledge.page.ts` | Create doc, search, edit, version history |
| `e2e/pages/settings.page.ts` | Tab switch, profile edit, notification toggle |
| `e2e/pages/dashboard.page.ts` | Stat cards, empty state, role-based view |
| `e2e/pages/activity.page.ts` | Pagination, filter |
| `e2e/pages/task-detail.modal.ts` | All fields, subtasks, deliverables, save |

#### 1.3 API Test Client (`e2e/api/titan-api.ts`)
```typescript
export class TitanAPI {
  constructor(private request: APIRequestContext) {}
  async createTask(title: string, opts?: Partial<Task>) { ... }
  async createKPI(code: string, title: string) { ... }
  async createTimeEntry(taskId: string, hours: number, date: string) { ... }
  async createDocument(title: string, content: string) { ... }
  async deleteTask(id: string) { ... }
  // ... all CRUD operations
}
```

#### 1.4 Test Data Factory (`e2e/helpers/factory.ts`)
```typescript
export const Factory = {
  task: (overrides?: Partial<Task>) => ({
    title: `Test Task ${Date.now()}`,
    priority: 'P2', category: 'PLANNED', ...overrides
  }),
  kpi: (overrides?) => ({ ... }),
  timeEntry: (overrides?) => ({ ... }),
};
```

**Estimated effort**: 400-500 lines
**Files**: 15 new files

---

### Step 2: CRUD Lifecycle Tests (5 new specs)

#### 2.1 Document CRUD (`e2e/document-crud.spec.ts`)
```
1. Create document → verify in tree
2. Edit title & content → save → verify
3. View version history → verify entries
4. Search document → verify result
5. Delete document → verify removed
```

#### 2.2 Time Entry CRUD (`e2e/time-entry-crud.spec.ts`)
```
1. Navigate to timesheet → click cell → enter hours → verify
2. Edit existing entry → change hours/category → verify
3. Delete entry → verify cell empty
4. Week navigation → verify data per week
5. View toggle (grid ↔ list) → verify same data
6. Stats summary → verify totals match entries
```

#### 2.3 Subtask & Deliverable CRUD (`e2e/subtask-deliverable-crud.spec.ts`)
```
1. Open task detail → add subtask → verify in list
2. Toggle subtask done → verify checkbox
3. Delete subtask → verify removed
4. Add deliverable → set status (NOT_STARTED → DELIVERED) → verify
5. Delete deliverable → verify removed
```

#### 2.4 Monthly Goal CRUD (`e2e/goal-crud.spec.ts`)
```
1. Go to plans → create monthly goal → verify in tree
2. Edit goal title → save → verify
3. Link task to goal → verify linkage
4. Delete goal → verify removed
```

#### 2.5 Notification Preferences (`e2e/notification-prefs.spec.ts`)
```
1. Go to settings → notification tab
2. Toggle off TASK_ASSIGNED → save → reload → verify off
3. Toggle on TASK_ASSIGNED → save → verify on
4. Toggle all off → save → verify all off
5. Toggle all on → verify all on
```

**Estimated effort**: 800-1000 lines
**Files**: 5 new specs

---

### Step 3: Interaction Tests (6 new specs)

#### 3.1 Timer Widget (`e2e/timer-widget.spec.ts`)
```
1. Select task from dropdown → start timer → verify running
2. Wait 2s → verify time display updates
3. Stop timer → verify time entry created
4. Start without task → verify "free time" entry
```

#### 3.2 Task Detail Modal Full Edit (`e2e/task-detail-edit.spec.ts`)
```
1. Create task via API → open in kanban
2. Edit title, description, priority, status, category → save
3. Change A角/B角 assignee → save → verify
4. Set due date, estimated hours → save → verify
5. Link to monthly goal → verify linkage
6. Close and reopen → verify all fields persisted
```

#### 3.3 Command Palette Search (`e2e/command-palette.spec.ts`)
```
1. Create task + document via API (seed data)
2. Ctrl+K → type task title → verify in results → Enter → verify navigation
3. Ctrl+K → type document title → verify in results
4. G+K shortcut → verify navigate to kanban
5. G+D shortcut → verify navigate to dashboard
6. ESC → verify palette closes
```

#### 3.4 Notification Flow (`e2e/notification-flow.spec.ts`)
```
1. Trigger notification via API (assign task to current user)
2. Click bell icon → verify notification appears
3. Click "mark read" → verify count decreases
4. Click "mark all read" → verify empty
5. Verify notification preferences respected (toggle off → no notification)
```

#### 3.5 Dark Mode & Sidebar Persistence (`e2e/ui-persistence.spec.ts`)
```
1. Toggle dark mode → verify className="dark" on <html>
2. Navigate to another page → verify dark mode persists
3. Collapse sidebar → navigate → verify stays collapsed
4. Expand sidebar → verify section headers visible (概覽/管理/紀錄/帳號)
```

#### 3.6 Report Export & Print (`e2e/report-export.spec.ts`)
```
1. Seed task + time entry data via API
2. Go to reports → weekly → click export → verify download event
3. Switch to monthly → click export → verify
4. Switch to KPI → click export → verify
5. Click "列印 PDF" → verify print dialog triggered
```

**Estimated effort**: 600-800 lines
**Files**: 6 new specs

---

### Step 4: Cross-Cutting Tests (4 new specs)

#### 4.1 Password Expiry & Force Change (`e2e/password-expiry.spec.ts`)
```
1. Set user passwordChangedAt to 91 days ago via SQL
2. Login → verify PasswordChangeGuard modal appears
3. Enter weak password → verify validation error
4. Enter valid password → submit → verify modal closes
5. Verify can access dashboard after change
```

#### 4.2 Concurrent Session Limit (`e2e/concurrent-session.spec.ts`)
```
1. Login as admin in browser context A
2. Login as admin in browser context B (new context)
3. Verify context A session is invalidated (redirect to login or 401)
```

#### 4.3 API Error Handling UI (`e2e/error-handling.spec.ts`)
```
1. Navigate to /nonexistent → verify 404 page renders
2. Mock API 500 response → verify error boundary shows
3. Verify error report sent to /api/error-report
4. Verify no white screen on any error state
```

#### 4.4 Data Import/Export (`e2e/import-export-flow.spec.ts`)
```
1. Download import template → verify file format
2. Upload valid Excel → verify tasks created in kanban
3. Upload invalid file → verify error message
4. Export report → verify CSV/JSON format
```

**Estimated effort**: 400-500 lines
**Files**: 4 new specs

---

### Step 5: Existing Spec Refactor (Optional)

Migrate top 5 largest specs to use POM:

| Spec | Lines | Benefit |
|------|-------|---------|
| `pages-deep.spec.ts` | 924 | ~40% reduction via POM |
| `smoke-tests.spec.ts` | 403 | DRY with shared assertions |
| `auth-comprehensive.spec.ts` | 280 | Reuse login.page.ts |
| `task-crud.spec.ts` | 265 | Reuse kanban.page.ts + api client |
| `admin-deep.spec.ts` | 236 | Extract admin.page.ts |

**Estimated effort**: Net reduction ~500 lines
**Risk**: Low (purely structural, no behavior change)

---

## Coverage Target

### Before (current)

| Category | Specs | Coverage |
|----------|-------|----------|
| Page navigation | 42 | 10/11 pages |
| CRUD lifecycle | 3 | Task, KPI, Plan |
| Interaction depth | Partial | Basic clicks only |
| Cross-cutting | 6 | Auth + a11y + visual |

### After (planned)

| Category | Specs | Coverage |
|----------|-------|----------|
| Page navigation | 42 (unchanged) | 11/11 pages |
| CRUD lifecycle | **8** (+5) | Task, KPI, Plan, Document, TimeEntry, Subtask, Goal, NotifPref |
| Interaction depth | **+6 specs** | Timer, modal edit, command palette, notifications, UI persist, export |
| Cross-cutting | **+4 specs** | Password expiry, concurrent session, error handling, import/export |
| Infrastructure | **+15 files** | POM, fixtures, API client, factory |

### Final Numbers

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Spec files | 42 | **57** | +15 |
| Test lines | ~6,897 | ~9,500 | +2,600 |
| POM files | 0 | **12** | +12 |
| Helper files | 2 | **5** | +3 |
| CRUD resources | 3/9 | **8/9** | +5 |
| Interactive features | ~40% | **~90%** | +50% |

---

## Execution Order & Dependencies

```
Step 1 (Foundation) ──→ Step 2 (CRUD) ──→ Step 3 (Interaction)
                    ╲                  ╲
                     ╲──→ Step 4 (Cross-cutting)
                                       ╲
                                        ──→ Step 5 (Refactor, optional)
```

**Step 1 is a prerequisite** for Steps 2-4 (POM + fixtures + API client).
Steps 2, 3, 4 can be parallelized after Step 1.
Step 5 is independent and optional.

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Rate limiter blocks parallel tests | Tests fail with 429 | Use pre-auth storage state, CI workers=1 |
| Flaky drag-and-drop tests | False negatives | Skip Gantt/Kanban drag tests in CI, run locally |
| Timer tests time-dependent | Flaky assertions | Use `page.clock` API for time mocking |
| Database state leaks between specs | Test pollution | `resetDatabase()` in `beforeAll`, serial execution for CRUD specs |
| Import/Export needs real files | Complex setup | Store fixtures in `e2e/fixtures/data/` |

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `e2e/fixtures/titan.ts` | Create | Custom test fixtures |
| `e2e/pages/*.page.ts` | Create (12) | Page Object Models |
| `e2e/api/titan-api.ts` | Create | Centralized API client |
| `e2e/helpers/factory.ts` | Create | Test data factory |
| `e2e/document-crud.spec.ts` | Create | Document lifecycle |
| `e2e/time-entry-crud.spec.ts` | Create | Time entry lifecycle |
| `e2e/subtask-deliverable-crud.spec.ts` | Create | Subtask & deliverable |
| `e2e/goal-crud.spec.ts` | Create | Monthly goal lifecycle |
| `e2e/notification-prefs.spec.ts` | Create | Notification settings |
| `e2e/timer-widget.spec.ts` | Create | Timer start/stop |
| `e2e/task-detail-edit.spec.ts` | Create | Modal full edit |
| `e2e/command-palette.spec.ts` | Create | Search & shortcuts |
| `e2e/notification-flow.spec.ts` | Create | Bell → mark read |
| `e2e/ui-persistence.spec.ts` | Create | Dark mode + sidebar |
| `e2e/report-export.spec.ts` | Create | Export & print |
| `e2e/password-expiry.spec.ts` | Create | Force change flow |
| `e2e/concurrent-session.spec.ts` | Create | Session limit |
| `e2e/error-handling.spec.ts` | Create | Error boundary |
| `e2e/import-export-flow.spec.ts` | Create | Excel import/export |
| `playwright.config.ts` | Modify:L1-L5 | Add globalSetup for factory |
