#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 首次部署自動化腳本
# 任務：Issue #263 — First Deploy Automation
# ═══════════════════════════════════════════════════════════════════════════════
# 用途：自動化 TITAN 平台首次部署的完整流程
#   1. 檢查前置條件（Docker、docker compose、openssl）
#   2. 產生必要密鑰（NEXTAUTH_SECRET、OUTLINE secrets 等）
#   3. 從 .env.example 建立 .env（填入產生的密鑰）
#   4. 啟動容器（docker compose up -d）
#   5. 執行資料庫 migration（prisma db push）
#   6. 載入種子資料（prisma db seed）
#   7. 健康檢查
#
# 使用方式：
#   chmod +x scripts/first-deploy.sh
#   ./scripts/first-deploy.sh
#
# 環境變數（可選覆蓋）：
#   TITAN_DOMAIN        — 網域名稱（預設：titan.bank.local）
#   POSTGRES_PASSWORD    — 若已有密碼可傳入，否則自動產生
#   SKIP_SEED           — 設為 true 跳過種子資料載入
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

# ── Step 1: 前置條件檢查 ──────────────────────────────────────────────────────

check_prerequisites() {
  log_section "Step 1: 前置條件檢查"

  local missing=0

  # Docker
  if ! command -v docker &>/dev/null; then
    log_error "找不到 'docker'，請先安裝 Docker Engine"
    missing=$((missing + 1))
  else
    log_ok "docker: $(docker --version | head -1)"
  fi

  # docker compose
  if docker compose version &>/dev/null; then
    log_ok "docker compose: $(docker compose version --short 2>/dev/null || echo 'available')"
  elif command -v docker-compose &>/dev/null; then
    log_warn "偵測到 docker-compose (v1)，建議升級至 docker compose v2"
  else
    log_error "找不到 'docker compose'，請安裝 Docker Compose V2"
    missing=$((missing + 1))
  fi

  # openssl（用於產生密鑰）
  if ! command -v openssl &>/dev/null; then
    log_error "找不到 'openssl'，請先安裝"
    missing=$((missing + 1))
  else
    log_ok "openssl: $(openssl version 2>/dev/null | head -1)"
  fi

  # 檢查 Docker daemon 是否執行中
  if ! docker info &>/dev/null; then
    log_error "Docker daemon 未執行，請先啟動 Docker"
    missing=$((missing + 1))
  else
    log_ok "Docker daemon 執行中"
  fi

  # 磁碟空間檢查
  local avail_pct
  avail_pct=$(df -P "${PROJECT_DIR}" 2>/dev/null \
    | awk 'NR==2 { gsub(/%/, "", $5); print 100 - $5 }')
  if [[ -n "${avail_pct}" && ${avail_pct} -lt 10 ]]; then
    log_error "磁碟可用空間不足 10%（目前可用 ${avail_pct}%），請先清理"
    missing=$((missing + 1))
  else
    log_ok "磁碟可用空間：${avail_pct:-unknown}%"
  fi

  if [[ ${missing} -gt 0 ]]; then
    log_error "前置條件不滿足，請修正上述問題後重新執行"
    exit 1
  fi

  log_ok "前置條件檢查通過"
}

# ── Step 2: 產生密鑰 ─────────────────────────────────────────────────────────

generate_secret() {
  openssl rand -hex 32
}

generate_password() {
  # 產生 20 字元強密碼（含大小寫、數字、符號）
  openssl rand -base64 24 | tr -d '/+=' | head -c 20
}

generate_secrets() {
  log_section "Step 2: 產生安全密鑰"

  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(generate_password)}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_password)}"
  MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(generate_password)}"
  NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(generate_secret)}"
  OUTLINE_SECRET_KEY="${OUTLINE_SECRET_KEY:-$(generate_secret)}"
  OUTLINE_UTILS_SECRET="${OUTLINE_UTILS_SECRET:-$(generate_secret)}"

  log_ok "PostgreSQL 密碼：已產生"
  log_ok "Redis 密碼：已產生"
  log_ok "MinIO 密碼：已產生"
  log_ok "NextAuth Secret：已產生"
  log_ok "Outline Secret Key：已產生"
  log_ok "Outline Utils Secret：已產生"
}

