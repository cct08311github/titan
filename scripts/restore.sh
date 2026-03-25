#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 還原腳本
# 任務：T19 — Backup and Restore Mechanism
# ═══════════════════════════════════════════════════════════════════════════════
# 使用方式：
#   ./restore.sh --timestamp 20240101_020000
#   ./restore.sh --timestamp 20240101_020000 --service postgres
#   ./restore.sh --list
#   ./restore.sh --help
#
# 可還原的服務：postgres | redis | minio | outline | homepage | configs | all
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 基礎設定 ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-/opt/titan/backups}"
LOG_FILE="${BACKUP_ROOT}/backup.log"

# 讀取 .env（若存在）
ENV_FILE="${PROJECT_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^[A-Z_]+=.+' "${ENV_FILE}" | grep -v '^#')
  set +a
fi

# 容器名稱
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-titan-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-titan-redis}"
MINIO_CONTAINER="${MINIO_CONTAINER:-titan-minio}"
OUTLINE_CONTAINER="${OUTLINE_CONTAINER:-titan-outline}"

# 連線參數
PG_USER="${POSTGRES_USER:-titan}"
REDIS_PASS="${REDIS_PASSWORD:-}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-}"

# ── 工具函數 ─────────────────────────────────────────────────────────────────

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

container_running() {
  local name="$1"
  docker inspect -f '{{.State.Running}}' "${name}" 2>/dev/null | grep -q "^true$"
}

# ── 說明文字 ─────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
TITAN 還原腳本

使用方式：
  $(basename "$0") [選項]

選項：
  -t, --timestamp TIMESTAMP   指定要還原的備份時間戳（格式：YYYYMMDD_HHMMSS）
  -s, --service   SERVICE     指定要還原的服務（預設：all）
                              可選值：postgres | redis | minio | outline | homepage | configs | all
  -l, --list                  列出所有可用的備份
  -y, --yes                   跳過確認提示（自動執行，適用於腳本呼叫）
  -h, --help                  顯示此說明

範例：
  $(basename "$0") --list
  $(basename "$0") --timestamp 20240101_020000
  $(basename "$0") --timestamp 20240101_020000 --service postgres
  $(basename "$0") --timestamp 20240101_020000 --service all --yes

EOF
}

# ── 列出可用備份 ──────────────────────────────────────────────────────────────

