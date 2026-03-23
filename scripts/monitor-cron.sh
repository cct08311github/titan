#!/usr/bin/env bash
# =============================================================================
# TITAN 監控排程腳本
# 任務：T18 — Logging and Monitoring Setup
# 說明：定期執行健康檢查，記錄結果至日誌，嚴重狀態時寫入告警檔案
#
# 設計為每 5 分鐘執行一次，建議 crontab 設定：
#   */5 * * * * /opt/titan/scripts/monitor-cron.sh >> /dev/null 2>&1
#
# 日誌位置：
#   /var/log/titan/monitor.log         — 監控執行紀錄
#   /var/log/titan/alerts/             — 告警事件檔案
#   /var/log/titan/health/             — 每次健康報告 JSON
# =============================================================================

set -euo pipefail

# ─── 目錄與檔案設定 ────────────────────────────────────────────────────────

TITAN_LOG_DIR="${TITAN_LOG_DIR:-/var/log/titan}"
MONITOR_LOG="${TITAN_LOG_DIR}/monitor.log"
ALERT_DIR="${TITAN_LOG_DIR}/alerts"
HEALTH_DIR="${TITAN_LOG_DIR}/health"
LOCK_FILE="${TITAN_LOG_DIR}/.monitor.lock"

# health-check.sh 路徑（自動偵測）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_CHECK="${HEALTH_CHECK:-${SCRIPT_DIR}/health-check.sh}"

# 告警抑制設定
ALERT_COOLDOWN_SECONDS="${ALERT_COOLDOWN_SECONDS:-900}"   # 15 分鐘冷卻期
LAST_ALERT_FILE="${TITAN_LOG_DIR}/.last_alert_time"

# 日誌保留天數
LOG_RETAIN_DAYS="${LOG_RETAIN_DAYS:-14}"
HEALTH_RETAIN_DAYS="${HEALTH_RETAIN_DAYS:-7}"
ALERT_RETAIN_DAYS="${ALERT_RETAIN_DAYS:-90}"

# ─── 初始化目錄 ────────────────────────────────────────────────────────────

init_directories() {
  for dir in "$TITAN_LOG_DIR" "$ALERT_DIR" "$HEALTH_DIR"; do
    if ! mkdir -p "$dir" 2>/dev/null; then
      echo "錯誤：無法建立目錄 $dir（可能需要 sudo）" >&2
      exit 1
    fi
    chmod 750 "$dir" 2>/dev/null || true
  done
}

# ─── 日誌函式 ─────────────────────────────────────────────────────────────

log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  printf "[%s] [%-8s] %s\n" "$timestamp" "$level" "$message" >> "$MONITOR_LOG"
}

log_info()    { log "INFO"     "$@"; }
log_warning() { log "WARNING"  "$@"; }
log_error()   { log "ERROR"    "$@"; }
log_alert()   { log "ALERT"    "$@"; }

# ─── 鎖定機制（防止重複執行）──────────────────────────────────────────────

acquire_lock() {
  if [ -f "$LOCK_FILE" ]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
      log_warning "監控腳本已在執行中（PID: $lock_pid），跳過本次執行"
      exit 0
    else
      log_warning "發現孤立的鎖定檔案，清除並繼續"
      rm -f "$LOCK_FILE"
    fi
  fi

  echo "$$" > "$LOCK_FILE"

  # 確保結束時釋放鎖定
  trap 'rm -f "$LOCK_FILE"' EXIT INT TERM
}

# ─── 告警冷卻判斷 ─────────────────────────────────────────────────────────

should_send_alert() {
  local current_time
  current_time="$(date +%s)"

  if [ -f "$LAST_ALERT_FILE" ]; then
    local last_alert_time
    last_alert_time="$(cat "$LAST_ALERT_FILE" 2>/dev/null || echo 0)"
    local elapsed=$(( current_time - last_alert_time ))
    if [ "$elapsed" -lt "$ALERT_COOLDOWN_SECONDS" ]; then
      local remaining=$(( ALERT_COOLDOWN_SECONDS - elapsed ))
      log_info "告警冷卻中（剩餘 ${remaining} 秒），不重複發送告警"
      return 1
    fi
  fi

  echo "$current_time" > "$LAST_ALERT_FILE"
  return 0
}

