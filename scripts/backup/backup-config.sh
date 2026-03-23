#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN 設定檔備份腳本
# 任務: T19 — 備份與還原機制
# ═══════════════════════════════════════════════════════════

set -euo pipefail

: "${TITAN_ROOT:=/opt/titan}"
: "${BACKUP_DIR:=/opt/titan/backups/config}"
: "${RETENTION_DAYS:=30}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }

[ -d "${TITAN_ROOT}" ] || { log_error "TITAN_ROOT not found: ${TITAN_ROOT}"; exit 1; }
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"
LATEST_LINK="${BACKUP_DIR}/latest.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

log_info "Starting config backup"

ITEMS=(docker-compose.yml docker-compose.monitoring.yml docs nginx config plane scripts)
for item in "${ITEMS[@]}"; do
  if [ -e "${TITAN_ROOT}/${item}" ]; then
    cp -Rp "${TITAN_ROOT}/${item}" "${TMP_DIR}/"
  fi
done

if [ -f "${TITAN_ROOT}/.env.example" ]; then
  cp -p "${TITAN_ROOT}/.env.example" "${TMP_DIR}/"
fi

# 故意排除 .env，避免把機敏資訊打包進版本化備份

tar -czf "${BACKUP_FILE}" -C "${TMP_DIR}" .
[ -s "${BACKUP_FILE}" ] || { log_error "Backup file not created"; exit 1; }

ln -sfn "$(basename "${BACKUP_FILE}")" "${LATEST_LINK}"
find "${BACKUP_DIR}" -name 'config_*.tar.gz' -type f -mtime +"${RETENTION_DAYS}" -delete

log_info "Backup completed: ${BACKUP_FILE}"
log_info "Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"
