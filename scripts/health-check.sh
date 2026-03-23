#!/usr/bin/env bash
# =============================================================================
# TITAN 服務健康檢查腳本
# 任務：T18 — Logging and Monitoring Setup
# 說明：檢查所有 TITAN 服務的健康狀態，支援彩色輸出與 JSON 模式
#
# 使用方式：
#   ./health-check.sh          # 彩色狀態報告
#   ./health-check.sh --json   # JSON 格式輸出（供自動化）
#   ./health-check.sh --quiet  # 靜默模式（只輸出結束碼）
#
# 結束碼：
#   0 = 全部健康 (Healthy)
#   1 = 部分降級 (Degraded)
#   2 = 嚴重異常 (Critical)
# =============================================================================

set -euo pipefail

# ─── 設定區 ────────────────────────────────────────────────────────────────

# 工具路徑（可從環境變數覆蓋）
DOCKER_CMD="${DOCKER_CMD:-docker}"
PSQL_CMD="${PSQL_CMD:-psql}"
REDIS_CLI_CMD="${REDIS_CLI_CMD:-redis-cli}"
CURL_CMD="${CURL_CMD:-curl}"

# 服務端點設定
HOMEPAGE_URL="${HOMEPAGE_URL:-http://localhost:3000}"
OUTLINE_URL="${OUTLINE_URL:-http://localhost:3001/_health}"
MINIO_URL="${MINIO_URL:-http://localhost:9000/minio/health/live}"
PLANE_URL="${PLANE_URL:-http://localhost:8082}"
UPTIME_KUMA_URL="${UPTIME_KUMA_URL:-http://localhost:3002}"

# PostgreSQL 設定
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-titan}"
POSTGRES_DB="${POSTGRES_DB:-titan}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# Redis 設定
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# 磁碟告警閾值（百分比）
DISK_WARNING_THRESHOLD="${DISK_WARNING_THRESHOLD:-75}"
DISK_CRITICAL_THRESHOLD="${DISK_CRITICAL_THRESHOLD:-90}"

# 記憶體告警閾值（百分比）
MEM_WARNING_THRESHOLD="${MEM_WARNING_THRESHOLD:-80}"
MEM_CRITICAL_THRESHOLD="${MEM_CRITICAL_THRESHOLD:-95}"

# Redis 記憶體告警閾值（百分比）
REDIS_MEM_WARNING_THRESHOLD="${REDIS_MEM_WARNING_THRESHOLD:-75}"
REDIS_MEM_CRITICAL_THRESHOLD="${REDIS_MEM_CRITICAL_THRESHOLD:-90}"

# HTTP 逾時（秒）
HTTP_TIMEOUT="${HTTP_TIMEOUT:-5}"

# ─── 顏色定義 ─────────────────────────────────────────────────────────────

if [ -t 1 ] && [ "${NO_COLOR:-}" = "" ]; then
  COLOR_RESET="\033[0m"
  COLOR_GREEN="\033[0;32m"
  COLOR_YELLOW="\033[0;33m"
  COLOR_RED="\033[0;31m"
  COLOR_CYAN="\033[0;36m"
  COLOR_BOLD="\033[1m"
  COLOR_DIM="\033[2m"
else
  COLOR_RESET=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_RED=""
  COLOR_CYAN=""
  COLOR_BOLD=""
  COLOR_DIM=""
fi

# ─── 模式旗標 ─────────────────────────────────────────────────────────────

JSON_MODE=false
QUIET_MODE=false

for arg in "$@"; do
  case "$arg" in
    --json)   JSON_MODE=true  ;;
    --quiet)  QUIET_MODE=true ;;
    --help|-h)
      echo "用法：$0 [--json] [--quiet]"
      echo ""
      echo "選項："
      echo "  --json   輸出 JSON 格式（供自動化使用）"
      echo "  --quiet  靜默模式，只顯示最終狀態並以結束碼回傳"
      echo ""
      echo "結束碼："
      echo "  0  全部健康 (Healthy)"
      echo "  1  部分降級 (Degraded)"
      echo "  2  嚴重異常 (Critical)"
      exit 0
      ;;
  esac
done

# ─── 全域狀態追蹤 ──────────────────────────────────────────────────────────

OVERALL_STATUS=0       # 0=健康, 1=降級, 2=嚴重
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
HOSTNAME_VAL="$(hostname 2>/dev/null || echo 'unknown')"

