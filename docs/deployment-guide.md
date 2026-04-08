# TITAN 離線部署指南

> 版本：1.1 | 更新日期：2026-04-07 | Issue #1302
> 適用版本：TITAN 1.0.0-rc.1
> 適用環境：**封閉網路（Air-Gapped）/ 銀行內部網路**

---

## 快速確認清單

在開始部署前，逐項確認以下事項（全部打勾才可繼續）：

**環境準備**
- [ ] 部署機器已安裝 Docker 24.0+ 及 Docker Compose V2
- [ ] 部署機器已安裝 Node.js 22 LTS（或 20 LTS，最低支援）
- [ ] 部署機器已安裝 `openssl`
- [ ] 磁碟可用空間 ≥ 50 GB（含映像、資料、備份）
- [ ] 記憶體 ≥ 8 GB（最低 4 GB）
- [ ] Docker daemon 已啟動

**離線資源**
- [ ] 離線映像包（`titan-offline-*.tar.gz`）已傳輸至部署機器
- [ ] 離線應用程式碼（`titan-app-*.tar.gz`）已傳輸至部署機器
- [ ] （可選）`node_modules` 預打包已傳輸（或網路可存取 npm registry）

**SSL 與網路**
- [ ] 已取得銀行內部 CA 憑證，或已準備使用自簽憑證（測試用）
- [ ] 已確認網域名稱（預設：`titan.bank.local`）
- [ ] 已確認部署機器 IP 或 DNS 設定

