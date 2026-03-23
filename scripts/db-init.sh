#!/usr/bin/env bash
# =============================================================================
# TITAN 資料庫初始化腳本
# 任務：T09 — 資料庫與儲存規劃
# 用途：建立各服務資料庫、專用使用者（最小權限），以及 MinIO Bucket
# 適用環境：銀行 IT 部門封閉網路（Air-Gapped）
#
# 使用方式：
#   chmod +x scripts/db-init.sh
#   ./scripts/db-init.sh
#
# 前置條件：
#   - docker compose up -d postgres minio 已執行且服務健康
#   - 環境變數已設定（參考 .env.example）
#   - mc（MinIO Client）已安裝於 PATH
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 顏色輸出工具
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_section() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}"; }

# ---------------------------------------------------------------------------
# 設定區（從環境變數讀取，提供合理預設值）
# ---------------------------------------------------------------------------

# PostgreSQL 超級管理員
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_ADMIN_USER="${POSTGRES_USER:-titan}"
POSTGRES_ADMIN_PASSWORD="${POSTGRES_PASSWORD:?錯誤：POSTGRES_PASSWORD 環境變數未設定}"

# Outline 資料庫設定
OUTLINE_DB="${OUTLINE_DB:-outline_db}"
OUTLINE_DB_USER="${OUTLINE_DB_USER:-outline_user}"
OUTLINE_DB_PASSWORD="${OUTLINE_DB_PASSWORD:?錯誤：OUTLINE_DB_PASSWORD 環境變數未設定}"
OUTLINE_DB_READONLY_USER="${OUTLINE_DB_READONLY_USER:-outline_readonly}"
OUTLINE_DB_READONLY_PASSWORD="${OUTLINE_DB_READONLY_PASSWORD:-}"

# Plane 資料庫設定
PLANE_DB="${PLANE_DB:-plane_db}"
PLANE_DB_USER="${PLANE_DB_USER:-plane_user}"
PLANE_DB_PASSWORD="${PLANE_DB_PASSWORD:?錯誤：PLANE_DB_PASSWORD 環境變數未設定}"
PLANE_DB_READONLY_USER="${PLANE_DB_READONLY_USER:-plane_readonly}"
PLANE_DB_READONLY_PASSWORD="${PLANE_DB_READONLY_PASSWORD:-}"

# MinIO 設定
MINIO_ALIAS="${MINIO_ALIAS:-titan}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?錯誤：MINIO_ROOT_PASSWORD 環境變數未設定}"

# Bucket 名稱
BUCKET_OUTLINE="${BUCKET_OUTLINE:-outline-attachments}"
BUCKET_PLANE="${BUCKET_PLANE:-plane-uploads}"
BUCKET_BACKUPS="${BUCKET_BACKUPS:-titan-backups}"
BUCKET_EXPORTS="${BUCKET_EXPORTS:-titan-exports}"

# ---------------------------------------------------------------------------
# 工具函數
# ---------------------------------------------------------------------------

# 執行 psql 指令（以管理員身份）
psql_admin() {
    PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -v ON_ERROR_STOP=1 \
        "$@"
}

# 執行 psql 指令至特定資料庫
psql_db() {
    local db="$1"
    shift
    PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_ADMIN_USER}" \
        -d "${db}" \
        -v ON_ERROR_STOP=1 \
        "$@"
}

# 執行 mc 指令
mc_cmd() {
    mc "$@"
}

# 等待 PostgreSQL 就緒
wait_for_postgres() {
    local retries=30
    local wait_sec=2
    log_info "等待 PostgreSQL 就緒（最多 $((retries * wait_sec)) 秒）..."
    for i in $(seq 1 "${retries}"); do
        if PGPASSWORD="${POSTGRES_ADMIN_PASSWORD}" pg_isready \
            -h "${POSTGRES_HOST}" \
            -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_ADMIN_USER}" \
            -q 2>/dev/null; then
            log_ok "PostgreSQL 已就緒"
            return 0
        fi
        log_info "  等待中... (${i}/${retries})"
        sleep "${wait_sec}"
    done
    log_error "PostgreSQL 在等待時間內未就緒，請檢查容器狀態"
    return 1
}

