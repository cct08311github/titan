# TITAN 系統架構文件

**版本：** 1.0.0-rc.1
**更新日期：** 2026-03-26
**狀態：** Sprint 1-8 + DT Phase 1-3 完成

---

## 1. 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 前端框架 | Next.js (App Router) | 15.5.14 |
| UI Library | React | 19 |
| 語言 | TypeScript | 5 |
| CSS | Tailwind CSS | 3.4 |
| UI 元件 | shadcn/ui + Radix UI | - |
| 字體 | Geist | 1.7 |
| 圖表 | ECharts | 6.0 |
| 甘特圖 | frappe-gantt | 1.2.2 |
| ORM | Prisma | 5.22 |
| 資料庫 | PostgreSQL | 16 |
| 快取 | Redis (ioredis) | 7 |
| 認證 | next-auth (Auth.js v5) | 5.0.0-beta.30 |
| 驗證 | Zod | 3.24 |
| i18n | next-intl | 3.26 |
| 日誌 | Pino | 9.6 |
| 測試 | Jest + Playwright | 30 / 1.58 |
| 容器化 | Docker Compose | - |
| 反向代理 | Nginx | - |

---

## 2. 資料模型（36 Models, 25 Enums）

### Models

| 分類 | Model | 說明 |
|------|-------|------|
| 使用者 | User | 使用者帳號（含 role、lockout、passwordChangedAt） |
| | PasswordHistory | 密碼歷史（禁止重複最近 5 組） |
| | Permission | 額外權限設定 |
| | PasswordResetToken | 密碼重設 Token |
| | RefreshToken | JWT Refresh Token |
| 計畫 | AnnualPlan | 年度計畫（含封存機制） |
| | MonthlyGoal | 月度目標 |
| | Milestone | 里程碑（含類型標記） |
| 任務 | Task | 主任務（含 SLA、分類、優先級、指派） |
| | SubTask | 子任務 checklist |
| | TaskComment | 任務評論串 |
| | TaskActivity | 任務操作事件（audit trail） |
| | TaskChange | 任務欄位變更歷史 |
| | TaskDocument | 任務-文件關聯 |
| | TaskAttachment | 任務附件 |
| | TaskTemplate | 任務模板 |
| | RecurringRule | 週期任務規則 |
| 事件/變更 | IncidentRecord | 事件記錄 |
| | ChangeRecord | 變更管理記錄 |
| | ApprovalRequest | 審批請求 |
| 績效 | KPI | KPI 定義（含頻率、值域、可視權限） |
| | KPIAchievement | KPI 達成值記錄 |
| | KPITaskLink | KPI-任務關聯 |
| | KPIHistory | KPI 歷史趨勢 |
| 工時 | TimeEntry | 工時記錄（含分類、加班、鎖定） |
| | TimesheetApproval | 月度工時審核 |
| | TimeEntryTemplate | 工時填報模板 |
| | TimeEntryTemplateItem | 模板明細項 |
| 交付物 | Deliverable | 交付物記錄 |
| 知識 | Document | 文件（Markdown、樹狀目錄） |
| | DocumentVersion | 文件版本歷史 |
| 系統 | Notification | 站內通知 |
| | NotificationPreference | 通知偏好設定 |
| | NotificationLog | 通知發送記錄 |
| | MonitoringAlert | 外部監控告警 |
| | AuditLog | 稽核日誌 |

### Enums (25)

Role, KPIStatus, KPIFrequency, KPIVisibility, GoalStatus, MilestoneStatus, MilestoneType, TaskStatus, Priority, TaskCategory, IncidentSeverity, CMChangeType, RiskLevel, ChangeStatus, ChangeType, DeliverableType, DeliverableStatus, TimeCategory, OvertimeType, TimesheetApprovalStatus, NotificationType, RecurrenceFrequency, ApprovalStatus, ApprovalType, AlertStatus

---

## 3. API 路由架構

### 資源端點（115+ routes）

