#!/usr/bin/env bash
# =============================================================================
# auth-init.sh — TITAN 平台認證初始化腳本
# 用途：建立 Outline 初始管理員帳號，並輸出首次登入說明
# 版本：v1.0
# 更新：2026-03-23
# 相關文件：docs/auth-design.md
# =============================================================================
set -euo pipefail

# ─────────────────────────────────────────────────────
# 顏色輸出
# ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─────────────────────────────────────────────────────
# 設定區（可由環境變數覆蓋）
# ─────────────────────────────────────────────────────
OUTLINE_URL="${OUTLINE_URL:-https://outline.internal.bank.com}"
OUTLINE_API_TOKEN="${OUTLINE_API_TOKEN:-}"          # 需預先產生 API Token

# 初始管理員帳號（可傳入環境變數）
ADMIN_EMAIL="${ADMIN_EMAIL:-titan-admin@bank.com}"
ADMIN_NAME="${ADMIN_NAME:-TITAN 管理員}"

# 腳本行為
DRY_RUN="${DRY_RUN:-false}"
SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-false}"

# ─────────────────────────────────────────────────────
# 前置檢查
# ─────────────────────────────────────────────────────
check_dependencies() {
    log_info "檢查必要工具..."
    local missing=0

    for cmd in curl jq docker; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "缺少必要工具：$cmd"
            missing=$((missing + 1))
        fi
    done

    if [[ $missing -gt 0 ]]; then
        log_error "請先安裝缺少的工具後再執行此腳本。"
        exit 1
    fi
    log_success "工具檢查通過（curl, jq, docker）"
}

check_env_vars() {
    log_info "檢查必要環境變數..."
    local missing=0

    if [[ -z "${OUTLINE_API_TOKEN}" ]]; then
        log_error "OUTLINE_API_TOKEN 未設定。"
        log_warn "  請至 Outline 後台 → 設定 → API 取得管理員 API Token"
        log_warn "  設定方式：export OUTLINE_API_TOKEN='your-token-here'"
        missing=$((missing + 1))
    fi

    if [[ $missing -gt 0 ]]; then
        exit 1
    fi
    log_success "環境變數檢查通過"
}

# ─────────────────────────────────────────────────────
# 健康檢查：等待 Outline 服務就緒
# ─────────────────────────────────────────────────────
wait_for_outline() {
    if [[ "${SKIP_HEALTH_CHECK}" == "true" ]]; then
        log_warn "跳過健康檢查（SKIP_HEALTH_CHECK=true）"
        return
    fi

    log_info "等待 Outline 服務就緒：${OUTLINE_URL}"
    local max_attempts=30
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        attempt=$((attempt + 1))
        if curl -sf "${OUTLINE_URL}/api/auth.info" \
            -H "Authorization: Bearer ${OUTLINE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --connect-timeout 5 \
            -o /dev/null 2>/dev/null; then
            log_success "Outline 服務就緒！"
            return
        fi
        log_info "  等待中... (${attempt}/${max_attempts})"
        sleep 10
    done

    log_error "Outline 服務在 ${max_attempts} 次嘗試後仍未就緒，請確認容器狀態。"
    log_info "  檢查指令：docker compose ps outline"
    log_info "  日誌查看：docker compose logs outline"
    exit 1
}

# ─────────────────────────────────────────────────────
# Outline API 輔助函數
# ─────────────────────────────────────────────────────
outline_api() {
    local endpoint="$1"
    local data="${2:-{}}"

    curl -sf \
        -X POST \
        "${OUTLINE_URL}/api/${endpoint}" \
        -H "Authorization: Bearer ${OUTLINE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${data}"
}

