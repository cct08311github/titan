---
name: titan-deploy
description: "TITAN 平台部署與維運技能。當使用者提到部署、更新、升級、上版、離線打包、健康檢查、備份還原、回滾、Docker Compose 操作、或任何與 TITAN 生產環境維運相關的事情時觸發。即使使用者只說「更新 Mac Mini」或「部署到生產」或「titan deploy」或「titan delpy」也要觸發。"
---

# TITAN Deploy

TITAN 平台的部署、更新、離線打包、健康檢查、備份還原、回滾操作指南。

## 操作模式

根據使用者意圖選擇對應流程：

| 使用者說 | 執行流程 |
|---------|---------|
| 「部署」「首次部署」「first deploy」 | → [首次部署](#首次部署) |
| 「更新」「升級」「上版」「update」 | → [版本更新](#版本更新) |
| 「離線打包」「air-gapped」「package」 | → [離線打包](#離線打包) |
| 「健康檢查」「health check」「狀態」 | → [健康檢查](#健康檢查) |
| 「備份」「還原」「restore」 | → [備份還原](#備份還原) |
| 「回滾」「rollback」「退版」 | → [回滾](#回滾) |

---

## 首次部署

適用於全新環境，從零開始。

### 前置條件

- Docker Engine + Docker Compose V2
- Node.js 22+, npm
- openssl（密鑰產生）
- 磁碟空間 > 20 GB

### 執行

```bash
# 一鍵自動化（產生密鑰 → .env → build → compose up → migration → seed → 健康檢查）
bash scripts/first-deploy.sh
```

腳本會自動：
1. 檢查前置條件
2. 產生所有密鑰（Postgres、Redis、MinIO、NextAuth、Outline）
3. 從 `.env.example` 建立 `.env`
4. `npm ci` → `npm run build` → `docker build`
5. `docker compose up -d`
6. 透過 `titan-migrate` 容器執行 Prisma DB Push
7. 載入種子資料
8. 健康檢查

### 首次部署後續

```bash
# SSL 憑證
bash scripts/generate-ssl-cert.sh

# 認證初始化
bash scripts/auth-init.sh

# 監控堆疊（可選）
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# 設定定時備份
crontab -e
# 加入: 0 2 * * * /path/to/scripts/backup.sh
```

---

## 版本更新

適用於已部署環境的更新。

### 標準更新流程

```bash
# 完整更新（git pull → 備份 → 重建 → migration → 滾動更新 → 健康檢查）
bash scripts/upgrade.sh

# 跳過 git pull（程式碼已手動更新時）
bash scripts/upgrade.sh --skip-pull

# 全量重建（含基礎設施映像更新）
bash scripts/upgrade.sh --full
```

### 手動更新（腳本失敗時的備案）

如果 `upgrade.sh` 中途失敗，按以下步驟手動完成：

```bash
# 1. 備份
docker compose exec -T postgres pg_dump -U titan -d titan --no-owner --no-acl | gzip > backups/pre-upgrade_$(date +%Y%m%d_%H%M%S).sql.gz

# 2. 標記舊映像
docker tag titan-app:latest titan-app:previous

# 3. 重建
npm ci --prefer-offline
npx prisma generate
npm run build

# 4. Docker build（Dockerfile 使用 flatten 後的 .next/standalone/）
docker build -t titan-app:latest .
docker build -f Dockerfile.migrate -t titan-migrate:latest .

# 5. 滾動更新
docker compose up -d --no-deps titan-app

# 6. 健康檢查
docker compose exec titan-app wget -qO- http://localhost:3100/api/health
```

### 已知問題

- **Next.js standalone 路徑**: `npm run build` 產生的 standalone 輸出嵌套在絕對路徑下（如 `.next/standalone/.openclaw/shared/projects/titan/`）。`upgrade.sh` 會自動 flatten 到 `.next/standalone/`，Dockerfile 也已對應調整。
- **Prisma v7 config**: `Dockerfile.migrate` 必須包含 `prisma.config.ts`，否則 Prisma 無法讀取 `DATABASE_URL`。
- **DB Migration 非必要**: 若 schema 未變更（僅程式碼更新），migration 失敗不影響服務。

---

## 離線打包

適用於 air-gapped 環境，在聯網機器打包所有映像。

### 打包（聯網機器）

```bash
# 完整打包（build + pull + docker save）
bash scripts/package-offline.sh

# 跳過重建（使用現有映像）
bash scripts/package-offline.sh --skip-build
```

產出：
- `dist/titan-offline-<date>.tar.gz` — 所有 Docker 映像壓縮包
- `dist/titan-offline-<date>.manifest` — 映像清單 + SHA-256

### 載入（目標機器）

```bash
# 載入映像
bash scripts/package-offline.sh --load dist/titan-offline-<date>.tar.gz

# 然後執行首次部署或更新
bash scripts/first-deploy.sh
# 或
bash scripts/upgrade.sh --skip-pull
```

### 包含的映像

| 映像 | 用途 |
|------|------|
| titan-app:latest | TITAN 主應用 |
| titan-migrate:latest | Prisma migration |
| postgres:16-alpine | 資料庫 |
| redis:7-alpine | 快取/佇列 |
| minio/minio:latest | S3 物件儲存 |
| outlinewiki/outline:1.6.1 | 知識庫 |
| gethomepage/homepage:v0.9.13 | 統一入口 |
| tecnativa/docker-socket-proxy:0.2 | Docker 安全代理 |
| prom/prometheus:v2.48.1 | 監控 |
| prom/node-exporter:v1.7.0 | 系統指標 |
| gcr.io/cadvisor/cadvisor:v0.47.2 | 容器指標 |

---

## 健康檢查

### 快速檢查

```bash
# 彩色報告
bash scripts/health-check.sh

# JSON 格式（適合自動化）
bash scripts/health-check.sh --json

# 靜默模式（僅 exit code）
bash scripts/health-check.sh --quiet
# exit 0=健康, 1=降級, 2=嚴重
```

### API 健康端點

```bash
# 應用層健康
docker compose exec titan-app wget -qO- http://localhost:3100/api/health
# 回應: {"status":"ok","checks":{"database":{"status":"ok"},"redis":{"status":"ok"}}}
```

### PostgreSQL 深度檢查

```bash
bash scripts/db-health-check.sh
```

### 容器狀態

```bash
docker compose ps
docker compose logs --tail=50 titan-app
```

---

## 備份還原

### 備份

```bash
# 全量備份
bash scripts/backup.sh

# 個別備份
bash scripts/backup/backup-postgres.sh
bash scripts/backup/backup-minio.sh
```

### 還原

```bash
# 全部還原
bash scripts/backup/restore.sh --all

# 僅 PostgreSQL
bash scripts/backup/restore.sh --postgres latest

# 緊急手動還原
gunzip < backups/<file>.sql.gz | docker compose exec -T postgres psql -U titan -d titan
```

### 自動備份排程

```bash
crontab -e
# 每日 02:00 全量備份
0 2 * * * /path/to/titan/scripts/backup.sh
# 每 6 小時 PostgreSQL 備份
0 */6 * * * /path/to/titan/scripts/backup/backup-postgres.sh
```

---

## 回滾

### App 快速回滾（最常用）

upgrade.sh 會自動標記舊映像為 `titan-app:previous`。

```bash
docker tag titan-app:previous titan-app:latest
docker compose up -d --no-deps titan-app
```

### 資料庫回滾

```bash
# 找到更新前的備份
ls -la backups/pre-upgrade_*.sql.gz

# 還原
gunzip < backups/pre-upgrade_<timestamp>.sql.gz | docker compose exec -T postgres psql -U titan -d titan
```

### 完整環境回滾

```bash
# 1. 停止服務
docker compose down

# 2. 還原映像
docker tag titan-app:previous titan-app:latest

# 3. 還原資料庫
docker compose up -d postgres redis
sleep 10
gunzip < backups/pre-upgrade_<timestamp>.sql.gz | docker compose exec -T postgres psql -U titan -d titan

# 4. 啟動全部服務
docker compose up -d
```

---

## 服務拓撲速查

```
Nginx Proxy (TLS) ─┬─ Homepage (:3000) ─── 統一入口
                    ├─ TITAN App (:3100) ── 主應用（Next.js）
                    ├─ Outline (:3001) ──── 知識庫
                    └─ Uptime Kuma (:3002) ─ 可用性監控

共用基礎設施（titan-internal 網路）：
  PostgreSQL 16 ─── 共用資料庫
  Redis 7 ──────── 快取/佇列
  MinIO ─────────── S3 物件儲存
```

## 關鍵埠號

| 服務 | 容器名稱 | 內部埠 | 預設外部埠 |
|------|---------|--------|-----------|
| TITAN App | titan-app | 3100 | 透過 Nginx |
| Homepage | titan-homepage | 3000 | 3000 |
| PostgreSQL | titan-postgres | 5432 | 不暴露 |
| Redis | titan-redis | 6379 | 不暴露 |
| MinIO | titan-minio | 9000 | 不暴露 |
| MinIO Console | titan-minio | 9001 | 9001 |

## 執行前確認清單

每次部署/更新前，確認：

- [ ] Docker daemon 運行中（`docker info`）
- [ ] `.env` 存在且密鑰已設定
- [ ] 磁碟空間 > 10 GB（`df -h`）
- [ ] 已備份資料庫（`scripts/backup/backup-postgres.sh`）
- [ ] 知道如何回滾（`docker tag titan-app:previous titan-app:latest`）
