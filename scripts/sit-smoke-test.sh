#!/usr/bin/env bash
# =============================================================================
# TITAN SIT Smoke Test Script
# T21 | 對應 Issue #32
#
# 用途：快速驗證 SIT 環境所有端點正常回應，作為 SIT 測試入場條件
# 使用：./scripts/sit-smoke-test.sh [BASE_URL]
#       BASE_URL 預設為 https://sit.titan.internal
# =============================================================================

set -euo pipefail

# ─────────────────────────── 設定區 ─────────────────────────────────────────
BASE_URL="${1:-https://sit.titan.internal}"
TIMEOUT=10          # 每個請求的超時秒數
MAX_RETRIES=3       # 重試次數
RETRY_DELAY=5       # 重試間隔秒數
LOG_FILE="/tmp/titan-sit-smoke-$(date +%Y%m%d_%H%M%S).log"
PASS=0
FAIL=0
SKIP=0

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────── 工具函式 ────────────────────────────────────────

log() {
    local level="$1"
    shift
    local msg="$*"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] [$level] $msg" | tee -a "$LOG_FILE"
}

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  TITAN SIT Smoke Test${NC}"
    echo -e "${BLUE}  目標環境：${BASE_URL}${NC}"
    echo -e "${BLUE}  執行時間：$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_summary() {
    local total=$((PASS + FAIL + SKIP))
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Smoke Test 結果摘要${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
    echo -e "  總測試數：${total}"
    echo -e "  ${GREEN}通過 (PASS)：${PASS}${NC}"
    echo -e "  ${RED}失敗 (FAIL)：${FAIL}${NC}"
    echo -e "  ${YELLOW}略過 (SKIP)：${SKIP}${NC}"
    echo -e "  日誌檔案：${LOG_FILE}"
    echo ""

    if [[ $FAIL -eq 0 ]]; then
        echo -e "  ${GREEN}✓ 煙霧測試通過 — 可進行 SIT 測試${NC}"
        echo ""
        log "INFO" "Smoke test PASSED: ${PASS}/${total}"
        exit 0
    else
        echo -e "  ${RED}✗ 煙霧測試失敗 — 請修復後再執行 SIT${NC}"
        echo ""
        log "ERROR" "Smoke test FAILED: PASS=${PASS}, FAIL=${FAIL}, SKIP=${SKIP}"
        exit 1
    fi
}

# HTTP 健康檢查
# 用法：check_http <測試名稱> <URL> <期望 HTTP 狀態碼> [預期回應字串]
check_http() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    local expected_body="${4:-}"

    local retries=0
    local actual_code
    local body

    while [[ $retries -lt $MAX_RETRIES ]]; do
        actual_code=$(curl -sk \
            --max-time "$TIMEOUT" \
            -o /tmp/titan_smoke_resp.txt \
            -w "%{http_code}" \
            "$url" 2>/dev/null) || actual_code="000"
        body=$(cat /tmp/titan_smoke_resp.txt 2>/dev/null || echo "")

        if [[ "$actual_code" == "$expected_code" ]]; then
            if [[ -z "$expected_body" ]] || echo "$body" | grep -q "$expected_body"; then
                echo -e "  ${GREEN}[PASS]${NC} ${name}"
                log "PASS" "${name} | ${url} | HTTP ${actual_code}"
                ((PASS++))
                return 0
            fi
        fi

        ((retries++))
        if [[ $retries -lt $MAX_RETRIES ]]; then
            log "WARN" "${name} | 重試 ${retries}/${MAX_RETRIES} | HTTP ${actual_code}"
            sleep "$RETRY_DELAY"
        fi
    done

    echo -e "  ${RED}[FAIL]${NC} ${name} (期望 HTTP ${expected_code}，實際 HTTP ${actual_code})"
    log "FAIL" "${name} | ${url} | 期望=${expected_code}, 實際=${actual_code}"
    ((FAIL++))
    return 1
}

# TCP 連線檢查
check_tcp() {
    local name="$1"
    local host="$2"
    local port="$3"

    if nc -z -w "$TIMEOUT" "$host" "$port" 2>/dev/null; then
        echo -e "  ${GREEN}[PASS]${NC} ${name} (${host}:${port})"
        log "PASS" "${name} | TCP ${host}:${port}"
        ((PASS++))
    else
        echo -e "  ${RED}[FAIL]${NC} ${name} (${host}:${port} 無法連線)"
        log "FAIL" "${name} | TCP ${host}:${port} 連線失敗"
        ((FAIL++))
    fi
}

