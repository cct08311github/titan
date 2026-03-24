#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 備份腳本
# 任務：T19 — Backup and Restore Mechanism
# ═══════════════════════════════════════════════════════════════════════════════
# 備份範圍：
#   - PostgreSQL 全量 dump（所有資料庫）
#   - Redis RDB 快照
#   - MinIO 物件儲存（mc mirror）
#   - Outline 資料目錄
#   - Homepage 設定檔
#   - docker-compose.yml 與 .env
#
# 保留策略：每日保留最近 7 份，每週保留最近 4 份
# 日誌：<BACKUP_ROOT>/backup.log
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 基礎設定 ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 備份根目錄（可透過環境變數覆蓋）
BACKUP_ROOT="${BACKUP_ROOT:-/opt/titan/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/daily/${TIMESTAMP}"
LOG_FILE="${BACKUP_ROOT}/backup.log"

# 保留策略
DAILY_KEEP=7     # 保留最近 7 份每日備份
WEEKLY_KEEP=4    # 保留最近 4 份每週備份（每週日執行）

# 讀取 .env（若存在）
ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  # 僅匯入非空、非註解行
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z_]+=.+' "${ENV_FILE}" | grep -v '^#')
  set +a
fi

# 容器名稱（與 docker-compose.yml 一致）
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-titan-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-titan-redis}"
MINIO_CONTAINER="${MINIO_CONTAINER:-titan-minio}"
OUTLINE_CONTAINER="${OUTLINE_CONTAINER:-titan-outline}"

# PostgreSQL 連線參數
PG_USER="${POSTGRES_USER:-titan}"
PG_PASSWORD="${POSTGRES_PASSWORD:-}"

# Redis 連線參數
REDIS_PASS="${REDIS_PASSWORD:-}"

# MinIO 連線參數
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-}"
MINIO_API_PORT="${MINIO_API_PORT:-9000}"

# ── 工具函數 ─────────────────────────────────────────────────────────────────

# 帶時間戳的日誌輸出（同時寫入終端與 log 檔）
log() {
  local level="$1"
  shift
  local msg="$*"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${ts}] [${level}] ${msg}" | tee -a "${LOG_FILE}"
}

log_info()  { log "INFO " "$@"; }
log_warn()  { log "WARN " "$@"; }
log_error() { log "ERROR" "$@"; }

# 檢查指令是否存在
require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" &>/dev/null; then
    log_error "必要指令不存在：${cmd}，請先安裝後再執行備份"
    exit 1
  fi
}

# 檢查容器是否執行中
container_running() {
  local name="$1"
  docker inspect -f '{{.State.Running}}' "${name}" 2>/dev/null | grep -q "^true$"
}

# ── 前置檢查 ─────────────────────────────────────────────────────────────────

preflight_check() {
  log_info "═══ TITAN 備份開始 ═══  時間戳：${TIMESTAMP}"
  log_info "備份目錄：${BACKUP_DIR}"

  # 必要指令
  require_cmd docker
  require_cmd gzip

  # 建立目錄
  mkdir -p "${BACKUP_DIR}"/{postgres,redis,minio,outline,homepage,configs}
  mkdir -p "${BACKUP_ROOT}/weekly"

  log_info "前置檢查通過"
}

# ── PostgreSQL 備份 ───────────────────────────────────────────────────────────

