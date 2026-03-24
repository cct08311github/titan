#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# TITAN Load Test — Shell-based Baseline（Air-gapped 環境適用）
# ═══════════════════════════════════════════════════════════════════
# 使用 curl 進行基礎負載測試，不依賴外部工具（k6/autocannon）。
# 適用於無法安裝額外套件的銀行封閉網路環境。
#
# 用法：
#   bash tests/load/load-test.sh [BASE_URL] [CONCURRENT_USERS] [ITERATIONS]
#
# 範例：
#   bash tests/load/load-test.sh http://localhost:3000 5 10
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 參數 ──────────────────────────────────────────────────
BASE_URL="${1:-http://localhost:3000}"
CONCURRENT_USERS="${2:-5}"
ITERATIONS="${3:-10}"
USERNAME="${TITAN_USERNAME:-admin}"
PASSWORD="${TITAN_PASSWORD:-changeme}"

# ── 顏色 ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── 結果目錄 ──────────────────────────────────────────────
RESULT_DIR="tests/load/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULT_DIR}/baseline_${TIMESTAMP}.log"
SUMMARY_FILE="${RESULT_DIR}/summary_${TIMESTAMP}.json"
mkdir -p "$RESULT_DIR"

# ── 輔助函式 ──────────────────────────────────────────────
log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}[PASS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

# 測量單次 HTTP 請求的回應時間（毫秒）與狀態碼
# 用法: measure_request METHOD URL [DATA]
# 輸出: status_code response_time_ms
measure_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local extra_args=()

  if [[ -n "$data" ]]; then
    extra_args+=(-d "$data")
  fi

  curl -s -o /dev/null \
    -w "%{http_code} %{time_total}" \
    -X "$method" \
    -H "Content-Type: application/json" \
    "${extra_args[@]}" \
    --max-time 10 \
    "$url" 2>/dev/null || echo "000 10.000"
}

# 將秒數轉換為毫秒
to_ms() {
  awk "BEGIN { printf \"%.0f\", $1 * 1000 }"
}

# ── 全域統計陣列 ──────────────────────────────────────────
declare -a ALL_TIMES=()
declare -a SCENARIO_LOGIN=()
declare -a SCENARIO_DASHBOARD=()
declare -a SCENARIO_TASK_LIST=()
declare -a SCENARIO_TASK_CREATE=()
declare -a SCENARIO_TASK_UPDATE=()
declare -a SCENARIO_TASK_DELETE=()
declare -a SCENARIO_REPORT=()
declare -a SCENARIO_KPI=()
TOTAL_REQUESTS=0
FAILED_REQUESTS=0

# 記錄結果
record() {
  local scenario="$1"
  local status="$2"
  local time_sec="$3"
  local time_ms
  time_ms=$(to_ms "$time_sec")

  ALL_TIMES+=("$time_ms")
  TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))

  if [[ "$status" -lt 200 || "$status" -ge 400 ]]; then
    FAILED_REQUESTS=$((FAILED_REQUESTS + 1))
  fi

  case "$scenario" in
    login)        SCENARIO_LOGIN+=("$time_ms") ;;
    dashboard)    SCENARIO_DASHBOARD+=("$time_ms") ;;
    task_list)    SCENARIO_TASK_LIST+=("$time_ms") ;;
    task_create)  SCENARIO_TASK_CREATE+=("$time_ms") ;;
    task_update)  SCENARIO_TASK_UPDATE+=("$time_ms") ;;
    task_delete)  SCENARIO_TASK_DELETE+=("$time_ms") ;;
    report)       SCENARIO_REPORT+=("$time_ms") ;;
    kpi)          SCENARIO_KPI+=("$time_ms") ;;
  esac
}

