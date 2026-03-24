# TITAN

**T**eam **I**ntegrated **T**ask **A**nd k**N**owledge — 銀行 IT 團隊工作管理系統

## 概述

TITAN 是為銀行內部 IT 團隊（1 主管 + 4 工程師）打造的一體化工作管理系統，取代 Excel、Email、紙本的分散式管理方式，提供統一的任務追蹤、工時記錄、KPI 管理和知識庫功能。

部署於封閉內網環境，透過 Docker 容器化部署，無需外部網路連線。

## 功能模組

| 模組 | 說明 | 路由 |
|------|------|------|
| 儀表板 | 管理者/經辦雙視角、統計卡片、團隊概況 | `/dashboard` |
| 看板 | 任務卡片拖拉、狀態管理、篩選排序 | `/kanban` |
| 年度計畫 | 計畫樹狀結構、月度目標、里程碑 | `/plans` |
| 甘特圖 | 時程視覺化、任務依賴、進度追蹤 | `/gantt` |
| 知識庫 | Markdown 文件管理、樹狀目錄、版本歷史 | `/knowledge` |
| 工時紀錄 | 週曆式填報、6 類工時分類、統計摘要 | `/timesheet` |
| KPI | 指標設定、達成率計算、任務連結 | `/kpi` |
| 報表 | 週報/月報/工作量分析、計畫外比例 | `/reports` |

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 15 (App Router)、React 19、TypeScript |
| UI | Tailwind CSS、shadcn/ui、Geist 字體、明亮主題 |
| 後端 | Next.js API Routes、Service Layer Pattern |
| ORM | Prisma 5 (18 models、12 enums) |
| 資料庫 | PostgreSQL 16 |
| 認證 | NextAuth v4 (JWT/JWE)、RBAC (Manager/Engineer) |
| 測試 | Jest (~930 tests)、Playwright E2E (~40 tests) |
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
                → Rate Limiting（100 req/60s per user）
                → RBAC 權限檢查（withAuth / withManager）
                → Audit Log（自動記錄所有寫入操作）

帳號保護       → 登入限流（5 次/分 per IP+username）
                → 帳號鎖定（10 次失敗鎖 15 分鐘）
                → 密碼 bcrypt 雜湊
                → Cookie httpOnly + SameSite=Strict
```

## 資料模型

18 個 Prisma Model：

- **使用者與權限**：User、Permission
- **計畫管理**：AnnualPlan、MonthlyGoal、Milestone
- **任務管理**：Task、SubTask、TaskComment、TaskActivity、TaskChange
- **績效追蹤**：KPI、KPITaskLink、TimeEntry、Deliverable
- **知識管理**：Document、DocumentVersion
- **系統**：Notification、AuditLog

## 快速開始

### 前置需求

- Docker Desktop
- Node.js 20+
- Git

### 開發環境

```bash
# 1. Clone
git clone https://github.com/cct08311github/titan.git
cd titan

# 2. 安裝依賴
npm install

# 3. 啟動 Docker（PostgreSQL + Next.js）
docker compose -f docker-compose.dev.yml up -d

# 4. 初始化資料庫
DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" npx prisma db push

# 5. 產生 Prisma Client
docker compose -f docker-compose.dev.yml exec titan-app npx prisma generate

