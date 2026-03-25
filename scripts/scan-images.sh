#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN Container Image Security Scanner
# ═══════════════════════════════════════════════════════════════════════════════
#
# Scans Docker images for known vulnerabilities using Trivy or Docker Scout.
# Intended for CI pipelines and manual security checks.
#
# Usage:
#   ./scripts/scan-images.sh                     # Scan default titan image
#   ./scripts/scan-images.sh myregistry/titan:v3  # Scan specific image
#   SCANNER=scout ./scripts/scan-images.sh       # Use Docker Scout instead
#
# Requirements:
#   - trivy (default): https://github.com/aquasecurity/trivy
#   - OR docker scout: Docker Desktop 4.17+ or standalone
#
# Exit codes:
#   0 — No CRITICAL or HIGH vulnerabilities found
#   1 — Vulnerabilities found or scanner error
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

IMAGE="${1:-titan:latest}"
SCANNER="${SCANNER:-trivy}"
SEVERITY="${SEVERITY:-CRITICAL,HIGH}"
OUTPUT_DIR="${OUTPUT_DIR:-./scan-results}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="${OUTPUT_DIR}/scan-${TIMESTAMP}.json"

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p "${OUTPUT_DIR}"

echo "=== TITAN Image Security Scan ==="
echo "Image:    ${IMAGE}"
echo "Scanner:  ${SCANNER}"
echo "Severity: ${SEVERITY}"
echo "Report:   ${REPORT_FILE}"
echo ""

# ── Check scanner availability ────────────────────────────────────────────────

check_trivy() {
  if ! command -v trivy &>/dev/null; then
    echo "[ERROR] trivy is not installed."
    echo "Install: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    echo ""
    echo "Quick install (macOS):  brew install trivy"
    echo "Quick install (Linux):  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin"
    exit 1
  fi
}

check_scout() {
  if ! docker scout version &>/dev/null 2>&1; then
    echo "[ERROR] Docker Scout is not available."
    echo "Requires Docker Desktop 4.17+ or standalone installation."
    exit 1
  fi
}

# ── Scan functions ────────────────────────────────────────────────────────────

scan_with_trivy() {
  echo "[INFO] Running Trivy scan..."
  echo ""

  # Update vulnerability database
  trivy image --download-db-only 2>/dev/null || true

  # Run scan with JSON output
  trivy image \
    --severity "${SEVERITY}" \
    --format json \
    --output "${REPORT_FILE}" \
    "${IMAGE}"

  local exit_code=$?

  # Also print human-readable table to stdout
  trivy image \
    --severity "${SEVERITY}" \
    --format table \
    "${IMAGE}"

  # Count vulnerabilities
  local critical_count high_count
  critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "${REPORT_FILE}" 2>/dev/null || echo "0")
  high_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "${REPORT_FILE}" 2>/dev/null || echo "0")

  echo ""
  echo "=== Summary ==="
  echo "CRITICAL: ${critical_count}"
  echo "HIGH:     ${high_count}"
  echo "Report:   ${REPORT_FILE}"

  if [[ "${critical_count}" -gt 0 ]] || [[ "${high_count}" -gt 0 ]]; then
    echo ""
    echo "[FAIL] Vulnerabilities detected. Review the report and remediate."
    return 1
  fi

  echo ""
  echo "[PASS] No CRITICAL or HIGH vulnerabilities found."
  return 0
}

scan_with_scout() {
  echo "[INFO] Running Docker Scout scan..."
  echo ""

  # Run scan with JSON output
  docker scout cves "${IMAGE}" \
    --format sarif \
    --output "${REPORT_FILE}" \
    --only-severity critical,high \
    2>&1

  local exit_code=$?

  # Also print human-readable output to stdout
  docker scout cves "${IMAGE}" \
    --only-severity critical,high

  echo ""
  echo "Report: ${REPORT_FILE}"

  if [[ ${exit_code} -ne 0 ]]; then
    echo "[FAIL] Vulnerabilities detected or scan error."
    return 1
  fi

  echo "[PASS] No CRITICAL or HIGH vulnerabilities found."
  return 0
}

# ── Dockerfile best practices (Trivy only) ────────────────────────────────────

scan_dockerfile() {
  if [[ "${SCANNER}" != "trivy" ]]; then
    return 0
  fi

  local dockerfile="${1:-Dockerfile}"
  if [[ ! -f "${dockerfile}" ]]; then
    echo "[SKIP] No Dockerfile found at ${dockerfile}"
    return 0
  fi

  echo ""
  echo "=== Dockerfile Misconfiguration Check ==="
  trivy config \
    --severity "${SEVERITY}" \
    "${dockerfile}" || true
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  local result=0

  case "${SCANNER}" in
    trivy)
      check_trivy
      scan_with_trivy || result=1
      scan_dockerfile "Dockerfile"
      ;;
    scout)
      check_scout
      scan_with_scout || result=1
      ;;
    *)
      echo "[ERROR] Unknown scanner: ${SCANNER}. Use 'trivy' or 'scout'."
      exit 1
      ;;
  esac

  echo ""
  echo "=== Scan Complete ($(date)) ==="
  exit ${result}
}

main
