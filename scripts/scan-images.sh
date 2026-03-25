#!/bin/bash
# TITAN Container Image Scanning — Issue #269
set -euo pipefail
: "${TITAN_ROOT:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${TITAN_ROOT}/docker-compose.yml"
REPORT_DIR="${TITAN_ROOT}/reports/image-scan"
TS=$(date +%Y%m%d_%H%M%S); FMT="table"; SEV="HIGH,CRITICAL"
while [[ $# -gt 0 ]]; do case "$1" in
  --format) FMT="$2"; shift 2;; --severity) SEV="$2"; shift 2;;
  -h|--help) echo "Usage: $0 [--format table|json] [--severity HIGH,CRITICAL]"; exit 0;;
  *) echo "Unknown: $1"; exit 1;; esac; done
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[0;33m'; NC='\033[0m'
log_info(){ echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error(){ echo -e "${RED}[ERROR]${NC} $1"; }
SCANNER=""
if command -v trivy &>/dev/null; then SCANNER="trivy"
elif command -v docker &>/dev/null && docker scout version &>/dev/null 2>&1; then SCANNER="docker-scout"
else log_error "找不到掃描工具 (trivy/docker scout)"; exit 1; fi
log_info "Scanner: ${SCANNER}"
[[ ! -f "${COMPOSE_FILE}" ]] && { log_error "找不到 ${COMPOSE_FILE}"; exit 1; }
IMAGES=$(grep -E '^\s+image:' "${COMPOSE_FILE}" | sed 's/.*image:\s*//' | sed 's/\s*$//' | sort -u)
[[ -z "${IMAGES}" ]] && { log_warn "未找到映像"; exit 0; }
mkdir -p "${REPORT_DIR}"
TOTAL=0; FAILED=0; RPT="${REPORT_DIR}/scan_${TS}.txt"
echo "TITAN Image Scan — $(date) — ${SCANNER} — ${SEV}" > "${RPT}"
while IFS= read -r IMG; do
  [[ -z "${IMG}" || "${IMG}" == *'\${'* ]] && continue
  TOTAL=$((TOTAL+1)); log_info "掃描: ${IMG}"
  if [[ "${SCANNER}" == "trivy" ]]; then
    trivy image --severity "${SEV}" --format "${FMT}" --no-progress "${IMG}" 2>&1 | tee -a "${RPT}" || FAILED=$((FAILED+1))
  else docker scout cves "${IMG}" 2>&1 | tee -a "${RPT}" || FAILED=$((FAILED+1)); fi
done <<< "${IMAGES}"
log_info "掃描: ${TOTAL}, 失敗: ${FAILED}, 報告: ${RPT}"
exit ${FAILED}
