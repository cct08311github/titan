#!/usr/bin/env bash
# =============================================================================
# TITAN 整合測試腳本
# Task: T17 — Portal 整合驗證
# 最後更新: 2026-03-23
#
# 用途:
#   測試所有服務端點可達性、Homepage 連結有效性、
#   服務間連線能力，並輸出彩色測試報告。
#
# 使用方式:
#   bash scripts/integration-test.sh [選項]
#
# 選項:
#   -v, --verbose     顯示詳細輸出（含 HTTP 狀態碼與回應時間）
#   -q, --quiet       僅顯示失敗項目
#   -s, --service     僅測試指定服務（例：-s plane）
#   --no-color        停用彩色輸出（適合 CI 環境）
#   -h, --help        顯示使用說明
#
# 範例:
#   bash scripts/integration-test.sh
#   bash scripts/integration-test.sh --verbose
#   bash scripts/integration-test.sh -s homepage -s plane
#   bash scripts/integration-test.sh --no-color 2>&1 | tee /tmp/titan-test.log
# =============================================================================

set -euo pipefail

# =============================================================================
# 顏色設定
# =============================================================================
if [[ "${NO_COLOR:-}" == "1" ]] || [[ "${1:-}" == "--no-color" ]]; then
  RED=""
  GREEN=""
  YELLOW=""
  BLUE=""
  CYAN=""
  BOLD=""
  RESET=""
else
  RED="\033[0;31m"
  GREEN="\033[0;32m"
  YELLOW="\033[0;33m"
  BLUE="\033[0;34m"
  CYAN="\033[0;36m"
  BOLD="\033[1m"
  RESET="\033[0m"
fi

# =============================================================================
# 全域變數
# =============================================================================
VERBOSE=0
QUIET=0
FILTER_SERVICES=()
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_COUNT=0
FAILED_ITEMS=()
START_TIME=$(date +%s)

# 預設逾時（秒）
HTTP_TIMEOUT=10
PING_TIMEOUT=5

# =============================================================================
# 服務端點設定
# 請依實際環境調整各 URL
# =============================================================================

# --- 核心服務 ---
declare -A SERVICES
SERVICES=(
  ["homepage"]="http://homepage.titan.internal"
  ["plane"]="http://plane.titan.internal"
  ["outline"]="http://outline.titan.internal"
  ["gitea"]="http://gitea.titan.internal"
  ["harbor"]="http://harbor.titan.internal"
)

# --- 健康檢查端點（服務專用路徑）---
declare -A HEALTH_ENDPOINTS
HEALTH_ENDPOINTS=(
  ["homepage"]="http://homepage.titan.internal"
  ["plane"]="http://plane.titan.internal/api/health/"
  ["outline"]="http://outline.titan.internal/_health"
  ["gitea"]="http://gitea.titan.internal/api/healthz"
  ["harbor"]="http://harbor.titan.internal/api/v2.0/ping"
)

# --- 監控服務 ---
declare -A MONITORING
MONITORING=(
  ["grafana"]="http://grafana.titan.internal/api/health"
  ["prometheus"]="http://prometheus.titan.internal/-/healthy"
  ["alertmanager"]="http://alertmanager.titan.internal/-/healthy"
)

# --- 基礎設施服務 ---
declare -A INFRA
INFRA=(
  ["keycloak"]="http://keycloak.titan.internal/realms/titan/.well-known/openid-configuration"
  ["minio"]="http://minio.titan.internal/minio/health/live"
  ["minio-console"]="http://minio.titan.internal:9001"
  ["portainer"]="http://portainer.titan.internal/api/status"
)

# --- Docker 容器健康狀態（從本機 Docker 查詢）---
CONTAINERS=(
  "titan-homepage"
  "titan-plane-web"
  "titan-plane-api"
  "titan-plane-worker"
  "titan-outline"
  "titan-gitea"
  "titan-harbor-core"
  "titan-postgresql"
  "titan-redis"
  "titan-minio"
  "titan-keycloak"
  "titan-grafana"
  "titan-prometheus"
  "titan-nginx"
)

# =============================================================================
# 輔助函式
# =============================================================================

