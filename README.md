# TITAN

**T**eam **I**ntegrated **T**ask **A**nd k**N**owledge — 銀行 IT 團隊工作管理系統

## 概述

TITAN 是為銀行內部 IT 團隊（1 主管 + 4 工程師）打造的一體化工作管理系統，取代 Excel、Email、紙本的分散式管理方式，提供統一的任務追蹤、工時記錄、KPI 管理和知識庫功能。

部署於封閉內網環境，透過 Docker 容器化部署，無需外部網路連線。

**開發狀態：** Sprint 1-8 + Design Thinking Phase 1-3 全部完成（v1.0.0-rc.1）

## 功能模組（12 個）

| 模組 | 說明 | 路由 | 狀態 |
|------|------|------|------|
| 儀表板 | 管理者/經辦雙視角、統計卡片、團隊概況、逾期警示 | `/dashboard` | Done |
| 看板 | 任務卡片拖拉、狀態管理、篩選排序、子任務、附件、變更管理 | `/kanban` | Done |
| 年度計畫 | 計畫樹狀結構、月度目標、里程碑、進度自動計算 | `/plans` | Done |
| 甘特圖 | frappe-gantt 時程視覺化、里程碑標記、拖拉調整、週/月/季縮放 | `/gantt` | Done |
| 知識庫 | Outline API 整合、全文搜尋、任務連結、Markdown 編輯器含圖片上傳 | `/knowledge` | Done |
| 工時紀錄 | 週曆式填報、6 類工時分類、加班標記、模板、鎖定機制、月結審核 | `/timesheet` | Done |
| 月度工時 | 主管月度總覽、審核工作流、合規報表 | `/timesheet/monthly` | Done |
| KPI | 指標定義/填報/儀表板、ECharts 圖表、任務連結、歷史趨勢 | `/kpi` | Done |
| 報表 | 完成率/工時分佈/KPI 達成率、自訂查詢、CSV/Excel 匯出 | `/reports` | Done |
| 團隊動態 | 操作事件自動記錄、時間軸 UI、篩選 | `/activity` | Done |
| 個人設定 | 個人資料/頭像編輯、通知偏好設定 | `/settings` | Done |
| 管理後台 | 使用者 CRUD/停用/恢復、RBAC 權限管理 | `/admin` | Done |

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 15.5.14 (App Router)、React 19、TypeScript 5 |
| UI | Tailwind CSS 3.4、shadcn/ui、Geist 字體、明亮主題 |
| 後端 | Next.js API Routes、Service Layer Pattern（27+ services） |
| ORM | Prisma 5.22 (36 models、25 enums) |
| 資料庫 | PostgreSQL 16 |
| 快取 | Redis 7 (rate limiting、session、JWT blacklist) |
| 認證 | Auth.js v5 (next-auth 5.0.0-beta.30)、JWT/JWE、RBAC (Manager/Engineer) |
| 驗證 | Zod shared schemas、server + client 雙層驗證 |
| 圖表 | ECharts 6.0、frappe-gantt 1.2 |
| i18n | next-intl 基礎架構（繁中為主） |
| 測試 | Jest 30 (199 suites, ~2500 tests)、Playwright 1.58 E2E (42 suites)、2500+ total |
| 部署 | Docker Compose、Nginx 反向代理 |

## 安全架構

Defense-in-Depth 多層防護：

```
Edge Runtime    → JWT/JWE 驗證（middleware.ts）
                → 頁面路由：未認證導向 /login
                → API 路由：401 JSON

Node.js Runtime → CSRF Origin 驗證
                → JWT Blacklist（suspended user）
                → Session Timeout（30 min server-side）
                → Rate Limiting（GET 100/60s, mutating 20/60s per user）
                → RBAC 權限檢查（withAuth / withManager）
                → Audit Log（自動記錄所有寫入操作）

帳號保護       → 登入限流（5 次/分 per IP+username）
                → 帳號鎖定（10 次失敗鎖 15 分鐘）
                → 密碼 bcrypt 雜湊
                → Cookie httpOnly + SameSite=Strict
```

## 資料模型

36 個 Prisma Model：

- **使用者與權限**：User、PasswordHistory、Permission、PasswordResetToken、RefreshToken
- **計畫管理**：AnnualPlan、MonthlyGoal、Milestone
- **任務管理**：Task、SubTask、TaskComment、TaskActivity、TaskChange、TaskDocument、TaskAttachment、TaskTemplate、RecurringRule
- **事件與變更**：IncidentRecord、ChangeRecord、ApprovalRequest
- **績效追蹤**：KPI、KPIAchievement、KPITaskLink、KPIHistory
- **工時管理**：TimeEntry、TimesheetApproval、TimeEntryTemplate、TimeEntryTemplateItem
- **交付物**：Deliverable
- **知識管理**：Document、DocumentVersion
- **系統**：Notification、NotificationPreference、NotificationLog、MonitoringAlert、AuditLog