# ─────────────────────────────────────────────────────
# 建立 Outline 管理員帳號（發送邀請）
# ─────────────────────────────────────────────────────
create_outline_admin() {
    log_info "建立 Outline 管理員帳號..."
    log_info "  Email：${ADMIN_EMAIL}"
    log_info "  姓名：${ADMIN_NAME}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warn "[DRY RUN] 模擬呼叫 Outline API users.invite"
        return
    fi

    local response
    response=$(outline_api "users.invite" "{
        \"invites\": [
            {
                \"email\": \"${ADMIN_EMAIL}\",
                \"name\": \"${ADMIN_NAME}\",
                \"role\": \"admin\"
            }
        ]
    }" 2>&1) || {
        log_error "呼叫 Outline API 失敗：${response}"
        log_warn "  可能原因：帳號已存在、或 API Token 權限不足"
        return 1
    }

    local status
    status=$(echo "${response}" | jq -r '.ok // false')

    if [[ "${status}" == "true" ]]; then
        log_success "管理員邀請成功！邀請信已發送至：${ADMIN_EMAIL}"
    else
        local error
        error=$(echo "${response}" | jq -r '.error // "未知錯誤"')
        if [[ "${error}" == "user_already_exists" ]]; then
            log_warn "帳號已存在，跳過建立：${ADMIN_EMAIL}"
        else
            log_error "建立帳號失敗：${error}"
            return 1
        fi
    fi
}

# ─────────────────────────────────────────────────────
# 建立 Outline 預設 Collection
# ─────────────────────────────────────────────────────
create_outline_collections() {
    log_info "建立 Outline 預設 Collection..."

    local collections=(
        "IT 技術文件|存放系統架構、API 文件、技術規範|#2563EB"
        "專案管理|存放專案計畫、會議記錄、決策日誌|#059669"
        "操作手冊|存放 SOP、維運指南、故障排除手冊|#D97706"
        "資安政策|存放資安規範、存取控制政策、稽核要求|#DC2626"
    )

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warn "[DRY RUN] 模擬建立以下 Collection："
        for coll in "${collections[@]}"; do
            IFS='|' read -r name _ _ <<< "$coll"
            echo "  - ${name}"
        done
        return
    fi

    for coll in "${collections[@]}"; do
        IFS='|' read -r name description color <<< "$coll"

        local response
        response=$(outline_api "collections.create" "{
            \"name\": \"${name}\",
            \"description\": \"${description}\",
            \"color\": \"${color}\",
            \"permission\": \"read\"
        }" 2>&1) || true

        local status
        status=$(echo "${response}" | jq -r '.ok // false' 2>/dev/null || echo "false")

        if [[ "${status}" == "true" ]]; then
            log_success "  建立 Collection：${name}"
        else
            log_warn "  Collection 建立失敗或已存在：${name}"
        fi
    done
}

# ─────────────────────────────────────────────────────
# Plane 管理員建立說明
# ─────────────────────────────────────────────────────
setup_plane_admin() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Plane 管理員初始設定（需手動執行）${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Plane 需要進入容器建立 superuser，請依序執行："
    echo ""
    echo -e "  ${YELLOW}步驟 1：進入 Plane API 容器${NC}"
    echo -e "  $ docker compose exec plane-api python manage.py createsuperuser"
    echo ""
    echo -e "  ${YELLOW}步驟 2：依提示輸入以下資訊${NC}"
    echo -e "    Email    : ${ADMIN_EMAIL}"
    echo -e "    Password : （請使用符合密碼政策的強密碼，長度 ≥ 12 字元）"
    echo ""
    echo -e "  ${YELLOW}步驟 3：首次登入 Plane 後台${NC}"
    echo -e "    URL：https://plane.internal.bank.com/"
    echo -e "    以上方建立的帳號登入後完成 workspace 初始設定"
    echo ""
    echo -e "  ${YELLOW}步驟 4：邀請成員${NC}"
    echo -e "    進入 Settings → Members → Invite Members"
    echo -e "    依 roles.yaml 定義指派適當角色"
    echo ""
}

