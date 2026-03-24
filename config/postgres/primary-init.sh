#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN — PostgreSQL Primary 初始化腳本
# 啟用 WAL 歸檔 + 建立 Replication Slot
# 此腳本在 primary 容器首次啟動時執行
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
REPL_USER="${REPLICATION_USER:-replicator}"
REPL_PASSWORD="${REPLICATION_PASSWORD:?REPLICATION_PASSWORD is required}"
REPL_SLOT="${REPLICATION_SLOT:-titan_replica_slot}"

echo "[primary-init] Configuring PostgreSQL primary for streaming replication..."

# ── 1. 建立 replication 使用者 ──────────────────────────────
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-titan}" --dbname "${POSTGRES_DB:-titan}" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${REPL_USER}') THEN
            CREATE ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASSWORD}';
            RAISE NOTICE 'Created replication user: ${REPL_USER}';
        ELSE
            ALTER ROLE ${REPL_USER} WITH PASSWORD '${REPL_PASSWORD}';
            RAISE NOTICE 'Updated password for replication user: ${REPL_USER}';
        END IF;
    END
    \$\$;
EOSQL

# ── 2. 設定 WAL 參數（寫入 postgresql.conf）────────────────
# 使用 ALTER SYSTEM 確保設定持久化
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-titan}" --dbname "${POSTGRES_DB:-titan}" <<-EOSQL
    -- WAL 歸檔設定
    ALTER SYSTEM SET wal_level = 'replica';
    ALTER SYSTEM SET max_wal_senders = 5;
    ALTER SYSTEM SET max_replication_slots = 5;
    ALTER SYSTEM SET wal_keep_size = '256MB';
    ALTER SYSTEM SET hot_standby = on;
    -- WAL 歸檔（本地備份用）
    ALTER SYSTEM SET archive_mode = on;
    ALTER SYSTEM SET archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f';
EOSQL

# ── 3. 設定 pg_hba.conf 允許 replication 連線 ──────────────
# 檢查是否已有 replication 規則，避免重複新增
if ! grep -q "replication.*${REPL_USER}" "${PGDATA}/pg_hba.conf" 2>/dev/null; then
    echo "" >> "${PGDATA}/pg_hba.conf"
    echo "# ── TITAN Replication ──────────────────────────────" >> "${PGDATA}/pg_hba.conf"
    echo "host    replication    ${REPL_USER}    0.0.0.0/0    scram-sha-256" >> "${PGDATA}/pg_hba.conf"
    echo "[primary-init] Added replication entry to pg_hba.conf"
fi

# ── 4. 建立 WAL archive 目錄 ───────────────────────────────
mkdir -p /var/lib/postgresql/wal_archive
echo "[primary-init] WAL archive directory created"

# ── 5. 建立 Replication Slot ───────────────────────────────
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-titan}" --dbname "${POSTGRES_DB:-titan}" <<-EOSQL
    SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${REPL_SLOT}')
        THEN pg_create_physical_replication_slot('${REPL_SLOT}')
    END;
EOSQL

echo "[primary-init] Replication slot '${REPL_SLOT}' ensured"

# ── 6. Reload 設定（若 server 已運行）──────────────────────
pg_ctl reload -D "${PGDATA}" 2>/dev/null || true

echo "[primary-init] Primary configuration complete. Restart required for wal_level change."
