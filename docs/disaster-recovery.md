# TITAN 災難復原計畫（Disaster Recovery Plan）

**文件版本**: v1.0
**撰寫日期**: 2026-03-24
**適用對象**: IT 主管、資深工程師、值班人員
**機密等級**: 內部限閱
**審核週期**: 每半年複審，重大架構變更時立即更新

---

## 1. 概述

本文件定義 TITAN 工作管理系統在發生災難性事件時的復原程序，包含資料備份策略、系統復原步驟、定期演練計畫及相關 Docker 操作指令。

---

## 2. RPO/RTO 目標

| 指標 | 定義 | TITAN 目標 | 說明 |
|------|------|----------|------|
| **RPO** (Recovery Point Objective) | 可接受的最大資料遺失時間 | **4 小時** | 每 4 小時備份一次，最差情況損失 4 小時資料 |
| **RTO** (Recovery Time Objective) | 服務中斷後恢復服務的最大時間 | **2 小時** | 從收到告警到服務重新上線 |

### 2.1 目標說明

- TITAN 為內部工作管理工具，非即時交易系統，4 小時 RPO 在業務可接受範圍
- 2 小時 RTO 考量到人工操作、備份還原、系統驗證的合理時間
- 如實際情況允許，應盡量縮短至 1 小時內完成

---

## 3. 備份策略

### 3.1 備份對象與頻率

| 備份對象 | 備份方式 | 頻率 | 保留期限 |
|---------|---------|------|---------|
| PostgreSQL 資料庫 | pg_dump（邏輯備份）| 每 4 小時 | 30 天 |
| PostgreSQL 資料庫 | WAL 歸檔（連續備份）| 持續 | 7 天 |
| Docker Volumes（應用資料）| volume backup | 每日 00:00 | 14 天 |
| 應用程式設定檔 | Git repository | 每次變更 | 永久 |
| 環境變數（.env）| 加密備份 | 每次變更 | 永久 |
| Nginx 設定 | Git repository | 每次變更 | 永久 |

### 3.2 備份位置

| 備份層級 | 位置 | 說明 |
|---------|------|------|
| 第一層（本機）| `/backup/titan/` | 主要備份，快速復原用 |
| 第二層（NAS）| `\\NAS-BACKUP\titan\` | 機房內 NAS，防單點故障 |
| 第三層（異地）| 依銀行異地備份規範 | 防機房整體故障 |

> 重要：第三層異地備份依銀行整體 BCP 政策執行，若尚未納入銀行 BCP 計畫，應優先提出申請。

### 3.3 備份驗證

- 每週日 02:00 自動執行備份完整性驗證
- 每月第一個週六進行完整復原演練（見第 6 章）
- 若備份失敗，立即發送告警至 IT 主管

---

## 4. 備份操作指令

### 4.1 PostgreSQL 資料庫備份

**手動備份（立即執行）**

```bash
# 進入專案目錄
cd /opt/titan

# 執行 pg_dump 備份
docker-compose exec postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --no-acl \
  --no-owner \
  -f /tmp/titan_backup_$(date +%Y%m%d_%H%M%S).dump

# 將備份檔複製到主機
docker cp titan-postgres-1:/tmp/titan_backup_*.dump /backup/titan/db/

# 驗證備份檔完整性
pg_restore --list /backup/titan/db/titan_backup_*.dump | head -20
```

**自動備份排程（crontab）**

```bash
# 編輯 root 的 crontab
crontab -e

# 加入以下排程（每 4 小時備份一次）
0 */4 * * * /opt/titan/scripts/backup-db.sh >> /var/log/titan-backup.log 2>&1

# backup-db.sh 腳本內容
#!/bin/bash
BACKUP_DIR="/backup/titan/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/titan_db_$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

docker-compose -f /opt/titan/docker-compose.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --format=custom \
  > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] Database backup successful: $BACKUP_FILE"
    # 清理 30 天前的備份
    find "$BACKUP_DIR" -name "titan_db_*.dump" -mtime +30 -delete
else
    echo "[$TIMESTAMP] ERROR: Database backup FAILED"
    # 發送告警（依環境調整）
    exit 1
fi
```

### 4.2 Docker Volumes 備份

```bash
# 列出所有 TITAN 相關 volumes
docker volume ls | grep titan

# 備份應用 volumes（含上傳檔案、設定等）
VOLUMES=("titan_postgres_data" "titan_redis_data" "titan_uploads")
BACKUP_DIR="/backup/titan/volumes"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

for VOLUME in "${VOLUMES[@]}"; do
    echo "Backing up volume: $VOLUME"
    docker run --rm \
        -v "$VOLUME":/source:ro \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf "/backup/${VOLUME}_${TIMESTAMP}.tar.gz" -C /source .
    echo "  -> Done: ${VOLUME}_${TIMESTAMP}.tar.gz"
done
```

### 4.3 完整系統快照備份

```bash
# 停機備份（最可靠，適用於計劃維護窗口）
cd /opt/titan

# 停止服務
docker-compose down

