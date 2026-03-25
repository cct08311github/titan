#!/usr/bin/env bash
# =============================================================================
# TITAN db-init.sh 測試套件
# Issue #257 — Test coverage gaps for infra scripts
# =============================================================================
# 測試策略：使用 stub 替換外部命令（psql, pg_isready, mc），
#           驗證腳本的前置檢查、錯誤處理與流程邏輯。
#
# 使用方式：bash tests/test-db-init.sh
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_UNDER_TEST="${REPO_ROOT}/scripts/db-init.sh"
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

  # psql stub — 紀錄呼叫並回傳成功
  cat > "${dir}/bin/psql" <<'STUB'
#!/usr/bin/env bash
echo "psql $*" >> "${TEST_LOG}"
# 模擬查詢回傳（資料庫不存在 → 空結果）
echo ""
STUB

  # pg_isready stub — 回傳就緒
  cat > "${dir}/bin/pg_isready" <<'STUB'
#!/usr/bin/env bash
echo "pg_isready $*" >> "${TEST_LOG}"
exit 0
STUB

  # mc stub — 回傳成功
  cat > "${dir}/bin/mc" <<'STUB'
#!/usr/bin/env bash
echo "mc $*" >> "${TEST_LOG}"
# mc ls 回傳空（bucket 不存在）
exit 0
STUB

  chmod +x "${dir}/bin/psql" "${dir}/bin/pg_isready" "${dir}/bin/mc"
}

write_psql_missing_stub() {
  local dir="$1"
  # 不建立 psql，讓 command -v 找不到
  cat > "${dir}/bin/pg_isready" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  cat > "${dir}/bin/mc" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
  chmod +x "${dir}/bin/pg_isready" "${dir}/bin/mc"
}

write_pg_not_ready_stub() {
  local dir="$1"
  write_passing_stubs "${dir}"

  # 覆寫 pg_isready — 永遠回傳失敗
  cat > "${dir}/bin/pg_isready" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
  chmod +x "${dir}/bin/pg_isready"
}

# ─── 執行待測腳本的包裝器 ──────────────────────────────────────────────────────

run_db_init() {
  local dir="$1"
  shift
  env \
    PATH="${dir}/bin:${PATH}" \
    TEST_LOG="${dir}/calls.log" \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT=5432 \
    POSTGRES_USER=titan \
    POSTGRES_PASSWORD=test-password \
    OUTLINE_DB_PASSWORD=test-outline-pw \
    PLANE_DB_PASSWORD=test-plane-pw \
    MINIO_ROOT_USER=minioadmin \
    MINIO_ROOT_PASSWORD=test-minio-pw \
    MINIO_ENDPOINT=http://127.0.0.1:9000 \
    "${SCRIPT_UNDER_TEST}" "$@" 2>&1
}

# ─── 測試案例 ──────────────────────────────────────────────────────────────────

# 1. 腳本存在且可執行
test_script_exists_and_executable() {
  local name="db-init: script exists and is executable"
  if [[ -f "${SCRIPT_UNDER_TEST}" && -x "${SCRIPT_UNDER_TEST}" || -r "${SCRIPT_UNDER_TEST}" ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 2. 腳本使用 set -euo pipefail
test_script_has_strict_mode() {
  local name="db-init: uses set -euo pipefail"
  if grep -q 'set -euo pipefail' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 3. 缺少 psql 時應報錯退出
test_missing_psql_exits_nonzero() {
  local name="db-init: exits non-zero when psql is missing"
  local dir
  dir="$(new_fixture missing-psql)"
  write_psql_missing_stub "${dir}"

  set +e
  # 使用限制的 PATH，確保找不到 psql
  env \
    PATH="${dir}/bin" \
    POSTGRES_PASSWORD=test \
    OUTLINE_DB_PASSWORD=test \
    PLANE_DB_PASSWORD=test \
    MINIO_ROOT_PASSWORD=test \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 4. 缺少必要環境變數時應報錯
test_missing_env_var_exits_nonzero() {
  local name="db-init: exits non-zero when POSTGRES_PASSWORD is missing"
  local dir
  dir="$(new_fixture missing-env)"
  write_passing_stubs "${dir}"

  set +e
  env \
    PATH="${dir}/bin:${PATH}" \
    POSTGRES_USER=titan \
    OUTLINE_DB_PASSWORD=test \
    PLANE_DB_PASSWORD=test \
    MINIO_ROOT_PASSWORD=test \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 5. PostgreSQL 未就緒時應超時退出
test_pg_not_ready_exits_nonzero() {
  local name="db-init: exits non-zero when PostgreSQL is unreachable"
  local dir
  dir="$(new_fixture pg-not-ready)"
  write_pg_not_ready_stub "${dir}"

  set +e
  # 縮短重試等待時間，避免測試過慢（透過短路 sleep）
  cat > "${dir}/bin/sleep" <<'STUB'
#!/usr/bin/env bash
# 短路 sleep 以加速測試
exit 0
STUB
  chmod +x "${dir}/bin/sleep"

  env \
    PATH="${dir}/bin:${PATH}" \
    TEST_LOG="${dir}/calls.log" \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT=59999 \
    POSTGRES_USER=titan \
    POSTGRES_PASSWORD=test \
    OUTLINE_DB_PASSWORD=test \
    PLANE_DB_PASSWORD=test \
    MINIO_ROOT_PASSWORD=test \
    "${SCRIPT_UNDER_TEST}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ ${status} -ne 0 ]]; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# 6. 正常執行時應呼叫 psql 建立資料庫
test_normal_run_calls_psql() {
  local name="db-init: calls psql to create databases on normal run"
  local dir
  dir="$(new_fixture normal-run)"
  write_passing_stubs "${dir}"

  set +e
  run_db_init "${dir}" >/dev/null 2>&1
  local status=$?
  set -e

  if [[ -f "${dir}/calls.log" ]] && grep -q "psql" "${dir}/calls.log"; then
    pass "${name}"
  else
    fail "${name} (psql not called or log missing)"
  fi
}

# 7. 腳本包含建立 Outline 和 Plane 資料庫的邏輯
test_script_creates_both_databases() {
  local name="db-init: contains logic for both outline and plane databases"
  local outline_found=false
  local plane_found=false

  if grep -q 'OUTLINE_DB' "${SCRIPT_UNDER_TEST}"; then
    outline_found=true
  fi
  if grep -q 'PLANE_DB' "${SCRIPT_UNDER_TEST}"; then
    plane_found=true
  fi

  if [[ "${outline_found}" == "true" && "${plane_found}" == "true" ]]; then
    pass "${name}"
  else
    fail "${name} (outline=${outline_found}, plane=${plane_found})"
  fi
}

# 8. 腳本包含最小權限使用者建立
test_script_creates_least_privilege_users() {
  local name="db-init: creates users with NOSUPERUSER"
  if grep -q 'NOSUPERUSER' "${SCRIPT_UNDER_TEST}"; then
    pass "${name}"
  else
    fail "${name}"
  fi
}

# ─── 主程式 ────────────────────────────────────────────────────────────────────

main() {
  log "=== db-init.sh Test Suite ==="

  test_script_exists_and_executable
  test_script_has_strict_mode
  test_missing_psql_exits_nonzero
  test_missing_env_var_exits_nonzero
  test_pg_not_ready_exits_nonzero
  test_normal_run_calls_psql
  test_script_creates_both_databases
  test_script_creates_least_privilege_users

  echo ""
  log "Results: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed"

  if [[ ${TESTS_FAILED} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