backup_postgres() {
  log_info "── PostgreSQL 備份開始 ──"

  if ! container_running "${POSTGRES_CONTAINER}"; then
    log_warn "容器 ${POSTGRES_CONTAINER} 未執行，跳過 PostgreSQL 備份"
    return 0
  fi

  # 取得所有資料庫清單（排除系統資料庫）
  local db_list
  db_list=$(docker exec "${POSTGRES_CONTAINER}" \
    psql -U "${PG_USER}" -At -c \
    "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres');" \
    2>/dev/null) || {
    log_error "無法取得 PostgreSQL 資料庫清單"
    return 1
  }

  # 備份每個資料庫
  local db_count=0
  while IFS= read -r db; do
    [[ -z "${db}" ]] && continue
    local dump_file="${BACKUP_DIR}/postgres/${db}.sql.gz"
    log_info "  備份資料庫：${db} → ${dump_file}"

    if docker exec "${POSTGRES_CONTAINER}" \
        pg_dump -U "${PG_USER}" --no-password \
        --format=plain --clean --if-exists "${db}" \
        2>/dev/null | gzip -9 > "${dump_file}"; then
      local size
      size=$(du -sh "${dump_file}" | cut -f1)
      log_info "  完成：${db}（${size}）"
      ((db_count++))
    else
      log_error "  備份失敗：${db}"
      return 1
    fi
  done <<< "${db_list}"

  # 備份 pg_dumpall（含角色與全域設定）
  local global_file="${BACKUP_DIR}/postgres/globals.sql.gz"
  log_info "  備份全域設定（roles/tablespaces） → ${global_file}"
  if docker exec "${POSTGRES_CONTAINER}" \
      pg_dumpall -U "${PG_USER}" --globals-only \
      2>/dev/null | gzip -9 > "${global_file}"; then
    log_info "  全域設定備份完成"
  else
    log_warn "  全域設定備份失敗（非致命）"
  fi

  log_info "── PostgreSQL 備份完成（共 ${db_count} 個資料庫）"
}

# ── Redis 備份 ────────────────────────────────────────────────────────────────

backup_redis() {
  log_info "── Redis 備份開始 ──"

  if ! container_running "${REDIS_CONTAINER}"; then
    log_warn "容器 ${REDIS_CONTAINER} 未執行，跳過 Redis 備份"
    return 0
  fi

  # 觸發 BGSAVE 並等待完成
  log_info "  觸發 Redis BGSAVE..."
  docker exec "${REDIS_CONTAINER}" \
    redis-cli -a "${REDIS_PASS}" --no-auth-warning BGSAVE >/dev/null 2>&1 || true

  # 等待背景儲存完成（最多 30 秒）
  local retries=30
  while [[ ${retries} -gt 0 ]]; do
    local status
    status=$(docker exec "${REDIS_CONTAINER}" \
      redis-cli -a "${REDIS_PASS}" --no-auth-warning LASTSAVE 2>/dev/null) || true
    local saving
    saving=$(docker exec "${REDIS_CONTAINER}" \
      redis-cli -a "${REDIS_PASS}" --no-auth-warning INFO persistence 2>/dev/null \
      | grep "rdb_bgsave_in_progress" | tr -d '\r' | cut -d: -f2) || true
    if [[ "${saving}" == "0" ]]; then
      break
    fi
    sleep 1
    ((retries--))
  done

  # 複製 RDB 檔案
  local rdb_dest="${BACKUP_DIR}/redis/dump.rdb.gz"
  log_info "  複製 RDB 快照 → ${rdb_dest}"
  if docker exec "${REDIS_CONTAINER}" cat /data/dump.rdb 2>/dev/null \
      | gzip -9 > "${rdb_dest}"; then
    local size
    size=$(du -sh "${rdb_dest}" | cut -f1)
    log_info "  Redis 備份完成（${size}）"
  else
    log_warn "  Redis RDB 複製失敗（/data/dump.rdb 可能不存在）"
  fi

  log_info "── Redis 備份完成"
}

# ── MinIO 備份 ────────────────────────────────────────────────────────────────

