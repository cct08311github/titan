# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TITAN** (Team Integrated Task And kNowledge) — 銀行 IT 團隊現代化協作平台。使用 Docker Compose 部署開源工具堆疊，設計用於離線/封閉網路 (air-gapped) 環境。所有映像版本均固定，無外部網路依賴。

## Commands

### 服務生命週期

```bash
# 啟動核心服務（需先有 .env）
cp .env.example .env  # 首次設定
docker compose up -d

# 啟動監控堆疊（Prometheus + Grafana + exporters）
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# 啟動認證服務（Keycloak 或 LDAP，擇一）
docker compose -f config/auth/docker-compose.keycloak.yml up -d
docker compose -f config/auth/docker-compose.ldap.yml up -d

# Plane 專案管理（獨立 compose）
docker compose -f /opt/titan/plane-docker-compose.yml --env-file config/plane/.env up -d
```

### 健康檢查與監控

```bash
./scripts/health-check.sh              # 彩色狀態報告（exit: 0=健康 1=降級 2=嚴重）
./scripts/health-check.sh --json       # JSON 格式（供自動化）
./scripts/health-check.sh --quiet      # 靜默（只看結束碼）
./scripts/db-health-check.sh           # PostgreSQL 專用深度檢查
./scripts/audit-check.sh               # 稽核合規檢查
```

### 備份與還原

```bash
./scripts/backup.sh                    # 全量備份（PG + Redis + MinIO + Outline + configs）
./scripts/backup/backup-postgres.sh    # 僅 PostgreSQL
./scripts/backup/backup-minio.sh       # 僅 MinIO
./scripts/backup/restore.sh --all      # 還原全部（互動式確認）
./scripts/backup/restore.sh --postgres latest   # 還原最新 PG 備份
./scripts/backup/restore.sh --minio latest      # 還原最新 MinIO
```

### 測試

```bash
bash tests/infra-validation.sh         # 基礎設施驗證（compose 解析 + 還原腳本測試）
```

## Architecture

### 服務拓撲

```
                     ┌─ Homepage (:3000) ─── 統一入口
                     ├─ Uptime Kuma (:3002) ─ 可用性監控
Nginx Proxy (TLS) ──┤
                     ├─ Outline (:3001) ──── 知識庫
                     └─ Plane (:8082) ────── 專案管理（獨立 compose）

共用基礎設施（titan-internal 網路）：
  PostgreSQL 16 ─── 共用資料庫（Outline: titan DB, Plane: plane_db）
  Redis 7 ──────── 快取/佇列（Outline: DB 0, Plane: DB 1）
  MinIO ─────────── S3 物件儲存（buckets: outline, plane-uploads）
```

### Compose 檔案結構

| 檔案 | 用途 |
|------|------|
| `docker-compose.yml` | 核心服務（PG, Redis, MinIO, Outline, Homepage, Uptime Kuma） |
| `docker-compose.monitoring.yml` | Prometheus + Grafana + node-exporter + cadvisor + exporters |
| `config/auth/docker-compose.keycloak.yml` | Keycloak SSO |
| `config/auth/docker-compose.ldap.yml` | OpenLDAP |
| `nginx/docker-compose.yml` | Nginx 反向代理 + TLS 終端 |

### 網路隔離

- `titan-internal`：服務間內部通訊（所有服務）
- `titan-external`：對外服務（僅 Homepage）
- 安全強化：大多數服務移除外部端口，僅透過 Nginx 代理存取

### 容器命名慣例

所有容器統一前綴 `titan-`（如 `titan-postgres`、`titan-redis`、`titan-outline`）。Plane 容器使用 `plane-` 前綴。

## Key Directories

| 路徑 | 用途 |
|------|------|
| `config/` | 各服務設定（homepage, monitoring, auth, audit, plane） |
| `scripts/` | 維運腳本（備份、還原、健康檢查、初始化） |
| `scripts/init/` | 資料庫初始化 SQL/腳本（Docker entrypoint 自動執行） |
| `scripts/backup/` | 模組化備份/還原腳本 + crontab 設定 |
| `nginx/` | Nginx 設定 + TLS 憑證目錄 |
| `docs/` | 設計文件（認證、資料庫、監控、備份策略、稽核） |
| `tests/` | 基礎設施驗證測試 |

## Development Workflow

專案使用 GitHub Issue 驅動開發，Issue 按 Phase 分組（A→E）。

```
zug (Claude Opus) 建 Issue → cct (OpenClaw) 開 branch 開發 → 提 PR → Code Review → 合併
```

- 分支命名：`feat/T{XX}-{描述}`（如 `feat/T06-os-hardening`）
- Commit 格式：`feat(T{XX}): 描述`
- PR 必須包含 `Closes #N` 連結 Issue

## Security Hardening Patterns

此專案為銀行環境設計，所有容器遵循以下安全強化原則：

- 非 root 使用者執行（`user: postgres`, `user: redis`, etc.）
- 資源限制（CPU/Memory limits + reservations）
- 無外部端口暴露（透過 Nginx proxy 統一入口）
- 必填密碼以 `:?` 語法強制（`${POSTGRES_PASSWORD:?...}`）
- Healthcheck 定義在每個服務上

## Application Features (Sprint 1-8 + DT Phase 1-3 完成)

- **Request Correlation ID** (`middleware.ts`): 每個 request 注入 `x-request-id`，支援跨層追蹤
- **Error Boundary** (`app/global-error.tsx`, `app/(app)/error.tsx`): 前端錯誤自動回報到 AuditLog via `/api/error-report`
- **Command Palette** (`app/components/command-palette.tsx`): `Ctrl+K` 搜尋導航 + `G`+字母快捷鍵
- **Global Search** (`app/components/global-search-modal.tsx`): 跨 table 全文搜尋 + 標籤篩選
- **Password History** (`PasswordHistory` model): 禁止重複使用最近 5 組密碼
- **Password Expiry** (`AU-5`): 密碼到期強制更換 + 7 天前預警
- **Prometheus Metrics** (`/api/metrics`): 應用層 request/error/duration 指標，Prometheus scrape config 已加入
- **Projector Viewport**: sidebar 在 ≤1024px 自動收合，dashboard grid 使用 `md:` breakpoint
- **SLA Timer**: 任務 SLA 倒數計時 + 到期通知
- **Recurring Tasks**: 週期任務自動排程系統
- **Change Management**: 結構化變更管理工作流（ChangeRecord + ApprovalRequest）
- **Email Notifications**: 排程觸發 Email 通知管道
- **Monitoring Integration**: 外部監控整合 + KPI 歷史追蹤
- **User Management**: 管理員使用者 CRUD + 停用/恢復
- **Custom Reports**: 自訂查詢 API + 日期範圍 + 多篩選 + Excel/CSV 匯出

### 技術數據

- **Prisma Models**: 36 models, 25 enums
- **API Routes**: 115+ route files
- **Components**: 70+ shared components
- **Services**: 27+ service files
- **Test Suites**: 199 Jest suites (~2500 tests) + 42 Playwright E2E suites
- **Version**: 1.0.0-rc.1

## Environment Variables

`.env` 由 `.env.example` 複製產生。關鍵 secrets 使用 `openssl rand -hex 32` 產生。必填欄位標記為 `:?`（啟動時未設定會報錯）。
