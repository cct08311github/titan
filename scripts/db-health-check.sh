#!/usr/bin/env bash
# =============================================================================
# TITAN 資料服務健康檢查腳本
# 任務：T09 — 資料庫與儲存規劃
# 用途：檢查 PostgreSQL、Redis、MinIO 連線狀態與基本統計
# 適用環境：銀行 IT 部門封閉網路（Air-Gapped）
#
# 使用方式：
#   chmod +x scripts/db-health-check.sh
#   ./scripts/db-health-check.sh           # 互動式彩色輸出
#   ./scripts/db-health-check.sh --json    # JSON 格式輸出（適合監控整合）
#   ./scripts/db-health-check.sh --quiet   # 僅顯示失敗項目
#
# 回傳碼：
#   0 — 所有服務健康
#   1 — 部分服務異常（詳見輸出）
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 設定區
# ---------------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_ADMIN_USER="${POSTGRES_USER:-titan}"
POSTGRES_ADMIN_PASSWORD="${POSTGRES_PASSWORD:-}"

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}"
MINIO_ALIAS="${MINIO_ALIAS:-titan}"

# 檢查對象資料庫
OUTLINE_DB="${OUTLINE_DB:-outline_db}"
PLANE_DB="${PLANE_DB:-plane_db}"

# 輸出模式
OUTPUT_MODE="${1:-normal}"   # normal | --json | --quiet

# ---------------------------------------------------------------------------
# 顏色輸出
# ---------------------------------------------------------------------------
if [ "${OUTPUT_MODE}" = "--json" ]; then
    # JSON 模式不使用顏色
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
fi

