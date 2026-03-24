# TITAN Load Test Baseline

## 概述

本文件定義 TITAN 平台的負載測試基準，模擬 5 人 IT 團隊的日常操作場景。
測試結果作為效能基線，後續版本更新可對照此基線驗證是否出現效能退化。

## 測試工具

提供兩種執行方式，適應不同環境：

| 工具 | 檔案 | 適用場景 |
|------|------|----------|
| **k6** | `tests/load/baseline.js` | 開發/CI 環境（需安裝 k6） |
| **Shell (curl)** | `tests/load/load-test.sh` | Air-gapped 銀行環境（零依賴） |

## 測試情境

### 使用者設定

- **虛擬使用者 (VUs)**: 5（對應 5 人團隊）
- **迭代次數**: 10 輪/人（Shell 版），持續 3 分鐘（k6 版）
- **併發模式**: 5 使用者同時執行完整工作流程

### 工作流程

每個虛擬使用者依序執行以下操作，模擬真實工作日常：

```
1. 登入          POST /api/auth/callback/credentials
2. 載入儀表板    GET  /dashboard
                 GET  /api/tasks?limit=10
                 GET  /api/notifications?limit=5
                 GET  /api/kpi
3. 任務 CRUD
   - 列表        GET  /api/tasks?limit=20
   - 建立        POST /api/tasks
   - 更新        PATCH /api/tasks/:id
   - 刪除        DELETE /api/tasks/:id
4. 報表產生
   - 週報        GET  /api/reports/weekly
   - 月報        GET  /api/reports/monthly
   - 工作量      GET  /api/reports/workload
5. KPI 查詢      GET  /api/kpi
```

## 效能門檻

首次基準測試的門檻值，後續依實測數據調整：

| 指標 | 門檻 | 說明 |
|------|------|------|
| 登入 p95 | < 3,000 ms | 含認證 + session 建立 |
| 儀表板 p95 | < 2,000 ms | 頁面 + API 資料載入 |
| 任務列表 p95 | < 1,500 ms | 20 筆分頁查詢 |
| 任務建立 p95 | < 2,000 ms | 含驗證 + 寫入 |
| 報表產生 p95 | < 3,000 ms | 含資料彙總計算 |
| KPI 查詢 p95 | < 2,000 ms | 含指標計算 |
| 整體錯誤率 | < 5% | 所有請求的失敗比例 |
| 整體 p95 | < 2,000 ms | 所有請求的 95 百分位 |

## 執行方式

### k6（推薦用於 CI）

```bash
# 基本執行
k6 run tests/load/baseline.js

# 指定環境
k6 run -e BASE_URL=https://titan.internal -e USERNAME=admin -e PASSWORD=secret tests/load/baseline.js

# 輸出 JSON 結果
k6 run --out json=results.json tests/load/baseline.js
```

### Shell（Air-gapped 環境）

```bash
# 基本執行（預設 localhost:3000, 5 使用者, 10 迭代）
bash tests/load/load-test.sh

# 自訂參數
bash tests/load/load-test.sh http://titan.internal:3000 5 20

# 環境變數
TITAN_USERNAME=admin TITAN_PASSWORD=secret bash tests/load/load-test.sh
```

結果輸出至 `tests/load/results/` 目錄：
- `baseline_YYYYMMDD_HHMMSS.log` — 詳細日誌
- `summary_YYYYMMDD_HHMMSS.json` — JSON 格式摘要（供自動化比對）

## 結果解讀

### PASS 條件

所有場景的 p95 回應時間均在門檻內，且整體錯誤率 < 5%。

### 基線更新流程

1. 每次重大版本更新後重新執行負載測試
2. 比對新結果與既有基線的差異
3. p95 退化超過 20% 需調查原因
4. 確認無退化後，更新基線數據

### JSON 結果格式

```json
{
  "timestamp": "2026-03-24T00:00:00Z",
  "config": {
    "base_url": "http://localhost:3000",
    "concurrent_users": 5,
    "iterations": 10
  },
  "duration_seconds": 120,
  "total_requests": 500,
  "failed_requests": 2,
  "error_rate_percent": 0.4,
  "throughput_rps": 4.2,
  "scenarios": [
    { "name": "登入", "count": 50, "p50": 150, "p95": 450, "avg": 200, "threshold": 3000 }
  ]
}
```

## 限制與注意事項

- Shell 版本使用 curl 循序+並行模式，精度不如 k6 的事件驅動模型
- 測試未涵蓋 WebSocket 或即時通知的長連線場景
- Air-gapped 環境下無法使用 k6 Cloud 等 SaaS 報告功能
- 首次基準數據建立後，門檻值應依實測結果微調
