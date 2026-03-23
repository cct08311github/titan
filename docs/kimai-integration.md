# Kimai 工時追蹤深度整合指南

> **Issue**: #64 — Kimai Time Tracking Deep Integration
> **文件版本**: 1.0
> **最後更新**: 2026-03-23
> **適用版本**: Kimai 2.21.x + TITAN 平台

---

## 目錄

1. [架構概述](#架構概述)
2. [服務啟動方式](#服務啟動方式)
3. [現有 MySQL dump 匯入指南](#現有-mysql-dump-匯入指南)
4. [LDAP / AD 單一登入設定](#ldap--ad-單一登入設定)
5. [Plane 專案結構對應](#plane-專案結構對應)
6. [Kimai REST API 整合端點](#kimai-rest-api-整合端點)
7. [常見問題排查](#常見問題排查)

---

## 架構概述

Kimai 透過 `docker-compose.override.yml` 整合進 TITAN 容器平台，與現有服務共享 `titan-internal` 網路，但使用獨立的 MySQL 8.0 資料庫（與 TITAN 的 PostgreSQL 16 分開管理）。

```
使用者瀏覽器
    │
    ▼
Nginx 反向代理 (titan-nginx)
    │  https://titan.bank.local/kimai/
    ▼
Kimai Apache 容器 (titan-kimai:8001)
    │
    ▼
MySQL 8.0 (titan-kimai-mysql:3306)
    │
    ▼  Volume 持久化
kimai-mysql-data / kimai-var-data / kimai-public-data
```

### 網路流量路徑

| 元件 | 容器名稱 | 網路 | 對外路徑 |
|------|---------|------|---------|
| Nginx 反向代理 | titan-nginx | titan-internal + titan-external | — |
| Kimai 應用程式 | titan-kimai | titan-internal | `/kimai/` |
| Kimai MySQL | titan-kimai-mysql | titan-internal | 不對外 |

### 與其他 TITAN 服務的整合關係

- **Nginx**：提供 `/kimai/` 及 `/kimai/api/` 兩個 location block，分別對應 UI 及 API 呼叫（API 端點套用較嚴格的速率限制）
- **Homepage**：在「工時管理」類別顯示 Kimai 服務卡片，並透過 Kimai REST API 顯示版本資訊
- **Plane**：透過 `scripts/kimai-sync-projects.sh` 定期將 Plane 專案同步至 Kimai，維持一致的專案結構
- **Uptime Kuma**：建議新增 Kimai 健康監控端點（`https://titan.bank.local/kimai/`）

---

## 服務啟動方式

### 首次部署

```bash
# 1. 複製環境變數範本
cp config/kimai/.env.example .env
# 編輯 .env，填入所有必要值（特別是密碼欄位）

# 2. 啟動 Kimai + MySQL（疊加主 compose）
docker compose \
  -f docker-compose.yml \
  -f docker-compose.override.yml \
  up -d kimai-mysql kimai

# 3. 等待服務就緒（約 90 秒）
docker compose logs -f kimai

# 4. 確認服務狀態
docker compose ps kimai kimai-mysql

# 5. 重新載入 Nginx（新增 /kimai/ 路由）
docker compose restart nginx
```

### 驗證部署

```bash
# 確認 Kimai 可正常回應
curl -s https://titan.bank.local/kimai/api/version | jq .

# 預期回應：
# { "version": "2.21.0", ... }
```

---

## 現有 MySQL dump 匯入指南

團隊於 2025 年 6 月安裝的 Kimai 資料可透過以下步驟匯入。

### 步驟 1：準備舊版資料庫 dump

```bash
# 從舊伺服器匯出（在舊伺服器執行）
mysqldump \
  -u kimai_user \
  -p \
  --single-transaction \
  --routines \
  --triggers \
  kimai_db > /tmp/kimai-backup-$(date +%Y%m%d).sql

# 將 dump 檔傳輸至 TITAN 伺服器
scp /tmp/kimai-backup-*.sql admin@titan.bank.local:/opt/titan/backups/
```

### 步驟 2：確認新容器 MySQL 已初始化

```bash
# 確認 titan-kimai-mysql 容器健康
docker exec titan-kimai-mysql mysqladmin \
  -u kimai -p"${KIMAI_DB_PASSWORD}" ping
# 回應：mysqld is alive
```

### 步驟 3：匯入資料

```bash
# 清空預設資料庫（首次部署時 Kimai 會自動建立空表）
docker exec -i titan-kimai-mysql mysql \
  -u kimai -p"${KIMAI_DB_PASSWORD}" kimai \
  -e "DROP DATABASE kimai; CREATE DATABASE kimai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 匯入備份資料
docker exec -i titan-kimai-mysql mysql \
  -u kimai -p"${KIMAI_DB_PASSWORD}" kimai \
  < /opt/titan/backups/kimai-backup-YYYYMMDD.sql
```

### 步驟 4：執行資料庫 Migration

```bash
# 舊版資料結構需 migration 至 Kimai 2.21.x schema
docker exec titan-kimai \
  /opt/kimai/bin/console kimai:update --no-interaction
```

### 步驟 5：驗證資料完整性

```bash
# 確認使用者數量
docker exec titan-kimai-mysql mysql \
  -u kimai -p"${KIMAI_DB_PASSWORD}" kimai \
  -e "SELECT COUNT(*) AS users FROM kimai2_users;"

# 確認工時記錄數量
docker exec titan-kimai-mysql mysql \
  -u kimai -p"${KIMAI_DB_PASSWORD}" kimai \
  -e "SELECT COUNT(*) AS timesheets FROM kimai2_timesheet;"
```

---

## LDAP / AD 單一登入設定

啟用 LDAP 整合後，使用者可直接以 Active Directory 帳號登入 Kimai，無需額外記憶獨立密碼。

### 前置條件

- 已取得唯讀 AD 服務帳號（建議 `kimai-svc@bank.local`）
- LDAP 伺服器可從 Docker 內網存取（需確認防火牆規則）

### 設定步驟

**步驟 1：在 .env 啟用 LDAP**

```bash
KIMAI_LDAP_ACTIVE=true
KIMAI_LDAP_HOST=ldap://dc01.bank.local
KIMAI_LDAP_PORT=389
KIMAI_LDAP_BIND_DN=CN=kimai-svc,OU=ServiceAccounts,DC=bank,DC=local
KIMAI_LDAP_BIND_PASSWORD=服務帳號密碼
KIMAI_LDAP_USER_BASE_DN=OU=ITDept,DC=bank,DC=local
KIMAI_LDAP_USER_FILTER=(memberOf=CN=TITAN-Users,OU=Groups,DC=bank,DC=local)
KIMAI_LDAP_ATTR_USERNAME=sAMAccountName
KIMAI_LDAP_ATTR_EMAIL=mail
KIMAI_LDAP_ATTR_DISPLAYNAME=displayName
```

**步驟 2：新增 Kimai LDAP 設定檔**

在 `kimai-var-data` volume 中建立 `config/packages/local.yaml`：

```yaml
# /opt/kimai/config/packages/local.yaml
kimai:
  ldap:
    activate: true
    connection:
      host: '%env(KIMAI_LDAP_HOST)%'
      port: '%env(int:KIMAI_LDAP_PORT)%'
      bindRequiresDn: true
    user:
      baseDn: '%env(KIMAI_LDAP_USER_BASE_DN)%'
      filter: '%env(KIMAI_LDAP_USER_FILTER)%'
      usernameAttribute: '%env(KIMAI_LDAP_ATTR_USERNAME)%'
      attributesFilter: '(objectClass=person)'
      attributes:
        - { ldap_attr: '%env(KIMAI_LDAP_ATTR_EMAIL)%', user_method: setEmail }
        - { ldap_attr: '%env(KIMAI_LDAP_ATTR_DISPLAYNAME)%', user_method: setAlias }
```

**步驟 3：清除快取並重啟**

```bash
docker exec titan-kimai \
  /opt/kimai/bin/console cache:clear --env=production

docker compose restart kimai
```

**步驟 4：測試 LDAP 連線**

```bash
docker exec titan-kimai \
  /opt/kimai/bin/console kimai:ldap:sync --dry-run
```

### 權限對應建議

| AD 群組 | Kimai 角色 | 說明 |
|---------|-----------|------|
| `TITAN-Users` | `ROLE_USER` | 一般 IT 人員，可記錄工時 |
| `TITAN-Leads` | `ROLE_TEAMLEAD` | 主管，可審核下屬工時 |
| `TITAN-Admin` | `ROLE_ADMIN` | 管理員，可管理專案與使用者 |

---

## Plane 專案結構對應

### 對應設計原則

TITAN 採用以下映射策略確保 Kimai 工時與 Plane 任務可相互關聯：

```
Plane Workspace
└── Plane Project（如：CORE-後端重構）
    └── Plane Issue（如：CORE-42 修復登入 Bug）
        ↕ 對應
Kimai 專案（如：[CORE] 後端重構）
└── Kimai Activity（如：程式開發、測試與驗證）
    └── Kimai Timesheet Entry
        └── Description 欄位填入 Plane Issue 編號（如：CORE-42）
```

### 活動類型標準（銀行 IT 工作分類）

每個 Kimai 專案自動建立以下 10 種活動類型：

| 活動名稱 | 說明 | 典型工作內容 |
|---------|------|------------|
| 需求分析與規劃 | 收集使用者需求、評估可行性 | 訪談、文件撰寫、工作量估算 |
| 系統設計 | 架構設計、技術選型 | UML 繪製、技術 PoC |
| 程式開發 | 功能實作、Code Review | Coding、PR Review |
| 測試與驗證 | 功能測試、整合測試 | SIT、UAT、Bug 驗證 |
| 文件撰寫 | 操作手冊、技術文件 | 系統文件、使用者指南 |
| 部署與上線 | 生產環境部署 | Release、上線支援 |
| 問題排查與修復 | 生產問題處理 | 障礙排除、Hotfix |
| 會議與溝通 | 各類會議 | Standup、評審會議 |
| 教育訓練 | 技術培訓 | 新人訓練、技術分享 |
| 專案管理 | 專案推進 | 進度追蹤、風險管理 |

### 同步腳本使用方式

```bash
# 預覽同步內容（不執行寫入）
bash scripts/kimai-sync-projects.sh --dry-run

# 正式同步
bash scripts/kimai-sync-projects.sh

# 詳細模式（顯示 API 回應）
bash scripts/kimai-sync-projects.sh --verbose
```

建議透過 cron 定期執行（每日一次），確保 Kimai 專案與 Plane 保持同步：

```bash
# crontab -e（在 TITAN 主機上）
0 8 * * * /opt/titan/scripts/kimai-sync-projects.sh >> /var/log/titan/kimai-sync.log 2>&1
```

---

## Kimai REST API 整合端點

Kimai 提供完整的 REST API，基底 URL：`https://titan.bank.local/kimai/api`

API 文件（Swagger UI）：`https://titan.bank.local/kimai/api/doc`

### 認證方式

```bash
# 方式 1：API Token（推薦，用於自動化腳本）
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://titan.bank.local/kimai/api/version

# 方式 2：HTTP Basic Auth（測試用）
curl -u "username:password" \
     https://titan.bank.local/kimai/api/version
```

### 常用 API 端點

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/version` | 取得 Kimai 版本資訊 |
| `GET` | `/api/projects` | 列出所有專案 |
| `POST` | `/api/projects` | 建立新專案 |
| `GET` | `/api/activities` | 列出所有活動 |
| `POST` | `/api/activities` | 建立新活動 |
| `GET` | `/api/timesheets` | 查詢工時記錄 |
| `POST` | `/api/timesheets` | 新增工時記錄 |
| `PATCH` | `/api/timesheets/{id}/stop` | 停止計時 |
| `GET` | `/api/users` | 列出使用者 |
| `GET` | `/api/teams` | 列出團隊 |

### 工時記錄新增範例

```bash
# 開始計時（不指定結束時間 = 即時計時）
curl -X POST https://titan.bank.local/kimai/api/timesheets \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project": 1,
    "activity": 3,
    "begin": "2026-03-23T09:00:00+08:00",
    "description": "CORE-42 修復使用者登入問題"
  }'

# 手動新增固定時段工時
curl -X POST https://titan.bank.local/kimai/api/timesheets \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project": 1,
    "activity": 3,
    "begin": "2026-03-23T09:00:00+08:00",
    "end": "2026-03-23T11:30:00+08:00",
    "description": "CORE-42 後端 API 修復"
  }'
```

### 工時查詢範例

```bash
# 查詢本週工時（依使用者）
curl "https://titan.bank.local/kimai/api/timesheets?\
begin=2026-03-18T00:00:00%2B08:00&\
end=2026-03-24T23:59:59%2B08:00&\
user=1" \
  -H "Authorization: Bearer YOUR_API_TOKEN" | jq .
```

---

## 常見問題排查

### Kimai 容器啟動失敗

```bash
# 查看詳細日誌
docker logs titan-kimai --tail=100

# 常見原因：MySQL 尚未就緒
# 解決方案：等待 kimai-mysql healthcheck 通過後再啟動 kimai
docker compose up -d kimai-mysql
# 等待 30-60 秒
docker compose up -d kimai
```

### 無法透過 /kimai/ 存取

```bash
# 確認 Nginx 設定已更新並重新載入
docker exec titan-nginx nginx -t
docker exec titan-nginx nginx -s reload

# 確認 Kimai 容器在 titan-internal 網路上
docker network inspect titan-internal | grep kimai
```

### LDAP 登入失敗

```bash
# 測試 LDAP 連線
docker exec titan-kimai \
  /opt/kimai/bin/console kimai:ldap:sync --dry-run --username 測試帳號

# 查看 Kimai 應用程式日誌
docker exec titan-kimai \
  tail -f /opt/kimai/var/log/prod.log
```

### MySQL 資料庫備份

```bash
# 定期備份（建議加入 cron）
docker exec titan-kimai-mysql mysqldump \
  -u kimai -p"${KIMAI_DB_PASSWORD}" \
  --single-transaction \
  kimai > /opt/titan/backups/kimai-$(date +%Y%m%d-%H%M%S).sql
```
