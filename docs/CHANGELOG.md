# TITAN Changelog

所有重大變更按開發階段分組記錄。

---

## [1.0.0-rc.1] — 2026-03-26

### DT Phase 3 — 使用者管理 + RWD + 子任務工時

- feat(timesheet): support subtask selection in time entries (#938)
- fix(schema): add onDelete SetNull for TimeEntry.subTaskId (#937)
- fix(responsive): improve mobile layout across all pages (#936)
- feat(admin): add user management tab with CRUD and suspend/unsuspend (#932)
- feat(knowledge): add image upload to Markdown editor (#931)
- feat(nav): add 系統管理 link to sidebar for MANAGER/ADMIN

### DT Phase 2 — 週期任務 + 變更管理 + 自訂報表

- feat(reports): custom query API with date range, multi-filters, Excel/CSV export (#926)
- feat(recurring): add Recurring Tasks auto-scheduling system (#922)
- feat(change-mgmt): add structured Change Management workflow (#921)

### DT Phase 1 — 搜尋 + SLA + 監控 + Email

- feat(email): add email notification channel with scheduled triggers (#927)
- feat(monitoring): add external monitoring integration and KPI history (#925)
- feat(sla): SLA countdown timer with expiry notifications (#924)
- feat(search): cross-table full-text search with tags and Command+K (#923)

### Sprint 8 — 報表 + 知識庫 + 完善

- feat(knowledge): enhance document search with highlight and history (KB-2) (#919)
- feat(settings): add profile edit with secure avatar upload (#918)
- feat(knowledge): add Outline API integration with graceful fallback (KB-1) (#917)
- feat(gantt): add drag-to-adjust schedule with bidirectional sync (#915, #916)
- feat(reports): add CSV export with UTF-8 BOM and streaming (R-3) (#914)
- feat(gantt): add milestone type markers with color-coded diamonds (#912)
- feat(reports): add task completion rate report with line chart (R-1) (#911)
- feat(kb): add task-document link for knowledge base integration (#910)
- feat(settings): add grouped notification preferences with filtering (#920)
- feat(reports): add time distribution stacked bar chart (R-2) (#913)

### Sprint 7 — KPI + 甘特圖 + 報表

- feat(gantt): G-5 時間軸縮放 — 週/月/季 (#908)
- feat(gantt): G-1 甘特圖自動呈現 — frappe-gantt + 缺日期提示 (#907)
- feat(plan): link tasks directly to annual plans (A-4) (#906)
- feat(kpi): KP-3 KPI 儀表板 — ECharts 圖表 (#905)
- feat(auth): 密碼到期強制更換 + 7 天前預警 (AU-5) (#904)
- feat(kpi): KP-2 KPI 填報介面 (#903)
- feat(kpi): KPI 定義完整功能 — 衡量方式、頻率、值域、可視權限、狀態管理 (#902)
- feat(timesheet): enhance quick-fill templates with preview & rename (T-3) (#901)
- feat(timesheet): add weekly/monthly pivot table summary (T-5) (#900)
- feat(reports): R-5 自訂日期範圍元件 (#899)

### Sprint 6 — 看板完善 + 工時 + 年度計畫

- feat(dashboard): add manager view toggle with team overview (#898)
- feat(timesheet): T-6 工時鎖定 (#897)
- feat(plans): A-3 進度自動計算 (#896)
- feat(goals): A-2 月度目標分解 (#895)
- feat(timesheet): T-2 加班標記 (#894)
- feat(timesheet): T-1 每日工時填報 (#893)
- feat(plans): add archive mechanism and multi-plan-per-year support (#892)
- feat(kanban): add quick filter with tags, due date range, and URL sync (#891)
- feat(kanban): add subtask checklist enhancements and task attachments (#890)

### Sprint 5 — 看板核心

- feat(kanban): task change history (K-6) (#888)
- feat(kanban): task detail with description + comments (K-3a) (#887)
- feat(dashboard): overdue task warnings (D-3) (#884)
- feat(dashboard): team task status summary (D-2) (#882)

### Sprint 1-2 — 工時強化 + 基線

- feat(timesheet): Phase 2 — Manager Monthly View + approval workflow (#854)
- feat(timesheet): monthly settle, anomaly report, compliance export, Kimai import
- feat(timesheet): overtime UI, template UI, category colors, daily subtotal, keyboard nav
- [Sprint2-T18] k6 performance baseline load test scripts (#766)
- fix(sprint2): CSP production headers (#760)

### Auth + Security 修正

- fix(auth): password change flow — JWT session refresh, signOut redirect
- fix(timesheet): auto-approve manager time entries + exclude from monthly review
- chore(deps): bump actions/checkout from 4 to 6 (#849)