# JSON 結果陣列
declare -a JSON_RESULTS=()

# ─── 工具函式 ─────────────────────────────────────────────────────────────

# 更新整體狀態（只升級，不降級）
update_status() {
  local new_status="$1"
  if [ "$new_status" -gt "$OVERALL_STATUS" ]; then
    OVERALL_STATUS="$new_status"
  fi
}

# 輸出分隔線
print_separator() {
  if ! $JSON_MODE && ! $QUIET_MODE; then
    printf "${COLOR_DIM}%s${COLOR_RESET}\n" \
      "  ────────────────────────────────────────────────────"
  fi
}

# 輸出章節標題
print_section() {
  local title="$1"
  if ! $JSON_MODE && ! $QUIET_MODE; then
    echo ""
    printf "${COLOR_BOLD}${COLOR_CYAN}  ▶ %s${COLOR_RESET}\n" "$title"
    print_separator
  fi
}

# 輸出狀態行
print_status() {
  local name="$1"
  local status="$2"      # healthy / warning / critical / unknown
  local detail="${3:-}"

  if $JSON_MODE || $QUIET_MODE; then
    return
  fi

  local icon color
  case "$status" in
    healthy)  icon="✓"; color="$COLOR_GREEN"  ;;
    warning)  icon="⚠"; color="$COLOR_YELLOW" ;;
    critical) icon="✗"; color="$COLOR_RED"    ;;
    *)        icon="?"; color="$COLOR_DIM"    ;;
  esac

  printf "  ${color}%s${COLOR_RESET}  %-28s %s\n" \
    "$icon" "$name" "${detail:+${COLOR_DIM}${detail}${COLOR_RESET}}"
}

# 加入 JSON 結果
append_json() {
  local name="$1"
  local category="$2"
  local status="$3"
  local detail="${4:-}"

  JSON_RESULTS+=("{\"name\":\"${name}\",\"category\":\"${category}\",\"status\":\"${status}\",\"detail\":\"${detail}\"}")
}

# ─── 系統資源檢查 ─────────────────────────────────────────────────────────

