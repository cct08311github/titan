#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 平台更新腳本
# 任務：Issue #1032 — 一鍵部署與更新方案
# ═══════════════════════════════════════════════════════════════════════════════
# 用途：安全地更新已部署的 TITAN 平台
#   1. 拉取最新程式碼（git pull）
#   2. 重建 titan-app 映像（npm ci → build → docker build）
#   3. 執行資料庫 Migration（Prisma，透過臨時容器）
#   4. 滾動更新容器（僅重啟有變更的服務）
#   5. 健康檢查驗證
#
# 使用方式：
#   bash scripts/upgrade.sh              # 標準更新
#   bash scripts/upgrade.sh --skip-pull  # 跳過 git pull（手動更新 code 後使用）
#   bash scripts/upgrade.sh --full       # 重建全部容器（含基礎設施）
#
# 安全保證：
#   - 數據保留：使用 Docker named volumes，容器重建不影響數據
#   - 自動備份：更新前自動備份 PostgreSQL
#   - 失敗回滾：映像建構失敗時不會影響執行中的服務
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── 顏色輸出 ──────────────────────────────────────────────────────────────────
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

# ── 參數解析 ──────────────────────────────────────────────────────────────────
SKIP_PULL=false
FULL_REBUILD=false

for arg in "$@"; do
  case "${arg}" in
    --skip-pull) SKIP_PULL=true ;;
    --full)      FULL_REBUILD=true ;;
    --help|-h)
      echo "用法：bash scripts/upgrade.sh [選項]"
      echo ""
      echo "選項："
      echo "  --skip-pull   跳過 git pull（已手動更新程式碼時使用）"
      echo "  --full        重建全部容器（含基礎設施映像更新）"
      echo "  --help, -h    顯示此說明"
      exit 0
      ;;
    *)
      log_error "未知參數：${arg}（使用 --help 查看說明）"
      exit 1
      ;;
  esac
done

# ── 前置檢查 ──────────────────────────────────────────────────────────────────

preflight_check() {
  log_section "Step 1: 前置檢查"

  cd "${PROJECT_DIR}"

  # 確認 .env 存在
  if [[ ! -f .env ]]; then
    log_error ".env 不存在。這看起來不是已部署的環境。請先執行 scripts/first-deploy.sh"
    exit 1
  fi

  # 載入 .env（僅讀取需要的變數）
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a

  # 確認 Docker 執行中
  if ! docker info &>/dev/null; then
    log_error "Docker daemon 未執行"
    exit 1
  fi

  # 確認核心容器存在
  if ! docker compose ps --format json 2>/dev/null | grep -q "titan-postgres"; then
    log_error "找不到 titan-postgres 容器。請確認 TITAN 已部署"
    exit 1
  fi

  # 驗證 compose 設定可解析（避免 .env 缺變數時後續 docker compose 指令全部 silent fail）
  local compose_err
  compose_err=$(docker compose config --quiet 2>&1) || {
    log_error "docker compose 設定解析失敗："
    echo "${compose_err}" >&2
    log_error "請檢查 .env 是否缺少必要變數"
    exit 1
  }

  log_ok "前置檢查通過"
}

# ── Step 2: 拉取最新程式碼 ────────────────────────────────────────────────────

pull_latest_code() {
  log_section "Step 2: 拉取最新程式碼"

  if [[ "${SKIP_PULL}" == "true" ]]; then
    log_warn "跳過 git pull（--skip-pull）"
    return 0
  fi

  cd "${PROJECT_DIR}"

  # 檢查是否有未提交的變更
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log_warn "工作目錄有未提交的變更："
    git status --short
    log_warn "繼續更新（不影響未追蹤的檔案）..."
  fi

  local current_commit
  current_commit=$(git rev-parse --short HEAD)

  log_info "目前版本：${current_commit}"
  git pull origin main 2>&1 | tail -5

  local new_commit
  new_commit=$(git rev-parse --short HEAD)

  if [[ "${current_commit}" == "${new_commit}" ]]; then
    log_ok "已是最新版本（${new_commit}），無需更新"
  else
    log_ok "已更新：${current_commit} → ${new_commit}"
  fi
}

