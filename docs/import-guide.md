# Excel 任務匯入指南

## 概觀

管理員（MANAGER 角色）可透過上傳 `.xlsx` 檔案批次建立任務。

## API

```
POST /api/tasks/import
Content-Type: multipart/form-data
Authorization: (需要 MANAGER 角色的 session)

Form field: file  — .xlsx 檔案
```

成功回應：

```json
{
  "ok": true,
  "data": {
    "created": 10,
    "errors": [
      { "rowIndex": 2, "message": "title 為必填欄位" }
    ]
  }
}
```

## Excel 欄位說明

第一列必須為標題列，欄位名稱如下（順序不限）：

| 欄位名稱 | 必填 | 說明 | 允許值 |
|---|---|---|---|
| `title` | 是 | 任務標題 | 任意文字 |
| `description` | 否 | 任務說明 | 任意文字 |
| `assigneeEmail` | 否 | 負責人 Email（須為系統內已建立的用戶） | e.g. `alice@example.com` |
| `status` | 否 | 任務狀態（預設 `BACKLOG`） | `BACKLOG` / `TODO` / `IN_PROGRESS` / `REVIEW` / `DONE` |
| `priority` | 否 | 優先度（預設 `P2`） | `P0` / `P1` / `P2` / `P3` |
| `category` | 否 | 任務分類（預設 `PLANNED`） | `PLANNED` / `ADDED` / `INCIDENT` / `SUPPORT` / `ADMIN` / `LEARNING` |
| `dueDate` | 否 | 到期日 | `YYYY-MM-DD` 格式，例如 `2026-04-30` |
| `estimatedHours` | 否 | 預估工時（小時） | 數字，例如 `4` 或 `2.5` |

## 匯入類型

自 Issue #424 起，匯入 API 支援多種資料類型：

```
POST /api/tasks/import?type=task   # 任務匯入（預設）
POST /api/tasks/import?type=kpi    # KPI 匯入
POST /api/tasks/import?type=plan   # 年度計畫匯入
```

## 範本下載

| 匯入類型 | 範本檔案 | 下載路徑 |
|----------|----------|----------|
| 任務匯入 | `task-import-template.xlsx` | [`/templates/task-import-template.xlsx`](../templates/task-import-template.xlsx) |
| KPI 匯入 | 使用任務範本，欄位對應 KPI schema | 同上 |
| 年度計畫匯入 | 使用任務範本，欄位對應 Plan schema | 同上 |

> **提示：** 範本檔案位於專案 `templates/` 目錄下。部署後可透過靜態路徑 `/templates/task-import-template.xlsx` 下載。

## 行為說明

- **有效列**：直接建立任務，`creatorId` 設定為目前登入的 MANAGER。
- **無效列**：跳過該列，在回應的 `errors` 陣列中回報 `rowIndex`（0 起算，對應 Excel 第 2 列起）與錯誤訊息。
- **assigneeEmail 找不到**：不視為錯誤，任務建立成功但 `primaryAssigneeId` 留空。
- **空工作表**：回傳 400 錯誤。

## 使用範例（curl）

```bash
curl -X POST https://your-titan-domain/api/tasks/import \
  -H "Cookie: next-auth.session-token=<token>" \
  -F "file=@/path/to/tasks.xlsx"
```