backup_minio() {
  log_info "── MinIO 備份開始 ──"

  if ! container_running "${MINIO_CONTAINER}"; then
    log_warn "容器 ${MINIO_CONTAINER} 未執行，跳過 MinIO 備份"
    return 0
  fi

  local minio_backup_dir="${BACKUP_DIR}/minio"

  # 使用 mc mirror 從容器內部備份（透過 docker exec）
  log_info "  設定 mc alias..."
  if docker exec "${MINIO_CONTAINER}" \
      mc alias set titanlocal "http://localhost:9000" \
      "${MINIO_USER}" "${MINIO_PASS}" --quiet 2>/dev/null; then
    log_info "  mc alias 設定成功"
  else
    log_error "  mc alias 設定失敗，請確認 MinIO 容器狀態"
    return 1
  fi

  # 取得所有 bucket 清單
  local bucket_list
  bucket_list=$(docker exec "${MINIO_CONTAINER}" \
    mc ls titanlocal 2>/dev/null | awk '{print $NF}' | tr -d '/') || {
    log_error "  無法取得 MinIO bucket 清單"
    return 1
  }

  local bucket_count=0
  while IFS= read -r bucket; do
    [[ -z "${bucket}" ]] && continue
    local bucket_dir="${minio_backup_dir}/${bucket}"
    mkdir -p "${bucket_dir}"
    log_info "  備份 bucket：${bucket} → ${bucket_dir}"

    # mirror 到容器內暫存目錄，再複製出來
    local tmp_path="/tmp/minio-backup-${bucket}"
    docker exec "${MINIO_CONTAINER}" \
      mc mirror --quiet "titanlocal/${bucket}" "${tmp_path}" 2>/dev/null || {
      log_warn "  bucket ${bucket} mirror 失敗，嘗試直接複製"
    }

    # 從容器複製備份資料到宿主機
    docker cp "${MINIO_CONTAINER}:${tmp_path}" "${bucket_dir}/" 2>/dev/null || true

    # 清理容器內暫存
    docker exec "${MINIO_CONTAINER}" rm -rf "${tmp_path}" 2>/dev/null || true

    # 壓縮備份目錄
    local archive="${minio_backup_dir}/${bucket}.tar.gz"
    if [[ -d "${bucket_dir}" ]]; then
      tar -czf "${archive}" -C "${minio_backup_dir}" "${bucket}" 2>/dev/null || true
      rm -rf "${bucket_dir}"
    fi

    log_info "  bucket ${bucket} 備份完成"
    ((bucket_count++))
  done <<< "${bucket_list}"

  log_info "── MinIO 備份完成（共 ${bucket_count} 個 bucket）"
}

# ── Outline 資料目錄備份 ───────────────────────────────────────────────────────

backup_outline() {
  log_info "── Outline 資料備份開始 ──"

  if ! container_running "${OUTLINE_CONTAINER}"; then
    log_warn "容器 ${OUTLINE_CONTAINER} 未執行，跳過 Outline 備份"
    return 0
  fi

  local outline_archive="${BACKUP_DIR}/outline/outline-data.tar.gz"
  log_info "  備份 Outline 資料目錄 → ${outline_archive}"

  # 使用 docker cp 從容器複製資料目錄
  local tmp_dir="/tmp/titan-outline-backup-${TIMESTAMP}"
  mkdir -p "${tmp_dir}"

  if docker cp "${OUTLINE_CONTAINER}:/var/lib/outline/data" "${tmp_dir}/" 2>/dev/null; then
    tar -czf "${outline_archive}" -C "${tmp_dir}" data 2>/dev/null
    rm -rf "${tmp_dir}"
    local size
    size=$(du -sh "${outline_archive}" | cut -f1)
    log_info "  Outline 資料備份完成（${size}）"
  else
    log_warn "  Outline 資料目錄不存在或無法讀取（資料可能僅在 MinIO）"
    rm -rf "${tmp_dir}"
  fi

  log_info "── Outline 備份完成"
}

# ── Homepage 設定備份 ─────────────────────────────────────────────────────────

backup_homepage() {
  log_info "── Homepage 設定備份開始 ──"

  local homepage_config_dir="${PROJECT_DIR}/config/homepage"
  local homepage_archive="${BACKUP_DIR}/homepage/homepage-config.tar.gz"

  if [[ -d "${homepage_config_dir}" ]]; then
    tar -czf "${homepage_archive}" -C "${PROJECT_DIR}/config" homepage 2>/dev/null
    local size
    size=$(du -sh "${homepage_archive}" | cut -f1)
    log_info "  Homepage 設定備份完成（${size}）"
  else
    log_warn "  Homepage 設定目錄不存在：${homepage_config_dir}"
  fi

  log_info "── Homepage 備份完成"
}

