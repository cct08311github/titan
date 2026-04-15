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
- **titan-migrate 跑的是 `prisma db push` 而非 `migrate deploy`**: 見 `Dockerfile.migrate` 的 `CMD`。這代表生產 DB 的 `_prisma_migrations` table 一直是空的，schema 變更靠 `db push` 直接對齊 `schema.prisma`。CI 的 `test` job 反而跑 `prisma migrate deploy`，兩條路徑不同——**如果有任何 model 只靠 `db push` 建過 table 而沒有對應 migration file，CI 會在第一個 ALTER 該 table 的 migration 爆 `relation "X" does not exist`**（2026-04-15 T1463 案例：`recurring_rules`）。新增 model 時一律補 `prisma/migrations/<ts>_create_X_table/migration.sql`，並用 `CREATE TABLE IF NOT EXISTS` + `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$` 包 enum 和 FK 以對生產相容。
- **本地驗證 migration**: 推 PR 前用 throwaway postgres 確認，避免 CI red：
  ```bash
  docker network create titan-ci-test
  docker run -d --name titan-pg-ci --network titan-ci-test \
    -e POSTGRES_USER=titan -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=titan postgres:16-alpine
  sleep 4
  docker run --rm --network titan-ci-test \
    -v "$PWD/prisma:/app/prisma:ro" -v "$PWD/prisma.config.ts:/app/prisma.config.ts:ro" \
    -w /app -e DATABASE_URL='postgresql://titan:ci@titan-pg-ci:5432/titan' \
    --entrypoint sh node:20-alpine -c \
    'apk add --no-cache openssl >/dev/null && npm init -y >/dev/null 2>&1 \
     && npm install prisma@7.6.0 dotenv --silent 2>&1 | tail -1 \
     && npx prisma migrate deploy'
  docker rm -f titan-pg-ci && docker network rm titan-ci-test
  ```

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
| Nginx HTTP | titan-nginx | 80 | `NGINX_HTTP_PORT` (預設 8080) |
| Nginx HTTPS | titan-nginx | 443 | `NGINX_HTTPS_PORT` (預設 8443) |
| Nginx Outline | titan-nginx | 8443 | `NGINX_OUTLINE_PORT` (預設 8444) |

## Nginx 反向代理

Nginx 定義在**獨立的 compose file**：`nginx/docker-compose.yml`，**不是** root `docker-compose.yml` 的一部分。這代表：

```bash
# ❌ 不會啟動 nginx
docker compose up -d

# ✅ 需要 explicit 指定檔案 + --env-file
docker compose -f nginx/docker-compose.yml --env-file .env up -d

# force recreate（改 port 或 compose 設定後需要）
docker compose -f nginx/docker-compose.yml --env-file .env up -d --force-recreate
```

**為什麼需要 `--env-file .env`**: compose v2 只會自動讀取**與 compose file 同目錄**的 `.env`。因為 `nginx/docker-compose.yml` 在 `nginx/` 子目錄，它不會自動吃到根目錄的 `.env`，導致 `NGINX_HTTP_PORT` 等變數 fallback 到 compose file 裡的 `${VAR:-default}`。

### Port 衝突

`NGINX_HTTP_PORT=8080` 預設值常跟其他本機服務衝突（Python dev server、Grafana 舊版、cAdvisor 等）。本機若 `lsof -iTCP:8080 -sTCP:LISTEN` 有佔用，改為 `NGINX_HTTP_PORT=8090` 或其他 free port。

### 與 Tailscale Serve 整合

生產環境透過 `tailscale serve` 把 TITAN 發佈到 tailnet 上：

```bash
# 把 TITAN nginx 綁到 tailnet 根路徑
tailscale serve --bg https+insecure://127.0.0.1:8443

# 若需要跟其他 web app 共存（例如 family-ledger-web），用 path 路由
tailscale serve --bg --set-path=/family-ledger-web http://127.0.0.1:3013

# 查看目前路由
tailscale serve status
```

`https+insecure://` 是因為 titan-nginx 使用 self-signed 憑證，tailscale 前端會重簽合法憑證給 tailnet 使用者。

---

## 生產環境故障排除

### `.env` 常見陷阱（T1460 學到的）

生產 `.env` 最容易出現以下 4 種問題，任一個都會讓 upgrade / force recreate 失敗：

