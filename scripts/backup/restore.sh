#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN 還原腳本
# 任務: T19 — 備份與還原機制
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ============================================================
# 色彩輸出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}\n"
}

# ============================================================
# 使用說明
# ============================================================
usage() {
    echo "用法: $0 [選項]"
    echo ""
    echo "選項:"
    echo "  -h, --help           顯示此幫助訊息"
    echo "  --postgres <檔案>    還原 PostgreSQL"
    echo "  --minio <檔案>       還原 MinIO"
    echo "  --config <檔案>      還原 Config"
    echo "  --all                還原所有元件"
    echo ""
    echo "範例:"
    echo "  $0 --postgres /opt/titan/backups/postgres/postgres_20240323.dump"
    echo "  $0 --all"
    exit 1
}

# ============================================================
# 解析參數
# ============================================================
RESTORE_POSTGRES=""
RESTORE_MINIO=""
RESTORE_CONFIG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        --postgres)
            RESTORE_POSTGRES="$2"
            shift 2
            ;;
        --minio)
            RESTORE_MINIO="$2"
            shift 2
            ;;
        --config)
            RESTORE_CONFIG="$2"
            shift 2
            ;;
        --all)
            RESTORE_POSTGRES="latest"
            RESTORE_MINIO="latest"
            RESTORE_CONFIG="latest"
            shift
            ;;
        *)
            log_error "未知選項: $1"
            usage
            ;;
    esac
done

# ============================================================
# 環境變數
# ============================================================
: "${BACKUP_DIR:=/opt/titan/backups}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=titan}"
: "${POSTGRES_DB:=titan}"
: "${MINIO_ENDPOINT:=localhost:9000}"
: "${MINIO_ACCESS_KEY:=minioadmin}"
: "${MINIO_SECRET_KEY:=minioadmin}"
: "${TITAN_ROOT:=/opt/titan}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================
# 累積式 Cleanup（防止雙重 trap 覆蓋）
# ============================================================
TEMP_DIRS=()
_cleanup() {
    if [[ ${#TEMP_DIRS[@]} -gt 0 ]]; then
        rm -rf "${TEMP_DIRS[@]}"
    fi
}
trap _cleanup EXIT

# ============================================================
# 開始還原
# ============================================================
log_section "TITAN 還原開始"

# ============================================================
# 1. 還原 PostgreSQL
# ============================================================
if [ -n "${RESTORE_POSTGRES}" ]; then
    log_section "還原 PostgreSQL"
    
    # 解析備份檔案路徑
    if [ "${RESTORE_POSTGRES}" = "latest" ]; then
        BACKUP_FILE="${BACKUP_DIR}/postgres/latest.dump"
    else
        BACKUP_FILE="${RESTORE_POSTGRES}"
    fi
    
    if [ ! -f "${BACKUP_FILE}" ]; then
        log_error "PostgreSQL 備份檔案不存在: ${BACKUP_FILE}"
        exit 1
    fi
    
    log_info "準備還原 PostgreSQL from: ${BACKUP_FILE}"
    log_warn "⚠️  此操作將覆蓋現有資料庫！"
    read -p "確認繼續? (yes/no): " CONFIRM
    
    if [ "${CONFIRM}" != "yes" ]; then
        log_info "取消還原"
        exit 0
    fi
    
    # 停止相關服務
    log_info "停止 Outline 服務..."
    cd "${TITAN_ROOT}" || { log_error "無法切換目錄: ${TITAN_ROOT}"; exit 1; }
    docker compose stop outline 2>/dev/null || true
    
    # 還原資料庫
    log_info "開始還原資料庫..."
    pg_restore \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --clean \
        --if-exists \
        -v \
        "${BACKUP_FILE}"
    log_info "PostgreSQL 還原成功"
    
    # 重啟服務
    log_info "重啟 Outline 服務..."
    docker compose start outline
fi

# ============================================================
# 2. 還原 MinIO
# ============================================================
if [ -n "${RESTORE_MINIO}" ]; then
    log_section "還原 MinIO"
    
    # 解析備份檔案路徑
    if [ "${RESTORE_MINIO}" = "latest" ]; then
        BACKUP_FILE="${BACKUP_DIR}/minio/latest.tar.gz"
    else
        BACKUP_FILE="${RESTORE_MINIO}"
    fi
    
    if [ ! -f "${BACKUP_FILE}" ]; then
        log_error "MinIO 備份檔案不存在: ${BACKUP_FILE}"
        exit 1
    fi
    
    log_info "準備還原 MinIO from: ${BACKUP_FILE}"
    log_warn "⚠️  此操作將覆蓋現有 MinIO 資料！"
    read -p "確認繼續? (yes/no): " CONFIRM
    
    if [ "${CONFIRM}" != "yes" ]; then
        log_info "取消還原"
        exit 0
    fi
    
    # 設定 mc
    mc alias set titanrestore "http://${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" > /dev/null 2>&1
    
    # 建立臨時目錄
    TEMP_DIR=$(mktemp -d)
    TEMP_DIRS+=("${TEMP_DIR}")

    # 解壓縮
    tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

    # 還原每個 bucket
    for BUCKET_DIR in "${TEMP_DIR}"/*; do
        if [ -d "${BUCKET_DIR}" ]; then
            BUCKET_NAME=$(basename "${BUCKET_DIR}")
            log_info "還原 bucket: ${BUCKET_NAME}"
            mc mirror --preserve --overwrite "${BUCKET_DIR}" "titanrestore/${BUCKET_NAME}"
        fi
    done
    
    log_info "MinIO 還原完成"
fi

# ============================================================
# 3. 還原 Config
# ============================================================
if [ -n "${RESTORE_CONFIG}" ]; then
    log_section "還原 Config"
    
    # 解析備份檔案路徑
    if [ "${RESTORE_CONFIG}" = "latest" ]; then
        BACKUP_FILE="${BACKUP_DIR}/config/latest.tar.gz"
    else
        BACKUP_FILE="${RESTORE_CONFIG}"
    fi
    
    if [ ! -f "${BACKUP_FILE}" ]; then
        log_error "Config 備份檔案不存在: ${BACKUP_FILE}"
        exit 1
    fi
    
    log_info "準備還原 Config from: ${BACKUP_FILE}"
    log_warn "⚠️  此操作將覆蓋現有配置檔案！"
    read -p "確認繼續? (yes/no): " CONFIRM
    
    if [ "${CONFIRM}" != "yes" ]; then
        log_info "取消還原"
        exit 0
    fi
    
    # 解壓縮到臨時目錄
    TEMP_DIR=$(mktemp -d)
    TEMP_DIRS+=("${TEMP_DIR}")

    tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"
    
    # 複製檔案
    for ITEM in "${TEMP_DIR}"/*; do
        if [ -e "${ITEM}" ]; then
            ITEM_NAME=$(basename "${ITEM}")
            log_info "還原: ${ITEM_NAME}"
            cp -rp "${ITEM}" "${TITAN_ROOT}/"
        fi
    done
    
    log_info "Config 還原完成"
    log_warn "請記得重啟服務使配置生效: cd ${TITAN_ROOT} && docker compose restart"
fi

# ============================================================
# 完成
# ============================================================
log_section "還原完成"
log_info "所有選定的元件已完成還原"
log_info "請檢查服務狀態: docker compose ps"