# ── 設定檔備份 ────────────────────────────────────────────────────────────────

backup_configs() {
  log_info "── 設定檔備份開始 ──"

  local configs_dir="${BACKUP_DIR}/configs"

  # 備份 docker-compose.yml
  if [[ -f "${PROJECT_DIR}/docker-compose.yml" ]]; then
    cp "${PROJECT_DIR}/docker-compose.yml" "${configs_dir}/docker-compose.yml"
    gzip -9 "${configs_dir}/docker-compose.yml"
    log_info "  docker-compose.yml 備份完成"
  else
    log_warn "  docker-compose.yml 不存在"
  fi

  # 備份 .env（敏感資料，Issue #194: 加密儲存）
  if [[ -f "${PROJECT_DIR}/.env" ]]; then
    local env_backup="${configs_dir}/.env"

    if command -v age &>/dev/null && [[ -f "${PROJECT_DIR}/.backup-key.pub" ]]; then
      # age 加密：使用預先產生的公鑰加密
      # 解密方式：age -d -i backup-key.txt .env.age > .env
      age -r "$(cat "${PROJECT_DIR}/.backup-key.pub")" \
        -o "${env_backup}.age" "${PROJECT_DIR}/.env"
      chmod 600 "${env_backup}.age"
      log_info "  .env 備份完成（age 加密）"
    elif command -v gpg &>/dev/null && [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
      # GPG 加密（備用方案）
      gpg --batch --yes --recipient "${BACKUP_GPG_RECIPIENT}" \
        --output "${env_backup}.gpg" --encrypt "${PROJECT_DIR}/.env"
      chmod 600 "${env_backup}.gpg"
      log_info "  .env 備份完成（GPG 加密）"
    else
      # 無加密工具 — gzip + 權限限制（降級警告）
      cp "${PROJECT_DIR}/.env" "${env_backup}"
      gzip -9 "${env_backup}"
      chmod 600 "${env_backup}.gz"
      log_warn "  .env 備份完成（未加密！請安裝 age 或設定 GPG）"
      log_warn "  安裝 age: brew install age 或 apt install age"
      log_warn "  產生金鑰: age-keygen -o backup-key.txt && cat backup-key.txt | grep 'public' > .backup-key.pub"
    fi
  else
    log_warn "  .env 不存在，請確認環境變數設定"
  fi

  # 備份 .env.example
  if [[ -f "${PROJECT_DIR}/.env.example" ]]; then
    cp "${PROJECT_DIR}/.env.example" "${configs_dir}/.env.example"
    log_info "  .env.example 備份完成"
  fi

  # 備份 Plane 設定（若存在）
  if [[ -d "${PROJECT_DIR}/config/plane" ]]; then
    tar -czf "${configs_dir}/plane-config.tar.gz" \
      -C "${PROJECT_DIR}/config" plane 2>/dev/null
    log_info "  Plane 設定備份完成"
  fi

  log_info "── 設定檔備份完成"
}

# ── 備份驗證 ─────────────────────────────────────────────────────────────────

verify_backup() {
  log_info "── 備份驗證開始 ──"

  local total_size
  total_size=$(du -sh "${BACKUP_DIR}" | cut -f1)
  local file_count
  file_count=$(find "${BACKUP_DIR}" -type f | wc -l | tr -d ' ')

  log_info "  備份目錄：${BACKUP_DIR}"
  log_info "  總大小：${total_size}，檔案數：${file_count}"

  # 驗證 gzip 檔案完整性
  local corrupt=0
  while IFS= read -r gz_file; do
    if ! gzip -t "${gz_file}" 2>/dev/null; then
      log_error "  損毀的壓縮檔：${gz_file}"
      ((corrupt++))
    fi
  done < <(find "${BACKUP_DIR}" -name "*.gz" -type f)

  if [[ ${corrupt} -gt 0 ]]; then
    log_error "驗證失敗：發現 ${corrupt} 個損毀的備份檔案"
    return 1
  fi

  log_info "── 備份驗證通過"
}

# ── 保留策略：每日備份 ────────────────────────────────────────────────────────

apply_daily_retention() {
  log_info "── 套用每日保留策略（保留最近 ${DAILY_KEEP} 份）──"

  local daily_dir="${BACKUP_ROOT}/daily"
  [[ -d "${daily_dir}" ]] || return 0

  # 依時間排序，保留最新的 DAILY_KEEP 份，刪除多餘的
  local count
  count=$(find "${daily_dir}" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')

  if [[ ${count} -gt ${DAILY_KEEP} ]]; then
    local to_delete=$(( count - DAILY_KEEP ))
    log_info "  目前每日備份：${count} 份，將刪除最舊的 ${to_delete} 份"
    find "${daily_dir}" -mindepth 1 -maxdepth 1 -type d \
      | sort | head -n "${to_delete}" \
      | while IFS= read -r old_dir; do
          log_info "  刪除過期備份：${old_dir}"
          rm -rf "${old_dir}"
        done
  else
    log_info "  每日備份數量（${count} 份）未超過上限，無需刪除"
  fi
}

# ── 保留策略：每週備份 ────────────────────────────────────────────────────────

apply_weekly_retention() {
  # 僅在每週日（weekday=0）執行週備份
  local weekday
  weekday=$(date +%u)  # 1=週一 … 7=週日

  local weekly_dir="${BACKUP_ROOT}/weekly"
  mkdir -p "${weekly_dir}"

  if [[ "${weekday}" == "7" ]]; then
    log_info "── 建立每週備份快照 ──"
    local weekly_link="${weekly_dir}/$(date +%Y_W%V)"
    # 建立符號連結指向本日備份
    if [[ ! -e "${weekly_link}" ]]; then
      ln -sf "${BACKUP_DIR}" "${weekly_link}"
      log_info "  每週備份建立：${weekly_link} → ${BACKUP_DIR}"
    fi

    # 清理超過 WEEKLY_KEEP 份的週備份
    local wcount
    wcount=$(find "${weekly_dir}" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')
    if [[ ${wcount} -gt ${WEEKLY_KEEP} ]]; then
      local wdelete=$(( wcount - WEEKLY_KEEP ))
      log_info "  清理過期週備份：刪除最舊 ${wdelete} 份"
      find "${weekly_dir}" -mindepth 1 -maxdepth 1 \
        | sort | head -n "${wdelete}" \
        | while IFS= read -r old_weekly; do
            log_info "  刪除：${old_weekly}"
            rm -f "${old_weekly}"
          done
    fi
  fi
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  # 確保 log 目錄存在
  mkdir -p "${BACKUP_ROOT}"

  local start_ts
  start_ts=$(date +%s)

  # 前置檢查
  preflight_check

  # 執行各項備份（任一失敗則整體失敗）
  local errors=0

  backup_postgres  || { log_error "PostgreSQL 備份失敗"; ((errors++)); }
  backup_redis     || { log_warn  "Redis 備份失敗（非致命）"; }
  backup_minio     || { log_error "MinIO 備份失敗"; ((errors++)); }
  backup_outline   || { log_warn  "Outline 備份失敗（非致命）"; }
  backup_homepage  || { log_warn  "Homepage 備份失敗（非致命）"; }
  backup_configs   || { log_error "設定檔備份失敗"; ((errors++)); }

  # 驗證備份完整性
  verify_backup    || { log_error "備份驗證失敗"; ((errors++)); }

  # 套用保留策略
  apply_daily_retention
  apply_weekly_retention

  local end_ts
  end_ts=$(date +%s)
  local elapsed=$(( end_ts - start_ts ))

  if [[ ${errors} -gt 0 ]]; then
    log_error "═══ TITAN 備份完成（有 ${errors} 個錯誤，耗時 ${elapsed} 秒）═══"
    exit 1
  else
    log_info "═══ TITAN 備份成功完成（耗時 ${elapsed} 秒）═══"
    log_info "備份位置：${BACKUP_DIR}"
    exit 0
  fi
}

main "$@"
