# TITAN 備份策略文件

**任務**：T19 — Backup and Restore Mechanism
**版本**：1.0
**最後更新**：2026-03-23

---

## 目錄

1. [備份排程建議](#1-備份排程建議)
2. [備份範圍說明](#2-備份範圍說明)
3. [還原步驟](#3-還原步驟)
4. [災難復原計畫](#4-災難復原計畫)
5. [每月還原演練](#5-每月還原演練)
6. [維運注意事項](#6-維運注意事項)

---

## 1. 備份排程建議

### 自動備份（每日）

| 時間 | 類型 | 執行方式 |
|------|------|----------|
| 凌晨 02:00 | 每日完整備份 | cron（`config/cron/backup-cron`） |
| 每週日 02:00 | 週備份快照 | 由每日備份腳本自動建立符號連結 |

### 保留策略

| 類型 | 保留份數 | 說明 |
|------|----------|------|
| 每日備份 | **最近 7 份** | 保留最近 7 天，超過自動刪除 |
| 每週備份 | **最近 4 份** | 每週日建立，保留最近 4 週 |

### 安裝排程

**方法 A：自動安裝（建議）**

```bash
# 使用安裝腳本（自動檢查重複、設定權限）
sudo /opt/titan/scripts/backup.sh --install-cron

# 或手動安裝
sudo crontab -l | cat - /opt/titan/config/cron/backup-cron | sudo crontab -

# 確認安裝
sudo crontab -l
```

**方法 B：Docker 初次部署時自動安裝**

首次執行 `docker compose up -d` 後，執行部署後腳本：

```bash
# 部署後設定（含 cron 安裝、權限設定、首次備份）
/opt/titan/scripts/backup.sh --install-cron
/opt/titan/scripts/backup.sh  # 立即執行首次備份
```

**驗證排程已安裝：**

```bash
# 檢查 crontab 中是否包含 backup.sh
sudo crontab -l | grep backup
# 預期輸出：0 2 * * * root /opt/titan/scripts/backup.sh ...

# 檢查最近一次備份是否成功
ls -lt /opt/titan/backups/daily/ | head -5
```

> **重要**：Cron 排程檔位於 `config/cron/backup-cron`。若修改備份時間或保留策略，
> 需重新執行安裝指令。詳見 `docs/disaster-recovery.md` §3 備份策略。

---

## 2. 備份範圍說明

### 已備份的內容

| 服務 | 備份方式 | 備份位置 | 說明 |
|------|----------|----------|------|
| **PostgreSQL** | `pg_dump`（每個資料庫）+ `pg_dumpall`（全域） | `daily/TIMESTAMP/postgres/` | 包含 titan、outline 等所有非系統資料庫，以及 roles/tablespaces |
| **Redis** | `BGSAVE` + 複製 `dump.rdb` | `daily/TIMESTAMP/redis/` | 快取資料快照；Redis 資料為揮發性，可接受部分遺失 |
| **MinIO** | `mc mirror`（每個 bucket） | `daily/TIMESTAMP/minio/` | 所有 bucket 的物件資料，含 outline 附件 |
| **Outline 資料目錄** | `docker cp` | `daily/TIMESTAMP/outline/` | `/var/lib/outline/data`（本地上傳暫存） |
| **Homepage 設定** | `tar.gz` | `daily/TIMESTAMP/homepage/` | `config/homepage/` 目錄（services.yaml 等） |
| **docker-compose.yml** | 複製 + gzip | `daily/TIMESTAMP/configs/` | 容器部署設定 |
| **.env** | 複製 + gzip（chmod 600） | `daily/TIMESTAMP/configs/` | 環境變數（含敏感資料，權限限制） |
| **Plane 設定** | `tar.gz` | `daily/TIMESTAMP/configs/` | `config/plane/` 目錄（若存在） |

### 未備份的內容（與原因）

| 項目 | 原因 |
|------|------|
| Docker 映像檔 | 映像版本固定，可隨時重新 pull 或從離線源還原 |
| Docker 網路設定 | 由 docker-compose.yml 定義，設定檔已備份 |
| 宿主機作業系統設定 | 超出 TITAN 範疇，由 IT 基礎設施團隊負責 |
| OIDC/SSO 設定 | 存放於 IdP 端，由身份認證基礎設施負責 |
| Outline 資料庫內的 MinIO 物件 URL | 物件已由 MinIO 備份涵蓋，URL 指向同一物件 |

---

## 3. 還原步驟

### 前置確認

在執行還原前，請確認：

1. 已取得目標備份的時間戳（使用 `--list` 查看）
2. 相關服務容器已啟動（或準備好重啟）
3. 了解還原操作**不可逆**，現有資料將被覆蓋

```bash
# 查看可用備份
./scripts/restore.sh --list
```

### 完整還原（所有服務）

```bash
# 查看備份清單，取得時間戳
./scripts/restore.sh --list

# 執行完整還原（會有確認提示）
./scripts/restore.sh --timestamp 20240101_020000

# 或跳過確認（適用於自動化腳本）
./scripts/restore.sh --timestamp 20240101_020000 --yes
```

### 單一服務還原

```bash
# 僅還原 PostgreSQL
./scripts/restore.sh --timestamp 20240101_020000 --service postgres

# 僅還原 Redis
./scripts/restore.sh --timestamp 20240101_020000 --service redis

# 僅還原 MinIO
./scripts/restore.sh --timestamp 20240101_020000 --service minio

# 僅還原 Outline 資料目錄
./scripts/restore.sh --timestamp 20240101_020000 --service outline

# 僅還原 Homepage 設定
./scripts/restore.sh --timestamp 20240101_020000 --service homepage
```

### 手動還原設定檔

`.env` 含敏感資料，腳本不自動覆蓋，請手動執行：

```bash
# 還原 .env（確認後執行）
zcat /opt/titan/backups/daily/20240101_020000/configs/.env.gz > /opt/titan/.env

# 還原 docker-compose.yml
zcat /opt/titan/backups/daily/20240101_020000/configs/docker-compose.yml.gz > /opt/titan/docker-compose.yml
```

### 還原後驗證

```bash
# 確認所有服務健康
docker compose ps
docker compose exec postgres pg_isready -U titan
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" PING
docker compose exec minio mc ready local

# 開啟 Outline 確認知識庫正常
curl -s http://localhost:3001/_health

# 開啟 Homepage 確認儀表板正常
curl -s http://localhost:3000/
```

---

## 4. 災難復原計畫

### 情境一：單一服務資料損毀

**症狀**：某個服務（如 PostgreSQL）資料損毀，其他服務正常。

**步驟**：

1. 確認受影響範圍：`docker compose ps`
2. 停止受影響服務：`docker compose stop postgres`
3. 執行單一服務還原：`./scripts/restore.sh --timestamp <最新時間戳> --service postgres`
4. 重啟服務：`docker compose start postgres`
5. 驗證服務：`docker compose exec postgres pg_isready -U titan`

**預期 RTO（恢復時間目標）**：30 分鐘
**預期 RPO（資料遺失容忍）**：最多 24 小時（取決於最後備份時間）

---

### 情境二：宿主機完全故障

**症狀**：伺服器無法啟動，需遷移到新主機。

**步驟**：

1. 準備新主機，安裝 Docker 與 Docker Compose
2. 將備份目錄複製到新主機：
   ```bash
   rsync -avz /opt/titan/backups/ newhost:/opt/titan/backups/
   rsync -avz /opt/titan/scripts/ newhost:/opt/titan/scripts/
   ```
3. 在新主機上還原設定檔：
   ```bash
   zcat /opt/titan/backups/daily/<時間戳>/configs/.env.gz > /opt/titan/.env
   zcat /opt/titan/backups/daily/<時間戳>/configs/docker-compose.yml.gz > /opt/titan/docker-compose.yml
   ```
4. 啟動服務容器（空資料）：
   ```bash
   docker compose up -d
   ```
5. 等待所有容器健康後執行完整還原：
   ```bash
   ./scripts/restore.sh --timestamp <時間戳> --yes
   ```
6. 重啟所有服務（讓 Outline 等重新連線）：
   ```bash
   docker compose restart
   ```

**預期 RTO**：2 小時
**預期 RPO**：最多 24 小時

---

### 情境三：誤刪資料（邏輯損毀）

**症狀**：使用者誤刪 Outline 文件或 MinIO 物件。

**步驟**：

1. 確認誤刪的時間點
2. 找到誤刪前最近的備份：`./scripts/restore.sh --list`
3. 僅還原受影響的服務，避免影響其他服務
4. 若需要，可先在測試環境中驗證還原結果

**注意**：部分還原可能導致跨服務資料不一致（如 PostgreSQL 中的 URL 指向已刪除的 MinIO 物件），需謹慎評估。

---

### 情境四：備份儲存空間不足

**症狀**：備份磁碟使用率超過 80%。

**緊急處置**：

```bash
# 查看備份空間使用
du -sh /opt/titan/backups/daily/*

# 手動刪除最舊的備份（保留至少 3 份）
ls -lt /opt/titan/backups/daily/ | tail -n +5 | awk '{print $NF}' | \
  xargs -I{} rm -rf /opt/titan/backups/daily/{}
```

**長期方案**：
- 擴充備份磁碟空間
- 考慮使用遠端儲存（S3 或 NFS）

---

## 5. 每月還原演練

### 目的

定期演練確保：
- 備份檔案完整性（非損毀）
- 還原腳本正常運作
- 維運人員熟悉操作流程
- 驗證 RTO 是否符合預期

### 演練排程

| 時間 | 演練類型 | 負責人 |
|------|----------|--------|
| 每月第一個週五 | 完整還原演練（測試環境） | IT 維運 |
| 每季最後一個月 | 災難復原模擬（含宿主機遷移） | IT 維運 + IT 主管 |

### 演練步驟（測試環境）

```bash
# 1. 準備測試環境（獨立主機或 VM）
#    - 複製最新備份到測試環境
#    - 安裝 Docker 與 Docker Compose

# 2. 查看可用備份
./scripts/restore.sh --list

# 3. 執行完整還原
./scripts/restore.sh --timestamp <最新時間戳> --yes

# 4. 驗證所有服務
docker compose ps
curl -s http://localhost:3001/_health
curl -s http://localhost:3000/

# 5. 記錄演練結果
# - 還原開始時間：
# - 還原完成時間：
# - 服務驗證通過：Y/N
# - 發現問題：
# - 改善行動：
```

### 演練記錄範本

```
演練日期：YYYY-MM-DD
執行人員：
備份時間戳：
還原開始：HH:MM
還原完成：HH:MM
實際 RTO：X 分鐘
服務驗證結果：
  - PostgreSQL：通過 / 失敗
  - Redis：通過 / 失敗
  - MinIO：通過 / 失敗
  - Outline：通過 / 失敗
  - Homepage：通過 / 失敗
問題記錄：
下次改善事項：
```

---

## 6. 維運注意事項

### 備份監控

建議設定以下監控告警：

```bash
# 確認昨日備份是否成功（可加入監控腳本）
YESTERDAY=$(date -d "yesterday" +%Y%m%d 2>/dev/null || date -v-1d +%Y%m%d)
if ! ls /opt/titan/backups/daily/ | grep -q "^${YESTERDAY}"; then
  echo "警告：昨日備份不存在！"
fi

# 確認備份磁碟空間
df -h /opt/titan/backups
```

### 備份加密建議

目前 `.env` 備份僅以 `chmod 600` 限制存取。若有更高安全需求：

```bash
# 使用 GPG 加密備份（選用）
gpg --symmetric --cipher-algo AES256 /opt/titan/backups/daily/<時間戳>/configs/.env.gz
```

### 異地備份建議

為防止宿主機同時損毀備份，建議定期將備份同步到異地：

```bash
# 範例：同步到遠端備份伺服器
rsync -avz --delete /opt/titan/backups/ backup-server:/remote/titan-backups/

# 範例：上傳到 S3 相容儲存
mc mirror /opt/titan/backups/ s3backup/titan-backups/
```

### 相關腳本位置

| 腳本 | 路徑 | 說明 |
|------|------|------|
| 備份腳本 | `scripts/backup.sh` | 完整備份，含保留策略 |
| 還原腳本 | `scripts/restore.sh` | 從指定時間戳還原 |
| Cron 設定 | `config/cron/backup-cron` | 每日 02:00 自動備份 |
| 本文件 | `docs/backup-strategy.md` | 備份策略與操作手冊 |

### 備份日誌查詢

```bash
# 查看最新備份日誌
tail -50 /opt/titan/backups/backup.log

# 搜尋錯誤
grep "ERROR" /opt/titan/backups/backup.log

# 查看今日備份狀態
grep "$(date +%Y-%m-%d)" /opt/titan/backups/backup.log
```