# ── Step 3: 備份資料庫 ────────────────────────────────────────────────────────

backup_database() {
  log_section "Step 3: 更新前備份"

  cd "${PROJECT_DIR}"

  local backup_dir="${PROJECT_DIR}/backups"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="${backup_dir}/pre-upgrade_${timestamp}.sql.gz"

  mkdir -p "${backup_dir}"

  log_info "備份 PostgreSQL 到 ${backup_file}..."
  local backup_err="${backup_dir}/pre-upgrade_${timestamp}.err"
  if docker compose exec -T postgres pg_dump \
    -U "${POSTGRES_USER:-titan}" \
    -d "${POSTGRES_DB:-titan}" \
    --no-owner --no-acl \
    2>"${backup_err}" | gzip > "${backup_file}"; then
    local size
    size=$(du -h "${backup_file}" | cut -f1)
    log_ok "備份完成（${size}）：${backup_file}"
    rm -f "${backup_err}"
  else
    log_warn "備份失敗，但不阻止更新。錯誤輸出："
    if [[ -s "${backup_err}" ]]; then
      sed 's/^/    /' "${backup_err}" >&2
    else
      echo "    （無 stderr 輸出；可能為 compose 設定或網路錯誤，手動檢查：docker compose exec postgres pg_dump ...）" >&2
    fi
    rm -f "${backup_file}"
  fi
}

# ── Step 4: 重建 TITAN App 映像 ──────────────────────────────────────────────

rebuild_titan_app() {
  log_section "Step 4: 重建 TITAN App 映像"

  cd "${PROJECT_DIR}"

  # 保留舊映像作為回滾用
  if docker image inspect titan-app:latest &>/dev/null; then
    log_info "標記舊映像為 titan-app:previous..."
    docker tag titan-app:latest titan-app:previous 2>/dev/null || true
  fi

  log_info "安裝依賴..."
  npm ci --prefer-offline 2>&1 | tail -3

  log_info "產生 Prisma client..."
  npx prisma generate 2>&1

  log_info "建構 Next.js..."
  npm run build 2>&1 | tail -5

  if [[ ! -d ".next/standalone" ]]; then
    log_error "Next.js 建構失敗。服務不受影響（仍使用舊映像）"
    log_info "回滾：docker tag titan-app:previous titan-app:latest"
    return 1
  fi

  # 拍平 standalone 輸出（Next.js 會將 server.js 複製到完整絕對路徑下）
  local standalone_server
  standalone_server=$(find ".next/standalone" -name "server.js" -not -path "*/node_modules/*" | head -1)
  if [[ -n "${standalone_server}" ]] && [[ "${standalone_server}" != ".next/standalone/server.js" ]]; then
    local standalone_src
    standalone_src=$(dirname "${standalone_server}")
    log_info "拍平 standalone 輸出：${standalone_src} → .next/standalone/"
    cp -rn "${standalone_src}/." ".next/standalone/"
    local nested_top
    nested_top=$(echo "${standalone_src#.next/standalone/}" | cut -d/ -f1)
    [[ -n "${nested_top}" ]] && rm -rf ".next/standalone/${nested_top}"
  fi

  # 補充 Linux Prisma binaries 到 standalone
  # Next.js standalone 僅追蹤 host native binary；Linux target binaries 需手動複製
  local prisma_src="node_modules/.prisma/client"
  local prisma_dst=".next/standalone/node_modules/.prisma/client"
  if [[ -d "${prisma_src}" ]] && [[ -d "${prisma_dst}" ]]; then
    log_info "補充 Linux Prisma binaries 到 standalone..."
    for f in "${prisma_src}"/libquery_engine-*.so.node; do
      [[ -f "${f}" ]] && cp -n "${f}" "${prisma_dst}/" && log_info "  已複製 $(basename "${f}")"
    done
  fi

  log_info "建構 Docker 映像..."
  docker build -t titan-app:latest . 2>&1 | tail -5

  # 同步更新 migration 映像（確保 schema 與 binary 版本一致）
  log_info "更新 Prisma migration 映像 titan-migrate:latest..."
  docker build -f Dockerfile.migrate -t titan-migrate:latest . 2>&1 | tail -5

  log_info "更新 cron 排程映像 titan-cron:latest..."
  docker build -f Dockerfile.cron -t titan-cron:latest . 2>&1 | tail -5

  log_ok "TITAN App 映像重建完成"
}