## 快速開始

### 前置需求

- Docker Desktop
- Node.js 20+
- Git

### 開發環境（推薦：使用 start-dev.sh）

最簡單的啟動方式：一鍵啟動 PostgreSQL + Redis + Next.js：

```bash
# 1. Clone
git clone https://github.com/cct08311github/titan.git
cd titan

# 2. 安裝依賴
npm install

# 3. 一鍵啟動開發環境（Docker DB + Redis + Next.js dev server）
./scripts/start-dev.sh
```

`start-dev.sh` 會自動：
1. 啟動 PostgreSQL + Redis Docker 容器
2. 等待服務就緒
3. 產生 Prisma Client 並推送 schema
4. 自動 seed 資料庫（如果是空的）
5. 啟動 Next.js dev server 於 http://localhost:3100

環境變數已配置於 `.env.development`，無需手動設定。

### 手動啟動（進階）

```bash
# 1. 啟動 Docker（PostgreSQL + Redis）
docker compose -f docker-compose.dev.yml up -d

# 2. 初始化資料庫（使用 migrate 進行版本控制）
DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" npx prisma migrate dev

# 3. 產生 Prisma Client
npx prisma generate

# 4. Seed 資料庫
DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" npx prisma db seed

# 5. 啟動 Next.js dev server
npx next dev -p 3100
```

### 測試帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 主管 | `admin@titan.local` | `Titan@2026` |
| 工程師 | `eng01` ~ `eng04` | `Titan@2026Dev!` |

> 開發環境可使用 `admin` / `Titan@2026Dev!` 登入。

### 執行測試

```bash
# 單元 + Integration 測試
npx jest --forceExit

# E2E 測試（需要 Docker 環境運行中）
npx playwright test

# 更新 Visual Regression 基準截圖
npx playwright test --update-snapshots
```

## 測試架構

**統計：199 個 Jest suites（~2500 tests）+ 42 個 Playwright E2E suites = 2500+ tests**

```
Layer 0:  Safe Utilities（safeFixed, safePct, safeNum）
Layer 1:  前端單元測試（Jest + RTL, 全頁面覆蓋）
Layer 1.5: Integration 測試（API + Service + RBAC + Schema Drift + Contract）
Layer 2:  E2E 測試（Playwright — 認證、巡覽、權限、Defensive、A11y、Visual）
Layer 3:  Performance 測試（k6 load test baseline）
```

詳細測試指南見 [TESTING.md](TESTING.md)

## 專案結構

```
titan/
├── app/
│   ├── (app)/              # 主要功能頁面（需認證）
│   │   ├── activity/       # 團隊動態
│   │   ├── admin/          # 管理後台（含通知管理）
│   │   ├── dashboard/      # 儀表板
│   │   ├── gantt/          # 甘特圖
│   │   ├── kanban/         # 看板
│   │   ├── knowledge/      # 知識庫
│   │   ├── kpi/            # KPI
│   │   ├── plans/          # 年度計畫
│   │   ├── reports/        # 報表
│   │   ├── settings/       # 個人設定
│   │   └── timesheet/      # 工時紀錄（含月度視圖）
│   ├── (auth)/             # 認證頁面
│   │   ├── login/          # 登入
│   │   ├── change-password/# 密碼變更
│   │   └── reset-password/ # 密碼重設
│   ├── api/                # API Routes（115+ routes, 25+ resources）
│   └── components/         # 共用元件（70+ 元件）
├── lib/                    # 核心程式庫
│   ├── api-handler.ts      # 統一錯誤處理
│   ├── auth-depth.ts       # Edge JWT/JWE 驗證
│   ├── csrf.ts             # CSRF 保護
│   ├── rate-limiter.ts     # 限流
│   ├── security-middleware.ts  # 安全中間件鏈
│   └── safe-number.ts      # 安全數值格式化
├── services/               # Service Layer（27+ services）
├── validators/             # Zod Schema 驗證
├── prisma/                 # Prisma Schema（36 models, 25 enums）+ Migrations
├── __tests__/              # Jest 測試（199 suites）
│   ├── api/                # API Route 測試
│   ├── integration/        # Integration 測試
│   └── pages/              # 前端頁面測試
├── e2e/                    # Playwright E2E 測試（42 suites）
├── scripts/
│   └── start-dev.sh        # 一鍵啟動開發環境
├── docs/                   # 專案文件（80+ 文件）
├── docker-compose.yml      # 生產部署配置
├── docker-compose.dev.yml  # 開發環境配置
├── Dockerfile              # 多階段建置
├── TESTING.md              # 測試指南
└── middleware.ts            # Edge 認證中間件
```

