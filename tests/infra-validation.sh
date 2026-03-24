#!/usr/bin/env bash
# =============================================================================
# TITAN 基礎設施驗證測試套件
# 任務：TIT-6 — 全面測試（TDD + UX 驗證）
# 說明：不依賴真實 Docker / DB 環境，全部透過 stub 外部命令
#
# 使用方式：bash tests/infra-validation.sh
#
# 測試分區：
#   Section 1 — Compose 解析 + 備份/還原腳本（8 案例）
#   Section 2 — health-check.sh UX 與行為（7 案例）
#   Section 3 — docker-compose 安全強化靜態分析（5 案例）
#   Section 4 — audit-check.sh 基本行為（2 案例）
#   Section 5 — db-health-check.sh UX（2 案例）
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

TESTS_PASSED=0

# ─── 測試框架工具函式 ────────────────────────────────────────────────────────

log() {
  printf '[test] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1" >&2
  exit 1
}

assert_file_contains() {
  local file="$1" pattern="$2"
  grep -Eq "${pattern}" "${file}" || fail "${file} does not contain pattern: ${pattern}"
}

assert_file_not_contains() {
  local file="$1" pattern="$2"
  if grep -Eq "${pattern}" "${file}"; then
    fail "${file} unexpectedly contains pattern: ${pattern}"
  fi
}

assert_exists() {
  local path="$1"
  [ -e "${path}" ] || fail "expected path to exist: ${path}"
}

assert_not_exists() {
  local path="$1"
  [ ! -e "${path}" ] || fail "expected path to be absent: ${path}"
}

assert_exit_code() {
  local expected="$1" actual="$2" label="$3"
  [ "${expected}" -eq "${actual}" ] || fail "${label}: expected exit ${expected}, got ${actual}"
}

new_fixture() {
  local name="$1"
  local dir="${TMP_DIR}/${name}"
  mkdir -p "${dir}/bin" "${dir}/backups/postgres" "${dir}/backups/minio" "${dir}/backups/config" "${dir}/target"
  printf '%s\n' "${dir}"
}