check_system_resources() {
  print_section "系統資源"

  # ── CPU 使用率 ──
  local cpu_usage cpu_status cpu_detail
  if command -v top &>/dev/null; then
    # 取得 1 秒平均 CPU idle 百分比
    cpu_idle=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $8}' | tr -d '%,' 2>/dev/null || echo "")
    if [ -z "$cpu_idle" ]; then
      # macOS / 替代方式
      cpu_idle=$(top -l 1 -n 0 2>/dev/null | grep "CPU usage" | awk '{print $7}' | tr -d '%' 2>/dev/null || echo "0")
    fi
    if [ -n "$cpu_idle" ] && [ "$cpu_idle" != "0" ]; then
      cpu_usage=$(echo "100 - $cpu_idle" | bc 2>/dev/null | xargs printf "%.0f" || echo "N/A")
    else
      # 從 /proc/stat 計算（Linux）
      if [ -f /proc/stat ]; then
        local stat1 stat2
        stat1=$(cat /proc/stat | grep "^cpu " | awk '{idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; print idle, total}')
        sleep 0.5
        stat2=$(cat /proc/stat | grep "^cpu " | awk '{idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; print idle, total}')
        local idle1 total1 idle2 total2
        idle1=$(echo "$stat1" | awk '{print $1}')
        total1=$(echo "$stat1" | awk '{print $2}')
        idle2=$(echo "$stat2" | awk '{print $1}')
        total2=$(echo "$stat2" | awk '{print $2}')
        local delta_idle delta_total
        delta_idle=$((idle2 - idle1))
        delta_total=$((total2 - total1))
        if [ "$delta_total" -gt 0 ]; then
          cpu_usage=$(echo "scale=0; 100 * ($delta_total - $delta_idle) / $delta_total" | bc 2>/dev/null || echo "N/A")
        else
          cpu_usage="N/A"
        fi
      else
        cpu_usage="N/A"
      fi
    fi
  else
    cpu_usage="N/A"
  fi

  if [ "$cpu_usage" = "N/A" ]; then
    cpu_status="unknown"
    cpu_detail="無法取得 CPU 資訊"
  elif [ "$cpu_usage" -ge 90 ] 2>/dev/null; then
    cpu_status="critical"
    cpu_detail="${cpu_usage}%（嚴重：≥90%）"
    update_status 2
  elif [ "$cpu_usage" -ge 75 ] 2>/dev/null; then
    cpu_status="warning"
    cpu_detail="${cpu_usage}%（警告：≥75%）"
    update_status 1
  else
    cpu_status="healthy"
    cpu_detail="${cpu_usage}%"
  fi
  print_status "CPU 使用率" "$cpu_status" "$cpu_detail"
  append_json "CPU 使用率" "system" "$cpu_status" "$cpu_detail"

  # ── 記憶體使用率 ──
  local mem_usage mem_status mem_detail
  if command -v free &>/dev/null; then
    mem_usage=$(free 2>/dev/null | awk '/^Mem:/ {printf "%.0f", $3/$2*100}' || echo "N/A")
  elif [ -f /proc/meminfo ]; then
    local mem_total mem_avail
    mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    mem_avail=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    if [ -n "$mem_total" ] && [ "$mem_total" -gt 0 ]; then
      mem_usage=$(echo "scale=0; 100 * ($mem_total - $mem_avail) / $mem_total" | bc 2>/dev/null || echo "N/A")
    else
      mem_usage="N/A"
    fi
  else
    mem_usage="N/A"
  fi

  if [ "$mem_usage" = "N/A" ]; then
    mem_status="unknown"
    mem_detail="無法取得記憶體資訊"
  elif [ "$mem_usage" -ge "$MEM_CRITICAL_THRESHOLD" ] 2>/dev/null; then
    mem_status="critical"
    mem_detail="${mem_usage}%（嚴重：≥${MEM_CRITICAL_THRESHOLD}%）"
    update_status 2
  elif [ "$mem_usage" -ge "$MEM_WARNING_THRESHOLD" ] 2>/dev/null; then
    mem_status="warning"
    mem_detail="${mem_usage}%（警告：≥${MEM_WARNING_THRESHOLD}%）"
    update_status 1
  else
    mem_status="healthy"
    mem_detail="${mem_usage}%"
  fi
  print_status "記憶體使用率" "$mem_status" "$mem_detail"
  append_json "記憶體使用率" "system" "$mem_status" "$mem_detail"

  # ── 磁碟使用率 ──
  local disk_usage disk_status disk_detail
  disk_usage=$(df / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo "N/A")

  if [ "$disk_usage" = "N/A" ]; then
    disk_status="unknown"
    disk_detail="無法取得磁碟資訊"
  elif [ "$disk_usage" -ge "$DISK_CRITICAL_THRESHOLD" ] 2>/dev/null; then
    disk_status="critical"
    disk_detail="${disk_usage}%（嚴重：≥${DISK_CRITICAL_THRESHOLD}%）"
    update_status 2
  elif [ "$disk_usage" -ge "$DISK_WARNING_THRESHOLD" ] 2>/dev/null; then
    disk_status="warning"
    disk_detail="${disk_usage}%（警告：≥${DISK_WARNING_THRESHOLD}%）"
    update_status 1
  else
    disk_status="healthy"
    disk_detail="${disk_usage}%"
  fi
  print_status "磁碟使用率 (/)" "$disk_status" "$disk_detail"
  append_json "磁碟使用率 (/)" "system" "$disk_status" "$disk_detail"

  # ── 磁碟 /var/log/titan ──
  local log_dir_status log_dir_detail
  if [ -d /var/log/titan ]; then
    local log_disk
    log_disk=$(df /var/log/titan 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo "N/A")
    if [ "$log_disk" = "N/A" ]; then
      log_dir_status="unknown"
      log_dir_detail="無法取得"
    elif [ "$log_disk" -ge "$DISK_CRITICAL_THRESHOLD" ] 2>/dev/null; then
      log_dir_status="critical"
      log_dir_detail="${log_disk}%（嚴重）"
      update_status 2
    elif [ "$log_disk" -ge "$DISK_WARNING_THRESHOLD" ] 2>/dev/null; then
      log_dir_status="warning"
      log_dir_detail="${log_disk}%（警告）"
      update_status 1
    else
      log_dir_status="healthy"
      log_dir_detail="${log_disk}%"
    fi
  else
    log_dir_status="warning"
    log_dir_detail="目錄不存在（/var/log/titan）"
    update_status 1
  fi
  print_status "磁碟使用率 (日誌)" "$log_dir_status" "$log_dir_detail"
  append_json "磁碟使用率 (日誌)" "system" "$log_dir_status" "$log_dir_detail"
}