# 等待 MinIO 就緒
wait_for_minio() {
    local retries=30
    local wait_sec=2
    log_info "等待 MinIO 就緒（最多 $((retries * wait_sec)) 秒）..."
    for i in $(seq 1 "${retries}"); do
        if mc_cmd alias list "${MINIO_ALIAS}" &>/dev/null 2>&1; then
            log_ok "MinIO 已就緒"
            return 0
        fi
        log_info "  等待中... (${i}/${retries})"
        sleep "${wait_sec}"
    done
    log_error "MinIO 在等待時間內未就緒，請檢查容器狀態"
    return 1
}

# ---------------------------------------------------------------------------
# 前置檢查
# ---------------------------------------------------------------------------
check_prerequisites() {
    log_section "前置條件檢查"

    local missing=0

    # 檢查 psql
    if ! command -v psql &>/dev/null; then
        log_error "找不到 'psql' 指令，請安裝 postgresql-client"
        missing=$((missing + 1))
    else
        log_ok "psql: $(psql --version)"
    fi

    # 檢查 pg_isready
    if ! command -v pg_isready &>/dev/null; then
        log_error "找不到 'pg_isready' 指令，請安裝 postgresql-client"
        missing=$((missing + 1))
    else
        log_ok "pg_isready: 已找到"
    fi

    # 檢查 mc（MinIO Client）
    if ! command -v mc &>/dev/null; then
        log_warn "找不到 'mc'（MinIO Client），將略過 MinIO 初始化步驟"
        SKIP_MINIO=true
    else
        log_ok "mc: $(mc --version 2>&1 | head -1)"
        SKIP_MINIO=false
    fi

    if [ "${missing}" -gt 0 ]; then
        log_error "缺少必要工具，請先安裝後再執行本腳本"
        exit 1
    fi

    log_ok "前置條件檢查完成"
}

# ---------------------------------------------------------------------------
# PostgreSQL：建立資料庫
# ---------------------------------------------------------------------------
create_databases() {
    log_section "建立 PostgreSQL 資料庫"

    # 建立 Outline 資料庫
    if psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname='${OUTLINE_DB}'" | grep -q 1; then
        log_warn "資料庫 '${OUTLINE_DB}' 已存在，略過建立"
    else
        psql_admin -c "CREATE DATABASE ${OUTLINE_DB}
            WITH
            OWNER = ${POSTGRES_ADMIN_USER}
            ENCODING = 'UTF8'
            LC_COLLATE = 'en_US.utf8'
            LC_CTYPE = 'en_US.utf8'
            TEMPLATE = template0
            CONNECTION LIMIT = 50;"
        log_ok "資料庫 '${OUTLINE_DB}' 建立成功"
    fi

    # 建立 Plane 資料庫
    if psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname='${PLANE_DB}'" | grep -q 1; then
        log_warn "資料庫 '${PLANE_DB}' 已存在，略過建立"
    else
        psql_admin -c "CREATE DATABASE ${PLANE_DB}
            WITH
            OWNER = ${POSTGRES_ADMIN_USER}
            ENCODING = 'UTF8'
            LC_COLLATE = 'en_US.utf8'
            LC_CTYPE = 'en_US.utf8'
            TEMPLATE = template0
            CONNECTION LIMIT = 50;"
        log_ok "資料庫 '${PLANE_DB}' 建立成功"
    fi
}

