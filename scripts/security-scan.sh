#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 基礎安全掃描腳本
# Issue #484: OWASP ZAP 基礎安全掃描（簡化版）
# ═══════════════════════════════════════════════════════════════════════════════
# 檢查項目：
#   1. API 端點回應是否包含正確的安全 headers
#   2. CSP header 是否存在
#   3. 錯誤回應是否洩漏敏感資訊
#   4. 未認證請求是否正確被拒絕
#
# 使用方式：
#   ./scripts/security-scan.sh [BASE_URL]
#   預設 BASE_URL: http://localhost:3000
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${1:-http://localhost:3000}"
ERRORS=0
WARNINGS=0
CHECKS=0

# ── 輸出格式 ─────────────────────────────────────────────────────────────────

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

pass() { ((CHECKS++)); echo -e "  ${GREEN}PASS${NC}  $1"; }
fail() { ((CHECKS++)); ((ERRORS++)); echo -e "  ${RED}FAIL${NC}  $1"; }
warn() { ((CHECKS++)); ((WARNINGS++)); echo -e "  ${YELLOW}WARN${NC}  $1"; }
info() { echo -e "  ${BLUE}INFO${NC}  $1"; }

# ── 前置檢查 ─────────────────────────────────────────────────────────────────

echo ""
echo "═══ TITAN 安全掃描 ═══"
echo "目標: ${BASE_URL}"
echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if ! command -v curl &>/dev/null; then
  echo "錯誤: curl 未安裝"
  exit 1
fi

# 確認服務可達
if ! curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${BASE_URL}/api/health" &>/dev/null; then
  echo "錯誤: 無法連線到 ${BASE_URL}，請確認服務已啟動"
  exit 1
fi

# ── 1. 安全 Headers 檢查 ────────────────────────────────────────────────────

echo "── 1. 安全 Headers 檢查 ──"

HEADERS=$(curl -s -I --max-time 10 "${BASE_URL}/" 2>/dev/null)

# X-Content-Type-Options
if echo "${HEADERS}" | grep -qi "x-content-type-options.*nosniff"; then
  pass "X-Content-Type-Options: nosniff"
else
  fail "缺少 X-Content-Type-Options: nosniff"
fi

# X-Frame-Options
if echo "${HEADERS}" | grep -qi "x-frame-options"; then
  pass "X-Frame-Options 已設定"
else
  fail "缺少 X-Frame-Options"
fi

# X-XSS-Protection (should be 0 for modern browsers)
if echo "${HEADERS}" | grep -qi "x-xss-protection"; then
  pass "X-XSS-Protection 已設定"
else
  warn "缺少 X-XSS-Protection（現代瀏覽器非必要）"
fi

# Referrer-Policy
if echo "${HEADERS}" | grep -qi "referrer-policy"; then
  pass "Referrer-Policy 已設定"
else
  fail "缺少 Referrer-Policy"
fi

# Permissions-Policy
if echo "${HEADERS}" | grep -qi "permissions-policy"; then
  pass "Permissions-Policy 已設定"
else
  warn "缺少 Permissions-Policy"
fi

# X-Powered-By should NOT be present
if echo "${HEADERS}" | grep -qi "x-powered-by"; then
  fail "X-Powered-By 存在（應隱藏伺服器技術資訊）"
else
  pass "X-Powered-By 已隱藏"
fi

echo ""

# ── 2. CSP Header 檢查 ──────────────────────────────────────────────────────

echo "── 2. Content-Security-Policy 檢查 ──"

if echo "${HEADERS}" | grep -qi "content-security-policy"; then
  pass "Content-Security-Policy 已設定"

  CSP_VALUE=$(echo "${HEADERS}" | grep -i "content-security-policy" | head -1 | sed 's/[^:]*: //')

  # 檢查 CSP 是否包含基本指令
  if echo "${CSP_VALUE}" | grep -q "default-src"; then
    pass "CSP 包含 default-src 指令"
  else
    warn "CSP 缺少 default-src 指令"
  fi

  if echo "${CSP_VALUE}" | grep -q "script-src"; then
    pass "CSP 包含 script-src 指令"
  else
    warn "CSP 缺少 script-src 指令"
  fi

  # 檢查是否使用 unsafe-inline（不含 nonce 的情況下）
  if echo "${CSP_VALUE}" | grep -q "'unsafe-inline'" && ! echo "${CSP_VALUE}" | grep -q "'nonce-"; then
    warn "CSP 使用 unsafe-inline 且無 nonce（建議使用 nonce-based CSP）"
  fi

  # 檢查是否使用 unsafe-eval
  if echo "${CSP_VALUE}" | grep -q "'unsafe-eval'"; then
    warn "CSP 使用 unsafe-eval（應盡量避免）"
  fi
else
  fail "缺少 Content-Security-Policy"
fi

echo ""

# ── 3. API 認證檢查 ─────────────────────────────────────────────────────────

echo "── 3. API 認證檢查（未認證請求應被拒絕）──"

# 需要認證的 API 端點列表
AUTH_ENDPOINTS=(
  "/api/tasks"
  "/api/users"
  "/api/plans"
  "/api/kpi"
  "/api/time-entries"
  "/api/notifications"
  "/api/documents"
  "/api/permissions"
  "/api/audit"
  "/api/approvals"
  "/api/reports/monthly"
  "/api/admin/backup-status"
)

for endpoint in "${AUTH_ENDPOINTS[@]}"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}${endpoint}" 2>/dev/null)

  if [[ "${HTTP_CODE}" == "401" || "${HTTP_CODE}" == "403" || "${HTTP_CODE}" == "302" ]]; then
    pass "GET ${endpoint} -> ${HTTP_CODE}（正確拒絕未認證請求）"
  elif [[ "${HTTP_CODE}" == "405" ]]; then
    info "GET ${endpoint} -> 405（方法不允許，可接受）"
  elif [[ "${HTTP_CODE}" == "200" ]]; then
    fail "GET ${endpoint} -> 200（未認證請求不應回傳 200）"
  else
    warn "GET ${endpoint} -> ${HTTP_CODE}（預期 401/403）"
  fi
