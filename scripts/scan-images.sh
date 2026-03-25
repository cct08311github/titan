#!/bin/bash
# Container image vulnerability scanner for TITAN
# Usage: ./scripts/scan-images.sh [docker-compose-file]
set -euo pipefail

echo "=== TITAN Container Image Security Scan ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

COMPOSE_FILE="${1:-docker-compose.yml}"
images=$(grep -E '^\s+image:' "$COMPOSE_FILE" | awk '{print $2}' | sort -u)

if command -v trivy &>/dev/null; then
  SCANNER="trivy"
elif command -v docker &>/dev/null && docker scout version &>/dev/null 2>&1; then
  SCANNER="docker-scout"
else
  echo "ERROR: Neither trivy nor docker scout found."
  echo "Install: brew install trivy"
  exit 1
fi

echo "Scanner: $SCANNER"
echo "Compose: $COMPOSE_FILE"
echo ""

for img in $images; do
  echo "--- Scanning: $img ---"
  if [ "$SCANNER" = "trivy" ]; then
    trivy image --severity HIGH,CRITICAL "$img" 2>/dev/null || echo "  WARN: scan failed for $img"
  else
    docker scout cves "$img" --only-severity critical,high 2>/dev/null || echo "  WARN: scan failed for $img"
  fi
  echo ""
done

echo "=== Scan Complete ==="
