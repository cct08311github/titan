# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TITAN** (Team Integrated Task And kNowledge) — 銀行 IT 團隊現代化協作平台。使用 Docker Compose 部署開源工具堆疊，設計用於離線/封閉網路 (air-gapped) 環境。所有映像版本均固定，無外部網路依賴。

## Commands

### 開發環境

```bash
npm install              # 安裝依賴
npm run dev              # 啟動 Next.js dev server (localhost:3100)
npm run build            # 建置生產版本
npm run lint             # ESLint 檢查
```

### 資料庫

```bash
npm run db:generate       # 產生 Prisma Client（schema 變更後執行）
npm run db:migrate        # 建立並套用 migration（開發環境）
npm run db:migrate:deploy # 僅套用既有 migration（生產環境）
npm run db:push           # 強制同步 schema 到資料庫（不建議用於 migration）
npm run db:seed           # 執行資料庫 seed
npm run db:studio         # 開啟 Prisma Studio GUI
```

### 測試

```bash
# Jest 單元 + Integration 測試
npx jest --forceExit

# 單一檔案或目錄
npx jest __tests__/pages/dashboard.test.tsx --forceExit
npx jest __tests__/integration/ --forceExit

# E2E 測試（需要 Docker: docker compose -f docker-compose.dev.yml up -d）
npx playwright test
npx playwright test e2e/kanban.spec.ts           # 單一 suite
npx playwright test --update-snapshots          # 更新視覺回歸基準
```

### Docker Compose（基礎設施）

```bash
# 核心服務（需先有 .env）
cp .env.example .env
docker compose up -d

# 監控堆疊（Prometheus + Grafana）
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# 認證服務（Keycloak 或 LDAP，擇一）
docker compose -f config/auth/docker-compose.keycloak.yml up -d
docker compose -f config/auth/docker-compose.ldap.yml up -d
```

### 健康檢查與監控

```bash
./scripts/health-check.sh              # 彩色狀態報告（exit: 0=健康 1=降級 2=嚴重）
./scripts/health-check.sh --json       # JSON 格式
./scripts/health-check.sh --quiet      # 靜默模式
./scripts/db-health-check.sh           # PostgreSQL 深度檢查
./scripts/audit-check.sh               # 稽核合規檢查
```

### 備份與還原

```bash
./scripts/backup.sh                     # 全量備份
./scripts/backup/backup-postgres.sh    # 僅 PostgreSQL
./scripts/backup/backup-minio.sh       # 僅 MinIO
./scripts/backup/restore.sh --all      # 還原全部
./scripts/backup/restore.sh --postgres latest   # 還原 PG
```

## Architecture

### 服務拓撲

```
                     ┌─ Homepage (:3000) ─── 統一入口
                     ├─ Uptime Kuma (:3002) ─ 可用性監控
Nginx Proxy (TLS) ──┤
                     ├─ Outline (:3001) ──── 知識庫
                     └─ Plane (:8082) ────── 專案管理

共用基礎設施（titan-internal 網路）：
  PostgreSQL 16 ─── 共用資料庫（Outline: titan DB, Plane: plane_db）
  Redis 7 ──────── 快取/佇列（Outline: DB 0, Plane: DB 1）
  MinIO ─────────── S3 物件儲存
```

### Next.js App Router 結構

```
app/
├── (app)/                    # 已認證頁面（含 layout sidebar/topbar）
│   ├── dashboard/           # 儀表板
│   ├── kanban/              # 看板
│   ├── gantt/               # 甘特圖
│   ├── plans/               # 年度計畫
│   ├── kpi/                 # KPI 指標
│   ├── timesheet/           # 工時紀錄（含月度視圖）
│   ├── reports/             # 報表
│   ├── knowledge/           # 知識庫
│   ├── activity/            # 團隊動態
│   ├── admin/               # 管理後台
│   └── settings/            # 個人設定
├── (auth)/                  # 認證頁面（無 sidebar）
│   ├── login/
│   ├── change-password/
│   └── reset-password/
├── api/                     # API Routes（115+ routes）
│   └── [resource]/          # RESTful 端點
│       └── route.ts         # 統一是 auth.ts + api-handler.ts
├── components/              # 共用元件（70+）
│   └── ui/                  # shadcn/ui 元件
└── global-error.tsx         # Error Boundary
```

### API 與 Service 層

**API Route → Service → Prisma**

每個 API route 統一使用：
1. `lib/auth.ts` 的 `requireAuth()` 或 `requireManager()` 驗證
2. `lib/api-handler.ts` 統一錯誤處理
3. `services/` 下的 service class 處理商業邏輯
4. `validators/` 下的 Zod schema 做輸入驗證

### Auth.js v5 模式

- JWT/JWE token 存於 httpOnly cookie
- Edge Runtime middleware (`middleware.ts`) 做第一層驗證
- RBAC: `Manager` / `Engineer` 兩種角色
- 帳號鎖定：10 次失敗鎖 15 分鐘
- 密碼歷史：禁止重複最近 5 組

### 安全中間件鏈

```
middleware.ts (Edge) → CSRF → Rate Limit → JWT Blacklist → RBAC → Audit Log
```

## Key Directories

| 路徑 | 用途 |
|------|------|
| `app/` | Next.js App Router 頁面與 API |
| `app/api/` | API Routes（115+） |
| `app/components/` | 共用 UI 元件 |
| `lib/` | 核心程式庫（auth, api-handler, rate-limiter, safe-number） |
| `services/` | Service Layer（27+ services，商業邏輯） |
| `validators/` | Zod Schema 雙層驗證（client + server） |
| `prisma/` | Schema（36 models, 25 enums）+ Migrations |
| `__tests__/` | Jest 測試（199 suites, ~2500 tests） |
| `e2e/` | Playwright E2E（42 suites） |
| `scripts/` | 維運腳本 |
| `config/` | 各服務設定 |
| `nginx/` | Nginx 反向代理 + TLS |

## Development Workflow

GitHub Issue 驅動開發，Issue 按 Phase 分組（A→E）。

```
建 Issue → 開 branch（feat/T{XX}-{描述}）→ 開發 → 測試 → PR（附 Closes #N）
```

- 分支：`feat/T{XX}-{描述}`
- Commit：`feat(T{XX}): 描述`
- PR 必須包含 `Closes #N`

### 重要：先建 Migration 再改 Schema

```bash
# 1. 修改 prisma/schema.prisma
# 2. 建立 migration
npm run db:migrate
# 3. 確認 migration 檔案產生在 prisma/migrations/
# 4. Commit 時一併包含 migration 檔案
```

## 技術數據

- **Prisma Models**: 36 models, 25 enums
- **API Routes**: 115+ route files
- **Components**: 70+ shared components
- **Services**: 27+ service files
- **Test Suites**: 199 Jest suites (~2500 tests) + 42 Playwright E2E suites
- **版本**: 1.0.0-rc.1

## Jest 測試注意事項

**ESM-only packages 必須 transform**：Jest 的 `transformIgnorePatterns` 必須排除這些否則會失敗：
```
next-auth|@auth/core|@panva/hkdf|jose|oauth4webapi
```

**next/headers mock**：所有 route handler 測試預設 mock `next/headers`，因為 Edge runtime 的 `headers()` 需要 Request Store context。

## Environment Variables

`.env` 由 `.env.example` 複製產生。關鍵 secrets 使用 `openssl rand -hex 32` 產生。必填欄位標記為 `:?`（啟動時未設定會報錯）。
