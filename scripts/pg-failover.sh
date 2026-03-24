#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN — PostgreSQL Automatic Failover Script
# Issue #252: PostgreSQL 單點故障 — 無自動 failover
#
# 功能：
#   1. 偵測 Primary 不可用（連續 N 次健康檢查失敗）
#   2. 將 Replica 提升為新 Primary（promote）
#   3. 記錄 failover 事件（audit log）
#
# 使用方式：
#   自動（由 titan-pg-monitor 容器執行）：
#     /opt/titan/pg-failover.sh --auto
#   手動（人工觸發 failover）：
#     /opt/titan/pg-failover.sh --manual
#   狀態檢查：
#     /opt/titan/pg-failover.sh --status
#
# RTO 目標：≤ 10 分鐘（含偵測 + promote + 服務重連）
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ── 設定 ──────────────────────────────────────────────────
PRIMARY_HOST="${PRIMARY_HOST:-titan-postgres}"
REPLICA_HOST="${REPLICA_HOST:-titan-postgres-replica}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${POSTGRES_USER:-titan}"
PG_DB="${POSTGRES_DB:-titan}"
PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export PGPASSWORD

# 自動 failover 參數
CHECK_INTERVAL="${FAILOVER_CHECK_INTERVAL:-10}"       # 每 N 秒檢查一次
FAILURE_THRESHOLD="${FAILOVER_FAILURE_THRESHOLD:-3}"   # 連續 N 次失敗觸發 failover
CHECK_TIMEOUT="${FAILOVER_CHECK_TIMEOUT:-5}"           # 單次檢查超時秒數

# 日誌與狀態檔
LOG_DIR="/var/log/titan"
LOG_FILE="${LOG_DIR}/pg-failover.log"
STATE_FILE="/tmp/pg-failover-state"