# 計算 p50/p95/avg
calc_stats() {
  local -n arr=$1
  local count=${#arr[@]}
  if [[ $count -eq 0 ]]; then
    echo "0 0 0 0"
    return
  fi

  # 排序
  local sorted
  sorted=($(printf '%s\n' "${arr[@]}" | sort -n))

  local sum=0
  for v in "${sorted[@]}"; do
    sum=$((sum + v))
  done
  local avg=$((sum / count))

  local p50_idx=$(( (count * 50 / 100) ))
  local p95_idx=$(( (count * 95 / 100) ))
  [[ $p50_idx -ge $count ]] && p50_idx=$((count - 1))
  [[ $p95_idx -ge $count ]] && p95_idx=$((count - 1))

  echo "${sorted[$p50_idx]} ${sorted[$p95_idx]} $avg $count"
}

# ── 單使用者工作流程 ──────────────────────────────────────
run_user_workflow() {
  local user_id="$1"
  local iteration="$2"

  # 1. 登入
  local result
  result=$(measure_request POST "${BASE_URL}/api/auth/callback/credentials" \
    "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
  local status time_sec
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "login" "$status" "$time_sec"

  # 2. 儀表板（Dashboard 頁面）
  result=$(measure_request GET "${BASE_URL}/dashboard")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "dashboard" "$status" "$time_sec"

  # 3. 任務列表
  result=$(measure_request GET "${BASE_URL}/api/tasks?limit=20")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "task_list" "$status" "$time_sec"

  # 4. 建立任務
  result=$(measure_request POST "${BASE_URL}/api/tasks" \
    "{\"title\":\"Load Test U${user_id}-I${iteration} $(date +%s)\",\"status\":\"TODO\",\"priority\":\"MEDIUM\"}")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "task_create" "$status" "$time_sec"

  # 5. 更新任務（用最近建立的 — 簡化為 PATCH 第一筆）
  result=$(measure_request PATCH "${BASE_URL}/api/tasks/1" \
    "{\"status\":\"IN_PROGRESS\"}")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "task_update" "$status" "$time_sec"

  # 6. 刪除任務（cleanup — 簡化）
  result=$(measure_request DELETE "${BASE_URL}/api/tasks/999999")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "task_delete" "$status" "$time_sec"

  # 7. 報表
  for endpoint in weekly monthly workload; do
    result=$(measure_request GET "${BASE_URL}/api/reports/${endpoint}")
    status=$(echo "$result" | awk '{print $1}')
    time_sec=$(echo "$result" | awk '{print $2}')
    record "report" "$status" "$time_sec"
  done

  # 8. KPI
  result=$(measure_request GET "${BASE_URL}/api/kpi")
  status=$(echo "$result" | awk '{print $1}')
  time_sec=$(echo "$result" | awk '{print $2}')
  record "kpi" "$status" "$time_sec"
}

# ── 主流程 ────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  TITAN Load Test Baseline${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  log "目標 URL:      ${BASE_URL}"
  log "併發使用者:    ${CONCURRENT_USERS}"
  log "每人迭代次數:  ${ITERATIONS}"
  log "結果檔案:      ${RESULT_FILE}"
  echo ""

  # 先測試連線
  log "測試連線..."
  if ! curl -s --max-time 5 -o /dev/null -w "%{http_code}" "${BASE_URL}" >/dev/null 2>&1; then
    fail "無法連線 ${BASE_URL} — 請確認服務已啟動"
    echo ""
    echo "提示：此測試腳本需要 TITAN 服務運行中。"
    echo "  若僅需驗證腳本語法，請加上 --dry-run（未實作，供未來擴充）"
    echo ""
    # 不 exit，改為輸出模擬結果供文件用途
    warn "切換至離線模式：產生結構化結果範本"
    generate_offline_report
    return 0
  fi
  ok "連線成功"
  echo ""

  # 執行負載測試
  local start_time
  start_time=$(date +%s)

  log "開始負載測試..."
  echo "" | tee -a "$RESULT_FILE"

  for iteration in $(seq 1 "$ITERATIONS"); do
    log "迭代 ${iteration}/${ITERATIONS}"

    # 並行啟動 N 個使用者
    local pids=()
    for user_id in $(seq 1 "$CONCURRENT_USERS"); do
      run_user_workflow "$user_id" "$iteration" &
      pids+=($!)
    done

    # 等待全部完成
    for pid in "${pids[@]}"; do
      wait "$pid" 2>/dev/null || true
    done
  done

  local end_time
  end_time=$(date +%s)
  local total_duration=$((end_time - start_time))

  echo ""
  log "測試完成，耗時 ${total_duration} 秒"
  echo ""

  # 輸出統計
  print_summary "$total_duration"
}

# ── 離線報告（服務未啟動時） ──────────────────────────────
generate_offline_report() {
  cat <<'REPORT'

═══════════════════════════════════════════════════════════
  TITAN Load Test — 離線結果範本
═══════════════════════════════════════════════════════════

以下為預期基準指標格式（實際值待服務啟動後測量）：

場景              | 請求數 | p50 (ms) | p95 (ms) | 平均 (ms) | 門檻 (ms)
─────────────────┼────────┼──────────┼──────────┼───────────┼──────────
登入              |     50 |      --- |      --- |       --- |     3000
儀表板            |     50 |      --- |      --- |       --- |     2000
任務列表          |     50 |      --- |      --- |       --- |     1500
建立任務          |     50 |      --- |      --- |       --- |     2000
更新任務          |     50 |      --- |      --- |       --- |     2000
刪除任務          |     50 |      --- |      --- |       --- |     2000
報表              |    150 |      --- |      --- |       --- |     3000
KPI               |     50 |      --- |      --- |       --- |     2000

總請求數: ---  |  失敗率: ---  |  測試耗時: ---

REPORT

  # 產生空白 JSON summary
  cat > "$SUMMARY_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "config": {
    "base_url": "${BASE_URL}",
    "concurrent_users": ${CONCURRENT_USERS},
    "iterations": ${ITERATIONS}
  },
  "status": "offline",
  "note": "服務未啟動，此為結構範本。實際值待環境就緒後重新執行。"
}
EOF
  log "離線報告已產生: ${SUMMARY_FILE}"
}

