#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TITAN 全量備份腳本（PostgreSQL / MinIO / Config）
# 任務: T19 — 備份與還原機制
# ═══════════════════════════════════════════════════════════

set -euo pipefail

: "${TITAN_ROOT:=/opt/titan}"
: "${LOG_DIR:=/var/log/titan}"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }
section(){ echo -e "\n${BLUE}== $1 ==${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/backup_$(date +%Y%m%d_%H%M%S).log"

action() {
  local name="$1" script="$2"
  section "${name}"
  if bash "${script}" 2>&1 | tee -a "${LOG_FILE}"; then
    log_info "${name} 完成"
  else
    log_error "${name} 失敗"
    exit 1
  fi
}

action "PostgreSQL 備份" "${SCRIPT_DIR}/backup-postgres.sh"
action "MinIO 備份" "${SCRIPT_DIR}/backup-minio.sh"
action "Config 備份" "${SCRIPT_DIR}/backup-config.sh"

section "完成"
log_info "全量備份完成，日誌：${LOG_FILE}"