1. **literal shell expansion 未展開**: 值裡出現 `$(openssl rand -hex 32)` 字面字串，代表當初有人把 `.env.example` 複製過來但沒真的跑 shell 展開。這在 JWT/session 相關欄位（`AUTH_SECRET`、`NEXTAUTH_SECRET`）會讓 Auth.js 永遠用同一個可預測字串當 HMAC key。
2. **container_name vs service name 搞混**: `DATABASE_URL=postgresql://titan:...@titan-db:5432/titan` 是錯的——`titan-db` 是 container_name，但 compose 內部 DNS 解析用的是 **service name**（看 `docker-compose.yml` 的 service key），實際是 `postgres`。`DATABASE_URL` host 應該是 `postgres`、`REDIS_URL` host 應該是 `redis`。
3. **新 compose 變數未補**: 升級到含新 service 的版本後，`.env` 缺 `CRON_SECRET` / `NGINX_HTTP_PORT` / `NGINX_HTTPS_PORT` / `NGINX_OUTLINE_PORT` 等變數，會讓 `docker compose config` / `up` 在解析時 fail with `required variable X is missing a value`。
4. **URL 指向過期的對外入口**: `TITAN_URL` / `NEXTAUTH_URL` 應該指向 tailscale / nginx 入口（`https://mac-mini.tailde842d.ts.net`），不是 `http://...:3100`。

### 從 running container 重建 `.env`（救援流程）

當 `.env` 壞掉但 running container 還健康時（例如舊容器是用另一份現在已遺失的 `.env` 啟動的），**不要**直接 force recreate——新容器會拿到壞的值。先從 running state 把實際環境變數撈出來當 baseline：

```bash
# Dump 關鍵容器的 env
docker inspect titan-app --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E "AUTH_SECRET|NEXTAUTH|DATABASE_URL|REDIS|CRON_SECRET|TITAN_URL"
docker inspect titan-outline --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E "SECRET_KEY|UTILS_SECRET|DATABASE_URL|REDIS_URL|URL"
docker inspect titan-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep POSTGRES
docker inspect titan-redis --format '{{.Config.Cmd}}'   # redis password 在 cmd args
docker inspect titan-minio --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep MINIO
```

**關鍵：絕對不能隨便換 `OUTLINE_SECRET_KEY` / `OUTLINE_UTILS_SECRET`**——Outline 用它做 column-level 加密（integration secrets 等），換掉舊加密欄位會讀不出、且無法復原。`AUTH_SECRET` / `NEXTAUTH_SECRET` 只用於 JWT 簽發，換掉只會讓現有 session 失效、不影響 DB（T1460 驗證過）。

先把 `.env` 備份（`.env.backup-<ticket>-<ts>`），再用 dump 出來的值重寫，然後 `docker compose up -d --force-recreate` 對應服務。

### `upgrade.sh` Step 3 / Step 5 失敗排查

從 T1461 開始 `upgrade.sh` 在 Step 1 preflight 會跑 `docker compose config --quiet`，若 `.env` 缺變數會直接 fail fast 並印出 compose 的 validation error。舊版的失敗徵兆是 Step 3 備份噴 `WARN 備份失敗` 但看不到任何原因（因為 `2>/dev/null`），或 Step 5 migration 噴 `P1000 Authentication failed`——兩者常常是**同一個 env 問題**（尤其 `.env` 的 DATABASE_URL host 寫錯、或缺 `CRON_SECRET` 造成整個 compose 解析失敗）。手動復現 + 看 real error：

```bash
cd /path/to/titan
docker compose config --quiet                # 檢查 .env 是否完整
docker compose exec -T postgres pg_dump -U titan -d titan --no-owner --no-acl > /tmp/t.sql  # 不 pipe 不 silent
```

### 生產部署 clone 位置

生產運行的 clone **不一定**是你當前 shell 的 cwd。用 `docker inspect` 確認：

```bash
docker inspect titan-nginx --format '{{range .HostConfig.Binds}}{{println .}}{{end}}'
```

輸出會是 `<host-path>:/etc/nginx/nginx.conf:ro` 形式，左邊就是實際生產 clone 的絕對路徑。升級時務必 `cd` 到那個路徑再跑 `scripts/upgrade.sh`。

---

## 執行前確認清單

每次部署/更新前，確認：

- [ ] Docker daemon 運行中（`docker info`）
- [ ] `.env` 存在且密鑰已設定
- [ ] `docker compose config --quiet` 通過（驗證 `.env` 變數完整，避免 T1461 pitfall）
- [ ] `cd` 到實際生產 clone（用 `docker inspect titan-nginx --format '{{range .HostConfig.Binds}}{{println .}}{{end}}'` 確認）
- [ ] 磁碟空間 > 10 GB（`df -h`）
- [ ] 已備份資料庫（`scripts/backup/backup-postgres.sh`）
- [ ] 知道如何回滾（`docker tag titan-app:previous titan-app:latest`）
- [ ] 若本次有 schema 變更：新 migration 先在 throwaway postgres 驗證（見「版本更新 → 本地驗證 migration」）
