# Plane 快速啟動說明

> 任務：T12 — Plane 基礎部署
> 詳細部署文件：[../../docs/plane-setup.md](../../docs/plane-setup.md)

---

## 前置條件

- TITAN 核心服務已啟動（`docker compose up -d`）
- PostgreSQL 已建立 `plane_db` 資料庫與 `plane_user` 使用者
- 確認 `titan-network` Docker 網路已存在：`docker network ls | grep titan-network`

---

## 快速啟動步驟

### 1. 準備環境變數

```bash
# 複製範本
cp config/plane/.env.example config/plane/.env

# 編輯並填入實際值（至少修改以下項目）
# - SECRET_KEY
# - DATABASE_URL（plane_user 密碼）
# - REDIS_URL（Redis 密碼）
# - AWS_SECRET_ACCESS_KEY（MinIO 密碼）
# - WEB_URL（實際存取 URL）
vim config/plane/.env
```

### 2. 取得 Plane docker-compose（需先在有網路的機器操作）

```bash
# 下載官方 compose 檔案
curl -fsSL \
  https://raw.githubusercontent.com/makeplane/plane/stable/deploy/selfhost/docker-compose.yml \
  -o /opt/titan/plane-docker-compose.yml
```

### 3. 隔離網路：匯入映像

```bash
# 若為隔離網路部署，先載入預先匯出的映像
bash scripts/plane-image-import.sh
```

### 4. 執行資料庫 Migration

```bash
docker compose -f /opt/titan/plane-docker-compose.yml \
  --env-file config/plane/.env \
  run --rm plane-migrator
```

### 5. 啟動 Plane 服務

```bash
docker compose -f /opt/titan/plane-docker-compose.yml \
  --env-file config/plane/.env \
  up -d
```

### 6. 建立管理員帳號

```bash
docker compose -f /opt/titan/plane-docker-compose.yml \
  --env-file config/plane/.env \
  run --rm plane-api python manage.py createsuperuser
```

### 7. 開啟 Plane UI

瀏覽器前往：`http://<SERVER_IP>:8082`

---

## 重要環境變數速查

| 變數名稱             | 說明                         | 範例值                          |
|----------------------|------------------------------|---------------------------------|
| `WEB_URL`            | 對外存取 URL                 | `http://10.0.1.100:8082`        |
| `SECRET_KEY`         | Django 加密金鑰（必填）      | 50 位以上隨機字串               |
| `DATABASE_URL`       | PostgreSQL 連線字串          | `postgresql://plane_user:pw@titan-postgres:5432/plane_db` |
| `REDIS_URL`          | Redis 連線字串               | `redis://:pw@titan-redis:6379/1` |
| `AWS_S3_BUCKET_NAME` | MinIO bucket 名稱            | `plane-uploads`                 |
| `NGINX_PORT`         | 對外 Port（預設 8082）       | `8082`                          |
| `ALLOW_SIGNUPS`      | 是否開放自行註冊             | `0`（銀行環境建議關閉）         |
| `TELEMETRY_ENABLED`  | 遙測資料（隔離網路設為 0）   | `0`                             |

---

## 驗證服務正常

```bash
# 查看所有 Plane 容器狀態
docker compose -f /opt/titan/plane-docker-compose.yml ps

# 快速健康檢查
curl -s http://localhost:8082/ | grep -o "<title>.*</title>"
```

---

## 停止服務

```bash
docker compose -f /opt/titan/plane-docker-compose.yml \
  --env-file config/plane/.env \
  down
```

---

詳細說明、OIDC 整合、故障排除請參閱：[docs/plane-setup.md](../../docs/plane-setup.md)