# ─── 寫入告警事件檔案 ─────────────────────────────────────────────────────

write_alert() {
  local level="$1"           # critical / warning
  local message="$2"
  local json_report="${3:-}"

  local timestamp
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  local alert_file="${ALERT_DIR}/${timestamp}-${level}.alert"

  {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "TITAN 監控告警"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "時間：$(date '+%Y-%m-%d %H:%M:%S')"
    echo "主機：$(hostname 2>/dev/null || echo 'unknown')"
    echo "等級：${level^^}"
    echo "訊息：$message"
    echo ""
    if [ -n "$json_report" ]; then
      echo "詳細報告："
      echo "$json_report"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  } > "$alert_file"

  chmod 640 "$alert_file" 2>/dev/null || true
  log_alert "告警事件已寫入：$alert_file"
}

# ─── 傳送通知（擴充點）───────────────────────────────────────────────────

send_notification() {
  local level="$1"
  local message="$2"
  local alert_file="$3"

  # ── 預留：Email 通知 ──
  # 若設定了 ALERT_EMAIL，透過 sendmail / mail 指令傳送
  if [ -n "${ALERT_EMAIL:-}" ] && command -v mail &>/dev/null; then
    echo "TITAN 告警 [${level^^}]: $message

$(cat "$alert_file" 2>/dev/null)" | \
      mail -s "[TITAN Alert][${level^^}] $message" "$ALERT_EMAIL" 2>/dev/null && \
      log_info "告警 email 已傳送至：$ALERT_EMAIL" || \
      log_warning "告警 email 傳送失敗"
  fi

  # ── 預留：Slack Webhook 通知 ──
  if [ -n "${SLACK_WEBHOOK_URL:-}" ] && command -v curl &>/dev/null; then
    local color
    case "$level" in
      critical) color="danger"  ;;
      warning)  color="warning" ;;
      *)        color="good"    ;;
    esac

    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"attachments\":[{\"color\":\"$color\",\"title\":\"TITAN 告警 [${level^^}]\",\"text\":\"$message\",\"footer\":\"TITAN Monitor\",\"ts\":$(date +%s)}]}" \
      &>/dev/null && \
      log_info "Slack 通知已傳送" || \
      log_warning "Slack 通知傳送失敗"
  fi

  # ── 預留：Telegram Bot 通知 ──
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] && \
     command -v curl &>/dev/null; then
    local emoji
    case "$level" in
      critical) emoji="🔴" ;;
      warning)  emoji="🟡" ;;
      *)        emoji="🟢" ;;
    esac

    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${emoji} TITAN 告警 [${level^^}]%0A${message}" \
      -d "parse_mode=HTML" \
      &>/dev/null && \
      log_info "Telegram 通知已傳送" || \
      log_warning "Telegram 通知傳送失敗"
  fi
}

# ─── 日誌清理 ─────────────────────────────────────────────────────────────

cleanup_old_logs() {
  # 清理過期的健康報告 JSON
  if [ -d "$HEALTH_DIR" ]; then
    find "$HEALTH_DIR" -name "*.json" -mtime +"$HEALTH_RETAIN_DAYS" -delete 2>/dev/null || true
  fi

  # 清理過期的告警檔案
  if [ -d "$ALERT_DIR" ]; then
    find "$ALERT_DIR" -name "*.alert" -mtime +"$ALERT_RETAIN_DAYS" -delete 2>/dev/null || true
  fi

  # 輪替 monitor.log（超過 50MB 時）
  if [ -f "$MONITOR_LOG" ]; then
    local log_size
    log_size=$(wc -c < "$MONITOR_LOG" 2>/dev/null || echo 0)
    if [ "$log_size" -gt 52428800 ]; then  # 50MB
      local backup="${MONITOR_LOG}.$(date '+%Y%m%d')"
      mv "$MONITOR_LOG" "$backup" 2>/dev/null || true
      gzip "$backup" 2>/dev/null || true
      log_info "monitor.log 已輪替：$backup.gz"
    fi
  fi
}