## API 端點

115+ 個 API Route，涵蓋 25+ RESTful Resources：

| Resource | 端點 | 方法 |
|----------|------|------|
| 認證 | `/api/auth/*` | Auth.js v5 |
| 密碼變更 | `/api/auth/change-password`, `/api/auth/reset-password` | POST |
| 任務 | `/api/tasks` | GET, POST, PUT, DELETE |
| 任務附件/評論/變更/文件 | `/api/tasks/[id]/*` | CRUD |
| 任務甘特/匯入/批量/SLA | `/api/tasks/gantt`, `/api/tasks/bulk`, etc. | GET, POST |
| 子任務 | `/api/subtasks` | GET, POST, PUT, DELETE |
| 使用者 | `/api/users` | GET, POST, PUT |
| 年度計畫 | `/api/plans` | GET, POST, PUT, DELETE |
| 月度目標 | `/api/goals` | GET, POST, PUT, DELETE |
| 里程碑 | `/api/milestones` | GET, POST, PUT, DELETE |
| KPI | `/api/kpi` | GET, POST, PUT, DELETE |
| KPI 成就/歷史/連結 | `/api/kpi/[id]/*` | GET, POST |
| 工時 | `/api/time-entries` | GET, POST, PUT, DELETE |
| 工時審核/模板/月結/計時 | `/api/time-entries/*` | CRUD |
| 交付物 | `/api/deliverables` | GET, POST, PUT, DELETE |
| 文件 | `/api/documents` | GET, POST, PUT, DELETE |
| 文件搜尋/標籤 | `/api/documents/search`, `/api/documents/tags` | GET |
| 通知 | `/api/notifications` | GET, PATCH |
| 權限 | `/api/permissions` | GET, POST, DELETE |
| 報表 | `/api/reports/*` (10+ 子路由) | GET |
| 稽核 | `/api/audit` | GET |
| 搜尋 | `/api/search` | GET |
| 週期任務 | `/api/recurring` | GET, POST, PUT, DELETE |
| 任務模板 | `/api/task-templates` | GET, POST, PUT, DELETE |
| 審批 | `/api/approvals` | GET, POST, PUT |
| 監控告警 | `/api/monitoring-alerts` | GET, POST, PUT |
| Outline 整合 | `/api/outline/*` | GET, POST |
| 管理員工具 | `/api/admin/*` | POST |
| 系統指標 | `/api/metrics`, `/api/health` | GET |

## 文件

| 文件 | 說明 |
|------|------|
| [架構文件](docs/architecture-v3.md) | 完整系統架構設計 |
| [ROI 分析](docs/roi-analysis.md) | 投資回報分析（三年期） |
| [SLA 定義](docs/sla-definition.md) | 服務等級協議 |
| [災難復原](docs/disaster-recovery.md) | RPO/RTO 目標與復原步驟 |
| [合規映射](docs/compliance-mapping.md) | 金管會 + ISO 27001 對照表 |
| [支援計畫](docs/support-plan.md) | L1/L2 支援架構 |
| [測試指南](TESTING.md) | 測試架構與執行指令 |

## Database Connection Pooling

TITAN 使用 Prisma 的 `connection_limit` 參數控制資料庫連線池上限。預設設為 **10**，適合 5 人團隊的銀行內網環境。

```
DATABASE_URL=postgresql://user:password@host:5432/db?connection_limit=10
```

- `connection_limit=10`：每個 Prisma Client 實例最多持有 10 條連線
- 若部署多個 replica，總連線數 = replica 數 × connection_limit
- PostgreSQL 預設 `max_connections=100`，建議保留餘裕給管理工具與監控

## 設計原則

1. **簡約** — 乾淨清爽的 UI，明亮專業風格
2. **直覺** — 不用教就會用，操作路徑最短
3. **經辦視角** — 今天要做什麼、哪個最急、做完怎麼回報
4. **管理者視角** — 誰在做什麼、進度多少、誰卡住了
5. **一體化** — 一個帳號、一個 UI、所有功能統一整合
6. **剛好夠用** — 只做需要的功能，不做用不到的

## License

Private — 銀行內部使用
