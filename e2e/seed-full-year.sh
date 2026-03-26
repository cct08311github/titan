#!/bin/bash
# TITAN Full-Year Data Seed Script
# Seeds realistic department data for comprehensive QA testing
#
# Usage: bash e2e/seed-full-year.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://mac-mini.tailde842d.ts.net:3100}"
JAR="/tmp/titan-seed-jar.txt"

# ─── Auth ─────────────────────────────────────────────────
login() {
  local email="$1" password="$2"
  local csrf
  csrf=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
  curl -s -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -b "$JAR" -c "$JAR" \
    -d "csrfToken=${csrf}&username=${email}&password=${password}&callbackUrl=${BASE}/dashboard" \
    -L -o /dev/null
  echo "Logged in as $email"
}

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      -b "$JAR" -d "$data"
  else
    curl -s -X "$method" "$BASE$path" -b "$JAR"
  fi
}

jq_id() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',d).get('id',''))"; }

# ─── Login as Manager ────────────────────────────────────
login "admin@titan.local" "Titan@2026"

# ─── 1. Annual Plan ──────────────────────────────────────
echo "=== Creating Annual Plan ==="
PLAN_ID=$(api POST /api/plans '{"year":2026,"title":"信科部 2026 年度計劃","description":"涵蓋系統維運、新功能開發、資安強化三大主軸"}' | jq_id)
echo "Plan: $PLAN_ID"

# ─── 2. Monthly Goals (12 months) ────────────────────────
echo "=== Creating Monthly Goals ==="
MONTHS=("系統健檢與規劃" "核心系統升級" "新功能開發啟動" "第一階段交付" "資安稽核準備" "中期檢討與調整" "第二階段開發" "壓力測試與優化" "UAT 與修正" "上線準備" "正式上線與監控" "年度回顧與規劃")
declare -a GOAL_IDS
for i in $(seq 0 11); do
  m=$((i+1))
  GID=$(api POST /api/goals "{\"planId\":\"$PLAN_ID\",\"month\":$m,\"title\":\"${MONTHS[$i]}\"}" | jq_id)
  GOAL_IDS+=("$GID")
  echo "  Month $m: $GID — ${MONTHS[$i]}"
done

# ─── 3. KPIs (6 indicators) ─────────────────────────────
echo "=== Creating KPIs ==="
KPI_DEFS=(
  '{"year":2026,"code":"KPI-01","title":"系統可用率","target":99.9,"weight":2,"description":"核心系統月均可用率"}'
  '{"year":2026,"code":"KPI-02","title":"需求交付準時率","target":85,"weight":2,"description":"按時完成需求的比例"}'
  '{"year":2026,"code":"KPI-03","title":"資安事件數","target":0,"weight":3,"description":"全年重大資安事件數量"}'
  '{"year":2026,"code":"KPI-04","title":"程式碼覆蓋率","target":80,"weight":1,"description":"自動化測試覆蓋率"}'
  '{"year":2026,"code":"KPI-05","title":"文件完整度","target":90,"weight":1,"description":"技術文件的完整性評分"}'
  '{"year":2026,"code":"KPI-06","title":"團隊滿意度","target":4.2,"weight":1,"description":"季度內部滿意度調查（1-5分）"}'
)
declare -a KPI_IDS
for def in "${KPI_DEFS[@]}"; do
  KID=$(api POST /api/kpi "$def" | jq_id)
  KPI_IDS+=("$KID")
  echo "  KPI: $KID"
done

# ─── 4. Tasks (30 tasks across team) ────────────────────
echo "=== Creating Tasks ==="
ENGINEERS=("eng-001" "eng-002" "eng-003" "eng-004")
CATEGORIES=("PLANNED_TASK" "ADDITIONAL_TASK" "INCIDENT" "USER_SUPPORT" "ADMIN_TASK" "LEARNING")
PRIORITIES=("P0" "P1" "P2" "P3")
STATUSES=("BACKLOG" "TODO" "IN_PROGRESS" "REVIEW" "DONE")

TASK_TITLES=(
  "PostgreSQL 16 升級評估" "Redis 叢集化規劃" "Nginx 反向代理強化" "MinIO 儲存空間擴容"
  "前端效能優化 — LCP 改善" "API 回應時間監控" "Prometheus 告警規則調整" "Grafana Dashboard 重構"
  "LDAP 整合開發" "SSO Keycloak 設定" "密碼策略強化" "帳號鎖定機制"
  "行動裝置 RWD 適配" "深色模式支援" "Command Palette 功能" "匯入匯出功能"
  "年度稽核報告準備" "SOC2 合規檢查" "弱點掃描修復" "SSL 憑證更新"
  "新人教育訓練" "技術分享：容器化" "程式碼審查流程建立" "CI/CD 管線優化"
  "Q1 OKR 對齊" "部門週會記錄系統" "工時報表自動化" "備份策略文件化"
  "災難復原演練" "效能基準測試"
)