# ---------------------------------------------------------------------------
# 全域狀態追蹤
# ---------------------------------------------------------------------------
declare -A CHECK_RESULTS   # check_name -> "PASS|FAIL|WARN|SKIP"
declare -A CHECK_DETAILS   # check_name -> 詳細訊息
OVERALL_STATUS="PASS"
TIMESTAMP=$(date -Iseconds 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S%z")

# ---------------------------------------------------------------------------
# 輸出工具
# ---------------------------------------------------------------------------
log_check_pass() {
    local name="$1"
    local detail="${2:-}"
    CHECK_RESULTS["${name}"]="PASS"
    CHECK_DETAILS["${name}"]="${detail}"
    if [ "${OUTPUT_MODE}" != "--quiet" ] && [ "${OUTPUT_MODE}" != "--json" ]; then
        echo -e "  ${GREEN}[PASS]${NC} ${name}${detail:+: ${detail}}"
    fi
}

log_check_fail() {
    local name="$1"
    local detail="${2:-}"
    CHECK_RESULTS["${name}"]="FAIL"
    CHECK_DETAILS["${name}"]="${detail}"
    OVERALL_STATUS="FAIL"
    if [ "${OUTPUT_MODE}" != "--json" ]; then
        echo -e "  ${RED}[FAIL]${NC} ${name}${detail:+: ${detail}}"
    fi
}

log_check_warn() {
    local name="$1"
    local detail="${2:-}"
    CHECK_RESULTS["${name}"]="WARN"
    CHECK_DETAILS["${name}"]="${detail}"
    if [ "${OVERALL_STATUS}" = "PASS" ]; then
        OVERALL_STATUS="WARN"
    fi
    if [ "${OUTPUT_MODE}" != "--quiet" ] && [ "${OUTPUT_MODE}" != "--json" ]; then
        echo -e "  ${YELLOW}[WARN]${NC} ${name}${detail:+: ${detail}}"
    fi
}

log_check_skip() {
    local name="$1"
    local detail="${2:-}"
    CHECK_RESULTS["${name}"]="SKIP"
    CHECK_DETAILS["${name}"]="${detail}"
    if [ "${OUTPUT_MODE}" != "--quiet" ] && [ "${OUTPUT_MODE}" != "--json" ]; then
        echo -e "  ${BLUE}[SKIP]${NC} ${name}${detail:+: ${detail}}"
    fi
}

log_section() {
    if [ "${OUTPUT_MODE}" != "--json" ]; then
        echo -e "\n${CYAN}${BOLD}▶ $*${NC}"
    fi
}

# ---------------------------------------------------------------------------
# PostgreSQL 健康檢查
# ---------------------------------------------------------------------------
check_postgres() {
    log_section "PostgreSQL 健康檢查"

    # 工具可用性
    if ! command -v psql &>/dev/null || ! command -v pg_isready &>/dev/null; then
        log_check_skip "postgres_tools" "psql/pg_isready 不在 PATH，略過 PostgreSQL 檢查"
        return 0
    fi

    # 1. 連線測試
    if PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" pg_isready \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -q 2>/dev/null; then
        log_check_pass "postgres_connectivity" "${POSTGRES_HOST}:${POSTGRES_PORT}"
    else
        log_check_fail "postgres_connectivity" "無法連線至 ${POSTGRES_HOST}:${POSTGRES_PORT}"
        return 1
    fi

    # 執行 psql 查詢的包裝函數
    local psql_base="PGPASSWORD=${POSTGRES_ADMIN_PASSWORD} psql -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_ADMIN_USER} -tAq"

    # 2. PostgreSQL 版本
    local pg_version
    pg_version=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -tAc "SELECT version();" 2>/dev/null | head -1 | cut -d' ' -f1-3) || true
    if [ -n "${pg_version}" ]; then
        log_check_pass "postgres_version" "${pg_version}"
    else
        log_check_warn "postgres_version" "無法取得版本資訊"
    fi

    # 3. 資料庫存在性
    for db in "${OUTLINE_DB}" "${PLANE_DB}"; do
        local db_exists
        db_exists=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
            -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_ADMIN_USER}" \
            -tAc "SELECT 1 FROM pg_database WHERE datname='${db}';" 2>/dev/null) || true
        if [ "${db_exists}" = "1" ]; then
            log_check_pass "postgres_db_${db}" "資料庫存在"
        else
            log_check_fail "postgres_db_${db}" "資料庫不存在（請執行 db-init.sh）"
        fi
    done

    # 4. 連線統計
    local active_conn
    active_conn=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -tAc "SELECT count(*) FROM pg_stat_activity WHERE state='active';" 2>/dev/null) || active_conn="N/A"
    local max_conn
    max_conn=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -tAc "SHOW max_connections;" 2>/dev/null) || max_conn="N/A"
    log_check_pass "postgres_connections" "活躍連線 ${active_conn} / 最大 ${max_conn}"

    # 5. 資料庫大小
    for db in "${OUTLINE_DB}" "${PLANE_DB}"; do
        local db_size
        db_size=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
            -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_ADMIN_USER}" \
            -tAc "SELECT pg_size_pretty(pg_database_size('${db}'));" 2>/dev/null) || db_size="N/A"
        log_check_pass "postgres_size_${db}" "${db_size}"
    done

    # 6. 長時間運行查詢偵測（超過 5 分鐘）
    local long_queries
    long_queries=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -tAc "SELECT count(*) FROM pg_stat_activity WHERE state='active' AND now() - query_start > interval '5 minutes';" 2>/dev/null) || long_queries="0"
    if [ "${long_queries}" = "0" ] || [ "${long_queries}" = "" ]; then
        log_check_pass "postgres_long_queries" "無長時間查詢"
    else
        log_check_warn "postgres_long_queries" "${long_queries} 個查詢超過 5 分鐘，請確認是否正常"
    fi

    # 7. 複製槽（replication slot）積壓偵測
    local replication_lag
    replication_lag=$(PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -tAc "SELECT count(*) FROM pg_replication_slots WHERE active = false;" 2>/dev/null) || replication_lag="0"
    if [ "${replication_lag}" = "0" ] || [ "${replication_lag}" = "" ]; then
        log_check_pass "postgres_replication" "無非活躍複製槽"
    else
        log_check_warn "postgres_replication" "${replication_lag} 個非活躍複製槽，可能導致 WAL 積壓"
    fi
}