# ─── HTTP 服務檢查 ─────────────────────────────────────────────────────────

check_http_endpoint() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"

  local status detail
  if ! command -v "$CURL_CMD" &>/dev/null; then
    status="unknown"
    detail="curl 不可用"
  else
    local start_time end_time response_code elapsed
    start_time=$(date +%s%N 2>/dev/null || date +%s)
    response_code=$(
      "$CURL_CMD" -sS -o /dev/null \
        -w "%{http_code}" \
        --connect-timeout "$HTTP_TIMEOUT" \
        --max-time "$HTTP_TIMEOUT" \
        "$url" 2>/dev/null || echo "000"
    )
    end_time=$(date +%s%N 2>/dev/null || date +%s)

    # 計算回應時間（毫秒）
    if [[ "$start_time" =~ ^[0-9]+$ ]] && [[ "$end_time" =~ ^[0-9]+$ ]]; then
      if [ ${#start_time} -gt 10 ]; then
        elapsed=$(( (end_time - start_time) / 1000000 ))
        elapsed_str="${elapsed}ms"
      else
        elapsed=$(( end_time - start_time ))
        elapsed_str="${elapsed}s"
      fi
    else
      elapsed_str="N/A"
    fi

    if [ "$response_code" = "000" ]; then
      status="critical"
      detail="連線失敗（${url}）"
      update_status 2
    elif [ "$response_code" = "$expected_code" ]; then
      status="healthy"
      detail="HTTP ${response_code}（${elapsed_str}）"
    else
      status="warning"
      detail="HTTP ${response_code}，預期 ${expected_code}（${elapsed_str}）"
      update_status 1
    fi
  fi

  print_status "$name" "$status" "$detail"
  append_json "$name" "http" "$status" "$detail"
}

check_http_services() {
  print_section "HTTP 服務端點"

  check_http_endpoint "Homepage"     "$HOMEPAGE_URL"    "200"
  check_http_endpoint "Outline"      "$OUTLINE_URL"     "200"
  check_http_endpoint "MinIO API"    "$MINIO_URL"       "200"
  check_http_endpoint "Plane"        "$PLANE_URL"       "200"
  check_http_endpoint "Uptime Kuma"  "$UPTIME_KUMA_URL" "200"
}

# ─── Docker 容器狀態檢查 ────────────────────────────────────────────────────

check_docker_container() {
  local container_name="$1"
  local critical="${2:-true}"  # 是否為關鍵服務

  local status detail
  if ! command -v "$DOCKER_CMD" &>/dev/null; then
    status="unknown"
    detail="docker 不可用"
  elif ! "$DOCKER_CMD" info &>/dev/null 2>&1; then
    status="critical"
    detail="Docker daemon 未運行"
    update_status 2
  else
    local container_status
    container_status=$(
      "$DOCKER_CMD" inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \
        "$container_name" 2>/dev/null || echo "not-found"
    )

    if [ "$container_status" = "not-found" ]; then
      if [ "$critical" = "true" ]; then
        status="critical"
        update_status 2
      else
        status="warning"
        update_status 1
      fi
      detail="容器不存在"
    else
      local run_state health_state
      run_state="${container_status%%/*}"
      health_state="${container_status##*/}"

      case "$run_state" in
        running)
          case "$health_state" in
            healthy)          status="healthy";  detail="運行中，健康" ;;
            unhealthy)        status="critical"; detail="運行中，健康檢查失敗"; update_status 2 ;;
            starting)         status="warning";  detail="運行中，啟動中"; update_status 1 ;;
            no-healthcheck)   status="healthy";  detail="運行中（無健康檢查）" ;;
            *)                status="warning";  detail="運行中，狀態未知（${health_state}）"; update_status 1 ;;
          esac
          ;;
        exited|stopped)
          if [ "$critical" = "true" ]; then
            status="critical"; update_status 2
          else
            status="warning"; update_status 1
          fi
          detail="容器已停止（${run_state}）"
          ;;
        restarting)
          status="warning"; detail="容器重啟中"; update_status 1 ;;
        *)
          status="warning"; detail="未知狀態（${run_state}）"; update_status 1 ;;
      esac
    fi
  fi

  print_status "$container_name" "$status" "$detail"
  append_json "$container_name" "container" "$status" "$detail"
}

