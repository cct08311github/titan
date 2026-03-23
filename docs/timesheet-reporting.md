# 工時報表產生指南

> **Issue**: #64 — Kimai Time Tracking Deep Integration
> **文件版本**: 1.0
> **最後更新**: 2026-03-23
> **適用版本**: Kimai 2.21.x + TITAN 平台

---

## 目錄

1. [報表概述](#報表概述)
2. [週報產生方式（Kimai API）](#週報產生方式kimai-api)
3. [報表格式範本](#報表格式範本)
4. [Plane 任務資料結合](#plane-任務資料結合)
5. [自動化報表腳本](#自動化報表腳本)
6. [匯出格式說明](#匯出格式說明)

---

## 報表概述

TITAN 工時報表系統整合 Kimai（工時記錄）與 Plane（任務管理），提供 IT 主管所需的多維度工時分析報表。

### 報表用途

| 報表類型 | 頻率 | 主要閱讀對象 | 用途 |
|---------|------|------------|------|
| 個人週報 | 每週一 | IT 人員本人 | 確認自身工時是否合理 |
| 專案工時彙整 | 每週一 | 專案主管 | 掌握各專案耗用資源 |
| 部門月報 | 每月 1 日 | IT 部門主管 | 月度資源分配檢討 |
| 個別任務工時 | 按需 | 技術主管 | 特定 Plane Issue 工時分析 |

---

## 週報產生方式（Kimai API）

### 方法 1：Kimai 內建報表（建議一般使用）

1. 登入 `https://titan.bank.local/kimai/`
2. 左側選單 → **報表** → **週報**
3. 選擇使用者（或「我的報表」）
4. 選擇目標週次
5. 點選「匯出 PDF」或「匯出 Excel」

### 方法 2：REST API 查詢（適合自動化）

```bash
# 設定報表週期（以本週為例）
WEEK_START=$(date -d "monday" +%Y-%m-%dT00:00:00+08:00)
WEEK_END=$(date -d "sunday" +%Y-%m-%dT23:59:59+08:00)

# 查詢全部人員工時（需 ROLE_ADMIN 或 ROLE_TEAMLEAD）
curl -s "https://titan.bank.local/kimai/api/timesheets?\
begin=${WEEK_START}&\
end=${WEEK_END}&\
full=true&\
size=500" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" | jq .
```

### 方法 3：Kimai 內建匯出 API

```bash
# 匯出本週工時為 CSV（所有使用者）
curl -s "https://titan.bank.local/kimai/api/timesheets/export?\
type=csv&\
begin=${WEEK_START}&\
end=${WEEK_END}" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" \
  -o "weekly-timesheet-$(date +%Y-W%V).csv"
```

---

## 報表格式範本

### 個人週報格式

```
════════════════════════════════════════════════════════════
TITAN IT 部門 — 個人工時週報
姓名：{員工姓名}
週次：{YYYY} 年第 {WW} 週（{MM/DD} ~ {MM/DD}）
════════════════════════════════════════════════════════════

一、工時總覽
─────────────────────────────────────────────────────────
  本週總工時：{X.XX} 小時
  標準工時：40.00 小時
  超時 / 不足：{+/-X.XX} 小時

二、各專案工時分配
─────────────────────────────────────────────────────────
  專案名稱                      活動類型        工時
  [CORE] 後端核心系統             程式開發        12.50 h
  [CORE] 後端核心系統             測試與驗證       4.00 h
  [INFRA] 基礎設施現代化          部署與上線       3.00 h
  [MGMT] 專案管理                 會議與溝通       6.00 h
  ────────────────────────────────────────────────────
  合計                                           25.50 h

三、工時明細（依日期排序）
─────────────────────────────────────────────────────────
  日期        開始     結束     工時   專案          活動          說明
  2026-03-18  09:00   12:00   3.00   [CORE]        程式開發      CORE-42 修復登入 Bug
  2026-03-18  13:00   17:30   4.50   [CORE]        程式開發      CORE-45 API 效能優化
  2026-03-19  09:00   11:00   2.00   [INFRA]       部署與上線    K8s 版本升級
  ...

四、備註
─────────────────────────────────────────────────────────
  {員工自填備註}

════════════════════════════════════════════════════════════
產生時間：{YYYY-MM-DD HH:MM:SS} | 資料來源：Kimai 2.21 + Plane
```

### 專案工時彙整格式

```
════════════════════════════════════════════════════════════
TITAN IT 部門 — 專案工時彙整週報
週次：{YYYY} 年第 {WW} 週（{MM/DD} ~ {MM/DD}）
════════════════════════════════════════════════════════════

一、各專案工時總覽
─────────────────────────────────────────────────────────
  排名  專案識別碼  專案名稱              本週工時  累計工時  人員數
   1    CORE       後端核心系統           45.50 h  280.00 h    3
   2    INFRA      基礎設施現代化         22.00 h  156.50 h    2
   3    SEC        資安強化計畫           15.00 h   98.00 h    2
   4    MGMT       專案管理              12.00 h   88.50 h    1

二、人員工時分配矩陣
─────────────────────────────────────────────────────────
              CORE   INFRA   SEC   MGMT   其他   合計
  張小明      18.5    6.0    3.0   3.0    0.0   30.5 h
  李小華      15.0    8.0    4.0   3.0    0.0   30.0 h
  王小英      12.0    8.0    8.0   6.0    0.0   34.0 h
  ──────────────────────────────────────────────────
  小計        45.5   22.0   15.0  12.0    0.0   94.5 h

三、Plane Issue 工時關聯（本週新增 / 完成）
─────────────────────────────────────────────────────────
  Issue 編號   標題                        狀態   工時
  CORE-42      修復使用者登入 Bug           完成   8.5 h
  CORE-45      API 回應效能優化            進行中  6.0 h
  INFRA-18     Kubernetes 版本升級         完成   12.0 h

════════════════════════════════════════════════════════════
產生時間：{YYYY-MM-DD HH:MM:SS} | 資料來源：Kimai 2.21 + Plane API
```

---

## Plane 任務資料結合

### 整合原理

Kimai 工時記錄的 `description` 欄位填入 Plane Issue 編號（如 `CORE-42`），透過 API 交叉查詢即可取得完整的「工時 × 任務」分析。

### 範例：查詢特定 Issue 的工時

```bash
# 查詢所有包含 CORE-42 的工時記錄
ISSUE_REF="CORE-42"
curl -s "https://titan.bank.local/kimai/api/timesheets?\
term=${ISSUE_REF}&size=100" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" | \
  jq '[.[] | {
    date: .begin[:10],
    user: .user.alias,
    project: .project.name,
    activity: .activity.name,
    hours: (.duration / 3600),
    description: .description
  }]'
```

### 範例：從 Plane 取得 Issue 詳情並結合工時

```bash
PLANE_ISSUE_ID="CORE-42"
KIMAI_API_TOKEN="your_token"
PLANE_API_TOKEN="your_plane_token"

# 取得 Plane Issue 詳情
plane_issue=$(curl -s \
  "https://titan.bank.local/plane/api/v1/workspaces/titan-bank/issues/?search=${PLANE_ISSUE_ID}" \
  -H "X-Api-Key: ${PLANE_API_TOKEN}" | jq '.results[0]')

# 取得對應工時
kimai_hours=$(curl -s \
  "https://titan.bank.local/kimai/api/timesheets?term=${PLANE_ISSUE_ID}&size=100" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" | \
  jq '[.[].duration] | add // 0 | . / 3600')

echo "Issue: ${PLANE_ISSUE_ID}"
echo "標題: $(echo $plane_issue | jq -r '.name')"
echo "狀態: $(echo $plane_issue | jq -r '.state_detail.name')"
echo "總工時: ${kimai_hours} 小時"
```

---

## 自動化報表腳本

以下腳本可搭配 cron 自動產生並儲存週報資料。

### 週報自動產生（存為 JSON）

```bash
#!/usr/bin/env bash
# generate-weekly-report.sh — 產生本週工時報表 JSON

set -euo pipefail

# 載入環境變數
source "$(dirname "$0")/../.env"

# 計算本週日期範圍（週一至週日）
WEEK_START=$(date -d "last monday" +%Y-%m-%dT00:00:00+08:00 2>/dev/null || \
             date -v-monday +%Y-%m-%dT00:00:00+08:00)
WEEK_END=$(date -d "next sunday 23:59:59" +%Y-%m-%dT23:59:59+08:00 2>/dev/null || \
           date -v+sunday +%Y-%m-%dT23:59:59+08:00)
WEEK_NUM=$(date +%V)
YEAR=$(date +%Y)

OUTPUT_DIR="/opt/titan/reports/timesheets"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="${OUTPUT_DIR}/weekly-${YEAR}-W${WEEK_NUM}.json"

echo "正在產生 ${YEAR} 年第 ${WEEK_NUM} 週工時報表..."

# 查詢 Kimai API
curl -s \
  "https://titan.bank.local/kimai/api/timesheets?begin=${WEEK_START}&end=${WEEK_END}&full=true&size=1000" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" | \
  jq '{
    report_type: "weekly",
    year: '"$YEAR"',
    week: '"$WEEK_NUM"',
    period: { start: "'"$WEEK_START"'", end: "'"$WEEK_END"'" },
    generated_at: now | todate,
    entries: [.[] | {
      date: .begin[:10],
      user: .user.alias,
      project: .project.name,
      activity: .activity.name,
      hours: (.duration / 3600 * 100 | round / 100),
      description: (.description // "")
    }],
    summary: {
      total_hours: ([.[].duration] | add // 0) / 3600,
      unique_users: ([.[].user.alias] | unique | length),
      unique_projects: ([.[].project.name] | unique | length)
    }
  }' > "$OUTPUT_FILE"

echo "報表已儲存至：$OUTPUT_FILE"
```

### cron 設定範例

```bash
# /etc/cron.d/titan-reports

# 每週一早上 08:00 自動產生上週工時報表
0 8 * * 1 titan /opt/titan/scripts/generate-weekly-report.sh >> /var/log/titan/reports.log 2>&1

# 每月 1 日早上 08:30 產生上月工時月報
30 8 1 * * titan /opt/titan/scripts/generate-monthly-report.sh >> /var/log/titan/reports.log 2>&1
```

---

## 匯出格式說明

Kimai 支援多種匯出格式，可從 UI 或 API 取得。

### UI 匯出（Kimai 管理介面）

1. 登入 Kimai → **工時記錄** → 設定日期範圍
2. 點選右上角 **匯出** 按鈕
3. 可選格式：

| 格式 | 用途 | 備註 |
|------|------|------|
| PDF | 正式報表、送簽 | 包含銀行 LOGO（需設定） |
| Excel (.xlsx) | 資料分析 | 可直接在 Excel 加工 |
| CSV | 系統整合 | 純文字，編碼 UTF-8 |
| DOCX | Word 格式 | 適合插入其他文件 |

### API 匯出參數

```bash
# 匯出指定月份工時為 Excel
curl -s "https://titan.bank.local/kimai/api/timesheets/export?\
type=xlsx&\
begin=2026-03-01T00:00:00%2B08:00&\
end=2026-03-31T23:59:59%2B08:00" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" \
  -o "march-2026-timesheet.xlsx"

# 匯出特定專案工時為 CSV
PROJECT_ID=1
curl -s "https://titan.bank.local/kimai/api/timesheets/export?\
type=csv&\
project[]=${PROJECT_ID}&\
begin=2026-03-01T00:00:00%2B08:00&\
end=2026-03-31T23:59:59%2B08:00" \
  -H "Authorization: Bearer ${KIMAI_API_TOKEN}" \
  -o "project-${PROJECT_ID}-march-2026.csv"
```

### CSV 欄位說明

匯出的 CSV 包含以下標準欄位：

| 欄位名稱 | 說明 | 範例 |
|---------|------|------|
| `Date` | 工時日期 | `2026-03-23` |
| `From` | 開始時間 | `09:00` |
| `To` | 結束時間 | `11:30` |
| `Duration` | 工時（時:分） | `2:30` |
| `Username` | 登入帳號 | `zhangxiaomin` |
| `Name` | 顯示名稱 | `張小明` |
| `Project` | 專案名稱 | `[CORE] 後端核心系統` |
| `Activity` | 活動類型 | `程式開發` |
| `Description` | 工作說明 | `CORE-42 修復登入 Bug` |
| `Exported` | 是否已匯出過 | `false` |
| `Tags` | 標籤 | `hotfix,priority-high` |
| `Hourly rate` | 時薪（若有設定） | `0` |
| `Total` | 小計金額（若有設定） | `0` |

> **注意**：銀行內部工時系統通常不計費，`Hourly rate` 與 `Total` 欄位可忽略。
