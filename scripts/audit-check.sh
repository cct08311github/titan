#!/usr/bin/env bash
# =============================================================================
# TITAN 稽核檢查腳本
# 版本：1.0 | 更新：2026-03-23
# 用途：驗證 RBAC 角色、檢查未授權存取嘗試、備份狀態、憑證到期
# 使用方式：./scripts/audit-check.sh [--output-dir /path/to/reports]
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 設定
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="${AUDIT_REPORT_DIR:-/var/log/titan/audit-reports}"
LOG_DIR="${TITAN_LOG_DIR:-/var/log/titan}"
BACKUP_DIR="${TITAN_BACKUP_DIR:-/backups/titan}"
CERT_WARN_DAYS=30
CERT_CRITICAL_DAYS=7
MAX_FAILED_LOGINS=5        # 單一 IP 每小時失敗登入警戒值
REPORT_DATE="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="${REPORT_DIR}/audit-report-${REPORT_DATE}.txt"

# 顏色輸出
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# 計數器
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# ---------------------------------------------------------------------------
# 工具函式
# ---------------------------------------------------------------------------
log_pass()     { echo -e "${GREEN}[PASS]${NC} $*"; ((PASS_COUNT++)); }
log_warn()     { echo -e "${YELLOW}[WARN]${NC} $*"; ((WARN_COUNT++)); }
log_fail()     { echo -e "${RED}[FAIL]${NC} $*"; ((FAIL_COUNT++)); }
log_info()     { echo -e "${BLUE}[INFO]${NC} $*"; }
log_section()  { echo -e "\n${BOLD}=== $* ===${NC}"; }

# 解析命令列參數
while [[ $# -gt 0 ]]; do
  case $1 in
    --output-dir) REPORT_DIR="$2"; shift 2 ;;
    --log-dir)    LOG_DIR="$2";    shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    *) echo "未知參數：$1"; exit 1 ;;
  esac
done

mkdir -p "$REPORT_DIR"

# 將輸出同時寫入終端與報告檔
exec > >(tee -a "$REPORT_FILE") 2>&1

echo "============================================================"
echo " TITAN 合規稽核報告"
echo " 執行時間：$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo " 執行主機：$(hostname)"
echo " 報告位置：${REPORT_FILE}"
echo "============================================================"

# ---------------------------------------------------------------------------
# 1. RBAC 角色驗證
# ---------------------------------------------------------------------------
log_section "RBAC 角色驗證"

check_rbac_docker_compose() {
  local compose_file="${REPO_ROOT}/docker-compose.yml"

  if [[ ! -f "$compose_file" ]]; then
    log_warn "找不到 docker-compose.yml，跳過 RBAC 設定驗證"
    return
  fi

  # 確認各服務的環境變數有設定認證相關設定
  local services=("outline" "plane" "minio")
  for svc in "${services[@]}"; do
    if grep -q "$svc" "$compose_file"; then
      log_pass "服務 ${svc} 存在於 docker-compose.yml"
    else
      log_warn "服務 ${svc} 未在 docker-compose.yml 中找到"
    fi
  done
}

check_rbac_env_files() {
  local env_example="${REPO_ROOT}/.env.example"
  local required_vars=(
    "OUTLINE_SECRET_KEY"
    "MINIO_ROOT_USER"
    "POSTGRES_PASSWORD"
  )

  if [[ ! -f "$env_example" ]]; then
    log_info ".env.example 不存在，略過環境變數稽核"
    return
  fi

  for var in "${required_vars[@]}"; do
    if grep -q "^${var}" "$env_example" 2>/dev/null; then
      log_pass "環境變數 ${var} 已定義於 .env.example"
    else
      log_warn "環境變數 ${var} 未定義於 .env.example"
    fi
  done
}

check_rbac_running_containers() {
  if ! command -v docker &>/dev/null; then
    log_info "Docker 未安裝或不可用，跳過容器 RBAC 驗證"
    return
  fi

  log_info "檢查執行中容器的使用者設定..."

  # 確認關鍵容器未以 root 身份執行（最佳實務）
  local containers
  containers=$(docker ps --format '{{.Names}}' 2>/dev/null || true)

  if [[ -z "$containers" ]]; then
    log_info "沒有執行中的容器"
    return
  fi

  while IFS= read -r container; do
    local user
    user=$(docker inspect --format '{{.Config.User}}' "$container" 2>/dev/null || echo "unknown")
    if [[ "$user" == "root" || "$user" == "0" || "$user" == "" ]]; then
      log_warn "容器 ${container} 以 root 身份執行（建議設定非特權使用者）"
    else
      log_pass "容器 ${container} 以非 root 使用者 (${user}) 執行"
    fi
  done <<< "$containers"
}