done

echo ""

# ── 4. 錯誤回應資訊洩漏檢查 ─────────────────────────────────────────────────

echo "── 4. 錯誤回應資訊洩漏檢查 ──"

# 測試不存在的端點
NOT_FOUND_BODY=$(curl -s --max-time 10 "${BASE_URL}/api/nonexistent-endpoint-test" 2>/dev/null)

# 檢查是否洩漏堆疊追蹤
if echo "${NOT_FOUND_BODY}" | grep -qi "stack\|traceback\|at .*\.ts:\|at .*\.js:"; then
  fail "錯誤回應洩漏堆疊追蹤資訊"
else
  pass "錯誤回應未洩漏堆疊追蹤"
fi

# 檢查是否洩漏路徑資訊
if echo "${NOT_FOUND_BODY}" | grep -qi "/Users/\|/home/\|/opt/\|/var/\|node_modules"; then
  fail "錯誤回應洩漏伺服器路徑資訊"
else
  pass "錯誤回應未洩漏伺服器路徑"
fi

# 檢查是否洩漏資料庫資訊
if echo "${NOT_FOUND_BODY}" | grep -qi "prisma\|postgresql\|pg_\|connection.*string\|database.*error"; then
  fail "錯誤回應洩漏資料庫資訊"
else
  pass "錯誤回應未洩漏資料庫資訊"
fi

# 測試 SQL injection 嘗試（應被正確處理）
SQLI_BODY=$(curl -s --max-time 10 "${BASE_URL}/api/tasks?id=1'%20OR%201=1--" 2>/dev/null)

if echo "${SQLI_BODY}" | grep -qi "sql\|syntax.*error\|pg_\|relation.*does.*not.*exist"; then
  fail "SQL injection 測試：回應洩漏 SQL 錯誤資訊"
else
  pass "SQL injection 測試：未洩漏 SQL 錯誤資訊"
fi

echo ""

# ── 5. HTTP 方法檢查 ─────────────────────────────────────────────────────────

echo "── 5. 危險 HTTP 方法檢查 ──"

# TRACE 方法應被禁用
TRACE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X TRACE --max-time 10 "${BASE_URL}/" 2>/dev/null)
if [[ "${TRACE_CODE}" == "405" || "${TRACE_CODE}" == "501" || "${TRACE_CODE}" == "400" ]]; then
  pass "TRACE 方法已禁用（${TRACE_CODE}）"
else
  warn "TRACE 方法回應 ${TRACE_CODE}（建議禁用）"
fi

# OPTIONS 檢查 CORS
OPTIONS_HEADERS=$(curl -s -I -X OPTIONS --max-time 10 \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST" \
  "${BASE_URL}/api/tasks" 2>/dev/null)

if echo "${OPTIONS_HEADERS}" | grep -qi "access-control-allow-origin.*\*"; then
  fail "CORS 允許所有 origin（Access-Control-Allow-Origin: *）"
elif echo "${OPTIONS_HEADERS}" | grep -qi "access-control-allow-origin.*evil\.example\.com"; then
  fail "CORS 允許任意 origin（反射 evil.example.com）"
else
  pass "CORS 未對惡意 origin 開放"
fi

echo ""

# ── 6. Cookie 安全檢查 ───────────────────────────────────────────────────────

echo "── 6. Cookie 安全屬性檢查 ──"

COOKIE_HEADERS=$(curl -s -I --max-time 10 "${BASE_URL}/api/auth/csrf" 2>/dev/null)

if echo "${COOKIE_HEADERS}" | grep -qi "set-cookie"; then
  COOKIES=$(echo "${COOKIE_HEADERS}" | grep -i "set-cookie")

  if echo "${COOKIES}" | grep -qi "httponly"; then
    pass "Cookie 設定 HttpOnly"
  else
    warn "Cookie 缺少 HttpOnly 屬性"
  fi

  if echo "${COOKIES}" | grep -qi "secure"; then
    pass "Cookie 設定 Secure"
  else
    # localhost 開發環境可能不設 Secure
    if echo "${BASE_URL}" | grep -q "localhost\|127.0.0.1"; then
      info "Cookie 缺少 Secure（localhost 開發環境可接受）"
    else
      fail "Cookie 缺少 Secure 屬性"
    fi
  fi

  if echo "${COOKIES}" | grep -qi "samesite"; then
    pass "Cookie 設定 SameSite"
  else
    warn "Cookie 缺少 SameSite 屬性"
  fi
else
  info "未偵測到 Set-Cookie header（可能需登入才會設定）"
fi

echo ""

# ── 結果摘要 ─────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════"
echo "  掃描完成"
echo "  檢查項目: ${CHECKS}"
echo -e "  ${GREEN}通過: $(( CHECKS - ERRORS - WARNINGS ))${NC}"
echo -e "  ${YELLOW}警告: ${WARNINGS}${NC}"
echo -e "  ${RED}失敗: ${ERRORS}${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

if [[ ${ERRORS} -gt 0 ]]; then
  echo -e "${RED}安全掃描發現 ${ERRORS} 個問題需要修復${NC}"
  exit 1
else
  if [[ ${WARNINGS} -gt 0 ]]; then
    echo -e "${YELLOW}安全掃描通過（有 ${WARNINGS} 個警告）${NC}"
  else
    echo -e "${GREEN}安全掃描全部通過${NC}"
  fi
  exit 0
fi
