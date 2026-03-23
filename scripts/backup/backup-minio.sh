#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN MinIO 備份腳本
# 任務: T19 — 備份與還原機制
# ═══════════════════════════════════════════════════════════

set -euo pipefail

: "${TITAN_ROOT:=/opt/titan}"
: "${BACKUP_DIR:=/opt/titan/backups/minio}"
: "${RETENTION_DAYS:=30}"
: "${MINIO_ENDPOINT:=localhost:9000}"
: "${MINIO_BUCKETS:=outline,plane-uploads}"

if [ -f "${TITAN_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${TITAN_ROOT}/.env"
  set +a
fi

: "${MINIO_ROOT_USER:=minioadmin}"
: "${MINIO_ROOT_PASSWORD:=minioadmin}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/minio_${TIMESTAMP}.tar.gz"
LATEST_LINK="${BACKUP_DIR}/latest.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

log_info "Starting MinIO backup"

if ! command -v mc >/dev/null 2>&1; then
  log_error "mc not found"
  exit 1
fi

mc alias set titan-backup "http://${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1 || {
  log_error "Failed to connect MinIO ${MINIO_ENDPOINT}"
  exit 1
}

IFS=',' read -r -a BUCKET_ARRAY <<< "${MINIO_BUCKETS}"
for bucket in "${BUCKET_ARRAY[@]}"; do
  bucket="${bucket// /}"
  if mc ls "titan-backup/${bucket}" >/dev/null 2>&1; then
    log_info "Mirroring bucket: ${bucket}"
    mc mirror --overwrite --preserve "titan-backup/${bucket}" "${TMP_DIR}/${bucket}"
  else
    log_warn "Bucket not found, skip: ${bucket}"
  fi
done

tar -czf "${BACKUP_FILE}" -C "${TMP_DIR}" .
[ -s "${BACKUP_FILE}" ] || { log_error "Backup file not created"; exit 1; }

ln -sfn "$(basename "${BACKUP_FILE}")" "${LATEST_LINK}"
find "${BACKUP_DIR}" -name 'minio_*.tar.gz' -type f -mtime +"${RETENTION_DAYS}" -delete

log_info "Backup completed: ${BACKUP_FILE}"
log_info "Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"
