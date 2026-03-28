# TITAN 部署與更新運維手冊

> 版本：1.0 | 更新日期：2026-03-28 | Issue #1032

---

## 懶人包（TL;DR）

```bash
# 首次部署（乾淨環境，約 5-10 分鐘）
bash scripts/first-deploy.sh

# 更新部署（約 2-3 分鐘）
bash scripts/upgrade.sh

# 全量更新（含基礎設施映像更新）
bash scripts/upgrade.sh --full
```

---

## 目錄

1. [系統需求](#1-系統需求)
2. [首次部署](#2-首次部署)
3. [更新部署](#3-更新部署)
4. [數據持久化](#4-數據持久化)
5. [服務架構與端口](#5-服務架構與端口)
6. [Profiles 選用服務](#6-profiles-選用服務)
7. [備份與還原](#7-備份與還原)
8. [故障排除](#8-故障排除)
9. [回滾操作](#9-回滾操作)

---

## 1. 系統需求

| 項目 | 最低需求 | 建議 |
|------|---------|------|
| OS | Linux / macOS | Ubuntu 22.04+ |
| Docker | 24.0+ | 最新穩定版 |
| Docker Compose | v2.20+ | 最新穩定版 |
| Node.js | 20 LTS | 20.x |
| RAM | 4 GB | 8 GB+ |
| 磁碟 | 20 GB | 50 GB+ |
| openssl | 任意版本 | — |

---

## 2. 首次部署

### 自動化流程

```bash
# 1. 取得程式碼
git clone https://github.com/cct08311github/titan.git
cd titan

# 2. 一鍵部署
bash scripts/first-deploy.sh
```

### 腳本會自動完成

| 步驟 | 動作 | 說明 |
|------|------|------|
| 1 | 前置條件檢查 | Docker / Node.js / openssl / 磁碟空間 |
| 2 | 產生密鑰 | PostgreSQL / Redis / MinIO / NextAuth / Outline |
| 3 | 建立 .env | 從 .env.example 複製並填入密鑰（chmod 600） |
| 4a | 建構映像 | npm ci → prisma generate → next build → docker build |
| 4b | 啟動容器 | docker compose up -d + 等待健康檢查 |
| 5 | DB Migration | Prisma DB Push（臨時容器，走內部網路） |
| 6 | 種子資料 | 載入初始資料（可 SKIP_SEED=true 跳過） |
| 7 | 健康檢查 | PostgreSQL / Redis / MinIO 驗證 |

### 環境變數覆蓋

```bash
# 自訂網域
TITAN_DOMAIN=titan.mybank.com bash scripts/first-deploy.sh

# 使用已有密碼
POSTGRES_PASSWORD=myStrongPass123 bash scripts/first-deploy.sh

# 跳過種子資料
SKIP_SEED=true bash scripts/first-deploy.sh
```

---

## 3. 更新部署

### 標準更新

```bash
bash scripts/upgrade.sh
```

### 腳本會自動完成

| 步驟 | 動作 | 說明 |
|------|------|------|
| 1 | 前置檢查 | 確認 .env / Docker / 容器存在 |
| 2 | 拉取程式碼 | git pull origin main |
| 3 | 備份資料庫 | pg_dump → backups/pre-upgrade_*.sql.gz |
| 4 | 重建映像 | 舊映像標記為 titan-app:previous（回滾用） |
| 5 | DB Migration | Prisma DB Push（僅新增/修改欄位，不刪資料） |
| 6 | 滾動更新 | 僅重啟 titan-app（基礎設施不動） |
| 7 | 健康檢查 | PostgreSQL / Redis / TITAN App |

### 選項

```bash
# 跳過 git pull（已手動更新程式碼）
bash scripts/upgrade.sh --skip-pull

# 全量更新（含基礎設施映像拉取 + 全容器重建）
bash scripts/upgrade.sh --full
```

---

## 4. 數據持久化

所有關鍵數據存於 Docker named volumes，**容器重建不影響數據**：

| Volume | 用途 | 重要性 |
|--------|------|--------|
| `titan-postgres-data` | PostgreSQL 資料庫 | 🔴 關鍵 |
| `titan-redis-data` | Redis 快取（含 AOF 持久化） | 🟡 重要 |
| `titan-minio-data` | MinIO 檔案儲存 | 🔴 關鍵 |
| `titan-outline-data` | Outline 知識庫資料 | 🟡 重要 |

### 安全操作 vs 危險操作

```bash
# ✅ 安全：停止容器，保留所有數據
docker compose down

# ✅ 安全：重建並重啟容器
docker compose up -d --force-recreate

# ⚠️ 危險：刪除所有 volumes（數據會遺失！）
docker compose down -v    # ← 永遠不要在生產環境執行
```

### 檢視 volumes

```bash
docker volume ls | grep titan
```

---

## 5. 服務架構與端口

```
┌───────────────────────────────────────────────────┐
│                 titan-external 網路                │
│  Homepage (:3000)                                 │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────┴────────────────────────────┐
│                 titan-internal 網路                │
│                                                   │
│  TITAN App (:3100) ─── PostgreSQL (:5432 內部)    │
│       │                     │                     │
│       └─── Redis (:6379 內部)                     │
│                                                   │
│  Outline (:3001 內部) ── MinIO (:9000 內部)       │
└───────────────────────────────────────────────────┘
```

| 服務 | 預設端口 | 環境變數 | 說明 |
|------|---------|---------|------|
| Homepage | 3000 | HOMEPAGE_PORT | 統一入口 |
| TITAN App | 3100 | TITAN_PORT | 主應用 |
| MinIO Console | 9001 | MINIO_CONSOLE_PORT | 物件儲存管理 |

> PostgreSQL / Redis 不暴露外部端口，僅透過 titan-internal 網路存取

---

## 6. Profiles 選用服務

```bash
# 僅核心服務（預設）
docker compose up -d

# 核心 + 監控（Prometheus + Grafana + Alertmanager）
docker compose --profile monitoring up -d

# 核心 + 監控 + 日誌（Loki + Promtail）
docker compose --profile monitoring --profile logging up -d

# 核心 + DB 複製（PostgreSQL streaming replication）
docker compose --profile replication up -d

# 全部
docker compose --profile monitoring --profile logging --profile replication up -d
```

| Profile | 包含服務 | 用途 |
|---------|---------|------|
| (default) | PG, Redis, MinIO, Outline, Homepage, TITAN App | 核心功能 |
| monitoring | Prometheus, Grafana, Alertmanager, exporters, Uptime Kuma | 可用性/效能監控 |
| logging | Loki, Promtail | 集中日誌 |
| replication | PG Replica, Failover Monitor | 資料庫高可用 |

---

## 7. 備份與還原

### 自動備份（建議設定 crontab）

```bash
# 每日凌晨 2 點全量備份
0 2 * * * cd /path/to/titan && bash scripts/backup.sh >> logs/backup.log 2>&1
```

### 手動備份

```bash
# 全量備份
bash scripts/backup.sh

# 僅 PostgreSQL
bash scripts/backup/backup-postgres.sh

# 僅 MinIO
bash scripts/backup/backup-minio.sh
```

### 還原

```bash
# 互動式全量還原
bash scripts/backup/restore.sh --all

# 還原最新 PostgreSQL 備份
bash scripts/backup/restore.sh --postgres latest
```

---

## 8. 故障排除

### 常用診斷指令

```bash
# 容器狀態
docker compose ps

# 特定服務日誌
docker compose logs titan-app --tail 50
docker compose logs postgres --tail 50

# 健康檢查
bash scripts/health-check.sh

# 資料庫深度檢查
bash scripts/db-health-check.sh

# 進入 PostgreSQL 互動
docker compose exec postgres psql -U titan -d titan
```

### 常見問題

| 問題 | 原因 | 解法 |
|------|------|------|
| titan-app 一直 restarting | DB 連線失敗 | 確認 postgres 容器 healthy：`docker compose logs postgres` |
| Prisma migration 失敗 | 網路未建立 | 確認 `docker network ls \| grep titan-internal` |
| 磁碟空間不足 | Docker 映像/日誌堆積 | `docker system prune -f` + 清理舊備份 |
| 建構時 npm 失敗 | 離線環境無法下載套件 | 確認 `node_modules` 存在或使用 `npm ci --prefer-offline` |

---

## 9. 回滾操作

### 回滾 TITAN App（最常見）

upgrade.sh 自動保留舊映像為 `titan-app:previous`：

```bash
# 1. 還原舊映像
docker tag titan-app:previous titan-app:latest

# 2. 重啟 titan-app（不影響其他服務）
docker compose up -d --no-deps titan-app

# 3. 確認健康
docker compose ps titan-app
```

### 回滾資料庫

upgrade.sh 自動在更新前備份到 `backups/pre-upgrade_*.sql.gz`：

```bash
# 1. 找到備份
ls -la backups/pre-upgrade_*.sql.gz

# 2. 還原
gunzip -c backups/pre-upgrade_20260328_143000.sql.gz \
  | docker compose exec -T postgres psql -U titan -d titan

# 3. 重啟 titan-app
docker compose restart titan-app
```

### 回滾程式碼

```bash
# 1. 找到前一版本
git log --oneline -5

# 2. 回退到指定 commit
git checkout <commit-hash>

# 3. 重建並更新
bash scripts/upgrade.sh --skip-pull
```