log_header() {
  echo ""
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${BLUE}  $1${RESET}"
  echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
}

log_section() {
  echo ""
  echo -e "${CYAN}── $1 ──${RESET}"
}

log_pass() {
  local name="$1"
  local detail="${2:-}"
  PASS_COUNT=$((PASS_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [[ "$QUIET" -eq 0 ]]; then
    printf "  ${GREEN}✓${RESET} %-40s" "$name"
    [[ -n "$detail" ]] && echo -e " ${detail}" || echo ""
  fi
}

log_fail() {
  local name="$1"
  local detail="${2:-}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  FAILED_ITEMS+=("$name")
  printf "  ${RED}✗${RESET} %-40s" "$name"
  [[ -n "$detail" ]] && echo -e " ${RED}${detail}${RESET}" || echo ""
}

log_warn() {
  local name="$1"
  local detail="${2:-}"
  WARN_COUNT=$((WARN_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [[ "$QUIET" -eq 0 ]]; then
    printf "  ${YELLOW}⚠${RESET} %-40s" "$name"
    [[ -n "$detail" ]] && echo -e " ${YELLOW}${detail}${RESET}" || echo ""
  fi
}

# 檢查是否需要測試此服務（依 --service 過濾）
should_test() {
  local service="$1"
  if [[ "${#FILTER_SERVICES[@]}" -eq 0 ]]; then
    return 0
  fi
  for s in "${FILTER_SERVICES[@]}"; do
    [[ "$s" == "$service" ]] && return 0
  done
  return 1
}

# HTTP 健康檢查（回傳 HTTP 狀態碼）
check_http() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  local result
  result=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" \
    --max-time "$HTTP_TIMEOUT" \
    --connect-timeout "$PING_TIMEOUT" \
    -L "$url" 2>/dev/null) || result="000 0.000"

  local http_code
  local response_time
  http_code=$(echo "$result" | awk '{print $1}')
  response_time=$(echo "$result" | awk '{printf "%.3fs", $2}')

  if [[ "$http_code" == "$expected" ]] || \
     [[ "$expected" == "2xx" && "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    if [[ "$VERBOSE" -eq 1 ]]; then
      log_pass "$name" "HTTP $http_code  ${response_time}"
    else
      log_pass "$name"
    fi
    return 0
  elif [[ "$http_code" =~ ^[3][0-9][0-9]$ ]]; then
    if [[ "$VERBOSE" -eq 1 ]]; then
      log_warn "$name" "HTTP $http_code (重新導向)  ${response_time}"
    else
      log_warn "$name" "HTTP $http_code 重新導向"
    fi
    return 1
  elif [[ "$http_code" == "000" ]]; then
    log_fail "$name" "連線失敗（逾時或拒絕）"
    return 1
  else
    log_fail "$name" "HTTP $http_code"
    return 1
  fi
}

# Docker 容器健康狀態檢查
check_container() {
  local container="$1"

  if ! command -v docker &>/dev/null; then
    log_warn "$container" "docker 指令不可用，跳過"
    return 1
  fi

  local status
  status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")

  case "$status" in
    "healthy")
      log_pass "$container" "healthy"
      ;;
    "unhealthy")
      log_fail "$container" "unhealthy"
      ;;
    "starting")
      log_warn "$container" "starting（仍在初始化）"
      ;;
    "not_found")
      # 嘗試不帶健康檢查的狀態
      local running
      running=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
      if [[ "$running" == "running" ]]; then
        log_warn "$container" "running（無 healthcheck 設定）"
      else
        log_fail "$container" "容器不存在或未執行（$running）"
      fi
      ;;
    *)
      log_warn "$container" "狀態未知（$status）"
      ;;
  esac
}

# DNS 解析檢查
check_dns() {
  local hostname="$1"
  if nslookup "$hostname" &>/dev/null 2>&1 || \
     getent hosts "$hostname" &>/dev/null 2>&1; then
    log_pass "$hostname" "DNS 解析成功"
    return 0
  else
    log_fail "$hostname" "DNS 解析失敗"
    return 1
  fi
}

