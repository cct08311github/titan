#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN — PostgreSQL Replica 初始化腳本
# 從 Primary 執行 pg_basebackup 並設定 Standby 模式
# 此腳本作為 replica 容器的 entrypoint wrapper 執行
# ═══════════════════════════════════════════════════════════
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PRIMARY_HOST="${PRIMARY_HOST:-titan-postgres}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
REPL_USER="${REPLICATION_USER:-replicator}"
REPL_PASSWORD="${REPLICATION_PASSWORD:?REPLICATION_PASSWORD is required}"
REPL_SLOT="${REPLICATION_SLOT:-titan_replica_slot}"

echo "[replica-init] Starting replica initialization..."

# ── 1. 等待 Primary 就緒 ───────────────────────────────────
echo "[replica-init] Waiting for primary at ${PRIMARY_HOST}:${PRIMARY_PORT}..."
until PGPASSWORD="${REPL_PASSWORD}" pg_isready -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" -U "${REPL_USER}" 2>/dev/null; do
    echo "[replica-init] Primary not ready, waiting 3s..."
    sleep 3
done
echo "[replica-init] Primary is ready"

# ── 2. 檢查是否已初始化 ────────────────────────────────────
if [ -f "${PGDATA}/PG_VERSION" ] && [ -f "${PGDATA}/standby.signal" ]; then
    echo "[replica-init] Data directory already initialized as standby, starting PostgreSQL..."
    exec docker-entrypoint.sh postgres
fi

# ── 3. 清空 PGDATA 並執行 base backup ─────────────────────
echo "[replica-init] Performing pg_basebackup from primary..."
rm -rf "${PGDATA}"/*

PGPASSWORD="${REPL_PASSWORD}" pg_basebackup \
    -h "${PRIMARY_HOST}" \
    -p "${PRIMARY_PORT}" \
    -U "${REPL_USER}" \
    -D "${PGDATA}" \
    -Fp -Xs -P -R \
    --slot="${REPL_SLOT}" \
    --checkpoint=fast

echo "[replica-init] Base backup completed"

# ── 4. 確認 standby.signal 存在（pg_basebackup -R 會建立）─
if [ ! -f "${PGDATA}/standby.signal" ]; then
    touch "${PGDATA}/standby.signal"
    echo "[replica-init] Created standby.signal"
fi

# ── 5. 設定 primary_conninfo（若尚未由 -R 自動寫入）───────
if ! grep -q "primary_conninfo" "${PGDATA}/postgresql.auto.conf" 2>/dev/null; then
    cat >> "${PGDATA}/postgresql.auto.conf" <<EOF

# TITAN Replication — Standby Configuration
primary_conninfo = 'host=${PRIMARY_HOST} port=${PRIMARY_PORT} user=${REPL_USER} password=${REPL_PASSWORD} application_name=titan-replica'
primary_slot_name = '${REPL_SLOT}'
EOF
    echo "[replica-init] Wrote primary_conninfo to postgresql.auto.conf"
fi

# ── 6. 設定唯讀模式 ────────────────────────────────────────
cat >> "${PGDATA}/postgresql.auto.conf" <<EOF

# Standby tuning
hot_standby = on
hot_standby_feedback = on
max_standby_streaming_delay = 30s
max_standby_archive_delay = 60s
EOF

# ── 7. 修正權限 ────────────────────────────────────────────
chmod 0700 "${PGDATA}"

echo "[replica-init] Replica initialization complete, starting PostgreSQL in standby mode..."

# ── 8. 啟動 PostgreSQL ─────────────────────────────────────
exec docker-entrypoint.sh postgres