# ─────────────────────────────────────────────────────
# 輸出首次登入說明
# ─────────────────────────────────────────────────────
print_first_login_instructions() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  TITAN 平台首次登入說明${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${CYAN}【Outline 知識庫】${NC}"
    echo -e "  網址：${OUTLINE_URL}"
    echo ""
    echo -e "  1. 管理員（${ADMIN_EMAIL}）應已收到邀請信"
    echo -e "     → 點擊信中連結，設定密碼後登入"
    echo -e "  2. 若未收到邀請信，請至 Outline 後台手動重發："
    echo -e "     Settings → Members → 找到帳號 → Resend invite"
    echo -e "  3. 登入後請先設定："
    echo -e "     - 工作區名稱：TITAN 銀行 IT 平台"
    echo -e "     - 上傳工作區 Logo"
    echo -e "     - 確認各 Collection 權限設定正確"
    echo ""
    echo -e "  ${CYAN}【邀請其他成員（Outline）】${NC}"
    echo -e "  Settings → Members → Invite people"
    echo -e "  依 config/auth/roles.yaml 對應角色指派"
    echo ""
    echo -e "  ${CYAN}【Phase 2 — SSO 整合提醒】${NC}"
    echo -e "  當 Keycloak + AD 整合完成後："
    echo -e "  1. 更新 .env 填入 OIDC 設定（見 docs/auth-design.md）"
    echo -e "  2. 重啟 Outline/Plane 服務"
    echo -e "  3. 通知所有成員改用 SSO 登入"
    echo -e "  4. 舊的本地帳號將於 SSO 上線後停用"
    echo ""
    echo -e "  ${YELLOW}重要安全提醒：${NC}"
    echo -e "  - 請勿在 Git 或文件中儲存帳號密碼"
    echo -e "  - 管理員帳號資訊請記錄至 ITSM 或 PAM 系統"
    echo -e "  - 初始密碼須於首次登入後立即變更"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ─────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}  TITAN 平台認證初始化腳本 v1.0${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warn "DRY RUN 模式：不會實際呼叫 API 或修改任何資料"
        echo ""
    fi

    # 前置檢查
    check_dependencies
    check_env_vars

    # 等待服務就緒
    wait_for_outline

    # 建立 Outline 管理員
    create_outline_admin

    # 建立預設 Collection
    create_outline_collections

    # 輸出 Plane 手動設定說明
    setup_plane_admin

    # 輸出首次登入說明
    print_first_login_instructions

    log_success "認證初始化完成！"
}

# ─────────────────────────────────────────────────────
# 使用說明
# ─────────────────────────────────────────────────────
usage() {
    echo "用法："
    echo "  $0 [選項]"
    echo ""
    echo "環境變數："
    echo "  OUTLINE_URL          Outline 服務 URL（預設：https://outline.internal.bank.com）"
    echo "  OUTLINE_API_TOKEN    Outline API Token（必填）"
    echo "  ADMIN_EMAIL          管理員 Email（預設：titan-admin@bank.com）"
    echo "  ADMIN_NAME           管理員姓名（預設：TITAN 管理員）"
    echo "  DRY_RUN              設為 true 啟用模擬模式（預設：false）"
    echo "  SKIP_HEALTH_CHECK    設為 true 跳過服務健康檢查（預設：false）"
    echo ""
    echo "範例："
    echo "  # 基本執行"
    echo "  OUTLINE_API_TOKEN='your-token' ./scripts/auth-init.sh"
    echo ""
    echo "  # 自訂管理員帳號"
    echo "  OUTLINE_API_TOKEN='your-token' \\"
    echo "    ADMIN_EMAIL='john.doe@bank.com' \\"
    echo "    ADMIN_NAME='John Doe' \\"
    echo "    ./scripts/auth-init.sh"
    echo ""
    echo "  # 模擬模式（不實際執行）"
    echo "  OUTLINE_API_TOKEN='dummy' DRY_RUN=true ./scripts/auth-init.sh"
}

# 處理命令列參數
case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    *) main "$@" ;;
esac