check_docker_containers() {
  print_section "Docker 容器狀態"

  # 關鍵服務（容器不存在 = Critical）
  check_docker_container "titan-postgres"     "true"
  check_docker_container "titan-redis"        "true"
  check_docker_container "titan-minio"        "true"
  check_docker_container "titan-outline"      "true"

  # 輔助服務（容器不存在 = Warning）
  check_docker_container "titan-homepage"     "false"
  check_docker_container "titan-uptime-kuma"  "false"

  # Plane 服務（獨立 compose，可能不存在）
  check_docker_container "plane-proxy"        "false"
  check_docker_container "plane-web"          "false"
  check_docker_container "plane-api"          "false"
}

# ─── PostgreSQL 連線檢查 ───────────────────────────────────────────────────

check_postgresql() {
  print_section "PostgreSQL 資料庫"

  local status detail

  # 先嘗試 TCP 連線
  if command -v nc &>/dev/null; then
    if ! nc -z -w3 "$POSTGRES_HOST" "$POSTGRES_PORT" &>/dev/null 2>&1; then
      print_status "PostgreSQL 連線" "critical" "無法連線至 ${POSTGRES_HOST}:${POSTGRES_PORT}"
      append_json "PostgreSQL 連線" "database" "critical" "無法連線至 ${POSTGRES_HOST}:${POSTGRES_PORT}"
      update_status 2
      return
    fi
  fi

  # 嘗試透過 Docker exec 執行 pg_isready
  local pg_check_result
  if command -v "$DOCKER_CMD" &>/dev/null && \
     "$DOCKER_CMD" inspect titan-postgres &>/dev/null 2>&1; then
    pg_check_result=$(
      "$DOCKER_CMD" exec titan-postgres \
        pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>&1 || echo "FAILED"
    )

    if echo "$pg_check_result" | grep -q "accepting connections"; then
      status="healthy"
      detail="接受連線（${POSTGRES_USER}@${POSTGRES_DB}）"
    else
      status="critical"
      detail="$pg_check_result"
      update_status 2
    fi
    print_status "PostgreSQL 連線" "$status" "$detail"
    append_json "PostgreSQL 連線" "database" "$status" "$detail"

    # 連線數檢查
    local conn_info conn_status conn_detail
    conn_info=$(
      "$DOCKER_CMD" exec titan-postgres \
        psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
        "SELECT current_setting('max_connections')::int AS max, count(*) AS used FROM pg_stat_activity;" \
        2>/dev/null || echo ""
    )

    if [ -n "$conn_info" ]; then
      local max_conn used_conn usage_pct
      max_conn=$(echo "$conn_info" | awk '{print $1}' | tr -d ' ')
      used_conn=$(echo "$conn_info" | awk '{print $3}' | tr -d ' ')
      if [ -n "$max_conn" ] && [ "$max_conn" -gt 0 ] 2>/dev/null; then
        usage_pct=$(( used_conn * 100 / max_conn ))
        if [ "$usage_pct" -ge 90 ]; then
          conn_status="critical"; update_status 2
        elif [ "$usage_pct" -ge 70 ]; then
          conn_status="warning"; update_status 1
        else
          conn_status="healthy"
        fi
        conn_detail="${used_conn}/${max_conn}（${usage_pct}%）"
      else
        conn_status="unknown"
        conn_detail="無法取得連線數"
      fi
      print_status "PostgreSQL 連線數" "$conn_status" "$conn_detail"
      append_json "PostgreSQL 連線數" "database" "$conn_status" "$conn_detail"
    fi
  elif command -v "$PSQL_CMD" &>/dev/null && [ -n "$POSTGRES_PASSWORD" ]; then
    # 直接使用 psql
    export PGPASSWORD="$POSTGRES_PASSWORD"
    if "$PSQL_CMD" -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
       -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -c "SELECT 1;" &>/dev/null 2>&1; then
      status="healthy"
      detail="連線成功"
    else
      status="critical"
      detail="連線失敗"
      update_status 2
    fi
    print_status "PostgreSQL 連線" "$status" "$detail"
    append_json "PostgreSQL 連線" "database" "$status" "$detail"
    unset PGPASSWORD
  else
    print_status "PostgreSQL 連線" "unknown" "無法執行檢查（缺少工具或密碼）"
    append_json "PostgreSQL 連線" "database" "unknown" "無法執行檢查"
  fi
}