# 備份所有 volumes
docker run --rm \
    -v titan_postgres_data:/pg_data:ro \
    -v titan_uploads:/uploads:ro \
    -v /backup/titan:/backup \
    alpine sh -c "
        tar czf /backup/full_snapshot_$(date +%Y%m%d_%H%M%S).tar.gz \
            /pg_data /uploads
    "

# 重啟服務
docker-compose up -d
```

---

## 5. 災難復原步驟

### 5.1 情境一：應用程式異常（資料庫正常）

**適用情況**：Next.js 服務崩潰、容器異常退出、記憶體溢出

**步驟**：

```bash
# Step 1: 確認問題範圍
docker-compose ps
docker-compose logs --tail=100 app

# Step 2: 嘗試重啟應用容器
docker-compose restart app

# Step 3: 若重啟無效，重新建立容器
docker-compose up -d --force-recreate app

# Step 4: 確認服務恢復
curl -f http://localhost:3000/api/health
# 預期回應: {"status":"ok","timestamp":"..."}

# Step 5: 確認日誌正常
docker-compose logs --tail=50 app
```

預估時間：10-30 分鐘

---

### 5.2 情境二：資料庫異常（需從備份還原）

**適用情況**：PostgreSQL 資料損毀、誤刪資料、資料庫容器無法啟動

**步驟**：

```bash
# Step 1: 停止所有服務（防止持續寫入損壞資料）
cd /opt/titan
docker-compose down

# Step 2: 確認可用備份
ls -la /backup/titan/db/
# 選擇最近的備份檔，例如：titan_db_20260324_120000.dump

# Step 3: 移除損壞的 postgres volume（不可逆！確認後執行）
docker volume rm titan_postgres_data

# Step 4: 重新建立 postgres 容器（空資料庫）
docker-compose up -d postgres
sleep 10  # 等待 postgres 啟動

# Step 5: 還原備份
BACKUP_FILE="/backup/titan/db/titan_db_20260324_120000.dump"

docker-compose exec -T postgres pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    < "$BACKUP_FILE"

# Step 6: 驗證資料完整性
docker-compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT COUNT(*) FROM tasks;" \
    -c "SELECT COUNT(*) FROM users;" \
    -c "SELECT MAX(updated_at) FROM tasks;"

# Step 7: 啟動其餘服務
docker-compose up -d

# Step 8: 功能驗證
curl -f http://localhost:3000/api/health
```

預估時間：30-90 分鐘（依資料量而定）

---

### 5.3 情境三：伺服器完全損毀（需異機復原）

**適用情況**：主機硬體故障、VM 損毀、需要整機遷移

**前提條件**：新主機已安裝 Docker + Docker Compose，且可存取備份 NAS

**步驟**：

```bash
# --- 在新主機上執行 ---

# Step 1: 安裝基本環境
apt-get update && apt-get install -y docker.io docker-compose git

# Step 2: 取得應用程式碼
git clone https://github.com/[org]/titan.git /opt/titan
cd /opt/titan

# Step 3: 復原環境設定
# 從備份 NAS 取得加密的 .env 檔
cp /mnt/NAS-BACKUP/titan/config/.env.encrypted /opt/titan/
# 使用金鑰解密（依實際加密方式調整）
openssl enc -d -aes-256-cbc -in .env.encrypted -out .env -k "$DECRYPT_KEY"

# Step 4: 啟動資料庫容器
docker-compose up -d postgres
sleep 15

# Step 5: 還原最新資料庫備份
LATEST_BACKUP=$(ls -t /mnt/NAS-BACKUP/titan/db/titan_db_*.dump | head -1)
echo "Restoring from: $LATEST_BACKUP"

docker-compose exec -T postgres pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    < "$LATEST_BACKUP"

# Step 6: 還原 uploads volume（若有）
docker run --rm \
    -v titan_uploads:/uploads \
    -v /mnt/NAS-BACKUP/titan/volumes:/backup \
    alpine sh -c "
        LATEST=$(ls -t /backup/titan_uploads_*.tar.gz | head -1)
        tar xzf $LATEST -C /uploads
    "

# Step 7: 啟動完整服務
docker-compose up -d

# Step 8: 驗證服務
docker-compose ps
curl -f http://localhost:3000/api/health

# Step 9: 更新 DNS / 反向代理指向新主機 IP
```

預估時間：1.5-3 小時

---

### 5.4 情境四：資安事件（被入侵或資料外洩）

**此情況優先通報資安主管，再執行技術處理。**

```bash
# Step 1: 立即隔離系統（停止對外服務）
iptables -I INPUT -p tcp --dport 3000 -j DROP
iptables -I INPUT -p tcp --dport 443 -j DROP

# Step 2: 保留現場證據（不要立即刪除）
# 備份當前日誌
docker-compose logs > /tmp/titan_incident_$(date +%Y%m%d_%H%M%S).log

# Step 3: 通報資安主管（同步進行）
# 提供：發現時間、異常跡象、受影響範圍

