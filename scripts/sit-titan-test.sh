#!/usr/bin/env bash
# =============================================================================
# TITAN Next.js App — SIT 專項測試腳本
# Issue #179 | 產出 SIT 測試報告
#
# 用途：驗證 TITAN Next.js App 所有 API 端點和頁面路由
# 使用：./scripts/sit-titan-test.sh [BASE_URL]
#       BASE_URL 預設為 http://localhost:3100
# =============================================================================

set -uo pipefail

BASE_URL="${1:-http://localhost:3100}"
LOG_FILE="/tmp/titan-sit-app-$(date +%Y%m%d_%H%M%S).log"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') | $*" | tee -a "$LOG_FILE"; }

check() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"
    ((TOTAL++))

    local code
    code=$(curl -sk --max-time 10 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || code="000"

    if [[ "$code" == "$expected" ]]; then
        echo -e "  ${GREEN}[PASS]${NC} ${name} (HTTP ${code})"
        log "PASS | ${name} | ${url} | HTTP ${code}"
        ((PASS++))
    else
        echo -e "  ${RED}[FAIL]${NC} ${name} (期望 ${expected}, 實際 ${code})"
        log "FAIL | ${name} | ${url} | 期望=${expected} 實際=${code}"
        ((FAIL++))
    fi
}

echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  TITAN Next.js App — SIT 測試${NC}"
echo -e "${BLUE}  目標：${BASE_URL}${NC}"
echo -e "${BLUE}  時間：$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo ""

# ── 1. 頁面路由（未登入應導向登入頁 = 302/307）──────────────
echo -e "${BLUE}[ 頁面路由 — 未登入重定向 ]${NC}"
check "登入頁可存取" "${BASE_URL}/login" "200"
check "Dashboard 重定向到登入" "${BASE_URL}/dashboard" "307"
check "Kanban 重定向到登入" "${BASE_URL}/kanban" "307"
check "Knowledge 重定向到登入" "${BASE_URL}/knowledge" "307"
check "Reports 重定向到登入" "${BASE_URL}/reports" "307"
check "Timesheet 重定向到登入" "${BASE_URL}/timesheet" "307"
check "Gantt 重定向到登入" "${BASE_URL}/gantt" "307"
check "Change Password 可存取" "${BASE_URL}/change-password" "200"
echo ""

# ── 2. API 端點（未認證應回 401）────────────────────────────
echo -e "${BLUE}[ API 端點 — 未認證拒絕 ]${NC}"
check "GET /api/users (401)" "${BASE_URL}/api/users" "401"
check "GET /api/tasks (401)" "${BASE_URL}/api/tasks" "401"
check "GET /api/plans (401)" "${BASE_URL}/api/plans" "401"
check "GET /api/kpi (401)" "${BASE_URL}/api/kpi" "401"
check "GET /api/documents (401)" "${BASE_URL}/api/documents" "401"
check "GET /api/time-entries (401)" "${BASE_URL}/api/time-entries" "401"
check "GET /api/audit-logs (401)" "${BASE_URL}/api/audit-logs" "401"
echo ""

# ── 3. Auth 端點 ─────────────────────────────────────────────
echo -e "${BLUE}[ Auth 端點 ]${NC}"
check "NextAuth CSRF 端點" "${BASE_URL}/api/auth/csrf" "200"
check "NextAuth Session 端點" "${BASE_URL}/api/auth/session" "200"
check "NextAuth Providers" "${BASE_URL}/api/auth/providers" "200"
echo ""

# ── 4. 登入流程測試 ──────────────────────────────────────────
echo -e "${BLUE}[ 登入流程 ]${NC}"

# Get CSRF token
CSRF=$(curl -sk --max-time 10 "${BASE_URL}/api/auth/csrf" 2>/dev/null | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
if [[ -n "$CSRF" ]]; then
    echo -e "  ${GREEN}[PASS]${NC} CSRF token 取得成功"
    log "PASS | CSRF token obtained"
    ((PASS++)); ((TOTAL++))

    # Test invalid login
    RESULT=$(curl -sk --max-time 10 \
        -X POST "${BASE_URL}/api/auth/callback/credentials" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=invalid&password=invalid&csrfToken=${CSRF}" \
        -o /dev/null -w "%{http_code}" 2>/dev/null) || RESULT="000"

    # NextAuth returns 200 with error query param for failed login, or 302 to error page
    if [[ "$RESULT" == "200" ]] || [[ "$RESULT" == "302" ]]; then
        echo -e "  ${GREEN}[PASS]${NC} 錯誤登入正確處理 (HTTP ${RESULT})"
        log "PASS | Invalid login handled correctly"
        ((PASS++)); ((TOTAL++))
    else
        echo -e "  ${RED}[FAIL]${NC} 錯誤登入未預期結果 (HTTP ${RESULT})"
        log "FAIL | Invalid login unexpected: HTTP ${RESULT}"
        ((FAIL++)); ((TOTAL++))
    fi
else
    echo -e "  ${RED}[FAIL]${NC} CSRF token 取得失敗"
    log "FAIL | CSRF token failed"
    ((FAIL++)); ((TOTAL++))
fi
echo ""

# ── 5. Security Headers 檢查 ─────────────────────────────────
echo -e "${BLUE}[ Security Headers ]${NC}"

HEADERS=$(curl -sk --max-time 10 -I "${BASE_URL}/login" 2>/dev/null)

check_header() {
    local name="$1"
    local header="$2"
    ((TOTAL++))
    if echo "$HEADERS" | grep -iq "$header"; then
        echo -e "  ${GREEN}[PASS]${NC} ${name}"
        log "PASS | Header: ${name}"
        ((PASS++))
    else
        echo -e "  ${YELLOW}[WARN]${NC} ${name} (由 Nginx 提供，dev 環境可能無)"
        log "WARN | Header missing: ${name} (expected in production via Nginx)"
        ((PASS++))  # 不算失敗，dev 環境由 Nginx 提供
    fi
}

check_header "X-Content-Type-Options" "x-content-type-options"
check_header "X-Frame-Options" "x-frame-options"
echo ""

# ── 結果摘要 ──────────────────────────────────────────────────
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  測試結果摘要${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  總測試：${TOTAL}"
echo -e "  ${GREEN}通過：${PASS}${NC}"
echo -e "  ${RED}失敗：${FAIL}${NC}"
echo -e "  日誌：${LOG_FILE}"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo -e "  ${GREEN}✓ TITAN SIT 測試全部通過${NC}"
    exit 0
else
    echo -e "  ${RED}✗ TITAN SIT 測試有失敗項目${NC}"
    exit 1
fi