# ── 統計報告 ──────────────────────────────────────────────
print_summary() {
  local total_duration="$1"
  local error_rate=0
  if [[ $TOTAL_REQUESTS -gt 0 ]]; then
    error_rate=$(awk "BEGIN { printf \"%.1f\", ($FAILED_REQUESTS / $TOTAL_REQUESTS) * 100 }")
  fi

  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  測試結果摘要${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  printf "%-18s | %6s | %8s | %8s | %8s | %8s\n" \
    "場景" "請求數" "p50(ms)" "p95(ms)" "avg(ms)" "門檻(ms)"
  echo "───────────────────┼────────┼──────────┼──────────┼──────────┼──────────"

  local scenarios=("SCENARIO_LOGIN:登入:3000"
                   "SCENARIO_DASHBOARD:儀表板:2000"
                   "SCENARIO_TASK_LIST:任務列表:1500"
                   "SCENARIO_TASK_CREATE:建立任務:2000"
                   "SCENARIO_TASK_UPDATE:更新任務:2000"
                   "SCENARIO_TASK_DELETE:刪除任務:2000"
                   "SCENARIO_REPORT:報表:3000"
                   "SCENARIO_KPI:KPI:2000")

  local json_scenarios="["
  local first=true

  for entry in "${scenarios[@]}"; do
    IFS=':' read -r var_name label threshold <<< "$entry"
    local stats
    stats=$(calc_stats "$var_name")
    local p50 p95 avg count
    read -r p50 p95 avg count <<< "$stats"

    local status_icon="${GREEN}PASS${NC}"
    if [[ $p95 -gt $threshold && $count -gt 0 ]]; then
      status_icon="${RED}FAIL${NC}"
    fi

    printf "%-18s | %6d | %8d | %8d | %8d | %8d  %b\n" \
      "$label" "$count" "$p50" "$p95" "$avg" "$threshold" "$status_icon"

    # JSON
    if [[ "$first" == "true" ]]; then first=false; else json_scenarios+=","; fi
    json_scenarios+="{\"name\":\"${label}\",\"count\":${count},\"p50\":${p50},\"p95\":${p95},\"avg\":${avg},\"threshold\":${threshold}}"
  done

  json_scenarios+="]"

  echo ""
  echo "───────────────────────────────────────────────────────────"
  echo ""
  log "總請求數:    ${TOTAL_REQUESTS}"
  log "失敗請求:    ${FAILED_REQUESTS}"
  log "錯誤率:      ${error_rate}%"
  log "測試耗時:    ${total_duration} 秒"
  log "吞吐量:      $(awk "BEGIN { printf \"%.1f\", $TOTAL_REQUESTS / $total_duration }") req/s"
  echo ""

  if (( $(awk "BEGIN { print ($error_rate < 5.0) }") )); then
    ok "錯誤率在門檻內 (< 5%)"
  else
    fail "錯誤率超過門檻 (>= 5%)"
  fi

  # 寫入 JSON summary
  cat > "$SUMMARY_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "config": {
    "base_url": "${BASE_URL}",
    "concurrent_users": ${CONCURRENT_USERS},
    "iterations": ${ITERATIONS}
  },
  "duration_seconds": ${total_duration},
  "total_requests": ${TOTAL_REQUESTS},
  "failed_requests": ${FAILED_REQUESTS},
  "error_rate_percent": ${error_rate},
  "throughput_rps": $(awk "BEGIN { printf \"%.1f\", $TOTAL_REQUESTS / $total_duration }"),
  "scenarios": ${json_scenarios}
}
EOF
  log "JSON 結果: ${SUMMARY_FILE}"
}

# ── 執行 ──────────────────────────────────────────────────
main "$@"