# ── 工具函數 ──────────────────────────────────────────────
log() {
    local level="$1"; shift
    local msg
    msg="$(date '+%Y-%m-%d %H:%M:%S') [${level}] $*"
    echo "$msg"
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

check_primary() {
    # 嘗試連線 Primary 並確認不是 standby
    if timeout "$CHECK_TIMEOUT" pg_isready -h "$PRIMARY_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
        local is_recovery
        is_recovery=$(timeout "$CHECK_TIMEOUT" psql -h "$PRIMARY_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
        if [ "$is_recovery" = "f" ]; then
            return 0  # Primary 正常（非 recovery 模式）
        fi
    fi
    return 1  # Primary 不可用
}

check_replica() {
    # 確認 Replica 可連線且處於 standby 模式
    if timeout "$CHECK_TIMEOUT" pg_isready -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
        local is_recovery
        is_recovery=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
        if [ "$is_recovery" = "t" ]; then
            return 0  # Replica 正常（在 recovery/standby 模式）
        fi
    fi
    return 1  # Replica 不可用或已非 standby
}

promote_replica() {
    log "WARN" "=== FAILOVER 開始 ==="
    log "WARN" "Primary ($PRIMARY_HOST) 不可用，準備提升 Replica ($REPLICA_HOST)..."

    # 確認 Replica 仍可用
    if ! check_replica; then
        log "ERROR" "Replica ($REPLICA_HOST) 也不可用！無法執行 failover"
        log "ERROR" "需要人工介入處理"
        return 1
    fi

    # 檢查 Replica 的 replication lag
    local lag
    lag=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
        "SELECT CASE WHEN pg_last_wal_receive_lsn() IS NOT NULL
                THEN extract(epoch FROM now() - pg_last_xact_replay_timestamp())::int
                ELSE -1 END;" 2>/dev/null || echo "-1")
    log "INFO" "Replica replication lag: ${lag}s"

    # 執行 promote
    log "WARN" "執行 pg_promote() on $REPLICA_HOST..."
    local promote_result
    promote_result=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
        "SELECT pg_promote(true, 60);" 2>&1)

    if [ "$promote_result" = "t" ]; then
        log "WARN" "pg_promote() 成功！"
    else
        log "ERROR" "pg_promote() 失敗: $promote_result"
        return 1
    fi

    # 等待 Replica 完成提升
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        local is_recovery
        is_recovery=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
        if [ "$is_recovery" = "f" ]; then
            log "WARN" "=== FAILOVER 完成 ==="
            log "WARN" "新 Primary: $REPLICA_HOST（原 Replica 已提升）"
            log "WARN" "原 Primary ($PRIMARY_HOST) 需要人工處理（重建為 Replica 或修復）"
            log "WARN" "請參閱 docs/pg-failover.md 了解恢復步驟"

            # 寫入狀態檔
            echo "FAILOVER_COMPLETED=$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$STATE_FILE"
            echo "NEW_PRIMARY=$REPLICA_HOST" >> "$STATE_FILE"
            echo "OLD_PRIMARY=$PRIMARY_HOST" >> "$STATE_FILE"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
    done

    log "ERROR" "Replica 提升超時（${max_wait}s），需要人工介入"
    return 1
}

show_status() {
    echo "═══════════════════════════════════════════════════"
    echo " TITAN PostgreSQL Failover 狀態"
    echo "═══════════════════════════════════════════════════"
    echo ""

    # 檢查 Primary
    echo -n "Primary ($PRIMARY_HOST): "
    if check_primary; then
        echo "✅ 正常運行"
        local primary_uptime
        primary_uptime=$(timeout "$CHECK_TIMEOUT" psql -h "$PRIMARY_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
            "SELECT now() - pg_postmaster_start_time();" 2>/dev/null || echo "N/A")
        echo "  運行時間: $primary_uptime"
    else
        echo "❌ 不可用"
    fi

    # 檢查 Replica
    echo -n "Replica ($REPLICA_HOST): "
    if check_replica; then
        echo "✅ 正常（Standby 模式）"
        local lag
        lag=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
            "SELECT CASE WHEN pg_last_wal_receive_lsn() IS NOT NULL
                    THEN extract(epoch FROM now() - pg_last_xact_replay_timestamp())::int || 's'
                    ELSE 'N/A' END;" 2>/dev/null || echo "N/A")
        echo "  Replication lag: $lag"
    else
        # 可能已被提升為 Primary
        local is_recovery
        is_recovery=$(timeout "$CHECK_TIMEOUT" psql -h "$REPLICA_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
        if [ "$is_recovery" = "f" ]; then
            echo "⚠️  已提升為 Primary（非 Standby 模式）"
        else
            echo "❌ 不可用"
        fi
    fi

    # 檢查 failover 狀態
    echo ""
    if [ -f "$STATE_FILE" ]; then
        echo "⚠️  Failover 記錄存在："
        cat "$STATE_FILE"
    else
        echo "ℹ️  尚未發生 failover"
    fi
    echo ""
}

run_monitor() {
    log "INFO" "TITAN PostgreSQL Failover Monitor 啟動"
    log "INFO" "Primary: $PRIMARY_HOST, Replica: $REPLICA_HOST"
    log "INFO" "檢查間隔: ${CHECK_INTERVAL}s, 容錯次數: $FAILURE_THRESHOLD"

    local consecutive_failures=0

    while true; do
        if check_primary; then
            if [ $consecutive_failures -gt 0 ]; then
                log "INFO" "Primary 恢復正常（前次連續失敗 ${consecutive_failures} 次）"
            fi
            consecutive_failures=0
        else
            consecutive_failures=$((consecutive_failures + 1))
            log "WARN" "Primary 健康檢查失敗 (${consecutive_failures}/${FAILURE_THRESHOLD})"

            if [ $consecutive_failures -ge "$FAILURE_THRESHOLD" ]; then
                log "WARN" "連續 ${FAILURE_THRESHOLD} 次失敗，觸發自動 failover"
                if promote_replica; then
                    log "WARN" "自動 failover 完成，Monitor 進入觀察模式"
                    # Failover 後持續監控新 Primary 但不再觸發 failover
                    while true; do
                        sleep "$CHECK_INTERVAL"
                        log "INFO" "[觀察模式] 新 Primary ($REPLICA_HOST) 運行中"
                    done
                else
                    log "ERROR" "自動 failover 失敗！需要人工介入"
                    # 持續嘗試但增加間隔，避免風暴
                    consecutive_failures=0
                    sleep 60
                fi
            fi
        fi

        sleep "$CHECK_INTERVAL"
    done
}

# ── 主程式 ────────────────────────────────────────────────
case "${1:-}" in
    --auto)
        run_monitor
        ;;
    --manual)
        log "WARN" "手動 failover 觸發"
        if check_primary; then
            echo "⚠️  Primary ($PRIMARY_HOST) 目前正常運作！"
            echo "確定要強制 failover 嗎？（這會造成短暫服務中斷）"
            read -r -p "輸入 'YES' 確認: " confirm
            if [ "$confirm" != "YES" ]; then
                echo "已取消"
                exit 0
            fi
        fi
        promote_replica
        ;;
    --status)
        show_status
        ;;
    *)
        echo "用法: $0 {--auto|--manual|--status}"
        echo ""
        echo "  --auto    啟動自動監控（由 titan-pg-monitor 容器使用）"
        echo "  --manual  手動觸發 failover（需確認）"
        echo "  --status  顯示目前 Primary/Replica 狀態"
        exit 1
        ;;
esac
