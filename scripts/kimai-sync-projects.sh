#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TITAN 平台 — Plane 專案同步至 Kimai 腳本
# Issue: #64 — Kimai Time Tracking Deep Integration
# ─────────────────────────────────────────────────────────────────────────
# 功能說明：
#   從 Plane REST API 讀取所有專案，同步建立對應的 Kimai 專案與活動（Activity）
#   讓 IT 團隊可在 Kimai 中針對 Plane 專案記錄工時
#
# 使用方式：
#   bash scripts/kimai-sync-projects.sh [--dry-run] [--verbose]
#
# 前置需求：
#   - curl（HTTP 請求）
#   - jq（JSON 解析）
#   - 已設定 config/kimai/.env.example 中的環境變數
#
# 環境變數（從 .env 載入或手動匯出）：
#   PLANE_API_BASE_URL    — Plane API 基底 URL
#   PLANE_API_TOKEN       — Plane API 存取金鑰
#   PLANE_WORKSPACE_SLUG  — Plane 工作區識別碼
#   KIMAI_API_BASE_URL    — Kimai API 基底 URL
#   KIMAI_API_TOKEN       — Kimai API 存取金鑰
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 顏色輸出 ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── 旗標解析 ────────────────────────────────────────────────────────────────
DRY_RUN=false
VERBOSE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true ;;
    --verbose)  VERBOSE=true ;;
    --help|-h)
      echo "使用方式: $0 [--dry-run] [--verbose]"
      echo ""
      echo "  --dry-run   僅顯示將執行的操作，不實際寫入 Kimai"
      echo "  --verbose   顯示詳細 API 回應"
      exit 0
      ;;
    *)
      echo -e "${RED}[錯誤]${NC} 未知參數: $arg"
      exit 1
      ;;
  esac
done

# ── 載入環境變數 ─────────────────────────────────────────────────────────────
# 優先從腳本目錄的上層 .env 載入
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  echo -e "${BLUE}[資訊]${NC} 已載入環境變數：$ENV_FILE"
else
  echo -e "${YELLOW}[警告]${NC} 找不到 .env 檔案，使用現有環境變數"
fi

# ── 必要變數驗證 ─────────────────────────────────────────────────────────────
REQUIRED_VARS=(
  PLANE_API_BASE_URL
  PLANE_API_TOKEN
  PLANE_WORKSPACE_SLUG
  KIMAI_API_BASE_URL
  KIMAI_API_TOKEN
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo -e "${RED}[錯誤]${NC} 缺少必要環境變數："
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "請參閱 config/kimai/.env.example 並設定上述變數"
  exit 1
fi

# ── 工具函數 ─────────────────────────────────────────────────────────────────

log_info()    { echo -e "${BLUE}[資訊]${NC} $*"; }
log_success() { echo -e "${GREEN}[成功]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[警告]${NC} $*"; }
log_error()   { echo -e "${RED}[錯誤]${NC} $*" >&2; }
log_dry()     { echo -e "${YELLOW}[DRY-RUN]${NC} $*"; }

# 呼叫 Plane API
plane_api() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local url="${PLANE_API_BASE_URL}${endpoint}"
  local response

  if [[ -n "$data" ]]; then
    response=$(curl -s -X "$method" "$url" \
      -H "X-Api-Key: ${PLANE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\n%{http_code}")
  else
    response=$(curl -s -X "$method" "$url" \
      -H "X-Api-Key: ${PLANE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\n%{http_code}")
  fi

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n -1)

  if [[ "$VERBOSE" == "true" ]]; then
    log_info "Plane API ${method} ${endpoint} → HTTP ${http_code}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
  fi

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    log_error "Plane API 請求失敗（HTTP ${http_code}）：${endpoint}"
    echo "$body" >&2
    return 1
  fi

  echo "$body"
}

# 呼叫 Kimai API
kimai_api() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local url="${KIMAI_API_BASE_URL}${endpoint}"
  local response

  if [[ -n "$data" ]]; then
    response=$(curl -s -X "$method" "$url" \
      -H "Authorization: Bearer ${KIMAI_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -w "\n%{http_code}")
  else
    response=$(curl -s -X "$method" "$url" \
      -H "Authorization: Bearer ${KIMAI_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\n%{http_code}")
  fi

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n -1)

  if [[ "$VERBOSE" == "true" ]]; then
    log_info "Kimai API ${method} ${endpoint} → HTTP ${http_code}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
  fi

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    log_error "Kimai API 請求失敗（HTTP ${http_code}）：${endpoint}"
    echo "$body" >&2
    return 1
  fi

  echo "$body"
}

# ── 取得 Kimai 現有專案清單（用於去重判斷）────────────────────────────────────
get_kimai_projects() {
  kimai_api GET "/projects?visible=1&page=1&size=200" || echo "[]"
}

# ── 在 Kimai 建立專案 ─────────────────────────────────────────────────────────
# 參數：plane_project_id plane_name plane_identifier plane_description
create_kimai_project() {
  local plane_id="$1"
  local plane_name="$2"
  local plane_identifier="$3"
  local plane_description="${4:-}"

  # Kimai 專案命名規則：[PLANE-識別碼] 專案名稱
  local kimai_name="[${plane_identifier}] ${plane_name}"
  # 在備註欄記錄 Plane 專案 ID，便於後續比對
  local comment="Plane 專案 ID: ${plane_id} | 自動同步於 $(date '+%Y-%m-%d %H:%M:%S')"
  local meta_note="${plane_description:0:500}"  # 限制說明長度

  local payload
  payload=$(jq -n \
    --arg name "$kimai_name" \
    --arg comment "$comment" \
    --argjson visible true \
    --argjson billable false \
    '{
      name: $name,
      comment: $comment,
      visible: $visible,
      billable: $billable
    }')

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "將建立 Kimai 專案：${kimai_name}"
    return 0
  fi

  local result
  result=$(kimai_api POST "/projects" "$payload")
  local kimai_project_id
  kimai_project_id=$(echo "$result" | jq -r '.id // empty')

  if [[ -n "$kimai_project_id" ]]; then
    log_success "已建立 Kimai 專案：${kimai_name}（ID: ${kimai_project_id}）"
    echo "$kimai_project_id"
  else
    log_error "建立 Kimai 專案失敗：${kimai_name}"
    return 1
  fi
}

