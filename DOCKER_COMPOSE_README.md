# T07: 容器平台建置

## 概述
本任務完成 Titan 專案的 Docker Compose 基礎設施建置。

## 已完成
- [x] PostgreSQL 15 配置（資料持久化）
- [x] Redis 7 配置（附 healthcheck）
- [x] 私有 Registry 匯入策略文件
- [x] 環境變數範本 (.env.example)

## 使用方式

### 1. 複製環境變數範本
```bash
cp .env.example .env
# 編輯 .env 填入實際值
```

### 2. 啟動服務

```bash
# 僅核心服務（postgres, redis, minio, outline, homepage, titan-app）
docker compose up -d

# 核心 + 監控（Prometheus, Grafana, Alertmanager, exporters, Uptime Kuma）
docker compose --profile monitoring up -d

# 核心 + 監控 + 日誌聚合（Loki + Promtail）
docker compose --profile monitoring --profile logging up -d

# 核心 + 資料庫複製（Primary-Replica + Failover Monitor）
docker compose --profile replication up -d

# 全部服務
docker compose --profile monitoring --profile logging --profile replication up -d
```

### 3. 驗證服務狀態
```bash
docker compose ps
docker compose logs -f
```

### 4. 停止服務
```bash
docker compose down
```

## 私有 Registry 策略

### 使用外部私有 Registry（如 Harbor）
1. 登入 Registry：
   ```bash
   echo "$HARBOR_PASSWORD" | docker login harbor.titan.internal --username="$HARBOR_USER" --password-stdin
   ```
2. 在 docker-compose.override.yml 中覆寫 image：
   ```yaml
   services:
     app:
       image: harbor.titan.internal/myapp:latest
   ```

### 本地 Registry（可選）
若需建立本地私有 Registry：
```bash
docker run -d -p 5000:5000 --name registry -v registry-data:/var/lib/registry registry:2
```

## TITAN Next.js 應用容器（Issue #185）

### 容器規格

| 項目 | 說明 |
|------|------|
| Dockerfile | 多階段建置（deps → builder → runner） |
| 基底映像 | `node:20-alpine` |
| 建置產出 | Next.js standalone output（`server.js`） |
| 執行使用者 | `nextjs`（UID 1001，非 root） |
| 暴露埠號 | 3100（容器內部），透過 Nginx 反向代理對外 |
| 健康檢查 | `GET /api/auth/csrf`（30s 間隔） |
| 資源限制 | CPU 2 核 / 記憶體 1024MB |

### 必要環境變數

| 變數 | 說明 | 範例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://titan:password@postgres:5432/titan` |
| `REDIS_URL` | Redis 連線字串 | `redis://:password@redis:6379` |
| `NEXTAUTH_URL` | 應用對外 URL（含路徑） | `https://titan.bank.local/titan` |
| `NEXTAUTH_SECRET` | NextAuth 加密金鑰（必填） | `openssl rand -hex 32` 產生 |
| `NODE_ENV` | 執行環境 | `production` |

### 部署方式

```bash
# 生產環境（與其他服務一起啟動）
docker compose up -d titan-app

# 單獨重建（程式碼更新後）
docker compose build titan-app
docker compose up -d titan-app

# 查看日誌
docker logs -f titan-app

# 健康狀態
docker inspect --format='{{.State.Health.Status}}' titan-app
```

### 網路拓撲

```
外部使用者 → Nginx（:443）→ titan-app（:3100）→ postgres / redis
                                          ↑ titan-internal 網路
```

`titan-app` 不直接暴露端口至主機，所有外部存取透過 Nginx 反向代理。

## 依賴
- T06: 需先完成基礎設施規劃

## 維運
- 資料 volume 預設掛載至 Docker 無名 volume
- 生產環境建議使用具名 volume 或 bind mount
