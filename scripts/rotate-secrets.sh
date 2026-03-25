#!/bin/bash
# TITAN Secret Rotation Template — Issue #269
# Usage: ./scripts/rotate-secrets.sh --target <name> [--dry-run]
# See docs/key-rotation-policy.md for full documentation
set -euo pipefail
: "${TITAN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
: "${ENV_FILE:=${TITAN_ROOT}/.env}"; : "${BACKUP_DIR:=${TITAN_ROOT}/.env-backups}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
log_i(){ echo -e "${GREEN}[INFO]${NC} $1"; }; log_w(){ echo -e "${YELLOW}[WARN]${NC} $1"; }; log_e(){ echo -e "${RED}[ERR]${NC} $1"; }
TGT=""; DRY=false
while [[ $# -gt 0 ]]; do case "$1" in
  --target) TGT="$2"; shift 2;; --dry-run) DRY=true; shift;;
  -h|--help) echo "Usage: $0 --target <name> [--dry-run]"
    echo "Targets: nextauth-secret db-password redis-password minio-password outline-secrets"; exit 0;;
  *) log_e "Unknown: $1"; exit 1;; esac; done
[[ -z "${TGT}" ]] && { log_e "必須指定 --target"; exit 1; }
gen(){ openssl rand -base64 32 | tr -d '=/+' | head -c 48; }
bak(){ mkdir -p "${BACKUP_DIR}"; cp "${ENV_FILE}" "${BACKUP_DIR}/.env.$(date +%Y%m%d_%H%M%S)"; log_i "已備份 .env"; }
upd(){ local k="$1" v="$2"
  [[ "${DRY}" == "true" ]] && { log_w "[DRY] ${k}=<hidden>"; return; }
  if grep -q "^${k}=" "${ENV_FILE}"; then
    [[ "$(uname)" == "Darwin" ]] && sed -i '' "s|^${k}=.*|${k}=${v}|" "${ENV_FILE}" || sed -i "s|^${k}=.*|${k}=${v}|" "${ENV_FILE}"
  else echo "${k}=${v}" >> "${ENV_FILE}"; fi; log_i "Updated ${k}"; }
rst(){ [[ "${DRY}" == "true" ]] && { log_w "[DRY] restart $*"; return; }
  cd "${TITAN_ROOT}"; docker compose restart "$@" || log_w "重啟失敗"; }
case "${TGT}" in
  nextauth-secret) log_i "輪換 NEXTAUTH_SECRET (session 將失效)"
    read -p "確認? (y/N) " -r; [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    bak; upd NEXTAUTH_SECRET "$(gen)"; rst titan-app;;
  db-password) log_i "輪換 POSTGRES_PASSWORD (DB 短暫中斷)"
    read -p "確認? (y/N) " -r; [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    bak; P=$(gen)
    [[ "${DRY}" != "true" ]] && docker compose exec -T postgres psql -U "${POSTGRES_USER:-titan}" -c "ALTER USER ${POSTGRES_USER:-titan} PASSWORD '${P}';"
    upd POSTGRES_PASSWORD "${P}"; rst postgres titan-app outline;;
  redis-password) log_i "輪換 REDIS_PASSWORD"
    read -p "確認? (y/N) " -r; [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    bak; upd REDIS_PASSWORD "$(gen)"; rst redis titan-app outline;;
  minio-password) log_i "輪換 MINIO_ROOT_PASSWORD"
    read -p "確認? (y/N) " -r; [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    bak; upd MINIO_ROOT_PASSWORD "$(gen)"; rst minio outline;;
  outline-secrets) log_i "輪換 Outline secrets"
    read -p "確認? (y/N) " -r; [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    bak; upd OUTLINE_SECRET_KEY "$(gen)"; upd OUTLINE_UTILS_SECRET "$(gen)"; rst outline;;
  *) log_e "不支援: ${TGT}"; exit 1;; esac
[[ "${DRY}" == "true" ]] && log_w "DRY RUN 完成"
