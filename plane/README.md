# Plane 專案管理系統 — 部署指南
# 任務: T12 — Plane 基礎部署

## 概述

Plane 是一個開源專案管理平台，可作為 Jira、Linear、Monday 的替代方案。本設定使用 TITAN 共享基礎設施（PostgreSQL、Redis、MinIO）部署。

## 架構

```
                    ┌─────────────────┐
                    │  Nginx Proxy    │
                    │  (8083)         │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │  Web    │         │  Admin  │         │  Space  │
   │ (8080)  │         │ (8081)  │         │ (8082)  │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Server   │
                    │   (8000)       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ Worker  │         │  Beat   │         │  Live   │
   │         │         │         │         │ (3002)  │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ PostgreSQL│        │  Redis  │         │ RabbitMQ│
   │ (5432)  │         │ (6379)  │         │ (5673)  │
   └─────────┘         └─────────┘         └─────────┘
                             │
                    ┌────────▼────────┐
                    │     MinIO      │
                    │     (9000)     │
                    └─────────────────┘
```

## 前置需求

1. **共享服務已啟動**：確保 `docker-compose.yml`（根目錄）的 PostgreSQL、Redis、MinIO 正在運行
2. **網路已建立**：確保 `titan-network` 網路存在
   ```bash
   docker network create titan-network
   ```
3. **環境變數已設定**：確保 `.env` 中包含 Plane 相關變數
4. **MinIO Bucket 已建立**：
   - 登入 MinIO Console (http://localhost:9001)
   - 建立名為 `plane-uploads` 的 bucket

## 部署步驟

### 1. 首次部署（Migration）

```bash
cd plane
docker compose up -d plane-migrator
# 等待 migration 完成（約 2-5 分鐘）
docker compose logs -f plane-migrator
```

確認 migration 完成後，停止 migrator：
```bash
docker compose stop plane-migrator
```

### 2. 啟動所有服務

```bash
cd plane
docker compose up -d
```

### 3. 驗證服務狀態

```bash
# 查看所有容器
docker compose ps

# 檢查健康狀態
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

### 4. 存取 Plane

- **主入口**：http://localhost:8083
- **Web UI**：http://localhost:8080
- **Admin**：http://localhost:8081
- **API**：http://localhost:8083/api/

## 環境變數說明

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `PLANE_SECRET_KEY` | 認證用 secret key（必填） | - |
| `PLANE_SITE_URL` | 對外 URL | http://localhost:8083 |
| `PLANE_S3_BUCKET` | MinIO bucket 名稱 | plane-uploads |
| `RABBITMQ_USER` | RabbitMQ 使用者 | plane |
| `RABBITMQ_PASSWORD` | RabbitMQ 密碼 | changeme_plane_mq |

## 健康檢查

每個服務都配置了 health check：

```bash
# 檢查單一服務
docker inspect --format='{{.State.Health.Status}}' titan-plane-api
```

## 停止與移除

```bash
cd plane
docker compose down

# 移除 volume（慎用！）
docker compose down -v
```

## 故障排除

### Migration 失敗
- 檢查 PostgreSQL 連線是否正常
- 確認 `DB_SCHEMA: plane` 在資料庫中是否存在（需手动创建）
- 查看日誌：`docker compose logs plane-migrator`

### API 啟動失敗
- 檢查 Redis 密碼是否正確
- 確認 RabbitMQ 是否正常運作
- 查看日誌：`docker compose logs plane-api`

### 檔案上傳失敗
- 確認 MinIO bucket `plane-uploads` 已建立
- 檢查 AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY 正確性

## 維護

### 更新 Plane 版本
1. 修改 `docker-compose.yml` 中的 image tag
2. 重新 pull：`docker compose pull`
3. 重啟：`docker compose up -d`

### 備份
- PostgreSQL：自動 volume 持久化
- Redis：自動 volume 持久化
- 上傳檔案：`plane-uploads` volume