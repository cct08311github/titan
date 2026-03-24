# TITAN Portal 整合驗證清單

> 任務：T17 — Portal 整合驗證
> 最後更新：2026-03-23
>
> 本清單用於手動驗證 TITAN Portal 各服務的整合狀態。
> 自動化測試請執行：`bash scripts/integration-test.sh`

---

## 目錄

1. [驗證前準備](#1-驗證前準備)
2. [基礎設施驗證](#2-基礎設施驗證)
3. [核心服務驗證](#3-核心服務驗證)
4. [Homepage 整合驗證](#4-homepage-整合驗證)
5. [SSO 整合驗證](#5-sso-整合驗證)
6. [服務間互通驗證](#6-服務間互通驗證)
7. [監控告警驗證](#7-監控告警驗證)
8. [備份服務驗證](#8-備份服務驗證)
9. [安全設定驗證](#9-安全設定驗證)
10. [效能基準驗證](#10-效能基準驗證)
11. [最終確認](#11-最終確認)

---

## 驗證說明

每個項目標記如下：

- `[ ]` 待驗證
- `[x]` 已通過
- `[!]` 需要修復（在後方備註問題）
- `[-]` 不適用（說明原因）

**執行人員**：_______________
**驗證日期**：_______________
**環境**：Production / Staging（圈選其一）

---

## 1. 驗證前準備

### 1.1 工具準備

- [ ] 可使用瀏覽器存取 `http://homepage.titan.internal`
- [ ] 已安裝 `curl`、`docker`（或可 SSH 至部署主機）
- [ ] 擁有 Keycloak admin 帳號
- [ ] 擁有各服務的管理員帳號

### 1.2 自動化測試執行

```bash
# 執行自動化整合測試
bash scripts/integration-test.sh --verbose 2>&1 | tee /tmp/titan-integration-$(date +%Y%m%d).log
```

- [ ] 自動化測試已執行完畢
- [ ] 測試結果已儲存至日誌檔

---

## 2. 基礎設施驗證

### 2.1 Docker 服務狀態

```bash
docker compose ps
```

| 容器名稱              | 預期狀態  | 實際狀態 | 備註 |
|-----------------------|-----------|----------|------|
| titan-postgresql      | healthy   |          |      |
| titan-redis           | healthy   |          |      |
| titan-minio           | healthy   |          |      |
| titan-keycloak        | healthy   |          |      |
| titan-nginx           | running   |          |      |
| titan-homepage        | running   |          |      |
| titan-plane-web       | healthy   |          |      |
| titan-plane-api       | healthy   |          |      |
| titan-plane-worker    | running   |          |      |
| titan-outline         | healthy   |          |      |
| titan-gitea           | healthy   |          |      |
| titan-harbor-core     | healthy   |          |      |
| titan-grafana         | healthy   |          |      |
| titan-prometheus      | running   |          |      |

- [ ] 所有容器均在預期狀態
- [ ] 無容器持續重啟（`Restarting` 狀態）

### 2.2 磁碟空間

```bash
df -h
docker system df
```

- [ ] 系統磁碟使用率低於 80%
- [ ] Docker volumes 磁碟使用率低於 80%

### 2.3 網路連通性

```bash
docker network ls | grep titan
docker network inspect titan-network
```

- [ ] `titan-network` 網路存在
- [ ] 各服務容器均連接至 `titan-network`

---

## 3. 核心服務驗證

### 3.1 Homepage

- [ ] `http://homepage.titan.internal` 可正常開啟
- [ ] 頁面標題顯示「TITAN Portal」
- [ ] 深色主題正確套用（custom.css 生效）
- [ ] 所有服務卡片均顯示
- [ ] 服務狀態燈正確顯示（綠色為正常，紅色需排查）

### 3.2 Plane 任務管理

- [ ] `http://plane.titan.internal` 可正常開啟
- [ ] API 健康檢查通過：`curl http://plane.titan.internal/api/health/`
- [ ] 可使用帳號登入
- [ ] TITAN Workspace 存在
- [ ] 工作流程狀態已設定（Backlog / Todo / In Progress / Review / Done）
- [ ] 標籤已建立（type / priority / component 系列）

### 3.3 Outline 知識庫

- [ ] `http://outline.titan.internal` 可正常開啟
- [ ] 健康檢查通過：`curl http://outline.titan.internal/_health`
- [ ] 可使用帳號登入
- [ ] 五個空間已建立：SOP、Runbook、FAQ、Meeting Notes、Architecture
- [ ] 範本已匯入（sop、runbook、faq、meeting-notes、cr）
- [ ] 文件搜尋功能正常

### 3.4 Gitea 版本控制

- [ ] `http://gitea.titan.internal` 可正常開啟
- [ ] API 健康檢查通過：`curl http://gitea.titan.internal/api/healthz`
- [ ] 可使用帳號登入
- [ ] 可建立 / 推送 Repository

### 3.5 Harbor 映像倉庫

- [ ] `http://harbor.titan.internal` 可正常開啟
- [ ] Ping 通過：`curl http://harbor.titan.internal/api/v2.0/ping`
- [ ] 可使用帳號登入
- [ ] `library` 預設 Project 存在
- [ ] 可推送 / 拉取 Docker 映像

---

## 4. Homepage 整合驗證

### 4.1 服務卡片連結

逐一點擊 Homepage 上的服務卡片，確認連結正確跳轉：

| 服務卡片         | 目標 URL                           | 可開啟 | 備註 |
|------------------|------------------------------------|--------|------|
| Plane 任務管理   | http://plane.titan.internal        | [ ]    |      |
| Outline 知識庫   | http://outline.titan.internal      | [ ]    |      |
| Gitea 程式碼庫   | http://gitea.titan.internal        | [ ]    |      |
| Harbor 映像倉庫  | http://harbor.titan.internal       | [ ]    |      |
| Grafana 儀表板   | http://grafana.titan.internal      | [ ]    |      |
| Keycloak 管理    | http://keycloak.titan.internal     | [ ]    |      |
| MinIO Console    | http://minio.titan.internal:9001   | [ ]    |      |
| Portainer        | http://portainer.titan.internal    | [ ]    |      |

### 4.2 服務狀態燈

- [ ] 正常服務顯示綠色狀態燈
- [ ] 狀態燈每 30 秒自動更新（預設）
- [ ] 停用一個非必要服務後，Homepage 顯示紅色燈

### 4.3 搜尋功能

- [ ] 搜尋列可正常輸入
- [ ] 搜尋功能指向正確目標（Outline 或設定的搜尋引擎）

### 4.4 小工具（Widgets）

- [ ] 時間小工具顯示正確時間
- [ ] 系統資源小工具顯示 CPU / Memory 使用率（若已設定）
- [ ] 日期格式為繁體中文或 ISO 格式

---

## 5. SSO 整合驗證

### 5.1 Keycloak 設定

- [ ] `titan` Realm 已建立
- [ ] OIDC Discovery Endpoint 可存取：
  `curl http://keycloak.titan.internal/realms/titan/.well-known/openid-configuration`
- [ ] 以下 Client 已建立：
  - [ ] `plane`
  - [ ] `outline`
  - [ ] `gitea`
  - [ ] `harbor`（若使用 OIDC）

### 5.2 各服務 SSO 登入

使用統一的 Keycloak 測試帳號進行以下驗證：

| 服務   | 點擊 SSO 登入 | Keycloak 跳轉 | 登入成功 | 登入後帳號正確 |
|--------|--------------|---------------|----------|----------------|
| Plane  | [ ]          | [ ]           | [ ]      | [ ]            |
| Outline| [ ]          | [ ]           | [ ]      | [ ]            |
| Gitea  | [ ]          | [ ]           | [ ]      | [ ]            |
| Harbor | [ ]          | [ ]           | [ ]      | [ ]            |

### 5.3 登出與 Session 管理

- [ ] 在 Keycloak 登出後，其他服務也同步登出（Single Logout）
- [ ] Token 過期後自動導向 Keycloak 重新認證

---

## 6. 服務間互通驗證

### 6.1 資料庫連線

```bash
# 確認各服務成功連接 PostgreSQL
docker exec titan-plane-api python manage.py check --database default
docker exec titan-outline node -e "require('./build/server')"  # 或適當的健康檢查指令
docker exec titan-gitea gitea doctor check --run database
```

- [ ] Plane 可連接 PostgreSQL
- [ ] Outline 可連接 PostgreSQL
- [ ] Gitea 可連接 PostgreSQL

### 6.2 Redis 連線

```bash
docker exec titan-redis redis-cli ping
```

- [ ] Redis 回應 `PONG`
- [ ] Plane worker 可連接 Redis（工作排程正常執行）
- [ ] Outline 可連接 Redis（session 快取正常）

### 6.3 MinIO 物件儲存

- [ ] MinIO Console 可正常登入：`http://minio.titan.internal:9001`
- [ ] `outline-attachments` bucket 存在（或已設定的 bucket 名稱）
- [ ] Plane 可上傳附件（在 Issue 中上傳圖片測試）
- [ ] Outline 可上傳附件（在文件中上傳圖片測試）
- [ ] Harbor 可使用 MinIO 作為儲存後端（若已設定）

### 6.4 Nginx 反向代理

```bash
curl -I http://homepage.titan.internal
curl -I http://plane.titan.internal
curl -I http://outline.titan.internal
```

- [ ] 所有服務均透過 Nginx 正確轉發
- [ ] HTTP Header 中包含 `X-Forwarded-For` 或 `X-Real-IP`
- [ ] 若設定 HTTPS，HTTP 請求自動重定向至 HTTPS

---

## 7. 監控告警驗證

### 7.1 Prometheus 指標收集

- [ ] Prometheus UI 可存取：`http://prometheus.titan.internal`
- [ ] Targets 頁面（`/targets`）顯示各服務 scrape 狀態為 UP
- [ ] 可執行基本 PromQL 查詢（例：`up{job="titan"}`）

### 7.2 Grafana 儀表板

- [ ] Grafana 可正常登入：`http://grafana.titan.internal`
- [ ] Prometheus 資料來源已設定且可連接
- [ ] TITAN 系統總覽儀表板可顯示
- [ ] 各服務的基本指標（CPU、Memory、HTTP 請求數）可正常顯示

### 7.3 告警規則

- [ ] Alertmanager 可存取：`http://alertmanager.titan.internal`
- [ ] 基本告警規則已載入（服務停機告警）
- [ ] 測試告警可正常觸發（使用 `amtool` 或手動觸發）

---

## 8. 備份服務驗證

### 8.1 備份 Bucket

- [ ] MinIO 中備份 bucket 已建立：
  - [ ] `titan-db-backup`
  - [ ] `titan-app-backup`
  - [ ] `titan-config-backup`

### 8.2 備份腳本執行

```bash
# 手動執行一次備份
bash scripts/backup.sh --dry-run
```

- [ ] 備份腳本 dry-run 執行成功
- [ ] Cron 排程已設定（參考 `scripts/monitor-cron.sh`）
- [ ] 最近一次備份記錄可在 MinIO 查到

### 8.3 備份還原測試（每季執行一次）

- [ ] 從備份還原至測試環境成功
- [ ] 還原後服務功能正常
- [ ] 還原測試結果記錄於 Outline Runbook

---

## 9. 安全設定驗證

### 9.1 網路隔離

- [ ] 各服務僅透過 `titan-network` 互通，未暴露不必要的 port 至主機網路
- [ ] PostgreSQL（5432）、Redis（6379）未對外開放
- [ ] MinIO API（9000）僅供內網存取

### 9.2 TLS / HTTPS（若已設定）

- [ ] 各服務 HTTPS 憑證有效
- [ ] HTTP 請求自動重定向至 HTTPS
- [ ] 憑證到期日距今 > 30 天

### 9.3 預設帳號變更

- [ ] Keycloak admin 預設密碼已變更
- [ ] MinIO root 密碼已變更（非 `minioadmin`）
- [ ] Grafana admin 密碼已變更
- [ ] Portainer admin 密碼已變更

### 9.4 敏感設定檢查

```bash
# 確認 .env 未提交至版本控制
git -C /opt/titan log --oneline -- .env
```

- [ ] `.env` 未包含在 git history 中
- [ ] 所有密碼使用環境變數，未硬編碼在設定檔中

---

## 10. 效能基準驗證

### 10.1 首頁載入時間

使用瀏覽器開發者工具（F12 → Network）測量：

| 頁面                              | 預期值 | 實際值 | 結果 |
|-----------------------------------|--------|--------|------|
| Homepage 首頁                     | < 3s   |        |      |
| Plane Dashboard                   | < 5s   |        |      |
| Outline 首頁                      | < 3s   |        |      |
| Gitea 首頁                        | < 3s   |        |      |

### 10.2 API 回應時間

```bash
curl -w "Total: %{time_total}s\n" -o /dev/null -s \
  http://plane.titan.internal/api/health/
```

- [ ] 各服務 API 健康檢查回應時間 < 1 秒

---

## 11. 最終確認

### 整合驗證摘要

填寫測試結果統計：

| 分類           | 通過項目 | 失敗項目 | 警告項目 |
|----------------|----------|----------|----------|
| 基礎設施       |          |          |          |
| 核心服務       |          |          |          |
| Homepage 整合  |          |          |          |
| SSO 整合       |          |          |          |
| 服務間互通     |          |          |          |
| 監控告警       |          |          |          |
| 備份服務       |          |          |          |
| 安全設定       |          |          |          |
| **合計**       |          |          |          |

### 待修復問題清單

| 編號 | 問題描述 | 嚴重程度 | 負責人 | 截止日期 |
|------|----------|----------|--------|----------|
| 1    |          |          |        |          |
| 2    |          |          |        |          |

### 整合驗證結論

- [ ] **通過**：所有必要項目通過，可進入生產使用
- [ ] **有條件通過**：非關鍵問題待修復，可上線但需追蹤
- [ ] **未通過**：關鍵問題尚未解決，需修復後重新驗證

**驗證結論說明**：

_______________________________________________________________________________

_______________________________________________________________________________

**驗證執行人員簽名**：_______________

**主管確認簽名**：_______________

**驗證完成日期**：_______________

---

## 附錄：快速命令參考

```bash
# 查看所有容器狀態
docker compose ps

# 查看特定服務日誌
docker compose logs -f --tail=100 plane-api

# 執行自動化整合測試
bash scripts/integration-test.sh --verbose

# 查看 Nginx 存取日誌
docker compose logs nginx | tail -50

# 手動觸發健康檢查
for svc in homepage plane outline gitea harbor; do
  echo "=== $svc ==="
  curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" \
    "http://${svc}.titan.internal"
done

# 檢查 PostgreSQL 連線數
docker exec titan-postgresql psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

---

## 相關文件

- 自動化測試腳本：`scripts/integration-test.sh`
- Homepage 自訂說明：`docs/homepage-customization.md`
- Plane 工作流程設定：`docs/plane-workflow.md`
- Outline 知識庫結構：`docs/outline-structure.md`
- 備份策略：`docs/backup-strategy.md`
- 安全稽核計畫：`docs/audit-plan.md`