# ─── Redis 記憶體檢查 ──────────────────────────────────────────────────────

check_redis() {
  print_section "Redis 快取"

  local status detail

  # 先嘗試 TCP 連線
  if command -v nc &>/dev/null; then
    if ! nc -z -w3 "$REDIS_HOST" "$REDIS_PORT" &>/dev/null 2>&1; then
      print_status "Redis 連線" "critical" "無法連線至 ${REDIS_HOST}:${REDIS_PORT}"
      append_json "Redis 連線" "cache" "critical" "無法連線至 ${REDIS_HOST}:${REDIS_PORT}"
      update_status 2
      return
    fi
  fi

  # 透過 Docker exec 執行 redis-cli
  local redis_info
  if command -v "$DOCKER_CMD" &>/dev/null && \
     "$DOCKER_CMD" inspect titan-redis &>/dev/null 2>&1; then

    # Ping 測試
    local ping_result
    ping_result=$(
      "$DOCKER_CMD" exec titan-redis \
        redis-cli ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
        --no-auth-warning ping 2>/dev/null || echo "FAILED"
    )

    if [ "$ping_result" = "PONG" ]; then
      print_status "Redis Ping" "healthy" "PONG"
      append_json "Redis Ping" "cache" "healthy" "PONG"
    else
      print_status "Redis Ping" "critical" "無回應（$ping_result）"
      append_json "Redis Ping" "cache" "critical" "無回應"
      update_status 2
      return
    fi

    # 記憶體資訊
    redis_info=$(
      "$DOCKER_CMD" exec titan-redis \
        redis-cli ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
        --no-auth-warning info memory 2>/dev/null || echo ""
    )

    if [ -n "$redis_info" ]; then
      local used_mem max_mem used_bytes max_bytes mem_pct

      used_bytes=$(echo "$redis_info" | grep "^used_memory:" | awk -F: '{print $2}' | tr -d '[:space:]')
      max_bytes=$(echo "$redis_info" | grep "^maxmemory:" | awk -F: '{print $2}' | tr -d '[:space:]')

      # 轉換為人類可讀格式
      if [ -n "$used_bytes" ] && [ "$used_bytes" -gt 0 ] 2>/dev/null; then
        used_mem=$(awk "BEGIN {printf \"%.1f MB\", $used_bytes/1048576}")
      else
        used_mem="N/A"
      fi

      if [ -n "$max_bytes" ] && [ "$max_bytes" -gt 0 ] 2>/dev/null; then
        max_mem=$(awk "BEGIN {printf \"%.1f MB\", $max_bytes/1048576}")
        mem_pct=$(awk "BEGIN {printf \"%.0f\", $used_bytes*100/$max_bytes}")

        if [ "$mem_pct" -ge "$REDIS_MEM_CRITICAL_THRESHOLD" ] 2>/dev/null; then
          status="critical"; update_status 2
        elif [ "$mem_pct" -ge "$REDIS_MEM_WARNING_THRESHOLD" ] 2>/dev/null; then
          status="warning"; update_status 1
        else
          status="healthy"
        fi
        detail="${used_mem} / ${max_mem}（${mem_pct}%）"
      else
        status="healthy"
        detail="${used_mem}（未設定 maxmemory）"
      fi

      print_status "Redis 記憶體" "$status" "$detail"
      append_json "Redis 記憶體" "cache" "$status" "$detail"
    fi

    # 連線數
    local client_info connected_clients
    client_info=$(
      "$DOCKER_CMD" exec titan-redis \
        redis-cli ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
        --no-auth-warning info clients 2>/dev/null || echo ""
    )
    connected_clients=$(echo "$client_info" | grep "^connected_clients:" | awk -F: '{print $2}' | tr -d '[:space:]')
    if [ -n "$connected_clients" ]; then
      print_status "Redis 連線數" "healthy" "${connected_clients} 個連線"
      append_json "Redis 連線數" "cache" "healthy" "${connected_clients} 個連線"
    fi

  elif command -v "$REDIS_CLI_CMD" &>/dev/null; then
    # 直接使用 redis-cli
    local ping_result
    ping_result=$(
      "$REDIS_CLI_CMD" -h "$REDIS_HOST" -p "$REDIS_PORT" \
        ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
        --no-auth-warning ping 2>/dev/null || echo "FAILED"
    )
    if [ "$ping_result" = "PONG" ]; then
      print_status "Redis Ping" "healthy" "PONG"
      append_json "Redis Ping" "cache" "healthy" "PONG"
    else
      print_status "Redis Ping" "critical" "無回應"
      append_json "Redis Ping" "cache" "critical" "無回應"
      update_status 2
    fi
  else
    print_status "Redis 連線" "unknown" "無法執行檢查（缺少工具）"
    append_json "Redis 連線" "cache" "unknown" "無法執行檢查"
  fi
}