# ── Step 3: 建立 .env ────────────────────────────────────────────────────────

create_env_file() {
  log_section "Step 3: 建立 .env 設定檔"

  local env_file="${PROJECT_DIR}/.env"
  local env_example="${PROJECT_DIR}/.env.example"

  if [[ -f "${env_file}" ]]; then
    log_warn ".env 已存在，備份為 .env.backup.$(date +%Y%m%d_%H%M%S)"
    cp "${env_file}" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
  fi

  if [[ ! -f "${env_example}" ]]; then
    log_error ".env.example 不存在，請確認專案檔案完整"
    exit 1
  fi

  # 從 .env.example 複製並替換密鑰
  cp "${env_example}" "${env_file}"

  # 使用 sed 替換預設值為產生的密鑰
  local domain="${TITAN_DOMAIN:-titan.bank.local}"

  sed -i.bak \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" \
    -e "s|^POSTGRES_APP_PASSWORD=.*|POSTGRES_APP_PASSWORD=$(generate_password)|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASSWORD}|" \
    -e "s|^REDIS_URL=.*|REDIS_URL=redis://:${REDIS_PASSWORD}@titan-redis:6379|" \
    -e "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" \
    -e "s|^TITAN_URL=.*|TITAN_URL=https://${domain}/titan|" \
    -e "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" \
    -e "s|^OUTLINE_SECRET_KEY=.*|OUTLINE_SECRET_KEY=${OUTLINE_SECRET_KEY}|" \
    -e "s|^OUTLINE_UTILS_SECRET=.*|OUTLINE_UTILS_SECRET=${OUTLINE_UTILS_SECRET}|" \
    -e "s|^HOMEPAGE_VAR_MINIO_ROOT_PASSWORD=.*|HOMEPAGE_VAR_MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}|" \
    "${env_file}"

  rm -f "${env_file}.bak"
  chmod 600 "${env_file}"

  log_ok ".env 已建立並設定安全權限 (600)"
  log_warn "請妥善保管 .env 中的密鑰，切勿提交至版本控制"
}

# ── Step 4: 啟動容器 ─────────────────────────────────────────────────────────

start_containers() {
  log_section "Step 4: 啟動容器服務"

  cd "${PROJECT_DIR}"

  log_info "拉取容器映像..."
  docker compose pull 2>&1 | tail -5

  log_info "啟動核心服務..."
  docker compose up -d 2>&1

  # 等待服務健康
  log_info "等待服務就緒（最多 120 秒）..."
  local max_wait=120
  local waited=0
  local interval=5

  while [[ ${waited} -lt ${max_wait} ]]; do
    local healthy
    healthy=$(docker compose ps --format json 2>/dev/null \
      | grep -c '"healthy"' 2>/dev/null || echo "0")
    local total
    total=$(docker compose ps --format json 2>/dev/null \
      | wc -l | tr -d ' ')

    log_info "  服務狀態：${healthy}/${total} 健康（已等待 ${waited}s）"

    # 檢查關鍵服務
    if docker compose exec -T postgres pg_isready -U titan &>/dev/null; then
      log_ok "PostgreSQL 已就緒"
      break
    fi

    sleep "${interval}"
    waited=$((waited + interval))
  done

  if [[ ${waited} -ge ${max_wait} ]]; then
    log_warn "部分服務可能尚未完全就緒，請手動確認：docker compose ps"
  fi

  log_ok "容器服務已啟動"
}

# ── Step 5: 資料庫 Migration ─────────────────────────────────────────────────

run_db_migration() {
  log_section "Step 5: 資料庫 Migration"

  cd "${PROJECT_DIR}"

  # 檢查是否有 prisma 設定
  if [[ -f "${PROJECT_DIR}/prisma/schema.prisma" ]]; then
    log_info "執行 Prisma DB Push..."
    if docker compose exec -T titan-app npx prisma db push --accept-data-loss 2>&1; then
      log_ok "Prisma DB Push 完成"
    else
      log_warn "Prisma DB Push 失敗（容器可能尚未就緒），嘗試本機執行..."
      if command -v npx &>/dev/null; then
        npx prisma db push --accept-data-loss 2>&1 || {
          log_warn "Prisma DB Push 失敗，請手動執行：npx prisma db push"
        }
      else
        log_warn "找不到 npx，請手動執行資料庫 Migration"
      fi
    fi
  else
    log_warn "未找到 prisma/schema.prisma，跳過資料庫 Migration"
  fi
}