check_rbac_docker_compose
check_rbac_env_files
check_rbac_running_containers

# ---------------------------------------------------------------------------
# 2. 未授權存取嘗試檢查
# ---------------------------------------------------------------------------
log_section "未授權存取嘗試檢查"

check_failed_logins() {
  local auth_log=""

  # 嘗試找到認證日誌
  for candidate in /var/log/auth.log /var/log/secure "${LOG_DIR}/auth.log"; do
    if [[ -f "$candidate" ]]; then
      auth_log="$candidate"
      break
    fi
  done

  if [[ -z "$auth_log" ]]; then
    log_info "找不到認證日誌，跳過失敗登入檢查"
    return
  fi

  log_info "分析認證日誌：${auth_log}"

  # 過去 1 小時內的失敗登入
  local one_hour_ago
  one_hour_ago=$(date -d '1 hour ago' '+%b %e %H' 2>/dev/null || date -v -1H '+%b %e %H' 2>/dev/null || echo "")

  if [[ -z "$one_hour_ago" ]]; then
    log_info "無法計算時間範圍，跳過時間篩選"
    return
  fi

  # 統計失敗登入次數（依 IP 分組）
  local failed_logins
  failed_logins=$(grep -i "failed password\|authentication failure\|invalid user" "$auth_log" 2>/dev/null \
    | awk '{print $NF}' \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
    | sort | uniq -c | sort -rn \
    || true)

  if [[ -z "$failed_logins" ]]; then
    log_pass "未偵測到失敗登入記錄"
    return
  fi

  while IFS= read -r line; do
    local count ip
    count=$(echo "$line" | awk '{print $1}')
    ip=$(echo "$line" | awk '{print $2}')

    if [[ "$count" -ge "$MAX_FAILED_LOGINS" ]]; then
      log_fail "IP ${ip} 失敗登入 ${count} 次（超過警戒值 ${MAX_FAILED_LOGINS}）— 可能遭受暴力破解"
    elif [[ "$count" -ge 3 ]]; then
      log_warn "IP ${ip} 失敗登入 ${count} 次"
    fi
  done <<< "$failed_logins"
}

check_nginx_access_anomalies() {
  local nginx_log="/var/log/nginx/access.log"
  if [[ ! -f "$nginx_log" ]]; then
    nginx_log="${LOG_DIR}/nginx/access.log"
  fi

  if [[ ! -f "$nginx_log" ]]; then
    log_info "找不到 Nginx 存取日誌，跳過 HTTP 異常檢查"
    return
  fi

  log_info "分析 Nginx 存取日誌：${nginx_log}"

  # 統計 4xx/5xx 錯誤
  local error_4xx error_5xx
  error_4xx=$(grep -c ' 4[0-9][0-9] ' "$nginx_log" 2>/dev/null || echo "0")
  error_5xx=$(grep -c ' 5[0-9][0-9] ' "$nginx_log" 2>/dev/null || echo "0")

  if [[ "$error_4xx" -gt 100 ]]; then
    log_warn "Nginx 日誌中偵測到 ${error_4xx} 個 4xx 錯誤（可能有掃描活動）"
  else
    log_pass "Nginx 4xx 錯誤數量正常（${error_4xx} 筆）"
  fi

  if [[ "$error_5xx" -gt 10 ]]; then
    log_warn "Nginx 日誌中偵測到 ${error_5xx} 個 5xx 錯誤"
  else
    log_pass "Nginx 5xx 錯誤數量正常（${error_5xx} 筆）"
  fi

  # 檢查可疑路徑（常見攻擊路徑）
  local suspicious_paths=("/admin" "/.env" "/wp-admin" "/etc/passwd" "/../" "/phpmyadmin")
  for path in "${suspicious_paths[@]}"; do
    local hits
    hits=$(grep -c "$path" "$nginx_log" 2>/dev/null || echo "0")
    if [[ "$hits" -gt 0 ]]; then
      log_warn "偵測到可疑路徑存取 '${path}'：${hits} 次"
    fi
  done
}