# ─── 輸出報告 ─────────────────────────────────────────────────────────────

print_report_header() {
  if $JSON_MODE || $QUIET_MODE; then
    return
  fi

  local width=56
  local title="TITAN 健康狀態報告"
  local ts_line="$TIMESTAMP"

  echo ""
  printf "${COLOR_BOLD}${COLOR_CYAN}"
  printf "  ╔%${width}s╗\n" | tr ' ' '═'
  printf "  ║  %-$((width-2))s║\n" "$title"
  printf "  ║  %-$((width-2))s║\n" "主機：${HOSTNAME_VAL}"
  printf "  ║  %-$((width-2))s║\n" "時間：${ts_line}"
  printf "  ╚%${width}s╝\n" | tr ' ' '═'
  printf "${COLOR_RESET}"
}

print_report_footer() {
  if $QUIET_MODE; then
    local status_text
    case "$OVERALL_STATUS" in
      0) status_text="全部健康 (Healthy)" ;;
      1) status_text="部分降級 (Degraded)" ;;
      2) status_text="嚴重異常 (Critical)" ;;
    esac
    echo "整體狀態：$status_text（結束碼 $OVERALL_STATUS）"
    return
  fi

  if $JSON_MODE; then
    return
  fi

  echo ""
  local status_text status_color

  case "$OVERALL_STATUS" in
    0)
      status_text="✓ 全部健康 (Healthy)"
      status_color="$COLOR_GREEN"
      ;;
    1)
      status_text="⚠ 部分降級 (Degraded)"
      status_color="$COLOR_YELLOW"
      ;;
    2)
      status_text="✗ 嚴重異常 (Critical)"
      status_color="$COLOR_RED"
      ;;
  esac

  printf "${COLOR_BOLD}${COLOR_CYAN}"
  printf "  ╔%56s╗\n" | tr ' ' '═'
  printf "  ║  ${status_color}%-54s${COLOR_BOLD}${COLOR_CYAN}║\n" "$status_text"
  printf "  ╚%56s╝\n" | tr ' ' '═'
  printf "${COLOR_RESET}"
  echo ""
}

output_json() {
  if ! $JSON_MODE; then
    return
  fi

  # 判斷整體狀態文字
  local overall_text
  case "$OVERALL_STATUS" in
    0) overall_text="healthy" ;;
    1) overall_text="degraded" ;;
    2) overall_text="critical" ;;
  esac

  # 組合 JSON
  printf '{\n'
  printf '  "timestamp": "%s",\n' "$TIMESTAMP"
  printf '  "hostname": "%s",\n' "$HOSTNAME_VAL"
  printf '  "overall_status": "%s",\n' "$overall_text"
  printf '  "exit_code": %d,\n' "$OVERALL_STATUS"
  printf '  "checks": [\n'

  local count="${#JSON_RESULTS[@]}"
  for i in "${!JSON_RESULTS[@]}"; do
    if [ "$((i+1))" -lt "$count" ]; then
      printf '    %s,\n' "${JSON_RESULTS[$i]}"
    else
      printf '    %s\n' "${JSON_RESULTS[$i]}"
    fi
  done

  printf '  ]\n'
  printf '}\n'
}

# ─── 主程式 ───────────────────────────────────────────────────────────────

main() {
  print_report_header
  check_system_resources
  check_http_services
  check_docker_containers
  check_postgresql
  check_redis
  print_report_footer
  output_json

  exit "$OVERALL_STATUS"
}

main "$@"
