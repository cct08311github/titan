#!/usr/bin/env bash
# =============================================================================
# TITAN auth-init.sh 測試套件
# Issue #257 — Test coverage gaps for infra scripts
# =============================================================================
# 測試策略：使用 stub 替換外部命令（curl, jq, docker），
#           驗證腳本的前置檢查、DRY_RUN 模式與錯誤處理。
#
# 使用方式：bash tests/test-auth-init.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_UNDER_TEST="${REPO_ROOT}/scripts/auth-init.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

TESTS_PASSED=0
TESTS_FAILED=0

# ─── 測試框架 ──────────────────────────────────────────────────────────────────

log() { printf '[test] %s\n' "$1"; }

pass() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  printf '[PASS] %s\n' "$1"
}

fail() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  printf '[FAIL] %s\n' "$1" >&2
}

new_fixture() {
  local name="$1"
  local dir="${TMP_DIR}/${name}"
  mkdir -p "${dir}/bin"
  printf '%s\n' "${dir}"
}

# ─── Stub 工具 ─────────────────────────────────────────────────────────────────

write_passing_stubs() {
  local dir="$1"

  cat > "${dir}/bin/curl" <<'STUB'
#!/usr/bin/env bash
echo "curl $*" >> "${TEST_LOG}"
# 模擬 Outline API 回傳成功
echo '{"ok": true}'
STUB

  cat > "${dir}/bin/jq" <<'STUB'
#!/usr/bin/env bash
echo "jq $*" >> "${TEST_LOG}"
# 根據輸入判斷回傳值
if echo "$*" | grep -q "\.ok"; then
  echo "true"
elif echo "$*" | grep -q "\.error"; then
  echo "null"
else
  cat  # passthrough
fi
STUB

  cat > "${dir}/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "docker $*" >> "${TEST_LOG}"
STUB

  cat > "${dir}/bin/sleep" <<'STUB'
#!/usr/bin/env bash
# 短路 sleep 以加速測試
exit 0
STUB

  chmod +x "${dir}/bin/curl" "${dir}/bin/jq" "${dir}/bin/docker" "${dir}/bin/sleep"
}

write_curl_missing_stub() {
  local dir="$1"
  # 只建立 jq 和 docker，不建立 curl
  cat > "${dir}/bin/jq" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  cat > "${dir}/bin/docker" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  chmod +x "${dir}/bin/jq" "${dir}/bin/docker"
}

# ─── 測試案例 ──────────────────────────────────────────────────────────────────

# 1. 腳本存在且可讀
test_script_exists() {
  local name="auth-init: script exists"
  if [[ -f "${SCRIPT_UNDER_TEST}" ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 2. 腳本使用 set -euo pipefail
test_script_has_strict_mode() {
  local name="auth-init: uses set -euo pipefail"
  if grep -q 'set -euo pipefail' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 3. --help 應以 exit 0 結束
test_help_exits_zero() {
  local name="auth-init: --help exits 0"
  local dir
  dir="$(new_fixture help)"
  write_passing_stubs "${dir}"

  set +e
  env \
    PATH="${dir}/bin:${PATH}" \
    "${SCRIPT_UNDER_TEST}" --help >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -eq 0 ]]; then
    pass "${name}"
  else
    fail "${name} (exit code: ${status})"
  fi
}

# 4. 缺少 OUTLINE_API_TOKEN 時應退出
test_missing_api_token_exits_nonzero() {
  local name="auth-init: exits non-zero when OUTLINE_API_TOKEN is missing"
  local dir
  dir="$(new_fixture missing-token)"
  write_passing_stubs "${dir}"

  set +e
  env \
    PATH="${dir}/bin:${PATH}" \
    OUTLINE_API_TOKEN="" \
    SKIP_HEALTH_CHECK=true \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 5. 缺少 curl 時應報錯退出
test_missing_curl_exits_nonzero() {
  local name="auth-init: exits non-zero when curl is missing"
  local dir
  dir="$(new_fixture missing-curl)"
  write_curl_missing_stub "${dir}"

  set +e
  env \
    PATH="${dir}/bin" \
    OUTLINE_API_TOKEN=test-token \
    SKIP_HEALTH_CHECK=true \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 6. DRY_RUN 模式不應呼叫 API
test_dry_run_does_not_call_api() {
  local name="auth-init: DRY_RUN=true does not call Outline API"
  local dir
  dir="$(new_fixture dry-run)"
  write_passing_stubs "${dir}"

  set +e
  env \
    PATH="${dir}/bin:${PATH}" \
    TEST_LOG="${dir}/calls.log" \
    OUTLINE_API_TOKEN=test-token \
    SKIP_HEALTH_CHECK=true \
    DRY_RUN=true \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  set -e

  # 在 DRY_RUN 模式下，curl 不應被用於 users.invite
  if [[ -f "${dir}/calls.log" ]] && grep -q "users.invite" "${dir}/calls.log"; then
    fail "${name} (API was called in DRY_RUN mode)"
  else
    pass "${name}"
  fi
}

# 7. 腳本包含 Outline admin 建立邏輯
test_script_has_admin_creation() {
  local name="auth-init: contains admin creation logic"
  if grep -q 'create_outline_admin' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 8. 腳本包含 Collection 建立邏輯
test_script_has_collection_creation() {
  local name="auth-init: contains collection creation logic"
  if grep -q 'create_outline_collections' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 9. 腳本包含 Plane admin 設定說明
test_script_has_plane_admin_instructions() {
  local name="auth-init: contains Plane admin setup instructions"
  if grep -q 'setup_plane_admin\|plane.*superuser\|createsuperuser' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# ─── 主程式 ────────────────────────────────────────────────────────────────────

main() {
  log "=== auth-init.sh Test Suite ==="

  test_script_exists
  test_script_has_strict_mode
  test_help_exits_zero
  test_missing_api_token_exits_nonzero
  test_missing_curl_exits_nonzero
  test_dry_run_does_not_call_api
  test_script_has_admin_creation
  test_script_has_collection_creation
  test_script_has_plane_admin_instructions

  echo ""
  log "Results: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed"

  if [[ ${TESTS_FAILED} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