# ---------------------------------------------------------------------------
# Redis 健康檢查
# ---------------------------------------------------------------------------
check_redis() {
    log_section "Redis 健康檢查"

    # 工具可用性
    if ! command -v redis-cli &>/dev/null; then
        log_check_skip "redis_tools" "redis-cli 不在 PATH，略過 Redis 檢查"
        return 0
    fi

    # Redis CLI 包裝函數
    redis_cmd() {
        if [ -n "${REDIS_PASSWORD}" ]; then
            redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" --no-auth-warning "$@" 2>/dev/null
        else
            redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" "$@" 2>/dev/null
        fi
    }

    # 1. 連線測試（PING）
    local ping_result
    ping_result=$(redis_cmd PING 2>/dev/null) || ping_result=""
    if [ "${ping_result}" = "PONG" ]; then
        log_check_pass "redis_connectivity" "${REDIS_HOST}:${REDIS_PORT}"
    else
        log_check_fail "redis_connectivity" "PING 失敗（回應：${ping_result:-無回應}）"
        return 1
    fi

    # 2. Redis 版本
    local redis_version
    redis_version=$(redis_cmd INFO server 2>/dev/null | grep "redis_version" | cut -d: -f2 | tr -d '[:space:]') || redis_version="N/A"
    log_check_pass "redis_version" "Redis ${redis_version}"

    # 3. 記憶體使用量
    local used_memory
    used_memory=$(redis_cmd INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '[:space:]') || used_memory="N/A"
    local max_memory
    max_memory=$(redis_cmd INFO memory 2>/dev/null | grep "^maxmemory_human" | cut -d: -f2 | tr -d '[:space:]') || max_memory="N/A"
    log_check_pass "redis_memory" "使用 ${used_memory}，上限 ${max_memory:-未設定}"

    # 4. 連線數
    local connected_clients
    connected_clients=$(redis_cmd INFO clients 2>/dev/null | grep "connected_clients" | cut -d: -f2 | tr -d '[:space:]') || connected_clients="N/A"
    log_check_pass "redis_clients" "目前連線數：${connected_clients}"

    # 5. 各 DB Keyspace 狀態
    local outline_keys plane_keys
    outline_keys=$(redis_cmd -n 0 DBSIZE 2>/dev/null) || outline_keys="N/A"
    plane_keys=$(redis_cmd -n 1 DBSIZE 2>/dev/null) || plane_keys="N/A"
    log_check_pass "redis_keyspace_db0" "Outline (DB 0)：${outline_keys} 個 key"
    log_check_pass "redis_keyspace_db1" "Plane (DB 1)：${plane_keys} 個 key"

    # 6. 持久化狀態（RDB）
    local rdb_last_save
    rdb_last_save=$(redis_cmd LASTSAVE 2>/dev/null) || rdb_last_save="0"
    if [ "${rdb_last_save}" != "0" ] && [ -n "${rdb_last_save}" ]; then
        local save_age=$(( $(date +%s) - rdb_last_save ))
        local save_hours=$(( save_age / 3600 ))
        if [ "${save_hours}" -lt 24 ]; then
            log_check_pass "redis_persistence" "上次 RDB 儲存：${save_hours} 小時前"
        else
            log_check_warn "redis_persistence" "上次 RDB 儲存距今 ${save_hours} 小時，請確認持久化設定"
        fi
    else
        log_check_warn "redis_persistence" "無法取得 RDB 儲存時間"
    fi

    # 7. Slow Log 積壓
    local slowlog_count
    slowlog_count=$(redis_cmd SLOWLOG LEN 2>/dev/null) || slowlog_count="0"
    if [ "${slowlog_count:-0}" -lt 10 ]; then
        log_check_pass "redis_slowlog" "Slow Log 項目數：${slowlog_count}"
    else
        log_check_warn "redis_slowlog" "Slow Log 積壓 ${slowlog_count} 條，可能有效能問題"
    fi
}

# ---------------------------------------------------------------------------
# MinIO 健康檢查
# ---------------------------------------------------------------------------
check_minio() {
    log_section "MinIO 健康檢查"

    local minio_available=false

    # 優先使用 mc（MinIO Client）
    if command -v mc &>/dev/null; then
        # 設定 mc 別名（若未設定）
        mc alias set "${MINIO_ALIAS}" \
            "${MINIO_ENDPOINT}" \
            "${MINIO_ROOT_USER}" \
            "${MINIO_ROOT_PASSWORD}" \
            --api S3v4 >/dev/null 2>&1 || true

        # 1. 連線測試
        if mc admin info "${MINIO_ALIAS}" &>/dev/null 2>&1; then
            log_check_pass "minio_connectivity" "${MINIO_ENDPOINT}"
            minio_available=true
        else
            log_check_fail "minio_connectivity" "無法連線至 ${MINIO_ENDPOINT}（mc admin info 失敗）"
        fi

        if [ "${minio_available}" = "true" ]; then
            # 2. 檢查各 Bucket 存在性
            local buckets=("outline-attachments" "plane-uploads" "titan-backups" "titan-exports")
            for bucket in "${buckets[@]}"; do
                if mc ls "${MINIO_ALIAS}/${bucket}" &>/dev/null 2>&1; then
                    local bucket_size
                    bucket_size=$(mc du "${MINIO_ALIAS}/${bucket}" 2>/dev/null | awk '{print $1}') || bucket_size="N/A"
                    log_check_pass "minio_bucket_${bucket}" "大小：${bucket_size}"
                else
                    log_check_fail "minio_bucket_${bucket}" "Bucket 不存在（請執行 db-init.sh）"
                fi
            done

            # 3. 磁碟使用量
            local disk_info
            disk_info=$(mc admin info "${MINIO_ALIAS}" 2>/dev/null | grep -E "Used|Total" | head -2 | tr '\n' ' ') || disk_info="N/A"
            log_check_pass "minio_disk" "${disk_info:-請至 MinIO Console 查看}"

            # 4. 寫入測試
            local write_test
            write_test=$(echo "healthcheck-$(date +%s)" | mc pipe "${MINIO_ALIAS}/outline-attachments/.healthcheck" 2>/dev/null && \
                mc rm "${MINIO_ALIAS}/outline-attachments/.healthcheck" 2>/dev/null && echo "ok") || write_test=""
            if [ "${write_test}" = "ok" ]; then
                log_check_pass "minio_write_test" "讀寫測試通過"
            else
                log_check_warn "minio_write_test" "讀寫測試失敗，請手動確認"
            fi
        fi

    elif command -v curl &>/dev/null; then
        # 降級：使用 curl 測試 MinIO Health Endpoint
        local health_endpoint="${MINIO_ENDPOINT}/minio/health/live"
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${health_endpoint}" 2>/dev/null) || http_code="000"
        if [ "${http_code}" = "200" ]; then
            log_check_pass "minio_connectivity" "${MINIO_ENDPOINT} (HTTP ${http_code})"
        else
            log_check_fail "minio_connectivity" "Health endpoint 回傳 HTTP ${http_code}（端點：${health_endpoint}）"
        fi
        log_check_skip "minio_buckets" "mc 不可用，略過 Bucket 詳細檢查"
    else
        log_check_skip "minio_all" "mc 與 curl 均不在 PATH，略過 MinIO 檢查"
    fi
}