# ── 在 Kimai 建立活動（Activity）──────────────────────────────────────────────
# 每個 Kimai 專案建立標準活動類型，對應銀行 IT 工作分類
create_default_activities() {
  local kimai_project_id="$1"
  local project_name="$2"

  # 銀行 IT 標準工時活動類型
  local -a activities=(
    "需求分析與規劃"
    "系統設計"
    "程式開發"
    "測試與驗證"
    "文件撰寫"
    "部署與上線"
    "問題排查與修復"
    "會議與溝通"
    "教育訓練"
    "專案管理"
  )

  for activity_name in "${activities[@]}"; do
    local payload
    payload=$(jq -n \
      --arg name "$activity_name" \
      --argjson project "$kimai_project_id" \
      --argjson visible true \
      --argjson billable false \
      '{
        name: $name,
        project: $project,
        visible: $visible,
        billable: $billable
      }')

    if [[ "$DRY_RUN" == "true" ]]; then
      log_dry "  將建立活動：${activity_name}（專案 ID: ${kimai_project_id}）"
      continue
    fi

    if kimai_api POST "/activities" "$payload" > /dev/null 2>&1; then
      log_success "  已建立活動：${activity_name}"
    else
      log_warn "  活動建立失敗（可能已存在）：${activity_name}"
    fi
  done
}

# ── 主流程 ───────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  TITAN — Plane → Kimai 專案同步工具"
  echo "  執行時間：$(date '+%Y-%m-%d %H:%M:%S')"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "  模式：${YELLOW}DRY-RUN（僅預覽，不執行寫入）${NC}"
  else
    echo "  模式：正式執行"
  fi
  echo "════════════════════════════════════════════════════════"
  echo ""

  # ── 步驟 1：取得 Plane 所有專案 ────────────────────────────────────────────
  log_info "正在從 Plane 取得專案清單..."
  local plane_projects
  plane_projects=$(plane_api GET "/workspaces/${PLANE_WORKSPACE_SLUG}/projects/?per_page=100")

  local total_plane
  total_plane=$(echo "$plane_projects" | jq '.count // (.results | length) // 0')
  log_info "Plane 共有 ${total_plane} 個專案"

  if [[ "$total_plane" -eq 0 ]]; then
    log_warn "Plane 中沒有專案可同步"
    exit 0
  fi

  # ── 步驟 2：取得 Kimai 現有專案（用於避免重複建立）──────────────────────────
  log_info "正在取得 Kimai 現有專案清單..."
  local kimai_projects
  kimai_projects=$(get_kimai_projects)
  local kimai_project_names
  kimai_project_names=$(echo "$kimai_projects" | jq -r '.[].name // empty' 2>/dev/null || echo "")

  # ── 步驟 3：逐一同步 Plane 專案至 Kimai ────────────────────────────────────
  local synced=0
  local skipped=0
  local failed=0

  while IFS= read -r project_json; do
    local plane_id plane_name plane_identifier plane_description
    plane_id=$(echo "$project_json" | jq -r '.id')
    plane_name=$(echo "$project_json" | jq -r '.name')
    plane_identifier=$(echo "$project_json" | jq -r '.identifier')
    plane_description=$(echo "$project_json" | jq -r '.description // ""')

    local kimai_name="[${plane_identifier}] ${plane_name}"

    # 檢查是否已存在
    if echo "$kimai_project_names" | grep -qF "$kimai_name"; then
      log_warn "已存在，略過：${kimai_name}"
      ((skipped++)) || true
      continue
    fi

    log_info "同步專案：${plane_name}（識別碼: ${plane_identifier}）"

    # 建立 Kimai 專案
    local kimai_project_id
    if kimai_project_id=$(create_kimai_project \
        "$plane_id" "$plane_name" "$plane_identifier" "$plane_description"); then

      # 建立預設活動類型
      if [[ -n "$kimai_project_id" ]]; then
        create_default_activities "$kimai_project_id" "$plane_name"
      fi
      ((synced++)) || true
    else
      ((failed++)) || true
    fi

  done < <(echo "$plane_projects" | jq -c '.results[]? // .[]?')

  # ── 步驟 4：輸出同步摘要 ────────────────────────────────────────────────────
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  同步完成摘要"
  echo "  ─────────────────────────────────────────────────────"
  echo -e "  新增同步：${GREEN}${synced}${NC} 個專案"
  echo -e "  已存在略過：${YELLOW}${skipped}${NC} 個專案"
  if [[ "$failed" -gt 0 ]]; then
    echo -e "  同步失敗：${RED}${failed}${NC} 個專案"
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "  ${YELLOW}（DRY-RUN 模式：以上操作均未實際執行）${NC}"
  fi
  echo "════════════════════════════════════════════════════════"
  echo ""

  if [[ "$failed" -gt 0 ]]; then
    exit 1
  fi
}

# ── 依賴工具檢查 ─────────────────────────────────────────────────────────────
for tool in curl jq; do
  if ! command -v "$tool" &>/dev/null; then
    log_error "缺少必要工具：${tool}，請先安裝後再執行此腳本"
    exit 1
  fi
done

main "$@"