# ---------------------------------------------------------------------------
# PostgreSQL：建立服務使用者（最小權限）
# ---------------------------------------------------------------------------
create_db_users() {
    log_section "建立 PostgreSQL 服務使用者"

    # ── Outline 服務帳號 ────────────────────────────────────────────────────
    if psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${OUTLINE_DB_USER}'" | grep -q 1; then
        log_warn "使用者 '${OUTLINE_DB_USER}' 已存在，更新密碼"
        psql_admin -c "ALTER USER ${OUTLINE_DB_USER} WITH PASSWORD '${OUTLINE_DB_PASSWORD}';"
    else
        psql_admin -c "CREATE USER ${OUTLINE_DB_USER} WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            CONNECTION LIMIT 10
            PASSWORD '${OUTLINE_DB_PASSWORD}';"
        log_ok "使用者 '${OUTLINE_DB_USER}' 建立成功"
    fi

    # 授予 Outline 服務帳號權限
    psql_admin -c "GRANT CONNECT ON DATABASE ${OUTLINE_DB} TO ${OUTLINE_DB_USER};"
    psql_db "${OUTLINE_DB}" -c "GRANT USAGE ON SCHEMA public TO ${OUTLINE_DB_USER};"
    psql_db "${OUTLINE_DB}" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${OUTLINE_DB_USER};"
    psql_db "${OUTLINE_DB}" -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${OUTLINE_DB_USER};"
    psql_db "${OUTLINE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${OUTLINE_DB_USER};"
    psql_db "${OUTLINE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${OUTLINE_DB_USER};"
    log_ok "Outline 服務帳號 '${OUTLINE_DB_USER}' 權限設定完成"

    # ── Outline 唯讀帳號（選用）────────────────────────────────────────────
    if [ -n "${OUTLINE_DB_READONLY_PASSWORD:-}" ]; then
        if psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${OUTLINE_DB_READONLY_USER}'" | grep -q 1; then
            log_warn "使用者 '${OUTLINE_DB_READONLY_USER}' 已存在，更新密碼"
            psql_admin -c "ALTER USER ${OUTLINE_DB_READONLY_USER} WITH PASSWORD '${OUTLINE_DB_READONLY_PASSWORD}';"
        else
            psql_admin -c "CREATE USER ${OUTLINE_DB_READONLY_USER} WITH
                LOGIN
                NOSUPERUSER
                NOCREATEDB
                NOCREATEROLE
                NOREPLICATION
                CONNECTION LIMIT 5
                PASSWORD '${OUTLINE_DB_READONLY_PASSWORD}';"
            log_ok "使用者 '${OUTLINE_DB_READONLY_USER}' 建立成功"
        fi
        psql_admin -c "GRANT CONNECT ON DATABASE ${OUTLINE_DB} TO ${OUTLINE_DB_READONLY_USER};"
        psql_db "${OUTLINE_DB}" -c "GRANT USAGE ON SCHEMA public TO ${OUTLINE_DB_READONLY_USER};"
        psql_db "${OUTLINE_DB}" -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${OUTLINE_DB_READONLY_USER};"
        psql_db "${OUTLINE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${OUTLINE_DB_READONLY_USER};"
        log_ok "Outline 唯讀帳號 '${OUTLINE_DB_READONLY_USER}' 權限設定完成"
    else
        log_warn "OUTLINE_DB_READONLY_PASSWORD 未設定，略過建立唯讀帳號"
    fi

    # ── Plane 服務帳號 ───────────────────────────────────────────────────────
    if psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PLANE_DB_USER}'" | grep -q 1; then
        log_warn "使用者 '${PLANE_DB_USER}' 已存在，更新密碼"
        psql_admin -c "ALTER USER ${PLANE_DB_USER} WITH PASSWORD '${PLANE_DB_PASSWORD}';"
    else
        psql_admin -c "CREATE USER ${PLANE_DB_USER} WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            CONNECTION LIMIT 15
            PASSWORD '${PLANE_DB_PASSWORD}';"
        log_ok "使用者 '${PLANE_DB_USER}' 建立成功"
    fi

    # 授予 Plane 服務帳號權限
    psql_admin -c "GRANT CONNECT ON DATABASE ${PLANE_DB} TO ${PLANE_DB_USER};"
    psql_db "${PLANE_DB}" -c "GRANT USAGE ON SCHEMA public TO ${PLANE_DB_USER};"
    psql_db "${PLANE_DB}" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PLANE_DB_USER};"
    psql_db "${PLANE_DB}" -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PLANE_DB_USER};"
    psql_db "${PLANE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${PLANE_DB_USER};"
    psql_db "${PLANE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${PLANE_DB_USER};"
    log_ok "Plane 服務帳號 '${PLANE_DB_USER}' 權限設定完成"

    # ── Plane 唯讀帳號（選用）──────────────────────────────────────────────
    if [ -n "${PLANE_DB_READONLY_PASSWORD:-}" ]; then
        if psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PLANE_DB_READONLY_USER}'" | grep -q 1; then
            log_warn "使用者 '${PLANE_DB_READONLY_USER}' 已存在，更新密碼"
            psql_admin -c "ALTER USER ${PLANE_DB_READONLY_USER} WITH PASSWORD '${PLANE_DB_READONLY_PASSWORD}';"
        else
            psql_admin -c "CREATE USER ${PLANE_DB_READONLY_USER} WITH
                LOGIN
                NOSUPERUSER
                NOCREATEDB
                NOCREATEROLE
                NOREPLICATION
                CONNECTION LIMIT 5
                PASSWORD '${PLANE_DB_READONLY_PASSWORD}';"
            log_ok "使用者 '${PLANE_DB_READONLY_USER}' 建立成功"
        fi
        psql_admin -c "GRANT CONNECT ON DATABASE ${PLANE_DB} TO ${PLANE_DB_READONLY_USER};"
        psql_db "${PLANE_DB}" -c "GRANT USAGE ON SCHEMA public TO ${PLANE_DB_READONLY_USER};"
        psql_db "${PLANE_DB}" -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${PLANE_DB_READONLY_USER};"
        psql_db "${PLANE_DB}" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${PLANE_DB_READONLY_USER};"
        log_ok "Plane 唯讀帳號 '${PLANE_DB_READONLY_USER}' 權限設定完成"
    else
        log_warn "PLANE_DB_READONLY_PASSWORD 未設定，略過建立唯讀帳號"
    fi
}