# ---------------------------------------------------------------------------
# 輸出健康報告
# ---------------------------------------------------------------------------
print_report_text() {
    local pass_count=0
    local fail_count=0
    local warn_count=0
    local skip_count=0

    for key in "${!CHECK_RESULTS[@]}"; do
        case "${CHECK_RESULTS[$key]}" in
            PASS) pass_count=$((pass_count + 1)) ;;
            FAIL) fail_count=$((fail_count + 1)) ;;
            WARN) warn_count=$((warn_count + 1)) ;;
            SKIP) skip_count=$((skip_count + 1)) ;;
        esac
    done

    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  TITAN 資料服務健康報告${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
    echo "  檢查時間：${TIMESTAMP}"
    echo ""

    case "${OVERALL_STATUS}" in
        PASS) echo -e "  整體狀態：${GREEN}${BOLD}HEALTHY${NC}" ;;
        WARN) echo -e "  整體狀態：${YELLOW}${BOLD}DEGRADED${NC}（有警告項目）" ;;
        FAIL) echo -e "  整體狀態：${RED}${BOLD}UNHEALTHY${NC}（有異常項目）" ;;
    esac

    echo ""
    echo -e "  ${GREEN}通過：${pass_count}${NC}  ${RED}失敗：${fail_count}${NC}  ${YELLOW}警告：${warn_count}${NC}  ${BLUE}略過：${skip_count}${NC}"
    echo ""

    if [ "${fail_count}" -gt 0 ]; then
        echo -e "${RED}失敗項目：${NC}"
        for key in "${!CHECK_RESULTS[@]}"; do
            if [ "${CHECK_RESULTS[$key]}" = "FAIL" ]; then
                echo -e "  ${RED}✗${NC} ${key}: ${CHECK_DETAILS[$key]}"
            fi
        done
        echo ""
    fi

    if [ "${warn_count}" -gt 0 ]; then
        echo -e "${YELLOW}警告項目：${NC}"
        for key in "${!CHECK_RESULTS[@]}"; do
            if [ "${CHECK_RESULTS[$key]}" = "WARN" ]; then
                echo -e "  ${YELLOW}!${NC} ${key}: ${CHECK_DETAILS[$key]}"
            fi
        done
        echo ""
    fi

    echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
}

print_report_json() {
    local checks_json=""
    local first=true

    for key in "${!CHECK_RESULTS[@]}"; do
        if [ "${first}" = "true" ]; then
            first=false
        else
            checks_json="${checks_json},"
        fi
        # 簡單 JSON 轉義
        local detail="${CHECK_DETAILS[$key]//\"/\\\"}"
        checks_json="${checks_json}\"${key}\":{\"status\":\"${CHECK_RESULTS[$key]}\",\"detail\":\"${detail}\"}"
    done

    echo "{"
    echo "  \"timestamp\": \"${TIMESTAMP}\","
    echo "  \"overall_status\": \"${OVERALL_STATUS}\","
    echo "  \"checks\": {${checks_json}}"
    echo "}"
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
main() {
    if [ "${OUTPUT_MODE}" != "--json" ]; then
        echo ""
        echo "══════════════════════════════════════════════════════"
        echo "  TITAN — 資料服務健康檢查 (T09)"
        echo "══════════════════════════════════════════════════════"
        echo ""
    fi

    check_postgres
    check_redis
    check_minio

    if [ "${OUTPUT_MODE}" = "--json" ]; then
        print_report_json
    else
        print_report_text
    fi

    # 回傳碼
    case "${OVERALL_STATUS}" in
        PASS) exit 0 ;;
        WARN) exit 0 ;;  # 警告不阻斷，僅記錄
        FAIL) exit 1 ;;
    esac
}

main "$@"