**備份**
- [ ] 若為重新部署，已備份舊有資料（見[備份與還原](#7-備份與還原)）

---

## 目錄

1. [前置需求](#1-前置需求)
2. [離線打包（在聯網建置機執行）](#2-離線打包在聯網建置機執行)
3. [首次部署（在封閉網路目標機執行）](#3-首次部署在封閉網路目標機執行)
4. [版本更新](#4-版本更新)
5. [健康檢查與監控](#5-健康檢查與監控)
6. [備份與還原](#6-備份與還原)
7. [SSL 憑證設定](#7-ssl-憑證設定)
8. [故障排除](#8-故障排除)
9. [回滾流程](#9-回滾流程)
10. [服務架構與端口參考](#10-服務架構與端口參考)

---

## 1. 前置需求

### 1.1 硬體規格

| 項目 | 最低需求 | 建議（生產環境） |
|------|---------|----------------|
| CPU | 4 核心 | 8 核心以上 |
| RAM | 4 GB | 16 GB（含監控堆疊） |
| 磁碟（系統） | 50 GB | 200 GB SSD |
| 磁碟（備份） | 另備 50 GB | 500 GB 以上獨立掛載 |

> 監控堆疊（Prometheus + Grafana + Loki）額外需要約 2 GB RAM。

### 1.2 軟體需求

| 軟體 | 版本 | 說明 |
|------|------|------|
| OS | Ubuntu 22.04+ / RHEL 8+ | 推薦 Ubuntu 22.04 LTS |
| Docker Engine | 24.0+ | 必須支援 Compose V2 |
| Docker Compose | v2.20+（內建於 Docker） | 使用 `docker compose`（非 `docker-compose`） |
| Node.js | 22 LTS（或 20 LTS） | 用於建構 TITAN App 映像 |
| openssl | 任意版本 | 用於密鑰產生與 SSL 憑證 |

### 1.3 安裝驗證

部署前執行以下指令確認環境正確：

```bash
docker --version
# 預期：Docker version 24.x.x

docker compose version
# 預期：Docker Compose version v2.x.x

node --version
# 預期：v22.x.x（或 v20.x.x）

openssl version
# 預期：OpenSSL 1.x.x 或 3.x.x
```

若任何指令回報錯誤，請先完成軟體安裝再繼續。

---

## 2. 離線打包（在聯網建置機執行）

> **注意**：此步驟在**可連網的建置機**上執行，產生的套件再透過安全媒介（USB、企業傳輸系統）傳輸到封閉網路的目標機器。

### 2.1 準備建置機環境

```bash
# 確認建置機已安裝所有必要軟體（同第 1 節）
docker --version && node --version && openssl version

# 取得 TITAN 程式碼
git clone https://github.com/your-org/titan.git
cd titan
git checkout v1.0.0-rc.1    # 指定版本 tag
```

### 2.2 安裝依賴與建構應用程式

```bash
# 安裝 Node.js 依賴（連網取得）
npm ci

# 產生 Prisma Client
npx prisma generate

# 建構 Next.js Standalone 輸出
npm run build
```

### 2.3 建構 Docker 映像

```bash
# 建構 TITAN 主應用映像
docker build -t titan-app:latest .

# 建構 Prisma Migration 映像
docker build -f Dockerfile.migrate -t titan-migrate:latest .
```

### 2.4 拉取所有基礎服務映像

```bash
# 拉取 docker-compose.yml 中所有外部映像（排除自建映像）
docker compose pull --ignore-buildable
```

### 2.5 匯出所有映像為離線包

```bash
# 執行離線打包腳本（若存在）
bash scripts/package-offline.sh

# 或手動匯出（如腳本尚未存在）
TIMESTAMP=$(date +%Y%m%d)
IMAGE_FILE="titan-images-${TIMESTAMP}.tar"

# 列出所有需要的映像
docker images --format "{{.Repository}}:{{.Tag}}" | grep -E \
  'titan-app|titan-migrate|postgres|redis|minio|outline|ghcr.io/gethomepage|uptime-kuma|nginx' \
  > /tmp/titan-image-list.txt

cat /tmp/titan-image-list.txt

# 批量匯出
docker save $(cat /tmp/titan-image-list.txt | tr '\n' ' ') \
  -o "${IMAGE_FILE}"

# 壓縮（約可減少 40-60% 大小）
gzip -9 "${IMAGE_FILE}"
echo "映像包大小：$(du -sh ${IMAGE_FILE}.gz | cut -f1)"
```

### 2.6 打包應用程式碼

```bash
# 打包完整專案（含 node_modules，確保離線可用）
TIMESTAMP=$(date +%Y%m%d)
tar -czf "titan-app-${TIMESTAMP}.tar.gz" \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='backups' \
  .

echo "應用程式包大小：$(du -sh titan-app-${TIMESTAMP}.tar.gz | cut -f1)"
```

### 2.7 傳輸至目標機器

將以下檔案透過安全媒介傳輸到封閉網路目標機器：

```
titan-images-YYYYMMDD.tar.gz    ← Docker 映像包（通常 3-8 GB）
titan-app-YYYYMMDD.tar.gz       ← 應用程式碼包（通常 500 MB-2 GB）
```

**傳輸前建議計算 SHA-256 雜湊值做完整性驗證：**

```bash
# 在建置機上
sha256sum titan-images-*.tar.gz titan-app-*.tar.gz > titan-checksums.txt
cat titan-checksums.txt

# 在目標機上傳輸後驗證
sha256sum -c titan-checksums.txt
# 每行應顯示 OK
```

---

## 3. 首次部署（在封閉網路目標機執行）

> **執行環境**：封閉網路的目標 Linux 伺服器。

### 3.1 載入 Docker 映像

```bash
# 解壓並載入所有映像
gzip -d titan-images-YYYYMMDD.tar.gz
docker load -i titan-images-YYYYMMDD.tar

# 驗證映像已載入
docker images | grep -E 'titan|postgres|redis|minio|outline'
# 應看到所有必要映像
```

### 3.2 解壓應用程式碼

```bash
# 選擇部署目錄（建議 /opt/titan）
sudo mkdir -p /opt/titan
sudo chown $(whoami):$(whoami) /opt/titan

# 解壓程式碼
tar -xzf titan-app-YYYYMMDD.tar.gz -C /opt/titan
cd /opt/titan
ls
# 應看到：app/  scripts/  docker-compose.yml  .env.example 等
```

### 3.3 執行自動化首次部署腳本

`scripts/first-deploy.sh` 會自動完成以下所有步驟：

| 步驟 | 自動完成的動作 |
|------|---------------|
| 1 | 前置條件檢查（Docker、Node.js、openssl、磁碟空間） |
| 2 | 產生所有安全密鑰（PostgreSQL、Redis、MinIO、NextAuth、Outline） |
| 3 | 從 `.env.example` 建立 `.env`（自動填入密鑰，設定 chmod 600） |
| 4a | 建構 TITAN App Docker 映像（**離線環境：映像已載入，此步驟建構） |
| 4b | 啟動所有容器並等待健康就緒 |
| 5 | 執行資料庫 Migration（透過臨時容器走內部網路） |
| 6 | 載入初始種子資料 |
| 7 | 健康檢查確認 |

```bash
cd /opt/titan

# 標準首次部署
bash scripts/first-deploy.sh

# 自訂網域
TITAN_DOMAIN=titan.mybank.internal bash scripts/first-deploy.sh

# 跳過種子資料（若要自行匯入資料）
SKIP_SEED=true bash scripts/first-deploy.sh
```

**腳本執行完成後，終端會顯示所有服務入口 URL。**

### 3.4 驗證部署成功

```bash
# 確認所有容器正常運行
docker compose ps

# 執行健康檢查
bash scripts/health-check.sh

# 應看到整體狀態：✓ 全部健康 (Healthy)
```

### 3.5 初次設定後續步驟

```bash
# 設定 SSL 憑證（詳見第 7 節）
bash scripts/generate-ssl-cert.sh

# 執行認證初始化（建立初始管理員帳號）
bash scripts/auth-init.sh

# 設定 /etc/hosts（讓本機可使用網域名稱存取）
echo "<SERVER_IP>  titan.bank.local" | sudo tee -a /etc/hosts

# 設定定時備份（建議）
crontab -e
# 加入：0 2 * * * cd /opt/titan && bash scripts/backup.sh >> logs/backup.log 2>&1
```

---

## 4. 版本更新

### 4.1 準備更新包

在聯網建置機上重複[第 2 節](#2-離線打包在聯網建置機執行)的流程，取得新版本的映像包和應用程式碼包，傳輸至目標機器。

### 4.2 載入新版映像

```bash
# 目標機：載入新版映像（舊版本自動保留）
docker load -i titan-images-新版本.tar

# 確認新版映像已載入
docker images titan-app
# 應看到 latest 標籤對應新版本
```

### 4.3 執行更新腳本

```bash
cd /opt/titan

# 標準更新（跳過 git pull，使用已載入的新映像和程式碼）
bash scripts/upgrade.sh --skip-pull
```

`upgrade.sh --skip-pull` 自動執行：

| 步驟 | 動作 | 安全保證 |
|------|------|---------|
| 1 | 前置檢查（.env / Docker / 容器存在） | 確認環境完整才繼續 |
| 2 | （略過 git pull） | — |
| 3 | 更新前備份 PostgreSQL | 備份至 `backups/pre-upgrade_*.sql.gz` |
| 4 | 重建 TITAN App 映像 | **自動保留舊映像為 `titan-app:previous`（回滾用）** |
| 5 | 資料庫 Migration | 安全地新增欄位，不刪除現有資料 |
| 6 | 滾動更新容器 | 僅重啟 titan-app，基礎設施服務不中斷 |
| 7 | 健康檢查 | 驗證更新成功 |

```bash
# 若需全量更新（含 PostgreSQL、Redis、MinIO 等基礎設施映像）
bash scripts/upgrade.sh --skip-pull --full
```

### 4.4 確認更新成功

```bash
# 檢查服務狀態
docker compose ps

# 完整健康檢查
bash scripts/health-check.sh

# 檢視 TITAN App 版本（若有版本端點）
curl -s http://localhost:3100/api/health | jq .
```

---

## 5. 健康檢查與監控

### 5.1 基本健康檢查

```bash
# 完整彩色報告（互動式使用）
bash scripts/health-check.sh

# JSON 格式（供自動化/監控系統使用）
bash scripts/health-check.sh --json

# 靜默模式（僅輸出結束碼）
bash scripts/health-check.sh --quiet
echo "結束碼：$?"
```

**結束碼說明：**

| 結束碼 | 狀態 | 說明 |
|-------|------|------|
| 0 | 全部健康 (Healthy) | 所有服務正常運行 |
| 1 | 部分降級 (Degraded) | 非關鍵服務異常（警告） |
| 2 | 嚴重異常 (Critical) | 關鍵服務（PG/Redis）無回應 |

**檢查項目：**
- 系統資源：CPU 使用率、記憶體、磁碟（警告 ≥75%，嚴重 ≥90%）
- HTTP 端點：Homepage、Outline、MinIO、Uptime Kuma
- Docker 容器狀態：所有 titan-* 容器
- PostgreSQL：連線能力、連線數使用率
- Redis：Ping 回應、記憶體使用率、連線數

### 5.2 PostgreSQL 深度健康檢查

```bash
# 詳細的資料庫健康報告
bash scripts/db-health-check.sh
```

包含：連線池狀態、複製落後（若啟用）、長時間鎖定查詢、表格膨脹等。

### 5.3 監控堆疊（選用）

```bash
# 啟動 Prometheus + Grafana + Alertmanager + Uptime Kuma
docker compose --profile monitoring up -d

# 服務端點：
# Grafana:        http://<SERVER_IP>:3003
# Prometheus:     http://<SERVER_IP>:9090
# Alertmanager:   http://<SERVER_IP>:9093
# Uptime Kuma:    http://<SERVER_IP>:3002
```

> **離線注意事項**：監控堆疊的映像（Prometheus、Grafana）需同樣包含在離線映像包中。確認建置機打包時有納入 `--profile monitoring` 的服務映像。

### 5.4 設定監控排程

```bash
# 每 5 分鐘靜默健康檢查，異常時寫入 syslog
crontab -e
# 加入：*/5 * * * * bash /opt/titan/scripts/health-check.sh --quiet || logger -t titan "HEALTH CHECK FAILED: exit $?"

# 每日稽核合規檢查
0 6 * * * bash /opt/titan/scripts/audit-check.sh >> /var/log/titan/audit.log 2>&1
```

---

## 6. 備份與還原

### 6.1 手動備份

```bash
# 全量備份（PostgreSQL + Redis + MinIO + 設定檔）
bash scripts/backup.sh

# 單一服務備份
bash scripts/backup/backup-postgres.sh    # 僅 PostgreSQL
bash scripts/backup/backup-minio.sh       # 僅 MinIO 物件儲存
```

**備份保存位置：**
- 預設目錄：`/opt/titan/backups/`
- 每日備份：`backups/daily/YYYYMMDD_HHMMSS/`
- 更新前備份：`backups/pre-upgrade_YYYYMMDD_HHMMSS.sql.gz`
- 保留策略：每日備份保留最近 7 份，每週備份保留最近 4 份

### 6.2 設定自動備份

```bash
crontab -e
# 建議設定：
# 每日凌晨 2:00 全量備份
0 2 * * * cd /opt/titan && bash scripts/backup.sh >> /var/log/titan/backup.log 2>&1

# 每週日凌晨 3:00 額外完整備份（可搬移至外部媒介）
0 3 * * 0 cd /opt/titan && BACKUP_ROOT=/mnt/backup bash scripts/backup.sh
```

### 6.3 還原操作

```bash
# 列出所有備份
bash scripts/restore.sh --list

# 還原至指定時間點（互動式確認）
bash scripts/restore.sh --timestamp 20260407_020000

# 僅還原 PostgreSQL
bash scripts/restore.sh --timestamp 20260407_020000 --service postgres

# 還原全部服務
bash scripts/restore.sh --timestamp 20260407_020000 --service all
```

**手動還原 PostgreSQL（緊急備用方式）：**

```bash
# 找到備份檔案
ls -lh /opt/titan/backups/pre-upgrade_*.sql.gz

# 停止 titan-app（防止寫入衝突）
docker compose stop titan-app

# 還原資料庫
gunzip -c backups/pre-upgrade_20260407_140000.sql.gz \
  | docker compose exec -T postgres psql -U titan -d titan

# 重啟 titan-app
docker compose start titan-app
```

### 6.4 驗證備份可用性

```bash
# 定期執行備份還原驗證（建議每月一次）
bash scripts/verify-backup-restore.sh
```

---

## 7. SSL 憑證設定

### 7.1 產生自簽憑證（測試/初期使用）

```bash
# 產生自簽憑證（有效期 10 年，僅適合內部測試）
bash scripts/generate-ssl-cert.sh

# 自訂網域
TITAN_DOMAIN=titan.mybank.internal bash scripts/generate-ssl-cert.sh

# 強制覆蓋既有憑證
FORCE=1 bash scripts/generate-ssl-cert.sh
```

**輸出位置：**
- 憑證：`config/nginx/certs/server.crt`
- 私鑰：`config/nginx/certs/server.key`（權限 700）

### 7.2 使用銀行內部 CA 憑證（正式環境）

```bash
# 將銀行 CA 核發的憑證複製至指定位置
mkdir -p config/nginx/certs
cp /path/to/bank-issued.crt config/nginx/certs/server.crt
cp /path/to/bank-issued.key config/nginx/certs/server.key
chmod 600 config/nginx/certs/server.key
chmod 644 config/nginx/certs/server.crt

# 重新載入 Nginx 設定（不中斷服務）
docker compose exec nginx nginx -s reload
```

### 7.3 確認憑證有效

```bash
# 查看憑證資訊
openssl x509 -in config/nginx/certs/server.crt -text -noout | grep -E 'Subject|Not Before|Not After|DNS'

# 測試 HTTPS 連線
curl -k -o /dev/null -s -w "HTTP 狀態碼：%{http_code}\n" \
  https://titan.bank.local
```

---

## 8. 故障排除

### 8.1 常用診斷指令

```bash
# 確認所有容器狀態
docker compose ps

# 查看特定服務日誌（最近 50 行）
docker compose logs titan-app --tail 50
docker compose logs postgres --tail 50
docker compose logs redis --tail 20
docker compose logs nginx --tail 20

# 即時追蹤日誌
docker compose logs -f titan-app

# 執行完整健康檢查
bash scripts/health-check.sh

# PostgreSQL 深度診斷
bash scripts/db-health-check.sh

# 進入 PostgreSQL 互動介面
docker compose exec postgres psql -U titan -d titan

# 測試 Redis 連線
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

### 8.2 常見問題與解法

| 問題現象 | 可能原因 | 解決方式 |
|---------|---------|---------|
| `titan-app` 容器持續重啟（CrashLoopBackOff） | 資料庫連線失敗 | 確認 `titan-postgres` 容器狀態：`docker compose logs postgres` |
| Prisma Migration 失敗，錯誤含 "network not found" | `titan-internal` 網路未建立 | `docker network ls \| grep titan-internal`；若不存在：`docker compose up -d postgres` 先建立網路 |
| Docker 映像載入失敗（`invalid tar header`） | 映像包傳輸過程損毀 | 重新確認 SHA-256 雜湊值，重新傳輸 |
| 磁碟空間不足，容器無法啟動 | Docker 映像、日誌堆積 | `docker system prune -f`；清理舊備份（保留最近 3 份） |
| `npm ci` 失敗（離線環境） | `node_modules` 未包含在程式碼包 | 確認打包時包含 `node_modules`，或傳輸 npm 離線快取 |
| MinIO 容器無回應 | 首次啟動初始化時間較長 | 等待 60-120 秒後再次執行健康檢查 |
| Nginx 502 Bad Gateway | `titan-app` 尚未就緒 | `docker compose logs titan-app`；等待 30 秒後重試 |
| SSL 憑證錯誤 | 憑證未設定或路徑錯誤 | 確認 `config/nginx/certs/server.crt` 和 `server.key` 存在 |
| 登入後立即被登出 | `NEXTAUTH_SECRET` 不一致 | 確認 `.env` 中 `NEXTAUTH_SECRET` 與部署時相同；切勿多機器使用不同值 |
| 健康檢查顯示 PostgreSQL Critical | PG 連線數耗盡（>90%） | `docker compose exec postgres psql -U titan -c "SELECT count(*) FROM pg_stat_activity;"` 並找出長時間閒置連線 |

### 8.3 映像載入問題排查

```bash
# 確認映像包完整性
sha256sum -c titan-checksums.txt

# 查看載入錯誤詳細訊息
docker load -i titan-images-*.tar 2>&1 | head -50

# 確認必要映像清單
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" \
  | grep -E 'titan|postgres|redis|minio|outline|homepage|uptime'
```

### 8.4 資料庫診斷

```bash
# 查看活躍連線
docker compose exec postgres psql -U titan -d titan -c \
  "SELECT pid, usename, application_name, state, query_start \
   FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"

# 查看資料庫大小
docker compose exec postgres psql -U titan -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;"

# 查看鎖定等待
docker compose exec postgres psql -U titan -d titan -c \
  "SELECT * FROM pg_locks WHERE NOT granted;"
```

---

## 9. 回滾流程

### 9.1 TITAN App 快速回滾

`upgrade.sh` 在每次更新前**自動**將舊映像標記為 `titan-app:previous`。若更新後發現問題，執行：

```bash
# 步驟 1：還原舊映像標籤
docker tag titan-app:previous titan-app:latest

# 步驟 2：重啟 titan-app（僅此服務，不影響 PG/Redis/MinIO）
docker compose up -d --no-deps titan-app

# 步驟 3：確認服務健康
docker compose ps titan-app
bash scripts/health-check.sh --quiet && echo "回滾成功" || echo "回滾後仍有問題"
```

> `titan-app:previous` 僅保留**上一次**更新前的版本。若需回滾更早版本，需使用離線映像包重新載入指定版本。

### 9.2 資料庫回滾

`upgrade.sh` 在更新前自動備份 PostgreSQL 到 `backups/pre-upgrade_YYYYMMDD_HHMMSS.sql.gz`：

```bash
# 步驟 1：確認備份存在
ls -lh /opt/titan/backups/pre-upgrade_*.sql.gz

# 步驟 2：停止 titan-app（防止寫入衝突）
docker compose stop titan-app

# 步驟 3：清空並還原資料庫
docker compose exec -T postgres psql -U titan -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c backups/pre-upgrade_20260407_140000.sql.gz \
  | docker compose exec -T postgres psql -U titan -d titan

# 步驟 4：確認還原成功
docker compose exec postgres psql -U titan -d titan -c \
  "SELECT count(*) FROM \"User\";"

# 步驟 5：重啟 titan-app
docker compose start titan-app

# 步驟 6：驗證
bash scripts/health-check.sh
```

### 9.3 完整環境回滾（重新部署舊版）

若需回滾至更早的版本（不只一個版本）：

```bash
# 步驟 1：載入指定版本的離線映像包
docker load -i titan-images-舊版本日期.tar

# 步驟 2：手動標記映像
docker tag titan-app:舊版本tag titan-app:latest
docker tag titan-migrate:舊版本tag titan-migrate:latest

# 步驟 3：還原資料庫（使用對應版本的備份）
# （參考 9.2 節步驟 2-4）

# 步驟 4：重新部署
bash scripts/upgrade.sh --skip-pull
```

---

## 10. 服務架構與端口參考

### 10.1 服務網路拓撲

```
外部存取（瀏覽器）
        │
        ▼
  Nginx 反向代理（:443 HTTPS）
        │
        ├─── /          → Homepage       (:3000 titan-internal)
        ├─── /titan     → TITAN App      (:3100 titan-internal)
        └─── /outline   → Outline        (:3001 titan-internal)

titan-internal 網路（容器間通訊，不對外暴露）：
  TITAN App ──→ PostgreSQL  (:5432)
  TITAN App ──→ Redis       (:6379)
  Outline   ──→ PostgreSQL  (:5432)
  Outline   ──→ MinIO       (:9000)
```

### 10.2 端口一覽表

| 服務 | 容器名稱 | 對外端口 | 說明 |
|------|---------|---------|------|
| Nginx | titan-nginx | 80, 443 | 反向代理入口（TLS） |
| TITAN App | titan-app | 3100（內部） | 主應用（透過 Nginx 代理） |
| Homepage | titan-homepage | 3000（內部） | 統一入口頁面 |
| Outline | titan-outline | 3001（內部） | 知識庫 |
| Uptime Kuma | titan-uptime-kuma | 3002 | 可用性監控（直接存取） |
| MinIO Console | titan-minio | 9001 | 物件儲存管理介面 |
| PostgreSQL | titan-postgres | 不對外 | 僅 titan-internal |
| Redis | titan-redis | 不對外 | 僅 titan-internal |
| MinIO API | titan-minio | 不對外（API） | 僅 titan-internal |

> PostgreSQL 和 Redis **不暴露** host port，所有存取必須透過 `titan-internal` Docker 網路（容器間）或 `docker compose exec`（維運操作）。

### 10.3 Docker Volumes 資料持久化

| Volume 名稱 | 對應服務 | 重要性 | 說明 |
|------------|---------|-------|------|
| `titan-postgres-data` | PostgreSQL | 關鍵 | 所有業務資料 |
| `titan-redis-data` | Redis | 重要 | Session、快取、佇列 |
| `titan-minio-data` | MinIO | 關鍵 | 使用者上傳的檔案、附件 |
| `titan-outline-data` | Outline | 重要 | 知識庫文件（含圖片） |

**重要**：`docker compose down` 僅停止容器，資料完整保留。`docker compose down -v` 會**永久刪除** volumes，生產環境絕對禁止執行。

---

> 如有部署問題，請聯繫 IT 維運團隊或查閱 `docs/disaster-recovery.md` 取得緊急處置流程。
