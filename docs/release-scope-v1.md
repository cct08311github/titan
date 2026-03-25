# Release Scope Definition — v1.0 GA

## Version
v1.0.0 (General Availability)

## Target Date
TBD (pending all P0/P1 issues resolved)

## v1.0 GA Feature List (Must Have)

### Core Features
- [x] User authentication (Auth.js v5 + Credentials)
- [x] Role-based access control (MANAGER / ENGINEER)
- [x] Task management (CRUD, status workflow, priority, category)
- [x] Kanban board (drag & drop, column view)
- [x] Annual plans & monthly goals management
- [x] KPI tracking (manual + auto-calculated from tasks)
- [x] Time entry management
- [x] Document management (tree structure, versioning)
- [x] Deliverable tracking
- [x] Subtask management with parent progress calculation
- [x] Dashboard (role-based views)

### Security Features
- [x] Password policy (complexity, expiry)
- [x] Account lockout (10 failures / 15 min)
- [x] Login rate limiting
- [x] CSRF protection
- [x] Session management (JWT, 8hr timeout)
- [x] Audit logging
- [x] RBAC enforcement on all routes

### Reporting
- [x] Weekly report
- [x] Workload analysis
- [x] Export (XLSX, CSV)
- [x] KPI achievement reports

### Infrastructure
- [x] CI/CD pipeline (GitHub Actions)
- [x] Database migrations (Prisma)
- [x] Structured logging (pino)
- [x] Error handling middleware

## Deferred to v1.1+

### v1.1
- [ ] LDAP/AD integration
- [ ] Push notifications (bank messaging)
- [ ] Dark mode
- [ ] PWA offline support
- [ ] WebSocket real-time notifications

### v1.2
- [ ] Approval workflow (ApprovalRequest model ready)
- [ ] Task templates (TaskTemplate model ready)
- [ ] Advanced search (full-text)
- [ ] Batch operations

### Future
- [ ] i18n (multi-language support)
- [ ] Redis session store
- [ ] Playwright component testing
- [ ] Performance monitoring (Sentry)

## Quality Standards for GA
1. All Jest tests passing (93+ suites)
2. No P0 or P1 open issues
3. TypeScript compilation clean
4. ESLint zero warnings on committed code
5. OWASP ZAP scan: no High/Critical findings
6. UAT sign-off from 5+ users
7. Backup/restore procedure verified
8. Documentation complete (API, onboarding, runbook)

## Decision Record
- Approved by: (pending)
- Date: (pending)
