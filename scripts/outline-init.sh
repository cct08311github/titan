#!/usr/bin/env bash
# =============================================================================
# Outline 知識庫初始化腳本
# 用途：建立 MinIO Bucket 並列印後續設定說明
# 適用環境：銀行 IT 部門封閉網路（Air-Gapped）
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 設定區（可依實際環境修改）
# ---------------------------------------------------------------------------
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
OUTLINE_BUCKET="${OUTLINE_BUCKET:-outline-attachments}"

# ---------------------------------------------------------------------------
# 顏色輸出
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# 前置檢查
# ---------------------------------------------------------------------------
check_prerequisites() {
    log_info "檢查前置條件..."

    # 檢查 mc 指令是否可用
    if ! command -v mc &>/dev/null; then
        log_error "找不到 'mc'（MinIO Client）指令"
        log_error "請先安裝 mc 或確認 PATH 設定："
        echo "  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc"
        echo "  chmod +x /usr/local/bin/mc"
        exit 1
    fi

    # 檢查 Docker 是否在運行（確認 MinIO 已啟動）
    if command -v docker &>/dev/null; then
        if ! docker compose ps minio 2>/dev/null | grep -q "running\|Up"; then
            log_warn "偵測到 MinIO 容器可能未啟動，建議先執行：docker compose up -d minio"
            log_warn "10 秒後繼續嘗試連線..."
            sleep 10
        fi
    fi

    log_ok "前置檢查完成"
}

# ---------------------------------------------------------------------------
# 設定 MinIO Client 別名
# ---------------------------------------------------------------------------
setup_mc_alias() {
    log_info "設定 MinIO Client 連線別名 '${MINIO_ALIAS}'..."

    mc alias set "${MINIO_ALIAS}" \
        "${MINIO_ENDPOINT}" \
        "${MINIO_ROOT_USER}" \
        "${MINIO_ROOT_PASSWORD}" \
        --api S3v4 2>&1

    # 測試連線
    if ! mc ls "${MINIO_ALIAS}" &>/dev/null; then
        log_error "無法連線至 MinIO（${MINIO_ENDPOINT}）"
        log_error "請確認："
        echo "  1. MinIO 服務已啟動（docker compose up -d minio）"
        echo "  2. MINIO_ROOT_USER 與 MINIO_ROOT_PASSWORD 設定正確"
        echo "  3. MINIO_ENDPOINT 位址可存取"
        exit 1
    fi

    log_ok "MinIO 連線成功"
}

# ---------------------------------------------------------------------------
# 建立 Outline Bucket
# ---------------------------------------------------------------------------
create_outline_bucket() {
    log_info "建立 Outline 附件 Bucket：${OUTLINE_BUCKET}..."

    if mc ls "${MINIO_ALIAS}/${OUTLINE_BUCKET}" &>/dev/null; then
        log_warn "Bucket '${OUTLINE_BUCKET}' 已存在，略過建立"
    else
        mc mb "${MINIO_ALIAS}/${OUTLINE_BUCKET}"
        log_ok "Bucket '${OUTLINE_BUCKET}' 建立成功"
    fi

    # 設定為私有（拒絕匿名存取）
    mc anonymous set none "${MINIO_ALIAS}/${OUTLINE_BUCKET}"
    log_ok "Bucket 存取策略已設定為私有（None）"
}

# ---------------------------------------------------------------------------
# 驗證 Bucket
# ---------------------------------------------------------------------------
verify_bucket() {
    log_info "驗證 Bucket 設定..."

    # 列出所有 Bucket
    echo ""
    echo "目前 MinIO 中的 Bucket 清單："
    mc ls "${MINIO_ALIAS}"

    # 確認目標 Bucket 存在
    if mc ls "${MINIO_ALIAS}/${OUTLINE_BUCKET}" &>/dev/null; then
        log_ok "Bucket '${OUTLINE_BUCKET}' 驗證通過"
    else
        log_error "Bucket '${OUTLINE_BUCKET}' 驗證失敗"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# 列印後續設定說明
# ---------------------------------------------------------------------------
print_setup_instructions() {
    echo ""
    echo "=================================================================="
    echo -e "${GREEN}  Outline MinIO 初始化完成！${NC}"
    echo "=================================================================="
    echo ""
    echo "後續設定步驟："
    echo ""
    echo "  1. 確認以下環境變數已設定於 config/outline.env："
    echo ""
    echo "     AWS_ACCESS_KEY_ID=${MINIO_ROOT_USER}"
    echo "     AWS_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>"
    echo "     AWS_REGION=us-east-1"
    echo "     AWS_S3_UPLOAD_BUCKET_NAME=${OUTLINE_BUCKET}"
    echo "     AWS_S3_UPLOAD_BUCKET_URL=${MINIO_ENDPOINT}"
    echo "     AWS_S3_FORCE_PATH_STYLE=true"
    echo ""
    echo "  2. 啟動 Outline 服務："
    echo ""
    echo "     docker compose up -d outline"
    echo ""
    echo "  3. 執行資料庫 Migration："
    echo ""
    echo "     docker compose exec outline yarn db:migrate"
    echo ""
    echo "  4. 瀏覽器訪問 Outline："
    echo ""
    echo "     http://<主機IP>:3000"
    echo ""
    echo "  5. 詳細設定說明請參考：docs/outline-setup.md"
    echo ""
    echo "=================================================================="
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
main() {
    echo ""
    echo "=================================================================="
    echo "  TITAN — Outline 知識庫初始化腳本"
    echo "=================================================================="
    echo ""

    check_prerequisites
    setup_mc_alias
    create_outline_bucket
    verify_bucket
    print_setup_instructions
}

main "$@"
