# PostgreSQL 自動 Failover

Issue: #252 — PostgreSQL 單點故障 — 無自動 failover

## 概述

TITAN 使用 shell-based failover monitor 實現 PostgreSQL 自動故障轉移。設計目標：

| 項目 | 規格 |
|------|------|
| RTO（Recovery Time Objective） | ≤ 10 分鐘 |
| 適用規模 | 5 人 IT 團隊 |
| 環境 | 銀行離線（air-gapped）網路 |
| 架構 | 單次 failover（Primary → Replica promote） |

## 架構

```
┌──────────────────┐       ┌──────────────────────┐
│  titan-postgres  │──WAL──│ titan-postgres-replica│
│   (Primary, RW)  │       │   (Standby, RO)      │
└────────┬─────────┘       └──────────┬───────────┘
         │                            │
         └──────────┬─────────────────┘
                    │
           ┌────────┴────────┐
           │ titan-pg-monitor │
           │ (健康檢查 loop)  │
           └─────────────────┘
                    │
         每 10 秒檢查 Primary
         連續 3 次失敗 → promote Replica
```

## 啟動方式

```bash
# 完整啟動（base + replication + failover）
docker compose -f docker-compose.yml \
  -f docker-compose.replication.yml \
  -f docker-compose.failover.yml up -d
```

## 環境變數

在 `.env` 中設定（皆有預設值，可不改）：

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `FAILOVER_CHECK_INTERVAL` | `10` | 健康檢查間隔（秒） |
| `FAILOVER_FAILURE_THRESHOLD` | `3` | 連續失敗幾次觸發 failover |
| `FAILOVER_CHECK_TIMEOUT` | `5` | 單次檢查超時（秒） |

偵測到故障的時間 = `CHECK_INTERVAL × FAILURE_THRESHOLD` = 預設 30 秒。

## Failover 流程

### 自動 Failover（預設行為）

1. `titan-pg-monitor` 每 10 秒向 Primary 發送 `pg_isready` + `pg_is_in_recovery()` 查詢
2. 連續 3 次檢查失敗（共 ~30 秒）
3. 確認 Replica 可連線且處於 standby 模式
4. 檢查 Replica 的 replication lag
5. 執行 `pg_promote(true, 60)` 將 Replica 提升為新 Primary
6. 驗證提升成功（`pg_is_in_recovery()` 回傳 `f`）
7. 記錄 failover 事件至 `/var/log/titan/pg-failover.log`
8. Monitor 進入觀察模式

### 手動 Failover

```bash
# 進入 monitor 容器執行
docker exec -it titan-pg-monitor \
  /opt/titan/pg-failover.sh --manual
```

如果 Primary 仍在運行，會要求輸入 `YES` 確認。

## 狀態檢查

```bash
# 從 monitor 容器檢查狀態
docker exec -it titan-pg-monitor \
  /opt/titan/pg-failover.sh --status

# 查看 monitor 日誌
docker logs titan-pg-monitor --tail 50

# 查看 failover 日誌檔
docker exec -it titan-pg-monitor \
  cat /var/log/titan/pg-failover.log
```

### 判斷目前 Primary 是誰

```bash
# 檢查原 Primary
docker exec titan-postgres \
  psql -U titan -d titan -tAc "SELECT pg_is_in_recovery();"
# f = Primary, t = Standby

# 檢查原 Replica
docker exec titan-postgres-replica \
  psql -U titan -d titan -tAc "SELECT pg_is_in_recovery();"
# f = 已被提升為 Primary, t = 仍為 Standby
```

## Failover 後恢復

Failover 完成後，舊 Primary 需要人工處理。以下為恢復步驟：

### 步驟 1：確認 Failover 狀態

```bash
docker exec titan-pg-monitor /opt/titan/pg-failover.sh --status
```

### 步驟 2：停止舊 Primary

```bash
docker compose -f docker-compose.yml \
  -f docker-compose.replication.yml \
  -f docker-compose.failover.yml \
  stop postgres
```

### 步驟 3：將舊 Primary 重建為新 Replica

```bash
# 1. 清除舊 Primary 資料
docker volume rm titan-postgres-data

# 2. 重新建立（此時需要交換角色設定）
#    修改 .env 或 docker-compose.override.yml 使：
#    - titan-postgres-replica 為 Primary（已被 promote）
#    - titan-postgres 為新 Replica

# 3. 或者更簡單：從新 Primary 重新做 pg_basebackup
docker exec titan-postgres bash -c "
  rm -rf /var/lib/postgresql/data/*
  PGPASSWORD=\$REPLICATION_PASSWORD pg_basebackup \
    -h titan-postgres-replica -p 5432 \
    -U \$REPLICATION_USER \
    -D /var/lib/postgresql/data \
    -Fp -Xs -P -R \
    --checkpoint=fast
  touch /var/lib/postgresql/data/standby.signal
  chmod 0700 /var/lib/postgresql/data
"

# 4. 重啟服務
docker compose -f docker-compose.yml \
  -f docker-compose.replication.yml \
  -f docker-compose.failover.yml \
  restart postgres
```

### 步驟 4：驗證恢復

```bash
# 確認新的 replication 正常
docker exec titan-postgres-replica \
  psql -U titan -d titan -tAc \
  "SELECT client_addr, state, sent_lsn, replay_lsn FROM pg_stat_replication;"
```

## 限制與注意事項

1. **單次 failover**：此設計為單向 promote。Failover 後 Monitor 不會再自動 failback。需人工恢復。
2. **應用程式連線**：Failover 後，應用程式的 `DATABASE_URL` 仍指向 `titan-postgres`。若 Primary 被 promote 的是 Replica，需要：
   - 將舊 Primary 容器重建為 proxy/redirect，或
   - 更新應用程式 `DATABASE_URL` 指向 `titan-postgres-replica`，或
   - 使用上方恢復步驟重建角色
3. **資料遺失**：若 Primary 突然故障，可能遺失尚未同步到 Replica 的 WAL（asynchronous replication）。對 5 人團隊而言，風險極低。
4. **不適用於**：多節點叢集、自動 failback、讀寫分離路由。如有需要，請評估 Patroni 或 pg_auto_failover。

## 疑難排解

### Monitor 無法連線到 Primary

```bash
# 確認網路連通
docker exec titan-pg-monitor pg_isready -h titan-postgres -U titan

# 確認 Primary 容器運行中
docker ps | grep titan-postgres
```

### Failover 未觸發

```bash
# 檢查 Monitor 是否運行
docker logs titan-pg-monitor --tail 20

# 確認失敗閾值設定
docker exec titan-pg-monitor env | grep FAILOVER
```

### Promote 失敗

```bash
# 手動 promote
docker exec titan-postgres-replica \
  psql -U titan -d titan -c "SELECT pg_promote(true, 60);"

# 或使用 pg_ctl
docker exec titan-postgres-replica pg_ctl promote -D /var/lib/postgresql/data
```