# Step 4: 依資安主管指示決定後續處理
# 可能需要：完整磁碟映像、鑑識調查、事件報告
```

---

## 6. 定期演練計畫

### 6.1 演練類型與頻率

| 演練類型 | 頻率 | 時間 | 參與人員 |
|---------|------|------|---------|
| 備份驗證演練 | 每月 | 第一個週六 09:00-11:00 | 值班工程師 |
| 應用層復原演練 | 每季 | 季末週六 09:00-12:00 | 全體 IT 工程師 |
| 完整 DR 演練 | 每半年 | 半年末週六 09:00-17:00 | 全體 IT 團隊 |
| 資安事件桌上演練 | 每年 | 依規劃 | IT 團隊 + 資安主管 |

### 6.2 演練執行標準

**每月備份驗證演練（2 小時）**

目標：確認備份檔可被成功還原

步驟：
1. 在測試環境（非生產）啟動一個乾淨的 PostgreSQL 容器
2. 從最新備份還原資料庫
3. 驗證關鍵資料表筆數與最新記錄時間
4. 填寫演練記錄表
5. 刪除測試環境

通過標準：
- 備份還原成功率 = 100%
- 任務資料筆數符合預期（誤差 < 1%）

**季度復原演練（3 小時）**

目標：驗證完整 RTO 達成能力

步驟：
1. 模擬應用容器異常，計時開始
2. 依本文件 5.1 或 5.2 情境執行復原
3. 服務恢復後驗證功能完整性
4. 記錄實際 RTO 時間
5. 填寫演練報告，如超過 2 小時目標需分析原因

**半年完整 DR 演練（1 天）**

目標：驗證異機完整復原能力（情境三）

步驟：
1. 準備一台全新測試主機（或 VM）
2. 依本文件 5.3 執行完整復原
3. 驗證所有功能正常運作
4. 記錄實際復原時間
5. 撰寫 DR 演練報告，提交 CIO 存查

### 6.3 演練記錄

每次演練必須填寫演練記錄表（保存於 TITAN 系統的文件管理模組），內容包含：

- 演練日期、類型
- 參與人員
- 執行步驟與結果
- 實際 RPO/RTO 達成情況
- 發現的問題與改善建議
- 負責人簽名

---

## 7. 緊急聯絡資訊

| 角色 | 姓名 | 聯絡方式 | 備用聯絡 |
|------|------|---------|---------|
| IT 主管 | （依實際填入）| 手機：XXXX-XXXX | 分機：XXXX |
| 值班工程師 | （輪值填入）| 手機：XXXX-XXXX | — |
| 資安主管 | （依實際填入）| 手機：XXXX-XXXX | 分機：XXXX |
| 機房管理 | — | 分機：XXXX | — |
| NAS 管理員 | — | 分機：XXXX | — |

> 注意：此表需定期更新，人員異動時立即更新。

---

## 8. HA 選項：PostgreSQL Primary-Replica

> 參考 Issue #198、`docs/pg-replication.md`、`docker-compose.replication.yml`

### 8.1 架構概述

TITAN 支援 PostgreSQL Streaming Replication，提供讀寫分離與快速故障切換能力：

```
titan-postgres (Primary, RW)
        │  WAL Streaming
        ▼
titan-postgres-replica (Standby, RO)
```

### 8.2 DR 效益

| 指標 | 無 Replica | 啟用 Replica |
|------|-----------|-------------|
| RPO | 4 小時（依備份週期） | 近乎 0（WAL 即時串流） |
| RTO | 30-90 分鐘（需還原備份） | 5-15 分鐘（Promote replica） |
| 讀取負載 | 集中於 Primary | 分散至 Replica |

### 8.3 故障切換步驟

當 Primary 不可用時，將 Replica 提升為新 Primary：

```bash
# Step 1: 確認 Primary 確實不可用
docker exec titan-postgres pg_isready || echo "Primary is DOWN"

# Step 2: Promote Replica
docker exec titan-postgres-replica pg_ctl promote -D /var/lib/postgresql/data

# Step 3: 更新應用程式連線指向新 Primary
# 修改 .env 中 DATABASE_URL 指向 replica 的 IP/hostname

# Step 4: 重啟應用服務
docker compose restart app

# Step 5: 驗證
docker exec titan-postgres-replica psql -U titan -d titan -c "SELECT pg_is_in_recovery();"
# 預期回傳 false（已不再是 standby）
```

### 8.4 啟用方式

詳見 `docs/pg-replication.md` 與 `docker-compose.replication.yml`。

啟用指令：
```bash
docker compose -f docker-compose.yml -f docker-compose.replication.yml up -d
```

### 8.5 自動 Failover（docker-compose.failover.yml）

進階方案使用 `docker-compose.failover.yml` 搭配 health check 自動偵測並切換，
詳見 `docs/pg-failover.md`。

---

## 9. DR 計畫維護

- **每半年複審**：IT 主管與相關工程師確認步驟仍然有效
- **架構變更時**：任何影響備份或復原路徑的架構變更，必須同步更新本文件
- **演練後**：若演練發現步驟有誤，立即更新並通知所有相關人員
- **版本控制**：本文件納入 Git 管理，所有變更須有 commit 記錄
- **Replica 啟用後**：更新 DR 演練步驟，納入 failover 切換練習

---

*本文件由 IT 主管核准後生效。最後一次 DR 演練記錄請見 TITAN 系統文件管理模組。*
