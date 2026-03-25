#!/usr/bin/env bash
# =============================================================================
# TITAN generate-ssl-cert.sh 測試套件
# Issue #257 — Test coverage gaps for infra scripts
# =============================================================================
# 測試策略：使用 stub 替換 openssl，驗證腳本流程、
#           輸出檔案產生與權限設定。
#
# 使用方式：bash tests/test-generate-ssl-cert.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_UNDER_TEST="${REPO_ROOT}/scripts/generate-ssl-cert.sh"
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

write_openssl_stub() {
  local dir="$1"

  # openssl stub — 模擬憑證產生
  cat > "${dir}/bin/openssl" <<'STUB'
#!/usr/bin/env bash
echo "openssl $*" >> "${TEST_LOG:-/dev/null}"

# 模擬 openssl version
if [[ "$1" == "version" ]]; then
  echo "OpenSSL 3.0.0 (stub)"
  exit 0
fi

# 模擬 openssl req -x509 — 產生空的 cert 和 key 檔案
if [[ "$1" == "req" ]]; then
  # 找出 -keyout 和 -out 參數的值
  local keyout="" certout=""
  local args=("$@")
  for ((i=0; i<${#args[@]}; i++)); do
    case "${args[i]}" in
      -keyout) keyout="${args[i+1]}" ;;
      -out)    certout="${args[i+1]}" ;;
    esac
  done
  [[ -n "${keyout}" ]] && echo "FAKE-KEY" > "${keyout}"
  [[ -n "${certout}" ]] && echo "FAKE-CERT" > "${certout}"
  exit 0
fi

# 模擬 openssl x509 驗證
if [[ "$1" == "x509" ]]; then
  if echo "$*" | grep -q "\-subject"; then
    echo "subject=CN = titan.bank.local"
  elif echo "$*" | grep -q "\-dates"; then
    echo "notBefore=Jan  1 00:00:00 2026 GMT"
    echo "notAfter=Jan  1 00:00:00 2036 GMT"
  elif echo "$*" | grep -q "\-ext"; then
    echo "DNS:titan.bank.local, DNS:localhost, IP:127.0.0.1"
  fi
  exit 0
fi

# 模擬 openssl rand
if [[ "$1" == "rand" ]]; then
  echo "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567"
  exit 0
fi

exit 0
STUB

  # read stub — 自動回答 y（覆寫既有憑證）
  cat > "${dir}/bin/read_wrapper" <<'STUB'
#!/usr/bin/env bash
echo "y"
STUB

  chmod +x "${dir}/bin/openssl" "${dir}/bin/read_wrapper"
}

write_openssl_missing() {
  local dir="$1"
  # 不建立 openssl stub
  mkdir -p "${dir}/bin"
}

# ─── 測試案例 ──────────────────────────────────────────────────────────────────

# 1. 腳本存在且可讀
test_script_exists() {
  local name="generate-ssl-cert: script exists"
  if [[ -f "${SCRIPT_UNDER_TEST}" ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 2. 腳本使用 set -euo pipefail
test_script_has_strict_mode() {
  local name="generate-ssl-cert: uses set -euo pipefail"
  if grep -q 'set -euo pipefail' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 3. 缺少 openssl 時應報錯退出
test_missing_openssl_exits_nonzero() {
  local name="generate-ssl-cert: exits non-zero when openssl is missing"
  local dir
  dir="$(new_fixture missing-openssl)"
  write_openssl_missing "${dir}"

  set +e
  env \
    PATH="${dir}/bin" \
    FORCE=1 \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 4. 正常執行時應呼叫 openssl
test_normal_run_calls_openssl() {
  local name="generate-ssl-cert: calls openssl on normal run"
  local dir
  dir="$(new_fixture normal-run)"
  write_openssl_stub "${dir}"

  set +e
  env \
    PATH="${dir}/bin:${PATH}" \
    TEST_LOG="${dir}/calls.log" \
    FORCE=1 \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ -f "${dir}/calls.log" ]] && grep -q "openssl req" "${dir}/calls.log"; then
    pass "${name}"
  else
    fail "${name} (openssl req not called)"
  fi
}

# 5. 腳本包含 SAN 配置（Subject Alternative Names）
test_script_has_san_config() {
  local name="generate-ssl-cert: includes SAN configuration"
  if grep -q 'subjectAltName\|alt_names' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 6. 腳本設定安全的檔案權限
test_script_sets_secure_permissions() {
  local name="generate-ssl-cert: sets chmod 600 on private key"
  if grep -q 'chmod 600.*KEY_FILE\|chmod 600.*key' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 7. 腳本包含既有憑證覆寫確認
test_script_has_overwrite_confirmation() {
  local name="generate-ssl-cert: asks for overwrite confirmation"
  if grep -q 'FORCE\|confirm\|覆寫' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 8. 預設網域為 titan.bank.local
test_default_domain() {
  local name="generate-ssl-cert: default domain is titan.bank.local"
  if grep -q 'titan.bank.local' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 9. 腳本包含憑證驗證步驟
test_script_has_verification() {
  local name="generate-ssl-cert: includes certificate verification"
  if grep -q 'verify_certificate\|openssl x509.*-noout' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 10. RSA 金鑰長度至少 2048 bit
test_key_length_at_least_2048() {
  local name="generate-ssl-cert: RSA key length >= 2048"
  local key_bits
  key_bits=$(grep -oE 'KEY_BITS=[0-9]+' "${SCRIPT_UNDER_TEST}" | head -1 | cut -d= -f2)

  if [[ -n "${key_bits}" && ${key_bits} -ge 2048 ]]; then
    pass "${name}"
  else
    fail "${name} (found KEY_BITS=${key_bits:-not set})"
  fi
}

# ─── 主程式 ────────────────────────────────────────────────────────────────────

main() {
  log "=== generate-ssl-cert.sh Test Suite ==="

  test_script_exists
  test_script_has_strict_mode
  test_missing_openssl_exits_nonzero
  test_normal_run_calls_openssl
  test_script_has_san_config
  test_script_sets_secure_permissions
  test_script_has_overwrite_confirmation
  test_default_domain
  test_script_has_verification
  test_key_length_at_least_2048

  echo ""
  log "Results: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed"

  if [[ ${TESTS_FAILED} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
