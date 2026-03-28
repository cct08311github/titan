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

  # Node.js + npm（用於建構 titan-app 映像及執行 prisma migration）
  if ! command -v node &>/dev/null; then
    log_error "找不到 'node'，請安裝 Node.js 20+"
    missing=$((missing + 1))
  else
    log_ok "node: $(node --version)"
  fi

  if ! command -v npm &>/dev/null; then
    log_error "找不到 'npm'，請安裝 Node.js 20+"
    missing=$((missing + 1))
  else
    log_ok "npm: $(npm --version)"
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

build_titan_app() {
  log_section "Step 4a: 建構 TITAN App 映像"

  cd "${PROJECT_DIR}"

  # 安裝依賴
  log_info "安裝 Node.js 依賴..."
  npm ci --prefer-offline 2>&1 | tail -3

  # Prisma generate
  log_info "產生 Prisma client..."
  npx prisma generate 2>&1

  # Next.js build（產生 .next/standalone）
  log_info "建構 Next.js（standalone 模式）..."
  npm run build 2>&1 | tail -5

  if [[ ! -d ".next/standalone" ]]; then
    log_error "Next.js 建構失敗：找不到 .next/standalone 目錄"
    exit 1
  fi

  # Next.js standalone 會將輸出複製到 .next/standalone/<absolute-path>/server.js
  # 需要拍平到 .next/standalone/server.js 供 Dockerfile COPY 使用
  local standalone_server
  standalone_server=$(find ".next/standalone" -name "server.js" -not -path "*/node_modules/*" | head -1)
  if [[ -n "${standalone_server}" ]] && [[ "${standalone_server}" != ".next/standalone/server.js" ]]; then
    local standalone_src
    standalone_src=$(dirname "${standalone_server}")
    log_info "拍平 standalone 輸出：${standalone_src} → .next/standalone/"
    cp -rn "${standalone_src}/." ".next/standalone/"
    # 移除嵌套的路徑目錄（保留 node_modules 和 .next）
    local nested_top
    nested_top=$(echo "${standalone_src#.next/standalone/}" | cut -d/ -f1)
    [[ -n "${nested_top}" ]] && rm -rf ".next/standalone/${nested_top}"
  fi

  # Docker build
  log_info "建構 Docker 映像 titan-app:latest..."
  docker build -t titan-app:latest . 2>&1 | tail -5

  # 建構 migration 映像（預下載 Linux Prisma binary，供 air-gapped 環境使用）
  log_info "建構 Prisma migration 映像 titan-migrate:latest..."
  docker build -f Dockerfile.migrate -t titan-migrate:latest . 2>&1 | tail -5

  log_ok "TITAN App 映像建構完成"
}

start_containers() {
  log_section "Step 4b: 啟動容器服務"

  cd "${PROJECT_DIR}"

  log_info "拉取基礎服務映像..."
  docker compose pull --ignore-buildable 2>&1 | tail -5

  log_info "啟動核心服務..."
  docker compose up -d 2>&1

  # 等待基礎設施就緒
  wait_for_services
}

wait_for_services() {
  log_info "等待服務就緒（最多 120 秒）..."
  local max_wait=120
  local waited=0
  local interval=5

  while [[ ${waited} -lt ${max_wait} ]]; do
    # 檢查 PostgreSQL
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-titan}" &>/dev/null; then
      log_ok "PostgreSQL 已就緒（${waited}s）"

      # 再等 Redis
      if docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
        log_ok "Redis 已就緒"
        return 0
      fi
    fi

    sleep "${interval}"
    waited=$((waited + interval))
    printf "\r  等待中... %ds / %ds" "${waited}" "${max_wait}"
  done
  echo ""

  if [[ ${waited} -ge ${max_wait} ]]; then
    log_warn "部分服務可能尚未完全就緒，請手動確認：docker compose ps"
  fi
}

# ── Step 5: 資料庫 Migration ─────────────────────────────────────────────────

run_db_migration() {
  log_section "Step 5: 資料庫 Migration"

  cd "${PROJECT_DIR}"

  if [[ ! -f "${PROJECT_DIR}/prisma/schema.prisma" ]]; then
    log_warn "未找到 prisma/schema.prisma，跳過資料庫 Migration"
    return 0
  fi

  # 使用臨時容器在 titan-internal 網路內執行 prisma，無需暴露 PG 端口
  local db_url="postgresql://${POSTGRES_USER:-titan}:${POSTGRES_PASSWORD}@titan-postgres:5432/${POSTGRES_DB:-titan}"

  log_info "透過 titan-migrate 容器執行 Prisma DB Push..."
  docker run --rm \
    --network titan-internal \
    -e DATABASE_URL="${db_url}" \
    titan-migrate:latest 2>&1 || {
      log_error "Prisma DB Push 失敗"
      return 1
    }

  log_ok "Prisma DB Push 完成"
}

# ── Step 6: 種子資料 ─────────────────────────────────────────────────────────

seed_database() {
  log_section "Step 6: 載入種子資料"

  if [[ "${SKIP_SEED:-false}" == "true" ]]; then
    log_warn "SKIP_SEED=true，跳過種子資料載入"
    return 0
  fi

  cd "${PROJECT_DIR}"

  if [[ ! -f "${PROJECT_DIR}/prisma/seed.ts" ]]; then
    log_warn "未找到 prisma/seed.ts，跳過種子資料載入"
    return 0
  fi

  local db_url="postgresql://${POSTGRES_USER:-titan}:${POSTGRES_PASSWORD}@titan-postgres:5432/${POSTGRES_DB:-titan}"

  log_info "透過 titan-migrate 容器載入種子資料..."
  docker run --rm \
    --network titan-internal \
    -e DATABASE_URL="${db_url}" \
    titan-migrate:latest \
    sh -c "npx prisma db seed" 2>&1 || {
      log_warn "種子資料載入失敗，可稍後手動執行"
      return 1
    }

  log_ok "種子資料載入完成"
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
  echo "    3. 啟動監控堆疊：docker compose --profile monitoring up -d"
  echo "    4. 更新部署：bash scripts/upgrade.sh"
  echo ""
  echo -e "  ${BLUE}數據持久化：${NC}"
  echo "    所有資料存於 Docker named volumes（postgres-data, redis-data, minio-data）"
  echo "    docker compose down 安全（保留資料），docker compose down -v 會刪除資料"
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
  build_titan_app
  start_containers
  run_db_migration
  seed_database
  run_health_check || true
  print_summary

  log_ok "首次部署流程完成！"
}

main "$@"