| 資源 | 基礎路徑 | 子路由數 |
|------|---------|---------|
| Auth | `/api/auth/` | 7（含 NextAuth、change-password、reset、refresh、logout、LDAP） |
| Tasks | `/api/tasks/` | 18（含 CRUD、gantt、bulk、import、reorder、SLA、tags、attachments、comments、changes、documents、incident、change-mgmt、dates） |
| SubTasks | `/api/subtasks/` | 2 |
| Users | `/api/users/` | 5（含 avatar、notification-preferences、workload） |
| Plans | `/api/plans/` | 4（含 copy-template） |
| Goals | `/api/goals/` | 2 |
| Milestones | `/api/milestones/` | 2 |
| KPI | `/api/kpi/` | 7（含 achievement、history、link、copy-year） |
| Time Entries | `/api/time-entries/` | 18（含 templates、batch、copy-week、monthly、approve、reject、review、unlock-request、settle-month、stats、running、start、stop、import-kimai） |
| Deliverables | `/api/deliverables/` | 2 |
| Documents | `/api/documents/` | 5（含 versions、search、tags） |
| Notifications | `/api/notifications/` | 6（含 read、read-all、generate、push、trigger） |
| Reports | `/api/reports/` | 12（含 completion-rate、time-distribution、kpi、weekly、monthly、workload、audit、custom、export、scheduled、trends、delay-change、department-timesheet、timesheet-compliance） |
| Recurring | `/api/recurring/` | 3（含 generate） |
| Task Templates | `/api/task-templates/` | 3（含 apply） |
| Approvals | `/api/approvals/` | 1 |
| Monitoring | `/api/monitoring-alerts/` | 2 |
| Search | `/api/search/` | 1 |
| Outline | `/api/outline/` | 3（含 documents、auth-redirect） |
| Admin | `/api/admin/` | 3（含 backup-status、generate-reset-token、unlock） |
| System | `/api/metrics/`、`/api/health/`、`/api/error-report/`、`/api/feedback/`、`/api/uploads/` | 5 |
| Permissions | `/api/permissions/` | 1 |
| Audit | `/api/audit/` | 1 |
| Activity | `/api/activity/` | 1 |

---

## 4. 元件架構

### 頁面（17 pages）

```
app/page.tsx                        # 首頁（重導 dashboard）
app/(auth)/login/page.tsx           # 登入
app/(auth)/change-password/page.tsx # 密碼變更
app/(auth)/reset-password/page.tsx  # 密碼重設
app/(app)/dashboard/page.tsx        # 儀表板
app/(app)/kanban/page.tsx           # 看板
app/(app)/gantt/page.tsx            # 甘特圖
app/(app)/plans/page.tsx            # 年度計畫
app/(app)/kpi/page.tsx              # KPI
app/(app)/timesheet/page.tsx        # 工時紀錄（週曆）
app/(app)/timesheet/monthly/page.tsx # 月度工時（主管視圖）
app/(app)/reports/page.tsx          # 報表
app/(app)/knowledge/page.tsx        # 知識庫
app/(app)/activity/page.tsx         # 團隊動態
app/(app)/settings/page.tsx         # 個人設定
app/(app)/admin/page.tsx            # 管理後台
app/(app)/admin/notifications/page.tsx # 通知管理
```

### 共用元件（70+）

主要分類：
- **Dashboard**: my-todo-list, task-status-summary, team-overview, overdue-alert
- **Kanban**: kanban-column, task-card, task-detail-modal, task-filters, task-change-history
- **Task Detail**: task-form-fields, task-subtask-section, task-attachment-section, task-deliverable-section, task-document-section, task-incident-section, task-change-management-section
- **Gantt**: gantt-chart, gantt-zoom-controls, missing-date-alert
- **Timesheet**: timesheet-grid, time-entry-cell, time-summary, timer-widget, timesheet-templates, timesheet-pivot-table, approval-panel, monthly-grid, monthly-summary, overtime-badge, template-selector
- **KPI**: kpi-chart, kpi-dashboard, kpi-dashboard-card
- **Reports**: completion-rate-chart, timesheet-distribution-chart, date-range-picker, export-button
- **Knowledge**: document-tree, document-search, markdown-editor, version-history
- **System**: sidebar, topbar, notification-bell, command-palette, global-search-modal, session-timeout-warning, password-change-guard, feedback-button, avatar-upload, notification-preferences, page-states

---

## 5. Service Layer（27+ services）