# ---------------------------------------------------------------------------
# PostgreSQL：啟用必要擴展
# ---------------------------------------------------------------------------
setup_extensions() {
    log_section "設定 PostgreSQL 擴展"

    for db in "${OUTLINE_DB}" "${PLANE_DB}"; do
        log_info "在 '${db}' 啟用擴展..."
        psql_db "${db}" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" && \
            log_ok "  ${db}: uuid-ossp 已啟用"
        psql_db "${db}" -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";" && \
            log_ok "  ${db}: pg_trgm 已啟用"
    done
}

# ---------------------------------------------------------------------------
# MinIO：設定別名並建立 Bucket
# ---------------------------------------------------------------------------
setup_minio() {
    log_section "設定 MinIO 物件儲存"

    if [ "${SKIP_MINIO:-false}" = "true" ]; then
        log_warn "略過 MinIO 初始化（mc 指令不可用）"
        return 0
    fi

    # 設定 mc 別名
    log_info "設定 MinIO Client 別名 '${MINIO_ALIAS}'..."
    mc_cmd alias set "${MINIO_ALIAS}" \
        "${MINIO_ENDPOINT}" \
        "${MINIO_ROOT_USER}" \
        "${MINIO_ROOT_PASSWORD}" \
        --api S3v4 2>&1

    # 等待 MinIO 就緒
    wait_for_minio

    # 建立各 Bucket
    local buckets=(
        "${BUCKET_OUTLINE}"
        "${BUCKET_PLANE}"
        "${BUCKET_BACKUPS}"
        "${BUCKET_EXPORTS}"
    )

    for bucket in "${buckets[@]}"; do
        if mc_cmd ls "${MINIO_ALIAS}/${bucket}" &>/dev/null 2>&1; then
            log_warn "Bucket '${bucket}' 已存在，略過建立"
        else
            mc_cmd mb "${MINIO_ALIAS}/${bucket}"
            log_ok "Bucket '${bucket}' 建立成功"
        fi

        # 設定所有 Bucket 為私有（拒絕匿名存取）
        mc_cmd anonymous set none "${MINIO_ALIAS}/${bucket}" 2>/dev/null || \
        mc_cmd anonymous set private "${MINIO_ALIAS}/${bucket}" 2>/dev/null || \
        log_warn "  無法設定 '${bucket}' 存取策略（mc 版本差異），請手動確認"
        log_ok "  '${bucket}' 存取策略：Private"
    done

    # 設定 titan-backups 生命週期：30 天後刪除
    log_info "設定 '${BUCKET_BACKUPS}' 生命週期規則（30 天）..."
    mc_cmd ilm add --expiry-days 30 "${MINIO_ALIAS}/${BUCKET_BACKUPS}" 2>/dev/null && \
        log_ok "  生命週期規則設定完成（30 天後刪除）" || \
        log_warn "  生命週期規則設定失敗（可能需手動於 MinIO Console 設定）"

    # 設定 titan-exports 生命週期：90 天後刪除
    log_info "設定 '${BUCKET_EXPORTS}' 生命週期規則（90 天）..."
    mc_cmd ilm add --expiry-days 90 "${MINIO_ALIAS}/${BUCKET_EXPORTS}" 2>/dev/null && \
        log_ok "  生命週期規則設定完成（90 天後刪除）" || \
        log_warn "  生命週期規則設定失敗（可能需手動於 MinIO Console 設定）"

    # 測試寫入健康檢查檔
    log_info "測試 MinIO 寫入能力..."
    echo "healthcheck" | mc_cmd pipe "${MINIO_ALIAS}/${BUCKET_OUTLINE}/.healthcheck" && \
        mc_cmd rm "${MINIO_ALIAS}/${BUCKET_OUTLINE}/.healthcheck" && \
        log_ok "MinIO 讀寫測試通過" || \
        log_warn "MinIO 讀寫測試失敗，請手動檢查"
}