# ─── 執行健康檢查 ─────────────────────────────────────────────────────────

run_health_check() {
  if [ ! -f "$HEALTH_CHECK" ]; then
    log_error "找不到健康檢查腳本：$HEALTH_CHECK"
    return 2
  fi

  if [ ! -x "$HEALTH_CHECK" ]; then
    chmod +x "$HEALTH_CHECK" 2>/dev/null || {
      log_error "無法執行健康檢查腳本（請確認權限）：$HEALTH_CHECK"
      return 2
    }
  fi

  local json_output exit_code
  json_output=$("$HEALTH_CHECK" --json 2>/dev/null) || exit_code=$?
  exit_code="${exit_code:-0}"

  # 儲存 JSON 報告
  local health_file="${HEALTH_DIR}/$(date '+%Y%m%d-%H%M%S').json"
  echo "$json_output" > "$health_file" 2>/dev/null || true

  echo "$json_output"
  return "$exit_code"
}

# ─── 分析 JSON 報告，產生摘要 ─────────────────────────────────────────────

summarize_issues() {
  local json_report="$1"
  local issues=""

  # 擷取失敗的檢查項目
  while IFS= read -r line; do
    local name status
    name=$(echo "$line" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"//;s/"//')
    status=$(echo "$line" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')

    if [ "$status" = "critical" ] || [ "$status" = "warning" ]; then
      local detail
      detail=$(echo "$line" | grep -o '"detail":"[^"]*"' | head -1 | sed 's/"detail":"//;s/"//')
      issues="${issues}  - ${name}: ${status} (${detail})\n"
    fi
  done < <(echo "$json_report" | grep -o '{[^}]*}' | grep '"status":"[^"]*"')

  echo -e "$issues"
}

# ─── 主程式 ───────────────────────────────────────────────────────────────

main() {
  init_directories
  acquire_lock

  log_info "開始監控檢查（PID: $$）"

  # 執行健康檢查並取得結果
  local json_output exit_code
  json_output=$(run_health_check) || exit_code=$?
  exit_code="${exit_code:-0}"

  # 取得整體狀態
  local overall_status
  case "$exit_code" in
    0) overall_status="healthy"  ;;
    1) overall_status="degraded" ;;
    2) overall_status="critical" ;;
    *) overall_status="unknown"  ;;
  esac

  log_info "健康檢查完成，整體狀態：${overall_status}（結束碼：${exit_code}）"

  # 分析問題
  local issues
  issues=$(summarize_issues "$json_output")

  # 根據狀態決定是否告警
  case "$exit_code" in
    0)
      log_info "所有服務正常，無需告警"
      ;;
    1)
      log_warning "偵測到降級狀態"
      if [ -n "$issues" ]; then
        log_warning "異常項目：\n$issues"
      fi

      if should_send_alert; then
        local alert_msg="TITAN 服務降級告警"
        if [ -n "$issues" ]; then
          alert_msg="${alert_msg} — 異常項目:\n${issues}"
        fi
        local alert_file="${ALERT_DIR}/$(date '+%Y%m%d-%H%M%S')-warning.alert"
        write_alert "warning" "服務部分降級，請確認以下項目：${issues}" "$json_output"
        send_notification "warning" "TITAN 服務降級" "$alert_file"
      fi
      ;;
    2)
      log_alert "偵測到嚴重異常！"
      if [ -n "$issues" ]; then
        log_alert "嚴重異常項目：\n$issues"
      fi

      if should_send_alert; then
        write_alert "critical" "嚴重服務中斷，請立即處理：${issues}" "$json_output"
        local latest_alert
        latest_alert=$(ls -t "${ALERT_DIR}"/*.alert 2>/dev/null | head -1 || echo "")
        if [ -n "$latest_alert" ]; then
          send_notification "critical" "TITAN 嚴重告警：服務中斷" "$latest_alert"
        fi
      fi
      ;;
  esac

  # 定期清理舊日誌
  cleanup_old_logs

  log_info "監控循環完成"
  return "$exit_code"
}

main "$@"
