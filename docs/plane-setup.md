# Plane 自架部署指南（隔離網路環境）

> 任務：T12 — Plane 基礎部署
> 適用版本：Plane v0.23.x（stable）
> 環境：銀行內網 / Air-Gapped 部署

---

## 目錄

1. [架構概覽](#1-架構概覽)
2. [取得官方 Docker Compose](#2-取得官方-docker-compose)
3. [隔離網路部署流程](#3-隔離網路部署流程)
4. [整合 TITAN 現有 PostgreSQL 與 Redis](#4-整合-titan-現有-postgresql-與-redis)
5. [初始化 Workspace 與專案](#5-初始化-workspace-與專案)
6. [OIDC / LDAP 整合說明](#6-oidc--ldap-整合說明)
7. [網路整合：加入 titan-network](#7-網路整合加入-titan-network)
8. [健康檢查與故障排除](#8-健康檢查與故障排除)

---

## 1. 架構概覽

Plane 採用微服務架構，由以下容器組成：

| 容器名稱           | 映像                           | 職責說明                                   |
|--------------------|--------------------------------|--------------------------------------------|
| `plane-web`        | `makeplane/plane-frontend`     | Next.js 前端 UI                            |
| `plane-api`        | `makeplane/plane-backend`      | Django REST API 後端                       |
| `plane-worker`     | `makeplane/plane-backend`      | Celery 非同步任務 Worker                   |
| `plane-beat`       | `makeplane/plane-backend`      | Celery Beat 排程任務                       |
| `plane-migrator`   | `makeplane/plane-backend`      | 資料庫 Migration（初始化時執行）           |
| `plane-proxy`      | `makeplane/plane-proxy`        | Nginx 反向代理（統一入口，port 80/443）    |
| `plane-postgres`   | `postgres:15.5-alpine`         | Plane 專用資料庫（可替換為 TITAN 共用 DB） |
| `plane-redis`      | `redis:7.2.4-alpine`           | Plane 專用快取與任務佇列（可替換為共用）   |
| `plane-minio`      | `minio/minio`                  | Plane 附件物件儲存（可替換為 TITAN MinIO） |

> **重要**：Plane 的 API、Worker、Beat 三個服務使用同一個映像，透過不同的啟動指令區分角色。

### 資料流向

```
使用者瀏覽器
     │
     ▼
plane-proxy (Nginx :80)
     │
     ├─► plane-web  (Next.js :3000)  ─► 靜態頁面渲染
     │
     └─► plane-api  (Django :8000)   ─► REST API
              │
              ├─► PostgreSQL          ─► 持久化儲存
              ├─► Redis               ─► 快取 / 任務佇列
              └─► MinIO               ─► 附件上傳
              │
         plane-worker ◄── Celery 任務消費
         plane-beat   ◄── 定時排程觸發
```

---

## 2. 取得官方 Docker Compose

### 有網路環境（先在外部機器操作）

```bash
# 方法一：直接下載官方安裝腳本
curl -fsSL https://raw.githubusercontent.com/makeplane/plane/master/deploy/selfhost/install.sh -o plane-install.sh
bash plane-install.sh

# 方法二：手動下載 docker-compose
curl -fsSL https://raw.githubusercontent.com/makeplane/plane/stable/deploy/selfhost/docker-compose.yml \
  -o plane-docker-compose.yml

curl -fsSL https://raw.githubusercontent.com/makeplane/plane/stable/deploy/selfhost/plane.env \
  -o plane.env
```

### 確認版本（建議固定版本號）

```bash
# 查詢最新 stable tag
curl -s https://api.github.com/repos/makeplane/plane/releases/latest | jq -r '.tag_name'

# 建議使用固定版本，例如 v0.23.0
PLANE_VERSION=v0.23.0
```

---

## 3. 隔離網路部署流程

### 步驟一：在有網路的機器上匯出所有映像

```bash
#!/bin/bash
# 腳本：scripts/plane-image-export.sh

PLANE_VERSION="0.23.0"

IMAGES=(
  "makeplane/plane-frontend:${PLANE_VERSION}"
  "makeplane/plane-backend:${PLANE_VERSION}"
  "makeplane/plane-proxy:${PLANE_VERSION}"
  "postgres:15.5-alpine"
  "redis:7.2.4-alpine"
  "minio/minio:RELEASE.2024-01-01T00-00-00Z"
)

mkdir -p plane-images

for IMAGE in "${IMAGES[@]}"; do
  echo "正在拉取：${IMAGE}"
  docker pull "${IMAGE}"
  FILENAME=$(echo "${IMAGE}" | tr '/:' '--')
  echo "正在匯出：${FILENAME}.tar"
  docker save "${IMAGE}" -o "plane-images/${FILENAME}.tar"
done

echo "完成！已匯出 ${#IMAGES[@]} 個映像至 plane-images/"
ls -lh plane-images/
```

### 步驟二：傳輸至隔離網路機器

```bash
# 使用 USB 或內部 SCP 傳輸
scp -r plane-images/ deploy@bank-server:/opt/titan/plane-images/
scp plane-docker-compose.yml deploy@bank-server:/opt/titan/
scp config/plane/.env.example deploy@bank-server:/opt/titan/plane/.env
```

### 步驟三：在隔離網路機器上載入映像

```bash
#!/bin/bash
# 腳本：scripts/plane-image-import.sh

IMAGE_DIR="/opt/titan/plane-images"

for TAR_FILE in "${IMAGE_DIR}"/*.tar; do
  echo "正在載入：${TAR_FILE}"
  docker load -i "${TAR_FILE}"
done

echo "已載入映像清單："
docker images | grep -E "makeplane|postgres|redis|minio"
```

### 步驟四：確認映像完整性

```bash
# 確認所有必要映像均已載入
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | \
  grep -E "makeplane|postgres.*15|redis.*7|minio"
```

---

## 4. 整合 TITAN 現有 PostgreSQL 與 Redis

### 4.1 在 TITAN PostgreSQL 建立 Plane 專用資料庫

```sql
-- 連線至 TITAN PostgreSQL
-- psql -h localhost -U titan -d titan

-- 建立 Plane 資料庫與使用者
CREATE DATABASE plane_db;
CREATE USER plane_user WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE plane_db TO plane_user;
ALTER DATABASE plane_db OWNER TO plane_user;

-- 確認建立成功
\l plane_db
```

### 4.2 在 TITAN Redis 為 Plane 分配獨立 DB 編號

TITAN 現有 Redis 使用 DB 0（Outline）。Plane 使用 DB 1，避免鍵值衝突：

```bash
# 測試 Redis 連線
redis-cli -h localhost -p 6379 -a "${REDIS_PASSWORD}" -n 1 ping
# 預期回應：PONG
```

### 4.3 修改 Plane 環境變數指向 TITAN 基礎設施

在 `config/plane/.env` 中設定（參考 `.env.example`）：

```dotenv
# 資料庫：指向 TITAN 共用 PostgreSQL
DATABASE_URL=postgresql://plane_user:your_password@titan-postgres:5432/plane_db

# 快取：指向 TITAN 共用 Redis（使用 DB 1）
REDIS_URL=redis://:${REDIS_PASSWORD}@titan-redis:6379/1

# 物件儲存：指向 TITAN 共用 MinIO
AWS_S3_ENDPOINT_URL=http://titan-minio:9000
AWS_ACCESS_KEY_ID=${MINIO_ROOT_USER}
AWS_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD}
AWS_S3_BUCKET_NAME=plane-uploads
```

### 4.4 調整 docker-compose.yml 移除獨立資料庫服務

在 Plane 的 docker-compose.yml 中，將 `plane-postgres`、`plane-redis`、`plane-minio` 服務區段註解或移除，並在 Plane 服務中加入 `external_links` 或使用共同網路：

```yaml
# plane-docker-compose.yml 修改範例
services:
  plane-api:
    image: makeplane/plane-backend:0.23.0
    environment:
      - DATABASE_URL=postgresql://plane_user:password@titan-postgres:5432/plane_db
      - REDIS_URL=redis://:password@titan-redis:6379/1
    networks:
      - titan-network    # 加入 TITAN 共用網路
    # 移除對 plane-postgres / plane-redis 的 depends_on

networks:
  titan-network:
    external: true       # 使用 TITAN 既有網路
```

---

## 5. 初始化 Workspace 與專案

### 5.1 執行資料庫 Migration

```bash
# 在 plane-migrator 容器執行（一次性）
docker compose -f plane-docker-compose.yml run --rm plane-migrator

# 確認 Migration 成功
docker compose -f plane-docker-compose.yml run --rm plane-api \
  python manage.py showmigrations | tail -20
```

### 5.2 建立管理員帳號

```bash
docker compose -f plane-docker-compose.yml run --rm plane-api \
  python manage.py createsuperuser
# 輸入：Email、姓名、密碼
```

### 5.3 透過 UI 初始化 Workspace

1. 開啟瀏覽器進入 `http://<TITAN_HOST>:8082`（或設定的 port）
2. 使用管理員帳號登入
3. 建立 Workspace：
   - **名稱**：TITAN（或銀行部門名稱）
   - **Slug**：`titan`（URL 識別碼）
4. 邀請初始成員

### 5.4 建立標準專案結構

建議為銀行 IT 建立以下初始專案：

| 專案名稱           | 說明                         | 預設成員角色 |
|--------------------|------------------------------|--------------|
| 系統維運           | 日常維運、障礙處理            | DevOps Team  |
| 開發迭代           | 功能開發、技術債              | Dev Team     |
| 變更管理（CR）     | 正式變更申請流程              | All IT       |
| 資安與合規         | 資安事件、合規追蹤            | Security     |
| TITAN 平台建置     | TITAN 自身的建置任務追蹤      | All          |

### 5.5 設定預設標籤（Labels）

在每個專案中建立以下標籤（可透過 API 批次建立）：

```bash
# 使用 Plane API 批次建立標籤
# 先取得 API Token：設定 > API Tokens > 建立

PLANE_URL="http://localhost:8082"
API_TOKEN="your_api_token"
WORKSPACE_SLUG="titan"
PROJECT_ID="your_project_id"

LABELS=(
  '{"name":"緊急","color":"#FF0000"}'
  '{"name":"高優先","color":"#FF6B00"}'
  '{"name":"中優先","color":"#FFD700"}'
  '{"name":"低優先","color":"#00AA00"}'
  '{"name":"待評估","color":"#808080"}'
  '{"name":"資安","color":"#8B0000"}'
  '{"name":"合規","color":"#000080"}'
  '{"name":"技術債","color":"#9B59B6"}'
)

for LABEL in "${LABELS[@]}"; do
  curl -s -X POST \
    "${PLANE_URL}/api/v1/workspaces/${WORKSPACE_SLUG}/projects/${PROJECT_ID}/labels/" \
    -H "X-Api-Key: ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${LABEL}"
done
```

### 5.6 設定任務狀態（States）

建議狀態流程（符合 ITIL 流程）：

```
待辦（Backlog） → 分析中（In Analysis） → 進行中（In Progress）
                                              │
                         ┌────────────────────┤
                         ▼                    ▼
                   待審核（In Review）   已封鎖（Blocked）
                         │
                         ▼
                   測試中（Testing）
                         │
                         ▼
                   已完成（Done）
                         │
                         ▼
                   已取消（Cancelled）
```

---

## 6. OIDC / LDAP 整合說明

### 6.1 OIDC 整合（Keycloak / 其他 IdP）

Plane 支援 OIDC（OpenID Connect）單一登入。需在 `plane.env` 中設定：

```dotenv
# OIDC 設定（需搭配 T09 Keycloak 或現有 IdP）
OIDC_CLIENT_ID=plane
OIDC_CLIENT_SECRET=your_client_secret
OIDC_TOKEN_ENDPOINT=https://keycloak.bank.internal/realms/titan/protocol/openid-connect/token
OIDC_USERINFO_ENDPOINT=https://keycloak.bank.internal/realms/titan/protocol/openid-connect/userinfo
OIDC_AUTH_ENDPOINT=https://keycloak.bank.internal/realms/titan/protocol/openid-connect/auth
OIDC_JWKS_URI=https://keycloak.bank.internal/realms/titan/protocol/openid-connect/certs

# 如 IdP 使用自簽憑證（銀行內網常見）
OIDC_SSL_VERIFY=false
```

在 Keycloak 中建立 Plane Client：
1. **Client ID**：`plane`
2. **Client Protocol**：`openid-connect`
3. **Access Type**：`confidential`
4. **Valid Redirect URIs**：`http://<TITAN_HOST>:8082/auth/oidc/callback/`
5. **Web Origins**：`http://<TITAN_HOST>:8082`

### 6.2 LDAP 整合說明

> **注意**：Plane 原生不支援 LDAP 直連，建議透過以下方案整合：

**方案一（建議）**：透過 Keycloak LDAP Federation
- 在 Keycloak 設定 LDAP User Federation
- Plane 透過 OIDC 對接 Keycloak
- 使用者從 LDAP 同步至 Keycloak，再由 Keycloak 提供給 Plane

**方案二**：透過 Authelia / Authentik
- 設定 LDAP 連線
- 提供 OIDC 端點給 Plane

### 6.3 角色映射

在 Keycloak 中設定 Group → Role 映射：

| LDAP/AD 群組          | Plane 角色  | 說明           |
|-----------------------|-------------|----------------|
| `CN=IT-Admin`         | `ADMIN`     | 全功能管理員   |
| `CN=IT-Developer`     | `MEMBER`    | 一般成員       |
| `CN=IT-Viewer`        | `VIEWER`    | 唯讀檢視       |
| `CN=IT-Manager`       | `MEMBER`    | 可建立/分配    |

---

## 7. 網路整合：加入 titan-network

### 7.1 讓 Plane 加入 TITAN 網路

修改 Plane 的 docker-compose 網路設定：

```yaml
# 在 plane-docker-compose.yml 中，所有服務加入 titan-network
networks:
  titan-network:
    external: true    # 使用 TITAN 主 compose 建立的網路
  plane-internal:
    driver: bridge    # Plane 內部通訊專用（不對外暴露）

# 每個 plane 服務加入兩個網路
services:
  plane-web:
    networks:
      - titan-network
      - plane-internal
  plane-api:
    networks:
      - titan-network
      - plane-internal
  plane-proxy:
    networks:
      - titan-network
    ports:
      - "8082:80"   # 對外只暴露 proxy
```

### 7.2 Homepage 儀表板加入 Plane 服務

在 `config/homepage/services.yaml` 中新增：

```yaml
- 專案管理:
    - Plane:
        icon: plane.png
        href: "http://{{HOSTNAME}}:8082"
        description: "TITAN 任務追蹤與專案管理"
        server: my-docker
        container: plane-proxy
```

### 7.3 防火牆規則（銀行內網）

```bash
# 開放 Plane 存取 port（依實際環境調整）
# 8082 → Plane Web UI（透過 plane-proxy）
# 內部 port 8000（plane-api）、3000（plane-web）不需對外開放

# iptables 範例
iptables -A INPUT -p tcp --dport 8082 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8082 -j DROP
```

---

## 8. 健康檢查與故障排除

### 8.1 驗證所有服務正常運行

```bash
# 查看所有 Plane 容器狀態
docker compose -f plane-docker-compose.yml ps

# 檢查各服務健康狀態
docker inspect plane-api --format='{{.State.Health.Status}}'
docker inspect plane-worker --format='{{.State.Health.Status}}'

# 查看即時日誌
docker compose -f plane-docker-compose.yml logs -f --tail=50
```

### 8.2 常見問題排除

**問題：Migration 失敗**
```bash
# 查看詳細錯誤
docker compose -f plane-docker-compose.yml logs plane-migrator

# 手動執行 migration
docker compose -f plane-docker-compose.yml run --rm plane-api \
  python manage.py migrate --verbosity=2
```

**問題：Worker 無法連線 Redis**
```bash
# 測試 Redis 連線
docker compose -f plane-docker-compose.yml exec plane-worker \
  python -c "import redis; r = redis.from_url('${REDIS_URL}'); print(r.ping())"
```

**問題：檔案上傳失敗（MinIO）**
```bash
# 確認 MinIO bucket 存在
mc alias set titan http://titan-minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
mc ls titan/
mc mb titan/plane-uploads  # 若 bucket 不存在則建立
```

**問題：OIDC 登入失敗**
```bash
# 確認 Plane 能存取 IdP（隔離網路特別注意）
docker compose -f plane-docker-compose.yml exec plane-api \
  curl -s https://keycloak.bank.internal/.well-known/openid-configuration | jq .

# 如為自簽憑證，需在容器內安裝 CA 憑證
docker compose -f plane-docker-compose.yml exec plane-api \
  update-ca-certificates
```

### 8.3 備份與還原

```bash
# 備份 Plane 資料庫（獨立 DB 模式）
docker exec titan-postgres pg_dump -U plane_user plane_db > plane_backup_$(date +%Y%m%d).sql

# 還原
docker exec -i titan-postgres psql -U plane_user plane_db < plane_backup_20240101.sql
```

---

## 參考資源

- Plane 官方文件：https://docs.plane.so/self-hosting
- Plane GitHub：https://github.com/makeplane/plane
- Docker Compose 官方安裝：https://github.com/makeplane/plane/tree/stable/deploy/selfhost
- TITAN T09 Keycloak 設定文件：`docs/keycloak-setup.md`（待建）