# ---------------------------------------------------------------------------
# 驗證：列出資料庫與 Bucket
# ---------------------------------------------------------------------------
verify_setup() {
    log_section "驗證初始化結果"

    log_info "PostgreSQL 資料庫清單："
    psql_admin -c "\l ${OUTLINE_DB} ${PLANE_DB}" 2>/dev/null || \
    psql_admin -tAc "SELECT datname FROM pg_database WHERE datname IN ('${OUTLINE_DB}', '${PLANE_DB}') ORDER BY datname;"

    log_info "PostgreSQL 服務帳號清單："
    psql_admin -tAc "SELECT rolname, rolcanlogin, rolconnlimit FROM pg_roles WHERE rolname IN ('${OUTLINE_DB_USER}', '${PLANE_DB_USER}', '${OUTLINE_DB_READONLY_USER}', '${PLANE_DB_READONLY_USER}') ORDER BY rolname;"

    if [ "${SKIP_MINIO:-false}" = "false" ]; then
        log_info "MinIO Bucket 清單："
        mc_cmd ls "${MINIO_ALIAS}/" 2>/dev/null || log_warn "無法列出 MinIO Bucket"
    fi
}

# ---------------------------------------------------------------------------
# 列印後續步驟
# ---------------------------------------------------------------------------
print_next_steps() {
    log_section "初始化完成"

    echo ""
    echo "  後續設定步驟："
    echo ""
    echo "  1. 設定 Outline 連線字串（config/outline.env）："
    echo "     DATABASE_URL=postgres://${OUTLINE_DB_USER}:<密碼>@postgres:5432/${OUTLINE_DB}"
    echo ""
    echo "  2. 設定 Plane 連線字串（config/plane/.env）："
    echo "     DATABASE_URL=postgresql://${PLANE_DB_USER}:<密碼>@postgres:5432/${PLANE_DB}"
    echo "     REDIS_URL=redis://:<密碼>@redis:6379/1"
    echo ""
    echo "  3. 啟動應用服務："
    echo "     docker compose up -d outline"
    echo "     docker compose -f plane-docker-compose.yml up -d"
    echo ""
    echo "  4. 執行 Outline 資料庫 Migration："
    echo "     docker compose exec outline yarn db:migrate"
    echo ""
    echo "  5. 健康檢查："
    echo "     ./scripts/db-health-check.sh"
    echo ""
    echo "  詳細規劃請參考：docs/database-plan.md"
    echo ""
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
main() {
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  TITAN — 資料庫與儲存初始化腳本 (T09)"
    echo "══════════════════════════════════════════════════════"
    echo ""

    check_prerequisites
    wait_for_postgres
    create_databases
    create_db_users
    setup_extensions
    setup_minio
    verify_setup
    print_next_steps
}

main "$@"
