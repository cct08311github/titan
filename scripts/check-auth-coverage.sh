#!/usr/bin/env bash
# check-auth-coverage.sh — CI scanner for missing auth on API routes
# Issue #124: RBAC complete coverage
#
# Scans all app/api/**/route.ts files and exits 1 if any exported HTTP handler
# (GET/POST/PUT/PATCH/DELETE) is bound directly to apiHandler() instead of
# withAuth() or withManager(), indicating a missing auth guard.
#
# Usage: bash scripts/check-auth-coverage.sh
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

echo "Scanning ${ROUTE_DIR} for unguarded API route handlers..."
echo ""

while IFS= read -r -d '' file; do
  relative="${file#./}"

  # Find lines where an HTTP method export is assigned directly to apiHandler(
  # Pattern: `export const (GET|POST|PUT|PATCH|DELETE) = apiHandler(`
  # This is the unguarded pattern — should be withAuth( or withManager( instead.
  if grep -qE '^export const (GET|POST|PUT|PATCH|DELETE)[[:space:]]*=[[:space:]]*apiHandler\(' "$file"; then
    echo -e "${RED}FAIL${NC} ${relative}"
    grep -nE '^export const (GET|POST|PUT|PATCH|DELETE)[[:space:]]*=[[:space:]]*apiHandler\(' "$file" \
      | while IFS= read -r match; do
          echo "  ${YELLOW}→${NC} ${match}"
        done
    echo ""
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "${ROUTE_DIR}" -name "route.ts" -print0)

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}Auth coverage check FAILED: ${ERRORS} route file(s) have unguarded handlers.${NC}"
  echo "Wrap each handler with withAuth() or withManager() from @/lib/auth-middleware."
  exit 1
else
  echo -e "${GREEN}Auth coverage check PASSED: all route handlers are guarded.${NC}"
  exit 0
fi
