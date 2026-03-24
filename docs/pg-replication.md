# PostgreSQL Primary-Replica Replication

> Issue #198 — 讀寫分離，提升可用性與讀取效能

## 架構

```
                        WAL Streaming
titan-postgres ─────────────────────────→ titan-postgres-replica
 (Primary, RW)          replication slot     (Standby, RO)
   :5432                                        :5432
```

- **Primary** (`titan-postgres`)：處理所有寫入操作，與現有基礎設施完全相容
- **Replica** (`titan-postgres-replica`)：接收 WAL 串流，提供唯讀查詢
- 使用 Physical Replication Slot 確保 WAL 不會在 replica 消費前被回收

## 前置條件

1. 在 `.env` 中新增 replication 相關變數：

```bash
# PostgreSQL Replication（僅在啟用 replication 時需要）
REPLICATION_USER=replicator
REPLICATION_PASSWORD=<使用 openssl rand -hex 32 產生>
REPLICATION_SLOT=titan_replica_slot
```

2. 如果 primary 已在運行，首次啟用需要重啟（`wal_level` 變更需要重啟）

## 啟動方式

```bash
# 與基礎 compose 合併啟動
docker compose -f docker-compose.yml \
  -f docker-compose.replication.yml up -d
```

首次啟動流程：
1. Primary 啟動 → 執行 `primary-init.sh`（建立 replication user、設定 WAL、建立 slot）
2. Primary 重啟（wal_level 變更生效）
3. Replica 啟動 → 執行 `replica-init.sh`（等待 primary → pg_basebackup → standby 模式）

## 驗證

### 確認 Primary WAL 設定

```bash
docker exec titan-postgres psql -U titan -d titan -c "SHOW wal_level;"
# 應顯示：replica

docker exec titan-postgres psql -U titan -d titan -c "SELECT * FROM pg_replication_slots;"
# 應顯示 titan_replica_slot
```

### 確認 Replica 狀態

```bash
# 確認 replica 處於 recovery 模式
docker exec titan-postgres-replica psql -U titan -d titan -c "SELECT pg_is_in_recovery();"
# 應顯示：t

# 查看 replication 延遲
docker exec titan-postgres psql -U titan -d titan -c \
  "SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
          now() - write_lag AS write_lag
   FROM pg_stat_replication;"
```

### 確認讀取可用

```bash
# 在 replica 上執行唯讀查詢
docker exec titan-postgres-replica psql -U titan -d titan -c "SELECT count(*) FROM pg_tables;"
```

## 應用程式整合

### 讀寫分離連線字串

| 用途 | 連線字串 |
|------|---------|
| 寫入 (Primary) | `postgresql://titan:PASSWORD@titan-postgres:5432/titan` |
| 唯讀 (Replica) | `postgresql://titan:PASSWORD@titan-postgres-replica:5432/titan` |

### Prisma 整合（未來）

Prisma 目前不原生支援 read replica，但可透過以下方式實現：
- 使用 `@prisma/extension-read-replicas` 擴充套件
- 或在應用層透過連線池 (PgBouncer) 實現路由

## 監控

### 關鍵指標

| 指標 | 查詢方式 | 告警閾值 |
|------|---------|---------|
| Replication Lag | `pg_stat_replication.write_lag` | > 30s |
| Slot 活躍狀態 | `pg_replication_slots.active` | = false |
| WAL Archive 積壓 | `pg_stat_archiver.last_archived_wal` | 停滯 > 10min |

### 健康檢查

Replica 的 healthcheck 同時驗證：
1. PostgreSQL 服務可回應連線 (`pg_isready`)
2. 確認處於 standby 模式 (`pg_is_in_recovery() = true`)

## 故障處理

### Replica 同步中斷

```bash
# 1. 檢查 replication 狀態
docker exec titan-postgres psql -U titan -d titan -c "SELECT * FROM pg_stat_replication;"

# 2. 如果 replica 完全脫離，重建 replica
docker compose -f docker-compose.yml -f docker-compose.replication.yml \
  stop postgres-replica
docker volume rm titan-postgres-replica-data
docker compose -f docker-compose.yml -f docker-compose.replication.yml \
  up -d postgres-replica
```

### Primary 故障（手動 Failover）

> 注意：此為手動流程。自動 failover 需額外工具（如 Patroni）。

```bash
# 1. 停止 primary
docker compose -f docker-compose.yml -f docker-compose.replication.yml \
  stop postgres

# 2. 提升 replica 為 primary
docker exec titan-postgres-replica pg_ctl promote -D /var/lib/postgresql/data

# 3. 更新應用程式連線字串指向 replica
# 4. 重建原 primary 為新的 replica
```

## 檔案清單

| 檔案 | 用途 |
|------|------|
| `docker-compose.replication.yml` | Replication 附加 compose（覆寫 primary + 新增 replica） |
| `config/postgres/primary-init.sh` | Primary 初始化（WAL + replication user + slot） |
| `config/postgres/replica-init.sh` | Replica 初始化（pg_basebackup + standby 設定） |
| `docs/pg-replication.md` | 本文件 |