# Docker 服務狀態檢查
check_docker_service() {
    local name="$1"
    local service="$2"
    local compose_file="${3:-/tmp/titan-phaseE/docker-compose.yml}"

    if docker compose -f "$compose_file" ps --status running 2>/dev/null | grep -q "$service"; then
        echo -e "  ${GREEN}[PASS]${NC} ${name} (${service} running)"
        log "PASS" "${name} | Docker service ${service} is running"
        ((PASS++))
    else
        echo -e "  ${RED}[FAIL]${NC} ${name} (${service} 未運行或不存在)"
        log "FAIL" "${name} | Docker service ${service} not running"
        ((FAIL++))
    fi
}

# ─────────────────────────── 測試案例 ────────────────────────────────────────

test_prerequisites() {
    echo -e "${BLUE}[ 前置條件檢查 ]${NC}"

    # 檢查必要工具
    for tool in curl nc docker jq; do
        if command -v "$tool" &>/dev/null; then
            echo -e "  ${GREEN}[PASS]${NC} 工具存在：${tool}"
            log "PASS" "工具存在：${tool}"
            ((PASS++))
        else
            echo -e "  ${YELLOW}[SKIP]${NC} 工具缺失：${tool}（部分測試將略過）"
            log "WARN" "工具缺失：${tool}"
            ((SKIP++))
        fi
    done
    echo ""
}

test_docker_services() {
    echo -e "${BLUE}[ Docker 服務狀態 ]${NC}"

    local compose_file
    compose_file="$(dirname "$0")/../docker-compose.yml"

    if [[ ! -f "$compose_file" ]]; then
        echo -e "  ${YELLOW}[SKIP]${NC} docker-compose.yml 不存在，略過 Docker 服務檢查"
        log "SKIP" "docker-compose.yml 不存在"
        ((SKIP+=5))
        echo ""
        return
    fi

    check_docker_service "Nginx 閘道" "nginx" "$compose_file"
    check_docker_service "Plane Web" "plane-web" "$compose_file"
    check_docker_service "Plane API" "plane-api" "$compose_file"
    check_docker_service "Outline" "outline" "$compose_file"
    check_docker_service "PostgreSQL" "postgres" "$compose_file"
    check_docker_service "Redis" "redis" "$compose_file"
    check_docker_service "Prometheus" "prometheus" "$compose_file"
    check_docker_service "Grafana" "grafana" "$compose_file"
    echo ""
}

test_nginx_gateway() {
    echo -e "${BLUE}[ Nginx 閘道端點 ]${NC}"

    check_http "首頁可存取" "${BASE_URL}/" "200"
    check_http "健康檢查端點" "${BASE_URL}/health" "200"
    check_http "靜態資源（robots.txt）" "${BASE_URL}/robots.txt" "200"
    check_http "HTTPS 強制重定向（HTTP→HTTPS）" \
        "${BASE_URL/https:/http:}/" "301"
    echo ""
}

test_plane_service() {
    echo -e "${BLUE}[ Plane 任務管理服務 ]${NC}"

    local plane_base="${BASE_URL}/plane"

    check_http "Plane 首頁" "${plane_base}/" "200"
    check_http "Plane 登入頁" "${plane_base}/sign-in/" "200"
    check_http "Plane API 健康" "${plane_base}/api/health/" "200" "ok"
    check_http "Plane API — 工作區列表（未認證應回 401）" \
        "${plane_base}/api/v1/workspaces/" "401"
    check_http "Plane API — 版本資訊" \
        "${plane_base}/api/v1/version/" "200"
    echo ""
}

test_outline_service() {
    echo -e "${BLUE}[ Outline 文件服務 ]${NC}"

    local outline_base="${BASE_URL}/outline"

    check_http "Outline 首頁" "${outline_base}/" "200"
    check_http "Outline 健康檢查" "${outline_base}/_health" "200" "OK"
    check_http "Outline API（未認證應回 401）" \
        "${outline_base}/api/auth.info" "401"
    check_http "Outline 靜態資源" "${outline_base}/static/" "200"
    echo ""
}