run_test() {
  local name="$1"
  log "${name}"
  "${name}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

# ─── Section 1 備份/還原基礎設施 ─────────────────────────────────────────────

write_stub_commands() {
  local dir="$1"

  cat >"${dir}/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"${TEST_CALLS_FILE}"
EOF

  cat >"${dir}/bin/pg_restore" <<'EOF'
#!/usr/bin/env bash
echo "pg_restore $*" >>"${TEST_CALLS_FILE}"
if [ "${PG_RESTORE_SHOULD_FAIL:-0}" = "1" ]; then
  exit 12
fi
EOF

  cat >"${dir}/bin/mc" <<'EOF'
#!/usr/bin/env bash
echo "mc $*" >>"${TEST_CALLS_FILE}"
if [ "${MC_SHOULD_FAIL:-0}" = "1" ]; then
  exit 13
fi
EOF

  chmod +x "${dir}/bin/docker" "${dir}/bin/pg_restore" "${dir}/bin/mc"
}

create_postgres_backup() {
  local dir="$1"
  touch "${dir}/backups/postgres/postgres_20260323_000000.dump"
  ln -s "postgres_20260323_000000.dump" "${dir}/backups/postgres/latest.dump"
}

create_minio_backup() {
  local dir="$1" bucket_name="${2:-outline}" object_name="${3:-object.txt}"
  mkdir -p "${dir}/minio-payload/${bucket_name}"
  echo "hello" >"${dir}/minio-payload/${bucket_name}/${object_name}"
  tar -czf "${dir}/backups/minio/minio_20260323_000000.tar.gz" -C "${dir}/minio-payload" .
  ln -s "minio_20260323_000000.tar.gz" "${dir}/backups/minio/latest.tar.gz"
}

create_empty_minio_backup() {
  local dir="$1"
  mkdir -p "${dir}/minio-empty"
  tar -czf "${dir}/backups/minio/minio_20260323_000000.tar.gz" -C "${dir}/minio-empty" .
  ln -s "minio_20260323_000000.tar.gz" "${dir}/backups/minio/latest.tar.gz"
}

create_config_backup() {
  local dir="$1"
  mkdir -p "${dir}/config-payload/docs"
  echo "doc" >"${dir}/config-payload/docs/readme.txt"
  tar -czf "${dir}/backups/config/config_20260323_000000.tar.gz" -C "${dir}/config-payload" .
  ln -s "config_20260323_000000.tar.gz" "${dir}/backups/config/latest.tar.gz"
}

run_restore() {
  local dir="$1" stdin_data="$2"
  shift 2
  printf '%b' "${stdin_data}" | env \
    PATH="${dir}/bin:${PATH}" \
    BACKUP_DIR="${dir}/backups" \
    TITAN_ROOT="${dir}/target" \
    TEST_CALLS_FILE="${dir}/calls.log" \
    "${REPO_ROOT}/scripts/backup/restore.sh" \
    "$@"
}

run_restore_with_env() {
  local dir="$1" stdin_data="$2"
  local extra_env="$3"
  shift 3
  printf '%b' "${stdin_data}" | env \
    PATH="${dir}/bin:${PATH}" \
    BACKUP_DIR="${dir}/backups" \
    TITAN_ROOT="${dir}/target" \
    TEST_CALLS_FILE="${dir}/calls.log" \
    ${extra_env} \
    "${REPO_ROOT}/scripts/backup/restore.sh" \
    "$@"
}

test_compose_files_parse() {
  env \
    POSTGRES_PASSWORD=test-postgres-password \
    REDIS_PASSWORD=test-redis-password \
    MINIO_ROOT_PASSWORD=test-minio-password \
    OUTLINE_SECRET_KEY=test-outline-secret \
    OUTLINE_UTILS_SECRET=test-outline-utils \
    docker compose -f "${REPO_ROOT}/docker-compose.yml" config >"${TMP_DIR}/root-compose.yml"
  env \
    POSTGRES_PASSWORD=test-postgres-password \
    REDIS_PASSWORD=test-redis-password \
    MINIO_ROOT_PASSWORD=test-minio-password \
    OUTLINE_SECRET_KEY=test-outline-secret \
    OUTLINE_UTILS_SECRET=test-outline-utils \
    docker compose \
      -f "${REPO_ROOT}/docker-compose.yml" \
      -f "${REPO_ROOT}/docker-compose.monitoring.yml" \
      config >"${TMP_DIR}/monitoring-compose.yml"
  docker compose -f "${REPO_ROOT}/config/auth/docker-compose.keycloak.yml" config >"${TMP_DIR}/keycloak-compose.yml"
  docker compose -f "${REPO_ROOT}/config/auth/docker-compose.ldap.yml" config >"${TMP_DIR}/ldap-compose.yml"

  assert_file_contains "${TMP_DIR}/root-compose.yml" 'titan-internal'
  assert_file_contains "${TMP_DIR}/monitoring-compose.yml" 'titan-internal'
  assert_file_contains "${TMP_DIR}/keycloak-compose.yml" 'titan-internal'
  assert_file_contains "${TMP_DIR}/ldap-compose.yml" 'titan-internal'
}

test_restore_all_latest_paths_success() {
  local dir
  dir="$(new_fixture restore-all-success)"
  write_stub_commands "${dir}"
  create_postgres_backup "${dir}"
  create_minio_backup "${dir}"
  create_config_backup "${dir}"

  run_restore "${dir}" 'yes\nyes\nyes\n' --all >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --all"

  assert_file_contains "${dir}/calls.log" 'pg_restore .*backups/postgres/latest\.dump'
  assert_file_contains "${dir}/calls.log" 'mc alias set titanrestore'
  assert_file_contains "${dir}/calls.log" 'mc mirror --preserve --overwrite '
  assert_file_contains "${dir}/calls.log" 'docker compose stop outline'
  assert_file_contains "${dir}/calls.log" 'docker compose start outline'
  assert_exists "${dir}/target/docs/readme.txt"
}

test_restore_postgres_custom_file_only() {
  local dir custom_backup
  dir="$(new_fixture restore-postgres-custom)"
  write_stub_commands "${dir}"
  custom_backup="${dir}/custom.dump"
  touch "${custom_backup}"

  run_restore "${dir}" 'yes\n' --postgres "${custom_backup}" >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --postgres custom"

  assert_file_contains "${dir}/calls.log" "pg_restore .*${custom_backup}"
  assert_file_not_contains "${dir}/calls.log" 'mc mirror'
}

test_restore_postgres_latest_missing_fails() {
  local dir
  dir="$(new_fixture restore-postgres-missing)"
  write_stub_commands "${dir}"

  set +e
  run_restore "${dir}" 'yes\n' --postgres latest >"${dir}/output.log" 2>&1
  local status=$?
  set -e

  [ "${status}" -ne 0 ] || fail "restore should fail when postgres latest backup is missing"
  assert_file_contains "${dir}/output.log" 'PostgreSQL 備份檔案不存在'
  assert_not_exists "${dir}/calls.log"
}

test_restore_minio_decline_confirmation() {
  local dir
  dir="$(new_fixture restore-minio-decline)"
  write_stub_commands "${dir}"
  create_minio_backup "${dir}"

  run_restore "${dir}" 'no\n' --minio latest >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --minio decline"
  assert_not_exists "${dir}/calls.log"
}

test_restore_postgres_failure_propagates() {
  local dir
  dir="$(new_fixture restore-postgres-failure)"
  write_stub_commands "${dir}"
  create_postgres_backup "${dir}"

  set +e
  run_restore_with_env "${dir}" 'yes\n' 'PG_RESTORE_SHOULD_FAIL=1' --postgres latest >"${dir}/output.log" 2>&1
  local status=$?
  set -e

  [ "${status}" -ne 0 ] || fail "restore should fail when pg_restore exits non-zero"
  assert_file_contains "${dir}/calls.log" 'pg_restore '
}

test_restore_minio_empty_archive_boundary() {
  local dir
  dir="$(new_fixture restore-minio-empty)"
  write_stub_commands "${dir}"
  create_empty_minio_backup "${dir}"

  run_restore "${dir}" 'yes\n' --minio latest >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --minio empty archive"
  assert_file_contains "${dir}/calls.log" 'mc alias set titanrestore'
  assert_file_not_contains "${dir}/calls.log" 'mc mirror --preserve --overwrite '
}

test_restore_config_latest_boundary() {
  local dir
  dir="$(new_fixture restore-config-boundary)"
  write_stub_commands "${dir}"
  create_config_backup "${dir}"

  run_restore "${dir}" 'yes\n' --config latest >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --config latest"
  assert_exists "${dir}/target/docs/readme.txt"
  assert_not_exists "${dir}/calls.log"
}

# ─── Section 2：health-check.sh UX 與行為測試 ────────────────────────────────
#
# 策略：以 stub PATH 替換外部命令（df/nc/top/free），搭配環境變數覆蓋
# DOCKER_CMD/CURL_CMD/PSQL_CMD/REDIS_CLI_CMD → /nonexistent/* 讓這些檢查進入
# "unknown"，避免觸發 critical 影響 exit code 驗證。

# 建立 health-check stub 目錄（每個 fixture 共用）
write_health_check_stubs() {
  local dir="$1"

  # df stub — 回傳 50% 磁碟使用率（健康）
  cat >"${dir}/bin/df" <<'EOF'
#!/usr/bin/env bash
printf "Filesystem     1K-blocks      Used Available Use%% Mounted on\n"
printf "/dev/sda1      100000000  50000000  50000000  50%% /\n"
EOF

  # nc stub — 回傳 0（端口可連）以跳過 TCP 連線失敗判定
  cat >"${dir}/bin/nc" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

  # top stub — 回傳低 CPU idle，讓 CPU 使用率顯示為正常
  cat >"${dir}/bin/top" <<'EOF'
#!/usr/bin/env bash
echo "Cpu(s): 10.0%us, 5.0%sy, 0.0%ni, 80.0%id, 0.0%wa, 0.0%hi, 5.0%si, 0.0%st"
EOF

  chmod +x "${dir}/bin/df" "${dir}/bin/nc" "${dir}/bin/top"
}

write_disk_critical_stub() {
  local dir="$1"
  # df stub — 回傳 95% 磁碟使用率（超過 DISK_CRITICAL_THRESHOLD=90%）
  cat >"${dir}/bin/df" <<'EOF'
#!/usr/bin/env bash
printf "Filesystem     1K-blocks      Used Available Use%% Mounted on\n"
printf "/dev/sda1      100000000  95000000   5000000  95%% /\n"
EOF
  chmod +x "${dir}/bin/df"
}

# 執行 health-check.sh，以隔離 PATH 與無效命令路徑替換所有外部服務
run_health_check() {
  local dir="$1"
  shift
  env \
    PATH="${dir}/bin:/usr/bin:/bin" \
    DOCKER_CMD=/nonexistent/docker \
    CURL_CMD=/nonexistent/curl \
    PSQL_CMD=/nonexistent/psql \
    REDIS_CLI_CMD=/nonexistent/redis-cli \
    "${REPO_ROOT}/scripts/health-check.sh" \
    "$@"
}

# --help / -h 應以 exit 0 結束
test_health_check_help_exits_zero() {
  local dir
  dir="$(new_fixture hc-help)"
  write_health_check_stubs "${dir}"

  set +e
  run_health_check "${dir}" --help >/dev/null 2>&1
  local status=$?
  set -e

  assert_exit_code 0 "${status}" "health-check --help"
}

# 未知參數應以非零結束
test_health_check_unknown_arg_exits_nonzero() {
  local dir
  dir="$(new_fixture hc-unknown-arg)"
  write_health_check_stubs "${dir}"

  set +e
  run_health_check "${dir}" --nonexistent-flag >/dev/null 2>&1
  local status=$?
  set -e

  [ "${status}" -ne 0 ] || fail "health-check --nonexistent-flag should exit non-zero"
}

# --json 輸出必須是合法 JSON（jq 解析無誤）
test_health_check_json_output_valid() {
  local dir
  dir="$(new_fixture hc-json-valid)"
  write_health_check_stubs "${dir}"

  set +e
  local json_output
  json_output=$(run_health_check "${dir}" --json 2>/dev/null)
  set -e

  # jq 驗證 JSON 合法性
  printf '%s\n' "${json_output}" | jq . >/dev/null 2>&1 \
    || fail "--json output is not valid JSON"
}

# --json 輸出必須包含必要欄位
test_health_check_json_has_required_keys() {
  local dir
  dir="$(new_fixture hc-json-keys)"
  write_health_check_stubs "${dir}"

  set +e
  local json_output
  json_output=$(run_health_check "${dir}" --json 2>/dev/null)
  set -e

  # 驗證必要欄位存在
  printf '%s\n' "${json_output}" | jq -e '.timestamp'      >/dev/null 2>&1 \
    || fail "--json missing field: timestamp"
  printf '%s\n' "${json_output}" | jq -e '.overall_status' >/dev/null 2>&1 \
    || fail "--json missing field: overall_status"
  printf '%s\n' "${json_output}" | jq -e '.exit_code'      >/dev/null 2>&1 \
    || fail "--json missing field: exit_code"
  printf '%s\n' "${json_output}" | jq -e '.checks'         >/dev/null 2>&1 \
    || fail "--json missing field: checks"
  printf '%s\n' "${json_output}" | jq -e '.checks | type == "array"' >/dev/null 2>&1 \
    || fail "--json .checks should be an array"
}

# --quiet 模式只輸出 1 行整體狀態
test_health_check_quiet_single_line_output() {
  local dir
  dir="$(new_fixture hc-quiet)"
  write_health_check_stubs "${dir}"

  set +e
  local output
  output=$(run_health_check "${dir}" --quiet 2>/dev/null)
  local status=$?
  set -e

  local line_count
  line_count=$(printf '%s\n' "${output}" | grep -c . || true)
  [ "${line_count}" -le 1 ] \
    || fail "--quiet should produce at most 1 line, got ${line_count}: ${output}"
}

# NO_COLOR=1 時輸出不含 ANSI 跳脫序列
test_health_check_no_color_no_ansi() {
  local dir
  dir="$(new_fixture hc-no-color)"
  write_health_check_stubs "${dir}"

  set +e
  local output
  output=$(env \
    PATH="${dir}/bin:/usr/bin:/bin" \
    DOCKER_CMD=/nonexistent/docker \
    CURL_CMD=/nonexistent/curl \
    PSQL_CMD=/nonexistent/psql \
    REDIS_CLI_CMD=/nonexistent/redis-cli \
    NO_COLOR=1 \
    "${REPO_ROOT}/scripts/health-check.sh" 2>/dev/null)
  set -e

  # 不應含 ANSI 跳脫序列 \033[ 或 \e[
  if printf '%s' "${output}" | grep -qP '\x1b\[' 2>/dev/null; then
    fail "NO_COLOR=1: output contains ANSI sequences"
  elif printf '%s' "${output}" | grep -q $'\033\['; then
    fail "NO_COLOR=1: output contains ANSI sequences"
  fi
}

# 磁碟使用率超過 critical 閾值時 exit code 應為 2
test_health_check_disk_critical_exits_two() {
  local dir
  dir="$(new_fixture hc-disk-critical)"
  write_health_check_stubs "${dir}"
  write_disk_critical_stub "${dir}"  # 覆蓋為 95% 磁碟使用率

  set +e
  run_health_check "${dir}" >/dev/null 2>&1
  local status=$?
  set -e

  assert_exit_code 2 "${status}" "health-check disk critical"
}

# ─── Section 3：docker-compose.yml 安全強化靜態分析 ──────────────────────────
#
# 策略：直接 grep compose 原始檔，不需要執行 Docker。

COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"

# 核心服務必須以非 root 使用者執行
test_compose_security_nonroot_users_defined() {
  local missing_users=()
  for service_user in "postgres" "redis" "minio" "outline"; do
    grep -q "user: ${service_user}" "${COMPOSE_FILE}" \
      || missing_users+=("${service_user}")
  done

  [ "${#missing_users[@]}" -eq 0 ] \
    || fail "compose: missing non-root user for: ${missing_users[*]}"
}

# 所有服務必須設定記憶體上限（防止 OOM）
test_compose_security_memory_limits_defined() {
  # 計算 deploy.resources.limits.memory 的出現次數
  local limit_count
  limit_count=$(grep -c "memory: " "${COMPOSE_FILE}" || true)
  # 核心服務（postgres/redis/minio/outline/homepage/uptime-kuma）至少各一個限制
  [ "${limit_count}" -ge 6 ] \
    || fail "compose: expected ≥6 memory limit entries, found ${limit_count}"
}

# 敏感密碼必須使用 :? 語法強制要求（缺少時 compose up 立即報錯）
test_compose_required_secrets_colon_question_syntax() {
  local missing=()
  for var in \
    "POSTGRES_PASSWORD:?" \
    "REDIS_PASSWORD:?" \
    "MINIO_ROOT_PASSWORD:?" \
    "OUTLINE_SECRET_KEY:?" \
    "OUTLINE_UTILS_SECRET:?"; do
    grep -q "\${${var%:?}:?" "${COMPOSE_FILE}" || missing+=("${var%:?}")
  done

  [ "${#missing[@]}" -eq 0 ] \
    || fail "compose: missing :? required syntax for: ${missing[*]}"
}

# 核心服務必須定義 healthcheck
test_compose_healthchecks_defined_for_core_services() {
  local hc_count
  hc_count=$(grep -c "healthcheck:" "${COMPOSE_FILE}" || true)
  # postgres / redis / minio / outline / homepage / uptime-kuma — 至少 6 個
  [ "${hc_count}" -ge 6 ] \
    || fail "compose: expected ≥6 healthcheck definitions, found ${hc_count}"
}

# 敏感服務（postgres/redis/minio）的 ports 必須被註解掉
test_compose_sensitive_ports_not_exposed() {
  # 活動端口（非 #- 開頭的 ports:）不應出現在 postgres/redis/minio 區段
  # 方法：確認 postgres/redis/minio 的 ports: 是以 '# ports:' 形式存在（已被注釋）
  local exposed_count
  exposed_count=$(grep -c "^    # ports:" "${COMPOSE_FILE}" || true)
  # 至少 postgres, redis, minio, outline 四個服務的 ports: 被注釋掉
  [ "${exposed_count}" -ge 4 ] \
    || fail "compose: expected ≥4 commented-out ports (sensitive services), found ${exposed_count}"
}

# ─── Section 4：audit-check.sh 基本行為 ──────────────────────────────────────

# audit-check.sh 應建立報告檔案
test_audit_check_creates_report_file() {
  local dir
  dir="$(new_fixture audit-report)"
  local report_dir="${dir}/audit-reports"
  mkdir -p "${report_dir}"

  set +e
  AUDIT_REPORT_DIR="${report_dir}" \
  TITAN_LOG_DIR="${dir}/logs" \
  TITAN_BACKUP_DIR="${dir}/backups" \
    "${REPO_ROOT}/scripts/audit-check.sh" \
    --output-dir "${report_dir}" \
    --log-dir "${dir}/logs" \
    --backup-dir "${dir}/backups" \
    >/dev/null 2>&1
  set -e

  # 不論 pass/warn/fail 數量，報告檔案必定被建立
  local report_count
  report_count=$(find "${report_dir}" -name "audit-report-*.txt" | wc -l | tr -d ' ')
  [ "${report_count}" -ge 1 ] \
    || fail "audit-check: no report file created in ${report_dir}"
}

# audit-check.sh 未知參數應以非零結束
test_audit_check_unknown_arg_exits_nonzero() {
  local dir
  dir="$(new_fixture audit-unknown-arg)"
  mkdir -p "${dir}/reports"

  set +e
  AUDIT_REPORT_DIR="${dir}/reports" \
    "${REPO_ROOT}/scripts/audit-check.sh" \
    --invalid-flag-xyz \
    >/dev/null 2>&1
  local status=$?
  set -e

  [ "${status}" -ne 0 ] \
    || fail "audit-check --invalid-flag-xyz should exit non-zero"
}

# ─── Section 5：db-health-check.sh UX ───────────────────────────────────────
#
# db-health-check.sh 使用 declare -A（關聯陣列），需要 bash 4+。
# macOS 內建 bash 3.x 不支援；若偵測到 bash < 4 則跳過此區段。

bash_major_version() {
  bash --version 2>/dev/null | grep -oE 'version [0-9]+' | grep -oE '[0-9]+' | head -1
}

# --json 模式輸出合法 JSON
test_db_health_check_json_mode_valid_output() {
  local bash_ver
  bash_ver="$(bash_major_version)"
  if [ "${bash_ver:-3}" -lt 4 ] 2>/dev/null; then
    log "  SKIP: db-health-check requires bash 4+ (found bash ${bash_ver})"
    return 0
  fi

  set +e
  local json_output
  json_output=$(env \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT=59999 \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT=59998 \
    MINIO_ENDPOINT=http://127.0.0.1:59997 \
    "${REPO_ROOT}/scripts/db-health-check.sh" --json 2>/dev/null)
  set -e

  # jq 驗證 JSON 合法性
  printf '%s\n' "${json_output}" | jq . >/dev/null 2>&1 \
    || fail "db-health-check --json output is not valid JSON"

  # 必須包含 overall_status 欄位
  printf '%s\n' "${json_output}" | jq -e '.overall_status' >/dev/null 2>&1 \
    || fail "db-health-check --json missing field: overall_status"
}

# --quiet 模式不應輸出 PASS/FAIL/WARN 細節行
test_db_health_check_quiet_mode_no_detail_lines() {
  local bash_ver
  bash_ver="$(bash_major_version)"
  if [ "${bash_ver:-3}" -lt 4 ] 2>/dev/null; then
    log "  SKIP: db-health-check requires bash 4+ (found bash ${bash_ver})"
    return 0
  fi

  set +e
  local output
  output=$(env \
    POSTGRES_HOST=127.0.0.1 \
    POSTGRES_PORT=59999 \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT=59998 \
    MINIO_ENDPOINT=http://127.0.0.1:59997 \
    "${REPO_ROOT}/scripts/db-health-check.sh" --quiet 2>/dev/null)
  set -e

  # --quiet 不應輸出 PASS/FAIL/WARN 個別項目細節
  if printf '%s\n' "${output}" | grep -qE '  \[PASS\]|  \[FAIL\]|  \[WARN\]'; then
    fail "db-health-check --quiet should not output detail lines"
  fi
}

# ─── 主程式 ──────────────────────────────────────────────────────────────────

main() {
  log "=== Section 1: Compose 解析 + 備份/還原腳本 ==="
  run_test test_compose_files_parse
  run_test test_restore_all_latest_paths_success
  run_test test_restore_postgres_custom_file_only
  run_test test_restore_postgres_latest_missing_fails
  run_test test_restore_minio_decline_confirmation
  run_test test_restore_postgres_failure_propagates
  run_test test_restore_minio_empty_archive_boundary
  run_test test_restore_config_latest_boundary

  log "=== Section 2: health-check.sh UX 與行為 ==="
  run_test test_health_check_help_exits_zero
  run_test test_health_check_unknown_arg_exits_nonzero
  run_test test_health_check_json_output_valid
  run_test test_health_check_json_has_required_keys
  run_test test_health_check_quiet_single_line_output
  run_test test_health_check_no_color_no_ansi
  run_test test_health_check_disk_critical_exits_two

  log "=== Section 3: docker-compose.yml 安全強化靜態分析 ==="
  run_test test_compose_security_nonroot_users_defined
  run_test test_compose_security_memory_limits_defined
  run_test test_compose_required_secrets_colon_question_syntax
  run_test test_compose_healthchecks_defined_for_core_services
  run_test test_compose_sensitive_ports_not_exposed

  log "=== Section 4: audit-check.sh 基本行為 ==="
  run_test test_audit_check_creates_report_file
  run_test test_audit_check_unknown_arg_exits_nonzero

  log "=== Section 5: db-health-check.sh UX ==="
  run_test test_db_health_check_json_mode_valid_output
  run_test test_db_health_check_quiet_mode_no_detail_lines

  log "all validations passed (${TESTS_PASSED} cases)"
}

main "$@"