# =============================================================================
# 使用說明
# =============================================================================
usage() {
  cat <<EOF
用途: $0 [選項]

選項:
  -v, --verbose       顯示詳細輸出（HTTP 狀態碼與回應時間）
  -q, --quiet         僅顯示失敗與警告項目
  -s, --service NAME  僅測試指定服務（可多次使用）
  --no-color          停用彩色輸出
  -h, --help          顯示本說明

範例:
  $0                          # 執行所有測試
  $0 --verbose                # 詳細模式
  $0 -s homepage -s plane     # 僅測試 Homepage 與 Plane
  $0 --no-color               # CI 環境適用

EOF
  exit 0
}

# =============================================================================
# 解析命令列引數
# =============================================================================
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -v|--verbose)   VERBOSE=1; shift ;;
    -q|--quiet)     QUIET=1;   shift ;;
    --no-color)     shift ;;  # 已在頂部處理
    -s|--service)   FILTER_SERVICES+=("$2"); shift 2 ;;
    -h|--help)      usage ;;
    *)              echo "未知選項: $1"; usage ;;
  esac
done

# =============================================================================
# 主要測試流程
# =============================================================================

log_header "TITAN 整合測試  $(date '+%Y-%m-%d %H:%M:%S')"

# -----------------------------------------------------------------------
# 1. DNS 解析測試
# -----------------------------------------------------------------------
log_section "1. DNS 解析測試"

DNS_HOSTS=(
  "homepage.titan.internal"
  "plane.titan.internal"
  "outline.titan.internal"
  "gitea.titan.internal"
  "harbor.titan.internal"
  "grafana.titan.internal"
  "keycloak.titan.internal"
  "minio.titan.internal"
)

for host in "${DNS_HOSTS[@]}"; do
  service="${host%%.*}"
  should_test "$service" || should_test "dns" || [[ "${#FILTER_SERVICES[@]}" -eq 0 ]] && \
    check_dns "$host" || true
done

# -----------------------------------------------------------------------
# 2. 核心服務健康檢查
# -----------------------------------------------------------------------
log_section "2. 核心服務健康檢查"

for service in "${!HEALTH_ENDPOINTS[@]}"; do
  should_test "$service" || continue
  check_http "$service" "${HEALTH_ENDPOINTS[$service]}" "2xx"
done

# -----------------------------------------------------------------------
# 3. 監控服務健康檢查
# -----------------------------------------------------------------------
log_section "3. 監控服務健康檢查"

for service in "${!MONITORING[@]}"; do
  should_test "$service" || [[ "${#FILTER_SERVICES[@]}" -eq 0 ]] || continue
  check_http "$service" "${MONITORING[$service]}" "2xx"
done

# -----------------------------------------------------------------------
# 4. 基礎設施服務健康檢查
# -----------------------------------------------------------------------
log_section "4. 基礎設施服務健康檢查"

for service in "${!INFRA[@]}"; do
  should_test "$service" || [[ "${#FILTER_SERVICES[@]}" -eq 0 ]] || continue
  check_http "$service" "${INFRA[$service]}" "2xx"
done

# -----------------------------------------------------------------------
# 5. Docker 容器健康狀態
# -----------------------------------------------------------------------
log_section "5. Docker 容器健康狀態"

for container in "${CONTAINERS[@]}"; do
  check_container "$container"
done

# -----------------------------------------------------------------------
# 6. Homepage 服務連結驗證
# -----------------------------------------------------------------------
log_section "6. Homepage 服務連結驗證"

HOMEPAGE_LINKS=(
  "Plane 任務管理:http://plane.titan.internal"
  "Outline 知識庫:http://outline.titan.internal"
  "Gitea 程式碼庫:http://gitea.titan.internal"
  "Harbor 映像倉庫:http://harbor.titan.internal"
  "Grafana 儀表板:http://grafana.titan.internal"
  "Keycloak 管理:http://keycloak.titan.internal/auth/admin"
  "MinIO Console:http://minio.titan.internal:9001"
  "Portainer:http://portainer.titan.internal"
)

for entry in "${HOMEPAGE_LINKS[@]}"; do
  name="${entry%%:*}"
  url="${entry#*:}"
  check_http "Homepage → $name" "$url" "2xx"
done