declare -a TASK_IDS
for i in $(seq 0 29); do
  eng_idx=$((i % 4))
  cat_idx=$((i % 6))
  pri_idx=$((i % 4))
  goal_idx=$((i % 12))

  # Distribute statuses: first 6 DONE, next 6 REVIEW, next 6 IN_PROGRESS, next 6 TODO, last 6 BACKLOG
  status_idx=$((i / 6))
  [ $status_idx -gt 4 ] && status_idx=4
  status="${STATUSES[$((4 - status_idx))]}"

  # Calculate dates across the year
  month=$((i / 3 + 1))
  [ $month -gt 12 ] && month=12
  day=$((i % 28 + 1))
  start_date="2026-$(printf '%02d' $month)-01"
  due_date="2026-$(printf '%02d' $month)-$(printf '%02d' $day)"

  TID=$(api POST /api/tasks "{
    \"title\":\"${TASK_TITLES[$i]}\",
    \"description\":\"${TASK_TITLES[$i]}的詳細說明與執行計畫\",
    \"status\":\"$status\",
    \"priority\":\"${PRIORITIES[$pri_idx]}\",
    \"category\":\"${CATEGORIES[$cat_idx]}\",
    \"assigneeId\":\"${ENGINEERS[$eng_idx]}\",
    \"backupAssigneeId\":\"${ENGINEERS[$(((eng_idx+1) % 4))]}\",
    \"startDate\":\"$start_date\",
    \"dueDate\":\"$due_date\",
    \"estimatedHours\":$((8 + i * 2)),
    \"goalId\":\"${GOAL_IDS[$goal_idx]}\"
  }" | jq_id)
  TASK_IDS+=("$TID")
  echo "  Task $((i+1))/30: $TID — ${TASK_TITLES[$i]} ($status)"
done

# ─── 5. Subtasks (2 per task, first 10 tasks) ────────────
echo "=== Creating Subtasks ==="
for i in $(seq 0 9); do
  tid="${TASK_IDS[$i]}"
  api POST /api/subtasks "{\"taskId\":\"$tid\",\"title\":\"${TASK_TITLES[$i]} — 分析階段\",\"done\":true}" > /dev/null
  api POST /api/subtasks "{\"taskId\":\"$tid\",\"title\":\"${TASK_TITLES[$i]} — 實作階段\",\"done\":false}" > /dev/null
  echo "  Subtasks for task $((i+1))"
done

# ─── 6. Time Entries (simulate 3 months of work) ────────
echo "=== Creating Time Entries ==="
WORK_CATEGORIES=("PLANNED_TASK" "ADDITIONAL_TASK" "INCIDENT" "USER_SUPPORT" "ADMIN_TASK" "LEARNING")
entry_count=0
for month in 1 2 3; do
  for week in 1 2 3 4; do
    for eng_idx in 0 1 2 3; do
      for day_offset in 0 1 2 3 4; do
        day=$((((week-1)*7) + day_offset + 1))
        [ $day -gt 28 ] && day=28
        date="2026-$(printf '%02d' $month)-$(printf '%02d' $day)"
        hours=$(python3 -c "import random;print(round(random.uniform(6,9),1))")
        cat_idx=$(( (eng_idx + day_offset + month) % 6 ))

        # Assign to a task if available
        task_idx=$(( (eng_idx * 3 + month - 1) % 30 ))
        tid="${TASK_IDS[$task_idx]}"

        api POST /api/time-entries "{
          \"date\":\"$date\",
          \"hours\":$hours,
          \"taskId\":\"$tid\",
          \"category\":\"${WORK_CATEGORIES[$cat_idx]}\",
          \"description\":\"${TASK_TITLES[$task_idx]}相關工作\"
        }" > /dev/null 2>&1
        entry_count=$((entry_count + 1))
      done
    done
  done
  echo "  Month $month: seeded $(( entry_count )) entries total"
done
echo "Total time entries: $entry_count"

# ─── 7. Documents (knowledge base) ──────────────────────
echo "=== Creating Documents ==="
DOC_TITLES=("部署手冊" "開發環境設定" "API 規格文件" "資安政策" "備份與還原 SOP" "效能調校指南")
for title in "${DOC_TITLES[@]}"; do
  api POST /api/documents "{\"title\":\"$title\",\"content\":\"# $title\n\n此文件說明 $title 的標準作業流程。\n\n## 目的\n\n確保團隊成員能夠遵循標準流程執行相關作業。\n\n## 範圍\n\n適用於信科部所有成員。\",\"parentId\":null}" > /dev/null 2>&1
  echo "  Doc: $title"
done

# ─── 8. KPI Achievement Updates ─────────────────────────
echo "=== Updating KPI Achievements ==="
ACHIEVEMENTS=(99.5 78 0 72 85 4.0)
for i in $(seq 0 5); do
  api POST "/api/kpi/${KPI_IDS[$i]}/achievement" "{\"actual\":${ACHIEVEMENTS[$i]}}" > /dev/null 2>&1
  echo "  KPI-0$((i+1)): actual=${ACHIEVEMENTS[$i]}"
done

# ─── 9. Deliverables (for first 5 tasks) ────────────────
echo "=== Creating Deliverables ==="
for i in $(seq 0 4); do
  tid="${TASK_IDS[$i]}"
  api POST /api/deliverables "{\"taskId\":\"$tid\",\"title\":\"${TASK_TITLES[$i]} 成果報告\",\"status\":\"DELIVERED\"}" > /dev/null 2>&1
  echo "  Deliverable for: ${TASK_TITLES[$i]}"
done

echo ""
echo "=== Seed Complete ==="
echo "Plan: $PLAN_ID"
echo "Goals: ${#GOAL_IDS[@]}"
echo "KPIs: ${#KPI_IDS[@]}"
echo "Tasks: ${#TASK_IDS[@]}"
echo "Time Entries: $entry_count"
echo "Documents: ${#DOC_TITLES[@]}"
