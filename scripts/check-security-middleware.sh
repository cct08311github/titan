#!/usr/bin/env bash
# check-security-middleware.sh — CI scanner for missing security middleware
# Issue #167, #169: enforce all 4 security wrappers on mutating route handlers
#
# Scans all app/api/**/route.ts files and exits 1 if any exported
# POST/PUT/PATCH/DELETE handler is not wrapped by the required security middleware.
#
# Usage: bash scripts/check-security-middleware.sh [route-dir]
#        Returns exit 0 if all routes are covered, exit 1 if gaps found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ROUTE_DIR="${1:-${PROJECT_ROOT}/app/api}"
ERRORS=0

# Required security middleware for all mutating handlers
REQUIRED_MIDDLEWARE=("withAuditLog" "withRateLimit" "withSessionTimeout" "withJwtBlacklist")

# Colour codes (suppressed when not a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' NC=''
fi

printf "Scanning %s for handlers missing required security middleware...\n\n" "${ROUTE_DIR}"

while IFS= read -r -d '' file; do
  relative="${file#"${PROJECT_ROOT}"/}"

  # Check if the file exports any mutating HTTP handler
  if ! grep -qE 'export\s+(const|function|async\s+function)\s+(POST|PUT|PATCH|DELETE)' "$file"; then
    continue
  fi

  file_error=0

  for mw in "${REQUIRED_MIDDLEWARE[@]}"; do
    count=$(grep -c "${mw}" "$file" || true)
    if [ "$count" -eq 0 ]; then
      printf "${RED}FAIL${NC} %s — missing %s\n" "${relative}" "${mw}"
      grep -nE 'export\s+(const|function|async\s+function)\s+(POST|PUT|PATCH|DELETE)' "$file" \
        | while IFS= read -r match; do
            printf "  ${YELLOW}→${NC} %s\n" "${match}"
          done
      file_error=1
    fi
  done

  if [ "$file_error" -eq 1 ]; then
    printf "\n"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "${ROUTE_DIR}" -name "route.ts" -print0)

if [ "$ERRORS" -gt 0 ]; then
  printf "${RED}Security middleware check FAILED: %d route file(s) are missing required wrappers.${NC}\n" "${ERRORS}"
  printf "Every POST/PUT/PATCH/DELETE handler must use: %s\n" "${REQUIRED_MIDDLEWARE[*]}"
  exit 1
else
  printf "${GREEN}Security middleware check PASSED: all mutating route handlers are properly wrapped.${NC}\n"
  exit 0
fi
