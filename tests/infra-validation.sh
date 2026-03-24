#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

TESTS_PASSED=0

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

write_stub_commands() {
  local dir="$1"

  cat >"${dir}/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"${TEST_CALLS_FILE}"
EOF

  cat >"${dir}/bin/pg_restore" <<'EOF'
#!/usr/bin/env bash
echo "pg_restore $*" >>"${TEST_CALLS_FILE}"
echo "pg_restore_env POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-}" >>"${TEST_CALLS_FILE}"
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

run_test() {
  local name="$1"
  log "${name}"
  "${name}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
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

test_restore_all_uses_titan_env_credentials() {
  local dir
  dir="$(new_fixture restore-all-env-creds)"
  write_stub_commands "${dir}"
  create_postgres_backup "${dir}"
  create_minio_backup "${dir}"
  create_config_backup "${dir}"

  cat >"${dir}/target/.env" <<'EOF'
POSTGRES_PASSWORD=from-env-postgres
MINIO_ROOT_USER=from-env-minio-user
MINIO_ROOT_PASSWORD=from-env-minio-pass
EOF

  run_restore "${dir}" 'yes\nyes\nyes\n' --all >/dev/null
  local status=$?
  assert_exit_code 0 "${status}" "restore --all with titan env"

  assert_file_contains "${dir}/calls.log" 'pg_restore_env POSTGRES_PASSWORD=from-env-postgres'
  assert_file_contains "${dir}/calls.log" 'mc alias set titanrestore http://localhost:9000 from-env-minio-user from-env-minio-pass'
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

main() {
  run_test test_compose_files_parse
  run_test test_restore_all_latest_paths_success
  run_test test_restore_postgres_custom_file_only
  run_test test_restore_postgres_latest_missing_fails
  run_test test_restore_minio_decline_confirmation
  run_test test_restore_postgres_failure_propagates
  run_test test_restore_all_uses_titan_env_credentials
  run_test test_restore_minio_empty_archive_boundary
  run_test test_restore_config_latest_boundary
  log "all validations passed (${TESTS_PASSED} cases)"
}

main "$@"