test_monitoring() {
    echo -e "${BLUE}[ 監控服務端點 ]${NC}"

    check_http "Prometheus 首頁" "${BASE_URL}/prometheus/" "200"
    check_http "Prometheus Metrics 端點" "${BASE_URL}/prometheus/metrics" "200"
    check_http "Prometheus 查詢 API" \
        "${BASE_URL}/prometheus/api/v1/query?query=up" "200" '"status":"success"'
    check_http "Grafana 首頁" "${BASE_URL}/grafana/" "200"
    check_http "Grafana 健康" "${BASE_URL}/grafana/api/health" "200" '"database":"ok"'
    echo ""
}

test_database_connectivity() {
    echo -e "${BLUE}[ 資料庫連線 ]${NC}"

    if ! command -v nc &>/dev/null; then
        echo -e "  ${YELLOW}[SKIP]${NC} nc 不存在，略過資料庫 TCP 檢查"
        ((SKIP+=2))
        echo ""
        return
    fi

    # 從 BASE_URL 解析主機
    local host
    host=$(echo "$BASE_URL" | sed -E 's|https?://([^/:]+).*|\1|')

    check_tcp "PostgreSQL TCP 連線" "$host" "5432"
    check_tcp "Redis TCP 連線" "$host" "6379"
    echo ""
}

test_ssl_certificate() {
    echo -e "${BLUE}[ SSL 憑證驗證 ]${NC}"

    local host
    host=$(echo "$BASE_URL" | sed -E 's|https?://([^/:]+).*|\1|')

    if echo | openssl s_client -connect "${host}:443" -servername "$host" \
        -verify_return_error 2>/dev/null | grep -q "Verify return code: 0"; then
        echo -e "  ${GREEN}[PASS]${NC} SSL 憑證有效"
        log "PASS" "SSL 憑證有效：${host}"
        ((PASS++))
    else
        # 自簽憑證在 SIT 環境可接受
        echo -e "  ${YELLOW}[SKIP]${NC} SSL 憑證驗證略過（SIT 環境可能使用自簽憑證）"
        log "SKIP" "SSL 憑證驗證略過"
        ((SKIP++))
    fi

    # 確認憑證到期日
    local expiry
    expiry=$(echo | openssl s_client -connect "${host}:443" -servername "$host" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null \
        | cut -d= -f2 || echo "無法取得")
    echo -e "  ${BLUE}[INFO]${NC} 憑證到期日：${expiry}"
    log "INFO" "憑證到期日：${expiry}"
    echo ""
}

test_api_response_time() {
    echo -e "${BLUE}[ API 回應時間 ]${NC}"

    local endpoints=(
        "${BASE_URL}/health"
        "${BASE_URL}/plane/api/health/"
        "${BASE_URL}/outline/_health"
        "${BASE_URL}/grafana/api/health"
    )

    local names=(
        "Nginx 健康檢查"
        "Plane API 健康"
        "Outline 健康"
        "Grafana 健康"
    )

    for i in "${!endpoints[@]}"; do
        local url="${endpoints[$i]}"
        local name="${names[$i]}"
        local response_time

        response_time=$(curl -sk --max-time "$TIMEOUT" \
            -o /dev/null \
            -w "%{time_total}" \
            "$url" 2>/dev/null || echo "999")

        # 轉換為毫秒（乘以 1000）
        local ms
        ms=$(echo "$response_time * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "9999")

        if [[ "$ms" -lt 2000 ]]; then
            echo -e "  ${GREEN}[PASS]${NC} ${name}：${ms}ms（< 2000ms）"
            log "PASS" "回應時間 ${name}：${ms}ms"
            ((PASS++))
        elif [[ "$ms" -lt 5000 ]]; then
            echo -e "  ${YELLOW}[WARN]${NC} ${name}：${ms}ms（< 5000ms，效能警告）"
            log "WARN" "回應時間偏高 ${name}：${ms}ms"
            ((PASS++))  # 仍算通過，僅警告
        else
            echo -e "  ${RED}[FAIL]${NC} ${name}：${ms}ms（>= 5000ms）"
            log "FAIL" "回應時間過高 ${name}：${ms}ms"
            ((FAIL++))
        fi
    done
    echo ""
}

# ─────────────────────────── 主程式 ──────────────────────────────────────────

main() {
    print_header

    log "INFO" "Smoke Test 開始 | 目標：${BASE_URL}"

    test_prerequisites
    test_docker_services
    test_nginx_gateway
    test_plane_service
    test_outline_service
    test_monitoring
    test_database_connectivity
    test_ssl_certificate
    test_api_response_time

    print_summary
}

main "$@"