# -----------------------------------------------------------------------
# 7. 服務間連線測試（Inter-Service Connectivity）
# -----------------------------------------------------------------------
log_section "7. 服務間連線測試"

INTER_SERVICE=(
  "Plane → PostgreSQL:plane:http://plane.titan.internal/api/health/"
  "Outline → PostgreSQL:outline:http://outline.titan.internal/_health"
  "Gitea → PostgreSQL:gitea:http://gitea.titan.internal/api/healthz"
  "Plane → MinIO:plane:http://plane.titan.internal/api/health/"
  "Keycloak OIDC Discovery:keycloak:http://keycloak.titan.internal/realms/titan/.well-known/openid-configuration"
  "Grafana → Prometheus:grafana:http://grafana.titan.internal/api/datasources"
)

for entry in "${INTER_SERVICE[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  # service="${rest%%:*}"
  url="${rest#*:}"
  check_http "$name" "$url" "2xx"
done

# -----------------------------------------------------------------------
# 8. SSO 整合檢查（Keycloak OIDC）
# -----------------------------------------------------------------------
log_section "8. SSO 整合檢查"

SSO_ENDPOINTS=(
  "Keycloak Realm 存在:http://keycloak.titan.internal/realms/titan"
  "OIDC Well-Known:http://keycloak.titan.internal/realms/titan/.well-known/openid-configuration"
  "Plane OIDC 重新導向:http://plane.titan.internal/auth/oidc/"
  "Outline OIDC 重新導向:http://outline.titan.internal/auth/oidc"
  "Gitea OIDC 重新導向:http://gitea.titan.internal/user/oauth2/keycloak"
)

for entry in "${SSO_ENDPOINTS[@]}"; do
  name="${entry%%:*}"
  url="${entry#*:}"
  check_http "SSO: $name" "$url" "2xx"
done

# -----------------------------------------------------------------------
# 9. 備份服務驗證
# -----------------------------------------------------------------------
log_section "9. 備份服務驗證"

# 檢查 MinIO 備份 bucket 是否存在
if command -v mc &>/dev/null; then
  if mc alias set titan http://minio.titan.internal \
       "${MINIO_ACCESS_KEY:-minioadmin}" \
       "${MINIO_SECRET_KEY:-minioadmin}" &>/dev/null 2>&1; then
    for bucket in titan-db-backup titan-app-backup titan-config-backup; do
      if mc ls "titan/$bucket" &>/dev/null 2>&1; then
        log_pass "MinIO bucket: $bucket"
      else
        log_fail "MinIO bucket: $bucket" "bucket 不存在"
      fi
    done
  else
    log_warn "MinIO bucket 驗證" "mc 連線失敗，跳過 bucket 檢查"
  fi
else
  log_warn "MinIO bucket 驗證" "mc 指令不可用，跳過"
fi

# =============================================================================
# 測試結果摘要
# =============================================================================

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  測試結果摘要${RESET}"
echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  總計測試項目：${BOLD}${TOTAL_COUNT}${RESET}"
echo -e "  通過：${GREEN}${BOLD}${PASS_COUNT}${RESET}"
echo -e "  警告：${YELLOW}${BOLD}${WARN_COUNT}${RESET}"
echo -e "  失敗：${RED}${BOLD}${FAIL_COUNT}${RESET}"
echo -e "  執行時間：${ELAPSED} 秒"
echo ""

if [[ "${#FAILED_ITEMS[@]}" -gt 0 ]]; then
  echo -e "${RED}${BOLD}失敗項目清單：${RESET}"
  for item in "${FAILED_ITEMS[@]}"; do
    echo -e "  ${RED}✗${RESET} $item"
  done
  echo ""
fi

if [[ "$FAIL_COUNT" -eq 0 && "$WARN_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}所有測試通過！TITAN Portal 整合狀態正常。${RESET}"
  echo ""
  exit 0
elif [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}測試完成，有 ${WARN_COUNT} 個警告需要確認。${RESET}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}測試失敗，${FAIL_COUNT} 個項目需要修復。${RESET}"
  echo -e "請參考 ${BOLD}docs/integration-checklist.md${RESET} 進行手動驗證。"
  echo ""
  exit 1
fi
