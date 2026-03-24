#!/usr/bin/env bash
# check-security-middleware.sh — CI scanner for missing security middleware
# Issue #167: enforce withAuditLog and withRateLimit on all mutating route handlers
#
# Scans all app/api/**/route.ts files and exits 1 if any exported
# POST/PUT/PATCH/DELETE handler is not wrapped by BOTH withAuditLog AND withRateLimit.
#
# Usage: bash scripts/check-security-middleware.sh [route-dir]
#        Returns exit 0 if all routes are covered, exit 1 if gaps found.

set -euo pipefail

ROUTE_DIR="${1:-app/api}"
ERRORS=0

# Colour codes (suppressed when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' NC=''
fi

echo "Scanning ${ROUTE_DIR} for handlers missing withAuditLog or withRateLimit..."
echo ""

while IFS= read -r -d '' file; do
  relative="${file#./}"

  # Check if the file exports any mutating HTTP handler
  if ! grep -qE '^export const (POST|PUT|PATCH|DELETE)' "$file"; then
    continue
  fi

  file_has_audit=$(grep -c 'withAuditLog' "$file" || true)
  file_has_rate=$(grep -c 'withRateLimit' "$file" || true)

  file_error=0

  if [ "$file_has_audit" -eq 0 ]; then
    echo -e "${RED}FAIL${NC} ${relative} — missing withAuditLog"
    grep -nE '^export const (POST|PUT|PATCH|DELETE)' "$file" \
      | while IFS= read -r match; do
          echo "  ${YELLOW}→${NC} ${match}"
        done
    file_error=1
  fi

  if [ "$file_has_rate" -eq 0 ]; then
    echo -e "${RED}FAIL${NC} ${relative} — missing withRateLimit"
    grep -nE '^export const (POST|PUT|PATCH|DELETE)' "$file" \
      | while IFS= read -r match; do
          echo "  ${YELLOW}→${NC} ${match}"
        done
    file_error=1
  fi

  if [ "$file_error" -eq 1 ]; then
    echo ""
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "${ROUTE_DIR}" -name "route.ts" -print0)

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}Security middleware check FAILED: ${ERRORS} route file(s) are missing required wrappers.${NC}"
  echo "Every POST/PUT/PATCH/DELETE handler must use withAuditLog and withRateLimit."
  exit 1
else
  echo -e "${GREEN}Security middleware check PASSED: all mutating route handlers are properly wrapped.${NC}"
  exit 0
fi
