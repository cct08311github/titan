#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN PostgreSQL 備份腳本
# 任務: T19 — 備份與還原機制
# ═══════════════════════════════════════════════════════════

set -euo pipefail

: "${TITAN_ROOT:=/opt/titan}"
: "${BACKUP_DIR:=/opt/titan/backups/postgres}"
: "${RETENTION_DAYS:=30}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=titan}"
: "${POSTGRES_DB:=titan}"

if [ -f "${TITAN_ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${TITAN_ROOT}/.env"
  set +a
fi

POSTGRES_HOST="${POSTGRES_HOST}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-titan}"
POSTGRES_DB="${POSTGRES_DB:-titan}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"
LATEST_LINK="${BACKUP_DIR}/latest.dump"

log_info "Starting PostgreSQL backup"

if ! command -v pg_dump >/dev/null 2>&1; then
  log_error "pg_dump not found"
  exit 1
fi

if ! command -v pg_isready >/dev/null 2>&1; then
  log_error "pg_isready not found"
  exit 1
fi

if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
  log_error "PostgreSQL is not reachable at ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  exit 1
fi

PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -Fc \
  --clean \
  --if-exists \
  -f "${BACKUP_FILE}"

[ -s "${BACKUP_FILE}" ] || { log_error "Backup file not created"; exit 1; }

ln -sfn "$(basename "${BACKUP_FILE}")" "${LATEST_LINK}"
find "${BACKUP_DIR}" -name 'postgres_*.dump' -type f -mtime +"${RETENTION_DAYS}" -delete

log_info "Backup completed: ${BACKUP_FILE}"
log_info "Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"