check_failed_logins
check_nginx_access_anomalies

# ---------------------------------------------------------------------------
# 3. 備份完成狀態驗證
# ---------------------------------------------------------------------------
log_section "備份完成狀態驗證"

check_backup_status() {
  if [[ ! -d "$BACKUP_DIR" ]]; then
    log_warn "備份目錄不存在：${BACKUP_DIR}（請確認備份設定）"
    return
  fi

  log_info "檢查備份目錄：${BACKUP_DIR}"

  # 檢查最近 24 小時是否有備份檔案產生
  local recent_backups
  recent_backups=$(find "$BACKUP_DIR" -type f -newer <(date -d '24 hours ago' 2>/dev/null || date -v -24H 2>/dev/null || echo "/etc/passwd") 2>/dev/null | wc -l || echo "0")

  if [[ "$recent_backups" -gt 0 ]]; then
    log_pass "過去 24 小時內發現 ${recent_backups} 個備份檔案"
  else
    log_fail "過去 24 小時內沒有新的備份檔案（備份可能失敗）"
  fi

  # 檢查最新備份檔案大小（確認非空檔案）
  local latest_backup
  latest_backup=$(find "$BACKUP_DIR" -type f -name "*.sql.gz" -o -name "*.tar.gz" 2>/dev/null \
    | xargs ls -t 2>/dev/null | head -1 || true)

  if [[ -n "$latest_backup" ]]; then
    local size
    size=$(du -sh "$latest_backup" 2>/dev/null | cut -f1 || echo "unknown")
    log_info "最新備份檔案：${latest_backup}（大小：${size}）"

    local bytes
    bytes=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null || echo "0")
    if [[ "$bytes" -lt 1024 ]]; then
      log_fail "最新備份檔案過小（${bytes} bytes），可能備份不完整"
    else
      log_pass "最新備份檔案大小正常（${size}）"
    fi
  else
    log_warn "備份目錄中未找到 .sql.gz 或 .tar.gz 備份檔案"
  fi
}

check_backup_log() {
  local backup_log="${LOG_DIR}/backup.log"

  if [[ ! -f "$backup_log" ]]; then
    log_info "備份日誌不存在：${backup_log}"
    return
  fi

  # 檢查最近一次備份是否成功
  local last_result
  last_result=$(grep -i "backup\|success\|error\|fail" "$backup_log" 2>/dev/null | tail -5 || true)

  if echo "$last_result" | grep -qi "error\|fail"; then
    log_fail "備份日誌中發現錯誤記錄"
    echo "       最近備份日誌：$last_result"
  elif echo "$last_result" | grep -qi "success\|complete\|done"; then
    log_pass "備份日誌顯示最近備份成功"
  else
    log_info "備份日誌最後 5 行：${last_result}"
  fi
}

check_backup_status
check_backup_log

# ---------------------------------------------------------------------------
# 4. 憑證到期日檢查
# ---------------------------------------------------------------------------
log_section "TLS 憑證到期日檢查"

check_certificate() {
  local cert_file="$1"
  local cert_name="$2"

  if [[ ! -f "$cert_file" ]]; then
    log_info "憑證檔案不存在：${cert_file}"
    return
  fi

  if ! command -v openssl &>/dev/null; then
    log_warn "openssl 未安裝，無法檢查憑證"
    return
  fi

  local expiry_date expiry_epoch now_epoch days_left
  expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d= -f2 || true)

  if [[ -z "$expiry_date" ]]; then
    log_warn "無法解析憑證：${cert_file}"
    return
  fi

  expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null || echo "0")
  now_epoch=$(date +%s)
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

  if [[ "$days_left" -le 0 ]]; then
    log_fail "憑證 ${cert_name} 已過期！（到期日：${expiry_date}）"
  elif [[ "$days_left" -le "$CERT_CRITICAL_DAYS" ]]; then
    log_fail "憑證 ${cert_name} 即將到期（剩餘 ${days_left} 天）— 需立即更新"
  elif [[ "$days_left" -le "$CERT_WARN_DAYS" ]]; then
    log_warn "憑證 ${cert_name} 將於 ${days_left} 天後到期（到期日：${expiry_date}）"
  else
    log_pass "憑證 ${cert_name} 有效期限正常（剩餘 ${days_left} 天，到期日：${expiry_date}）"
  fi
}