| Service | 職責 |
|---------|------|
| task-service | 任務 CRUD、批量操作、排序 |
| time-entry-service | 工時記錄 CRUD、鎖定、月結、審核 |
| user-service | 使用者管理、帳號鎖定/解鎖、停用 |
| kpi-service | KPI 定義、填報、計算 |
| kpi-history-service | KPI 歷史趨勢追蹤 |
| plan-service | 年度計畫 CRUD、模板複製 |
| goal-service | 月度目標管理 |
| milestone-service | 里程碑管理 |
| document-service | 文件 CRUD、版本管理 |
| task-document-service | 任務-文件關聯 |
| deliverable-service | 交付物管理 |
| notification-service | 通知產生、推播、偏好管理 |
| email-notification-service | Email 通知排程發送 |
| monitoring-service | 外部監控整合、告警處理 |
| permission-service | 權限查詢與設定 |
| session-service | Session 管理、JWT blacklist |
| report-service | 報表計算（完成率、工時分佈、KPI 達成率） |
| export-service | CSV/Excel 匯出 |
| import-service | 資料匯入（含 Kimai） |
| kimai-import-service | Kimai 工時匯入轉換 |
| audit-service | 稽核日誌查詢 |
| activity-logger | 操作事件自動記錄 |
| change-tracking-service | 任務欄位變更追蹤 |
| outline-client | Outline API 整合客戶端 |
| recurring-service | 週期任務排程與產生 |

---

## 6. 認證流程（Auth.js v5 + JWT）

```
                        ┌─────────────────────────┐
                        │   Edge Middleware        │
                        │   (middleware.ts)        │
                        │   JWT/JWE 驗證           │
                        │   未認證 → /login        │
                        │   API → 401 JSON        │
                        └────────┬────────────────┘
                                 │
                        ┌────────▼────────────────┐
                        │   Node.js Runtime       │
                        │   CSRF Origin 驗證       │
                        │   JWT Blacklist 檢查     │
                        │   Session Timeout 30min │
                        │   Rate Limiting         │
                        │   RBAC（withAuth/withManager）│
                        │   Audit Log 自動記錄     │
                        └─────────────────────────┘

密碼安全：
  - bcrypt cost ≥ 12
  - 密碼強度前後端雙重驗證
  - 密碼歷史不重複（最近 5 組）
  - 密碼到期強制更換 + 7 天預警
  - 登入限流（5 次/分 per IP+username）
  - 帳號鎖定（10 次失敗鎖 15 分鐘）

Token 機制：
  - Access Token: JWT/JWE（15 min）
  - Refresh Token: 7 天
  - Cookie: httpOnly + SameSite=Strict

RBAC 角色：
  - ADMIN: 完整系統管理權限
  - MANAGER: 團隊管理、審核、報表
  - ENGINEER: 個人任務、工時填報
```

---

## 7. 部署架構（Docker）

```
┌─────────────────────────────────────────┐
│              Nginx (TLS)                │
│         反向代理 + 靜態資源快取          │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Next.js App (Port 3100)         │
│         App Router + API Routes         │
│         Edge Middleware (JWT)            │
└───┬──────────────────┬──────────────────┘
    │                  │
┌───▼──────┐    ┌──────▼──────┐
│PostgreSQL│    │   Redis 7   │
│   16     │    │  Rate Limit │
│  Prisma  │    │  JWT Blacklist│
│  36 Models│   │  Session     │
└──────────┘    └─────────────┘
```

### Docker Compose 檔案

| 檔案 | 用途 |
|------|------|
| `docker-compose.yml` | 生產部署（Next.js + PG + Redis + Nginx） |
| `docker-compose.dev.yml` | 開發環境（PG + Redis，Next.js 本地執行） |
| `docker-compose.monitoring.yml` | 監控（Prometheus + Grafana + exporters） |
| `config/auth/docker-compose.keycloak.yml` | Keycloak SSO |
| `config/auth/docker-compose.ldap.yml` | OpenLDAP |

---

## 8. 測試架構

```
Layer 0:  Safe Utilities — safeFixed, safePct, safeNum
Layer 1:  前端單元測試 — Jest + React Testing Library（全頁面覆蓋）
Layer 1.5: Integration 測試 — API + Service + RBAC + Schema Drift + Contract
Layer 2:  E2E 測試 — Playwright（認證、巡覽、權限、Defensive、A11y、Visual）
Layer 3:  Performance 測試 — k6 load test baseline
```

**統計：199 Jest suites (~2500 tests) + 42 Playwright E2E suites = 2500+ tests**