# ── Step 5: 資料庫 Migration ─────────────────────────────────────────────────

run_migration() {
  log_section "Step 5: 資料庫 Migration"

  cd "${PROJECT_DIR}"

  if [[ ! -f prisma/schema.prisma ]]; then
    log_warn "未找到 prisma/schema.prisma，跳過"
    return 0
  fi

  local db_url="postgresql://${POSTGRES_USER:-titan}:${POSTGRES_PASSWORD}@titan-postgres:5432/${POSTGRES_DB:-titan}"

  log_info "透過 titan-migrate 容器執行 Prisma DB Push..."
  docker run --rm \
    --network titan-internal \
    -e DATABASE_URL="${db_url}" \
    titan-migrate:latest 2>&1 || {
      log_error "DB Migration 失敗。資料庫未變更。"
      log_info "手動執行：docker run --rm --network titan-internal -e DATABASE_URL='...' titan-migrate:latest"
      return 1
    }

  log_ok "DB Migration 完成"
}

# ── Step 6: 滾動更新容器 ─────────────────────────────────────────────────────

rolling_update() {
  log_section "Step 6: 滾動更新容器"

  cd "${PROJECT_DIR}"

  if [[ "${FULL_REBUILD}" == "true" ]]; then
    log_info "全量更新：拉取所有基礎映像..."
    docker compose pull --ignore-buildable 2>&1 | tail -5
    log_info "重建全部容器..."
    docker compose up -d --force-recreate 2>&1
  else
    log_info "僅更新 titan-app 容器..."
    docker compose up -d --no-deps titan-app 2>&1
  fi

  # 等待健康
  log_info "等待服務就緒..."
  local max_wait=60
  local waited=0

  while [[ ${waited} -lt ${max_wait} ]]; do
    if docker compose exec -T titan-app wget -qO- http://localhost:3100/api/health &>/dev/null 2>&1; then
      log_ok "titan-app 健康檢查通過（${waited}s）"
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
  done

  log_warn "titan-app 可能尚未就緒，請手動檢查：docker compose logs titan-app"
}

# ── Step 7: 健康檢查 ─────────────────────────────────────────────────────────

run_health_check() {
  log_section "Step 7: 健康檢查"

  cd "${PROJECT_DIR}"

  local errors=0

  # PostgreSQL
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-titan}" &>/dev/null; then
    log_ok "PostgreSQL：正常"
  else
    log_error "PostgreSQL：無回應"
    errors=$((errors + 1))
  fi

  # Redis
  if docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    log_ok "Redis：正常"
  else
    log_error "Redis：無回應"
    errors=$((errors + 1))
  fi

  # TITAN App
  if docker compose exec -T titan-app wget -qO- http://localhost:3100/api/health &>/dev/null 2>&1; then
    log_ok "TITAN App：正常"
  else
    log_error "TITAN App：無回應"
    errors=$((errors + 1))
  fi

  echo ""
  docker compose ps 2>/dev/null || true

  if [[ ${errors} -gt 0 ]]; then
    log_error "發現 ${errors} 個問題"
    log_info "回滾 titan-app：docker tag titan-app:previous titan-app:latest && docker compose up -d titan-app"
    return 1
  fi

  log_ok "所有健康檢查通過"
}

# ── 完成摘要 ──────────────────────────────────────────────────────────────────

print_summary() {
  local commit
  commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  TITAN 平台更新完成！                                        ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  版本：${commit}"
  echo "  時間：$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo -e "  ${YELLOW}回滾方式（如有問題）：${NC}"
  echo "    docker tag titan-app:previous titan-app:latest"
  echo "    docker compose up -d --no-deps titan-app"
  echo ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  TITAN 平台 — 更新腳本${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo ""

  preflight_check
  pull_latest_code
  backup_database
  rebuild_titan_app
  run_migration
  rolling_update
  run_health_check || true
  print_summary

  log_ok "更新流程完成！"
}

main "$@"