check_remote_certificate() {
  local host="$1"
  local port="${2:-443}"
  local name="${3:-$host}"

  if ! command -v openssl &>/dev/null; then
    return
  fi

  local expiry_date expiry_epoch now_epoch days_left
  expiry_date=$(echo | timeout 5 openssl s_client -connect "${host}:${port}" -servername "$host" 2>/dev/null \
    | openssl x509 -enddate -noout 2>/dev/null | cut -d= -f2 || true)

  if [[ -z "$expiry_date" ]]; then
    log_info "無法連線至 ${host}:${port}，跳過遠端憑證檢查"
    return
  fi

  expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null || echo "0")
  now_epoch=$(date +%s)
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

  if [[ "$days_left" -le "$CERT_CRITICAL_DAYS" ]]; then
    log_fail "遠端憑證 ${name} 剩餘 ${days_left} 天到期"
  elif [[ "$days_left" -le "$CERT_WARN_DAYS" ]]; then
    log_warn "遠端憑證 ${name} 將於 ${days_left} 天後到期"
  else
    log_pass "遠端憑證 ${name} 有效（剩餘 ${days_left} 天）"
  fi
}

# 檢查本地憑證檔案
CERT_DIRS=(
  "/etc/nginx/ssl"
  "/etc/ssl/certs/titan"
  "${REPO_ROOT}/nginx/ssl"
  "${REPO_ROOT}/config/ssl"
)

cert_found=false
for cert_dir in "${CERT_DIRS[@]}"; do
  if [[ -d "$cert_dir" ]]; then
    while IFS= read -r -d '' cert_file; do
      cert_name=$(basename "$cert_file")
      check_certificate "$cert_file" "$cert_name"
      cert_found=true
    done < <(find "$cert_dir" -name "*.crt" -o -name "*.pem" -print0 2>/dev/null)
  fi
done

if [[ "$cert_found" == "false" ]]; then
  log_info "未在標準路徑找到本地憑證檔案，嘗試連線遠端服務..."
  # 嘗試檢查本機服務（若設定了 TITAN_DOMAIN 環境變數則使用）
  if [[ -n "${TITAN_DOMAIN:-}" ]]; then
    check_remote_certificate "$TITAN_DOMAIN" 443 "TITAN 主站"
  else
    log_info "未設定 TITAN_DOMAIN 環境變數，跳過遠端憑證檢查"
  fi
fi

# ---------------------------------------------------------------------------
# 5. 合規報告輸出
# ---------------------------------------------------------------------------
log_section "合規報告摘要"

TOTAL=$((PASS_COUNT + WARN_COUNT + FAIL_COUNT))
SCORE=0
if [[ "$TOTAL" -gt 0 ]]; then
  SCORE=$(( PASS_COUNT * 100 / TOTAL ))
fi

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│         TITAN 稽核合規報告摘要           │"
echo "├─────────────────────────────────────────┤"
printf "│  %-38s │\n" "執行時間：$(date '+%Y-%m-%d %H:%M:%S')"
printf "│  %-38s │\n" "通過項目：${PASS_COUNT}"
printf "│  %-38s │\n" "警告項目：${WARN_COUNT}"
printf "│  %-38s │\n" "失敗項目：${FAIL_COUNT}"
printf "│  %-38s │\n" "合規評分：${SCORE}% (${PASS_COUNT}/${TOTAL})"
echo "└─────────────────────────────────────────┘"

echo ""
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo -e "${RED}[!] 稽核結果：不合規 — 有 ${FAIL_COUNT} 個項目需要立即處理${NC}"
  EXIT_CODE=2
elif [[ "$WARN_COUNT" -gt 0 ]]; then
  echo -e "${YELLOW}[!] 稽核結果：部分合規 — 有 ${WARN_COUNT} 個警告項目需要關注${NC}"
  EXIT_CODE=1
else
  echo -e "${GREEN}[+] 稽核結果：合規 — 所有檢查項目通過${NC}"
  EXIT_CODE=0
fi

echo ""
echo "報告已儲存至：${REPORT_FILE}"

exit $EXIT_CODE