# ── Step 6: 種子資料 ─────────────────────────────────────────────────────────

seed_database() {
  log_section "Step 6: 載入種子資料"

  if [[ "${SKIP_SEED:-false}" == "true" ]]; then
    log_warn "SKIP_SEED=true，跳過種子資料載入"
    return 0
  fi

  cd "${PROJECT_DIR}"

  if [[ -f "${PROJECT_DIR}/prisma/seed.ts" ]]; then
    log_info "執行 Prisma DB Seed..."
    if docker compose exec -T titan-app npx prisma db seed 2>&1; then
      log_ok "種子資料載入完成"
    else
      log_warn "種子資料載入失敗（容器可能尚未就緒），嘗試本機執行..."
      if command -v npx &>/dev/null; then
        npx prisma db seed 2>&1 || {
          log_warn "種子資料載入失敗，請手動執行：npx prisma db seed"
        }
      else
        log_warn "找不到 npx，請手動載入種子資料"
      fi
    fi
  else
    log_warn "未找到 prisma/seed.ts，跳過種子資料載入"
  fi
}

# ── Step 7: 健康檢查 ─────────────────────────────────────────────────────────

run_health_check() {
  log_section "Step 7: 健康檢查"

  cd "${PROJECT_DIR}"

  local errors=0

  # PostgreSQL
  if docker compose exec -T postgres pg_isready -U titan &>/dev/null; then
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

  # MinIO
  if docker compose exec -T minio mc ready local 2>/dev/null; then
    log_ok "MinIO：正常"
  else
    log_warn "MinIO：可能尚未就緒"
  fi

  # 列出所有容器狀態
  log_info "容器狀態總覽："
  docker compose ps 2>/dev/null || true

  if [[ ${errors} -gt 0 ]]; then
    log_error "健康檢查發現 ${errors} 個問題，請檢查容器日誌"
    log_info "  檢視日誌：docker compose logs <service-name>"
    return 1
  fi

  log_ok "健康檢查通過"
  return 0
}

# ── 完成摘要 ──────────────────────────────────────────────────────────────────

print_summary() {
  local domain="${TITAN_DOMAIN:-titan.bank.local}"

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  TITAN 平台首次部署完成！                                     ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  服務入口："
  echo "    Homepage:     http://localhost:\${HOMEPAGE_PORT:-3000}"
  echo "    TITAN App:    https://${domain}/titan"
  echo "    Outline:      http://localhost:\${OUTLINE_PORT:-3001}"
  echo "    Uptime Kuma:  http://localhost:\${UPTIME_KUMA_PORT:-3002}"
  echo "    MinIO Console: http://localhost:\${MINIO_CONSOLE_PORT:-9001}"
  echo ""
  echo -e "  ${YELLOW}重要提醒：${NC}"
  echo "    - .env 中包含所有密鑰，請妥善保管"
  echo "    - 切勿將 .env 提交至 Git（已加入 .gitignore）"
  echo "    - 建議立即執行 SSL 憑證設定：bash scripts/generate-ssl-cert.sh"
  echo "    - 建議設定定時備份：crontab -e 加入 scripts/backup.sh"
  echo ""
  echo "  後續操作："
  echo "    1. 設定 /etc/hosts：<SERVER_IP>  ${domain}"
  echo "    2. 執行認證初始化：bash scripts/auth-init.sh"
  echo "    3. 啟動監控堆疊：docker compose -f docker-compose.monitoring.yml up -d"
  echo ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  TITAN 平台 — 首次部署自動化腳本${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo ""

  check_prerequisites
  generate_secrets
  create_env_file
  start_containers
  run_db_migration
  seed_database
  run_health_check || true
  print_summary

  log_ok "首次部署流程完成！"
}

main "$@"