list_backups() {
  echo ""
  echo "═══ 可用的 TITAN 備份 ═══"
  echo ""

  local daily_dir="${BACKUP_ROOT}/daily"
  if [[ ! -d "${daily_dir}" ]]; then
    echo "  （無可用備份）"
    return 0
  fi

  local found=0
  while IFS= read -r backup_dir; do
    [[ -d "${backup_dir}" ]] || continue
    local ts
    ts=$(basename "${backup_dir}")
    local size
    size=$(du -sh "${backup_dir}" | cut -f1)
    local date_str
    date_str=$(echo "${ts}" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')

    # 列出此備份包含的服務
    local services=""
    [[ -d "${backup_dir}/postgres" ]] && services+="postgres "
    [[ -d "${backup_dir}/redis" ]] && services+="redis "
    [[ -d "${backup_dir}/minio" ]] && services+="minio "
    [[ -d "${backup_dir}/outline" ]] && services+="outline "
    [[ -d "${backup_dir}/homepage" ]] && services+="homepage "
    [[ -d "${backup_dir}/configs" ]] && services+="configs "

    printf "  %-20s  大小：%-8s  服務：%s\n" "${date_str}" "${size}" "${services}"
    ((found++))
  done < <(find "${daily_dir}" -mindepth 1 -maxdepth 1 -type d | sort -r)

  if [[ ${found} -eq 0 ]]; then
    echo "  （無可用備份）"
  fi

  echo ""
  echo "  每週備份："
  local weekly_dir="${BACKUP_ROOT}/weekly"
  if [[ -d "${weekly_dir}" ]]; then
    find "${weekly_dir}" -mindepth 1 -maxdepth 1 | sort -r | while IFS= read -r w; do
      printf "  %s → %s\n" "$(basename "${w}")" "$(readlink "${w}" 2>/dev/null || echo "${w}")"
    done
  fi
  echo ""
}

# ── 前置健康檢查 ──────────────────────────────────────────────────────────────

preflight_health_check() {
  log_info "── 還原前健康檢查 ──"

  local issues=0

  # 檢查 Docker
  if ! command -v docker &>/dev/null; then
    log_error "Docker 未安裝或不在 PATH 中"
    ((issues++))
  fi

  # 檢查各容器狀態（警告，非阻斷）
  for container in "${POSTGRES_CONTAINER}" "${REDIS_CONTAINER}" \
                   "${MINIO_CONTAINER}" "${OUTLINE_CONTAINER}"; do
    if container_running "${container}"; then
      log_warn "  容器 ${container} 正在執行中，還原時將停止服務"
    else
      log_info "  容器 ${container} 未執行"
    fi
  done

  if [[ ${issues} -gt 0 ]]; then
    log_error "健康檢查發現 ${issues} 個問題，無法繼續還原"
    exit 1
  fi

  log_info "── 健康檢查完成"
}

# ── 安全確認提示 ──────────────────────────────────────────────────────────────

confirm_restore() {
  local timestamp="$1"
  local service="$2"

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║              ⚠️   TITAN 還原警告                              ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  還原時間戳：${timestamp}"
  echo "║  還原服務：  ${service}"
  echo "║"
  echo "║  ！！警告！！"
  echo "║  此操作將覆蓋現有資料，無法復原。"
  echo "║  建議在還原前先執行一次新的備份。"
  echo "║"
  echo "║  受影響的服務將會暫時停止。"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  read -r -p "確定要繼續還原嗎？請輸入 'RESTORE' 確認：" confirm
  echo ""

  if [[ "${confirm}" != "RESTORE" ]]; then
    log_info "使用者取消還原操作"
    exit 0
  fi
}

# ── PostgreSQL 還原 ───────────────────────────────────────────────────────────

restore_postgres() {
  local backup_dir="$1"
  local pg_backup_dir="${backup_dir}/postgres"

  log_info "── PostgreSQL 還原開始 ──"

  if [[ ! -d "${pg_backup_dir}" ]]; then
    log_warn "  PostgreSQL 備份目錄不存在：${pg_backup_dir}"
    return 0
  fi

  if ! container_running "${POSTGRES_CONTAINER}"; then
    log_error "  容器 ${POSTGRES_CONTAINER} 未執行，請先啟動服務"
    return 1
  fi

  # 先還原全域設定（roles）
  local global_file="${pg_backup_dir}/globals.sql.gz"
  if [[ -f "${global_file}" ]]; then
    log_info "  還原全域設定（roles/tablespaces）..."
    zcat "${global_file}" | docker exec -i "${POSTGRES_CONTAINER}" \
      psql -U "${PG_USER}" --quiet 2>/dev/null || \
      log_warn "  全域設定還原有警告（可能部分角色已存在）"
    log_info "  全域設定還原完成"
  fi

  # 還原各資料庫
  while IFS= read -r dump_file; do
    local db
    db=$(basename "${dump_file}" .sql.gz)
    [[ "${db}" == "globals" ]] && continue

    log_info "  還原資料庫：${db}"

    # 建立資料庫（若不存在）
    docker exec "${POSTGRES_CONTAINER}" \
      psql -U "${PG_USER}" --quiet -c \
      "CREATE DATABASE \"${db}\" OWNER ${PG_USER};" 2>/dev/null || true

    # 還原資料
    if zcat "${dump_file}" | docker exec -i "${POSTGRES_CONTAINER}" \
        psql -U "${PG_USER}" --quiet "${db}" 2>/dev/null; then
      log_info "  資料庫 ${db} 還原完成"
    else
      log_warn "  資料庫 ${db} 還原有警告（部分物件可能已存在）"
    fi
  done < <(find "${pg_backup_dir}" -name "*.sql.gz" | sort)

  log_info "── PostgreSQL 還原完成"
}

# ── Redis 還原 ────────────────────────────────────────────────────────────────

restore_redis() {
  local backup_dir="$1"
  local redis_backup_dir="${backup_dir}/redis"

  log_info "── Redis 還原開始 ──"

  if [[ ! -d "${redis_backup_dir}" ]]; then
    log_warn "  Redis 備份目錄不存在：${redis_backup_dir}"
    return 0
  fi

  local rdb_file="${redis_backup_dir}/dump.rdb.gz"
  if [[ ! -f "${rdb_file}" ]]; then
    log_warn "  Redis RDB 備份檔不存在：${rdb_file}"
    return 0
  fi

  if ! container_running "${REDIS_CONTAINER}"; then
    log_error "  容器 ${REDIS_CONTAINER} 未執行，請先啟動服務"
    return 1
  fi

  log_info "  停止 Redis 寫入..."
  docker exec "${REDIS_CONTAINER}" \
    redis-cli -a "${REDIS_PASS}" --no-auth-warning CONFIG SET save "" 2>/dev/null || true

  log_info "  複製 RDB 快照到容器..."
  zcat "${rdb_file}" | docker exec -i "${REDIS_CONTAINER}" \
    sh -c 'cat > /data/dump.rdb.restore' 2>/dev/null

  # 停止並重啟容器以載入新的 RDB
  log_info "  重啟 Redis 容器以載入備份資料..."
  docker exec "${REDIS_CONTAINER}" \
    sh -c 'mv /data/dump.rdb.restore /data/dump.rdb' 2>/dev/null

  docker restart "${REDIS_CONTAINER}" >/dev/null 2>&1
  sleep 3

  # 驗證 Redis 是否正常運作
  if docker exec "${REDIS_CONTAINER}" \
      redis-cli -a "${REDIS_PASS}" --no-auth-warning PING 2>/dev/null | grep -q "PONG"; then
    log_info "  Redis 容器重啟成功"
  else
    log_warn "  Redis 容器重啟後無法 PING，請手動確認"
  fi

  log_info "── Redis 還原完成"
}

# ── MinIO 還原 ────────────────────────────────────────────────────────────────

restore_minio() {
  local backup_dir="$1"
  local minio_backup_dir="${backup_dir}/minio"

  log_info "── MinIO 還原開始 ──"

  if [[ ! -d "${minio_backup_dir}" ]]; then
    log_warn "  MinIO 備份目錄不存在：${minio_backup_dir}"
    return 0
  fi

  if ! container_running "${MINIO_CONTAINER}"; then
    log_error "  容器 ${MINIO_CONTAINER} 未執行，請先啟動服務"
    return 1
  fi

  # 設定 mc alias
  docker exec "${MINIO_CONTAINER}" \
    mc alias set titanlocal "http://localhost:9000" \
    "${MINIO_USER}" "${MINIO_PASS}" --quiet 2>/dev/null || {
    log_error "  mc alias 設定失敗"
    return 1
  }

  # 還原每個 bucket
  while IFS= read -r archive; do
    local bucket
    bucket=$(basename "${archive}" .tar.gz)
    # 驗證 bucket 名稱不含路徑分隔符或特殊字元
    if [[ "${bucket}" =~ [/\\] || "${bucket}" == ".." || "${bucket}" == "." ]]; then
      log_warn "  bucket 名稱不安全，已跳過：${bucket}"
      continue
    fi
    log_info "  還原 bucket：${bucket}"

    # 解壓到安全臨時目錄（mktemp 防止 symlink 攻擊）
    local tmp_dir
    tmp_dir="$(mktemp -d "/tmp/titan-minio-restore-XXXXXXXXXX")"
    tar -xzf "${archive}" -C "${tmp_dir}" 2>/dev/null || {
      log_warn "  bucket ${bucket} 解壓失敗"
      rm -rf "${tmp_dir}"
      continue
    }

    # 建立 bucket（若不存在）
    docker exec "${MINIO_CONTAINER}" \
      mc mb "titanlocal/${bucket}" --quiet 2>/dev/null || true

    # 複製解壓後的資料到容器
    local restore_path="${tmp_dir}/${bucket}"
    if [[ -d "${restore_path}" ]]; then
      docker cp "${restore_path}/." "${MINIO_CONTAINER}:/tmp/minio-restore-${bucket}/" 2>/dev/null || true

      # 使用 mc cp 載入到 MinIO
      docker exec "${MINIO_CONTAINER}" \
        mc cp --recursive "/tmp/minio-restore-${bucket}/" \
        "titanlocal/${bucket}/" --quiet 2>/dev/null || \
        log_warn "  bucket ${bucket} 部分資料還原失敗"

      # 清理容器內暫存
      docker exec "${MINIO_CONTAINER}" \
        rm -rf "/tmp/minio-restore-${bucket}" 2>/dev/null || true
    fi

    rm -rf "${tmp_dir}"
    log_info "  bucket ${bucket} 還原完成"
  done < <(find "${minio_backup_dir}" -name "*.tar.gz" | sort)

  log_info "── MinIO 還原完成"
}

# ── Outline 還原 ──────────────────────────────────────────────────────────────

restore_outline() {
  local backup_dir="$1"
  local outline_archive="${backup_dir}/outline/outline-data.tar.gz"

  log_info "── Outline 還原開始 ──"

  if [[ ! -f "${outline_archive}" ]]; then
    log_warn "  Outline 備份檔不存在：${outline_archive}"
    return 0
  fi

  if ! container_running "${OUTLINE_CONTAINER}"; then
    log_error "  容器 ${OUTLINE_CONTAINER} 未執行，請先啟動服務"
    return 1
  fi

  log_info "  解壓 Outline 資料..."
  local tmp_dir
  tmp_dir="$(mktemp -d "/tmp/titan-outline-restore-XXXXXXXXXX")"
  tar -xzf "${outline_archive}" -C "${tmp_dir}" 2>/dev/null

  if [[ -d "${tmp_dir}/data" ]]; then
    log_info "  複製資料到 Outline 容器..."
    docker cp "${tmp_dir}/data/." \
      "${OUTLINE_CONTAINER}:/var/lib/outline/data/" 2>/dev/null || \
      log_warn "  Outline 資料複製失敗（資料可能已在 MinIO）"
  fi

  rm -rf "${tmp_dir}"
  log_info "── Outline 還原完成"
}

# ── Homepage 還原 ─────────────────────────────────────────────────────────────

restore_homepage() {
  local backup_dir="$1"
  local homepage_archive="${backup_dir}/homepage/homepage-config.tar.gz"

  log_info "── Homepage 設定還原開始 ──"

  if [[ ! -f "${homepage_archive}" ]]; then
    log_warn "  Homepage 備份檔不存在：${homepage_archive}"
    return 0
  fi

  local homepage_config_dir="${PROJECT_DIR}/config"
  log_info "  還原 Homepage 設定檔..."

  # 備份現有設定
  if [[ -d "${homepage_config_dir}/homepage" ]]; then
    mv "${homepage_config_dir}/homepage" \
       "${homepage_config_dir}/homepage.bak.$$" 2>/dev/null || true
    log_info "  現有設定已備份為 homepage.bak.$$"
  fi

  tar -xzf "${homepage_archive}" -C "${homepage_config_dir}" 2>/dev/null
  log_info "── Homepage 還原完成"
}

# ── 設定檔還原 ────────────────────────────────────────────────────────────────

restore_configs() {
  local backup_dir="$1"
  local configs_dir="${backup_dir}/configs"

  log_info "── 設定檔還原開始 ──"

  if [[ ! -d "${configs_dir}" ]]; then
    log_warn "  設定檔備份目錄不存在：${configs_dir}"
    return 0
  fi

  # 還原 docker-compose.yml
  if [[ -f "${configs_dir}/docker-compose.yml.gz" ]]; then
    log_warn "  docker-compose.yml 備份存在，請手動確認是否還原（避免覆蓋自訂設定）"
    log_warn "  備份位置：${configs_dir}/docker-compose.yml.gz"
  fi

  # 還原 .env（需使用者確認）
  if [[ -f "${configs_dir}/.env.gz" ]]; then
    log_warn "  .env 備份存在（含敏感資料），請手動還原："
    log_warn "  zcat '${configs_dir}/.env.gz' > '${PROJECT_DIR}/.env'"
  fi

  log_info "── 設定檔還原提示已顯示（需手動執行敏感操作）"
}

# ── 還原後驗證 ────────────────────────────────────────────────────────────────

post_restore_verification() {
  local service="$1"
  log_info "── 還原後驗證 ──"

  local all_ok=true

  if [[ "${service}" == "all" || "${service}" == "postgres" ]]; then
    if container_running "${POSTGRES_CONTAINER}"; then
      if docker exec "${POSTGRES_CONTAINER}" \
          pg_isready -U "${PG_USER}" >/dev/null 2>&1; then
        log_info "  PostgreSQL：正常"
      else
        log_warn "  PostgreSQL：無法連線，請手動確認"
        all_ok=false
      fi
    fi
  fi

  if [[ "${service}" == "all" || "${service}" == "redis" ]]; then
    if container_running "${REDIS_CONTAINER}"; then
      if docker exec "${REDIS_CONTAINER}" \
          redis-cli -a "${REDIS_PASS}" --no-auth-warning PING 2>/dev/null | grep -q "PONG"; then
        log_info "  Redis：正常"
      else
        log_warn "  Redis：無法 PING，請手動確認"
        all_ok=false
      fi
    fi
  fi

  if [[ "${service}" == "all" || "${service}" == "minio" ]]; then
    if container_running "${MINIO_CONTAINER}"; then
      if docker exec "${MINIO_CONTAINER}" \
          mc ready local 2>/dev/null; then
        log_info "  MinIO：正常"
      else
        log_warn "  MinIO：健康檢查失敗，請手動確認"
        all_ok=false
      fi
    fi
  fi

  if [[ "${all_ok}" == "true" ]]; then
    log_info "── 還原後驗證通過"
  else
    log_warn "── 還原後驗證有警告，請手動確認服務狀態"
  fi
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  mkdir -p "${BACKUP_ROOT}"

  # 解析參數
  local timestamp=""
  local service="all"
  local auto_yes=false
  local do_list=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -t|--timestamp)
        timestamp="$2"
        shift 2
        ;;
      -s|--service)
        service="$2"
        shift 2
        ;;
      -l|--list)
        do_list=true
        shift
        ;;
      -y|--yes)
        auto_yes=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        log_error "未知參數：$1"
        usage
        exit 1
        ;;
    esac
  done

  # 列出備份
  if [[ "${do_list}" == "true" ]]; then
    list_backups
    exit 0
  fi

  # 必要參數檢查
  if [[ -z "${timestamp}" ]]; then
    log_error "請指定備份時間戳（--timestamp YYYYMMDD_HHMMSS）"
    echo ""
    usage
    exit 1
  fi

  # 驗證 timestamp 格式，防止路徑遍歷攻擊
  if [[ ! "${timestamp}" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
    log_error "時間戳格式無效（必須為 YYYYMMDD_HHMMSS，僅允許數字和底線）"
    exit 1
  fi

  # 驗證服務名稱
  case "${service}" in
    postgres|redis|minio|outline|homepage|configs|all) ;;
    *)
      log_error "無效的服務名稱：${service}"
      log_error "可選值：postgres | redis | minio | outline | homepage | configs | all"
      exit 1
      ;;
  esac

  # 確認備份目錄存在，並驗證路徑未逃逸出 BACKUP_ROOT
  local backup_dir="${BACKUP_ROOT}/daily/${timestamp}"
  local resolved_backup_dir
  resolved_backup_dir="$(realpath "${backup_dir}" 2>/dev/null || echo "")"
  local resolved_backup_root
  resolved_backup_root="$(realpath "${BACKUP_ROOT}" 2>/dev/null || echo "${BACKUP_ROOT}")"
  if [[ -z "${resolved_backup_dir}" || "${resolved_backup_dir}" != "${resolved_backup_root}"/* ]]; then
    log_error "備份路徑驗證失敗：路徑超出允許範圍"
    exit 1
  fi
  if [[ ! -d "${backup_dir}" ]]; then
    log_error "備份目錄不存在：${backup_dir}"
    log_error "請使用 --list 查看可用的備份"
    exit 1
  fi

  log_info "═══ TITAN 還原開始 ═══"
  log_info "  備份時間戳：${timestamp}"
  log_info "  還原服務：${service}"
  log_info "  備份目錄：${backup_dir}"

  # 前置健康檢查
  preflight_health_check

  # 安全確認（除非 --yes）
  if [[ "${auto_yes}" == "false" ]]; then
    confirm_restore "${timestamp}" "${service}"
  else
    log_warn "  已跳過確認提示（--yes 模式）"
  fi

  local start_ts
  start_ts=$(date +%s)
  local errors=0

  # 執行還原
  case "${service}" in
    all)
      restore_postgres "${backup_dir}" || { log_error "PostgreSQL 還原失敗"; ((errors++)); }
      restore_redis    "${backup_dir}" || { log_warn  "Redis 還原失敗（非致命）"; }
      restore_minio    "${backup_dir}" || { log_error "MinIO 還原失敗"; ((errors++)); }
      restore_outline  "${backup_dir}" || { log_warn  "Outline 還原失敗（非致命）"; }
      restore_homepage "${backup_dir}" || { log_warn  "Homepage 還原失敗（非致命）"; }
      restore_configs  "${backup_dir}" || { log_warn  "設定檔還原提示失敗"; }
      ;;
    postgres)  restore_postgres "${backup_dir}" || ((errors++)) ;;
    redis)     restore_redis    "${backup_dir}" || true ;;
    minio)     restore_minio    "${backup_dir}" || ((errors++)) ;;
    outline)   restore_outline  "${backup_dir}" || true ;;
    homepage)  restore_homepage "${backup_dir}" || true ;;
    configs)   restore_configs  "${backup_dir}" || true ;;
  esac

  # 還原後驗證
  post_restore_verification "${service}"

  local end_ts
  end_ts=$(date +%s)
  local elapsed=$(( end_ts - start_ts ))

  if [[ ${errors} -gt 0 ]]; then
    log_error "═══ TITAN 還原完成（有 ${errors} 個錯誤，耗時 ${elapsed} 秒）═══"
    exit 1
  else
    log_info "═══ TITAN 還原成功完成（耗時 ${elapsed} 秒）═══"
    exit 0
  fi
}

main "$@"