# 6. 建立種子帳號
docker compose -f docker-compose.dev.yml exec titan-db psql -U titan -d titan_dev -c "
INSERT INTO users (id, name, email, password, role, \"isActive\", \"createdAt\", \"updatedAt\")
VALUES ('admin-001', '主管', 'admin@titan.local',
  '\$2a\$10\$2bHYZk6wD77JuR1H3mdnZuucHr2hqJLqmu4KGWGwDv7LMmRBPKNcy',
  'MANAGER', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;"

# 7. 開啟瀏覽器
open http://localhost:3100
```

### 測試帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 主管 | `admin@titan.local` | `Titan@2026` |

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

```
Layer 0:  Safe Utilities（safeFixed, safePct, safeNum）
Layer 1:  前端單元測試（Jest + RTL, 10 頁面全覆蓋）
Layer 1.5: Integration 測試（API + Service + RBAC + Schema Drift）
Layer 2:  E2E 測試（Playwright — 認證、巡覽、權限、Defensive、A11y、Visual）
```

詳細測試指南見 [TESTING.md](TESTING.md)

## 專案結構

```
titan/
├── app/
│   ├── (app)/              # 主要功能頁面（需認證）
│   │   ├── dashboard/      # 儀表板
│   │   ├── kanban/         # 看板
│   │   ├── gantt/          # 甘特圖
│   │   ├── knowledge/      # 知識庫
│   │   ├── kpi/            # KPI
│   │   ├── plans/          # 年度計畫
│   │   ├── reports/        # 報表
│   │   └── timesheet/      # 工時紀錄
│   ├── (auth)/login/       # 登入頁
│   ├── api/                # API Routes（15 個 resource）
│   └── components/         # 共用元件
├── lib/                    # 核心程式庫
│   ├── api-handler.ts      # 統一錯誤處理
│   ├── auth-depth.ts       # Edge JWT/JWE 驗證
│   ├── csrf.ts             # CSRF 保護
│   ├── rate-limiter.ts     # 限流
│   ├── security-middleware.ts  # 安全中間件鏈
│   └── safe-number.ts      # 安全數值格式化
├── services/               # Service Layer（14+ services）
├── validators/             # Zod Schema 驗證
├── prisma/                 # Prisma Schema + Migrations
├── __tests__/              # Jest 測試
│   ├── api/                # API Route 測試
│   ├── integration/        # Integration 測試
│   └── pages/              # 前端頁面測試
├── e2e/                    # Playwright E2E 測試
├── docs/                   # 專案文件
│   ├── architecture-v3.md  # 系統架構文件
│   ├── roi-analysis.md     # ROI 分析
│   ├── sla-definition.md   # SLA 定義
│   ├── disaster-recovery.md    # 災難復原計畫
│   ├── compliance-mapping.md   # 合規映射表
│   └── support-plan.md    # L1/L2 支援計畫
├── docker-compose.yml      # 生產部署配置
├── docker-compose.dev.yml  # 開發環境配置
├── Dockerfile              # 多階段建置
├── TESTING.md              # 測試指南
└── middleware.ts            # Edge 認證中間件
```

## API 端點

15 個 RESTful Resource：

| Resource | 端點 | 方法 |
|----------|------|------|
| 認證 | `/api/auth/*` | NextAuth |
| 任務 | `/api/tasks` | GET, POST, PUT, DELETE |
| 子任務 | `/api/subtasks` | GET, POST, PUT, DELETE |
| 使用者 | `/api/users` | GET, POST, PUT |
| 年度計畫 | `/api/plans` | GET, POST, PUT, DELETE |
| 月度目標 | `/api/goals` | GET, POST, PUT, DELETE |
| 里程碑 | `/api/milestones` | GET, POST, PUT, DELETE |
| KPI | `/api/kpi` | GET, POST, PUT, DELETE |
| 工時 | `/api/time-entries` | GET, POST, PUT, DELETE |
| 交付物 | `/api/deliverables` | GET, POST, PUT, DELETE |
| 文件 | `/api/documents` | GET, POST, PUT, DELETE |
| 通知 | `/api/notifications` | GET, PATCH |
| 權限 | `/api/permissions` | GET, POST, DELETE |
| 報表 | `/api/reports` | GET |
| 稽核 | `/api/audit` | GET |

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

## 設計原則

1. **簡約** — 乾淨清爽的 UI，明亮專業風格
2. **直覺** — 不用教就會用，操作路徑最短
3. **經辦視角** — 今天要做什麼、哪個最急、做完怎麼回報
4. **管理者視角** — 誰在做什麼、進度多少、誰卡住了
5. **一體化** — 一個帳號、一個 UI、所有功能統一整合
6. **剛好夠用** — 只做需要的功能，不做用不到的

## License

Private — 銀行內部使用
