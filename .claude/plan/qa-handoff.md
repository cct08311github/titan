# QA Handoff — TITAN Full-Year UI Test

> 新 session 開始時讀取此檔案，接續 UI 驅動 QA 測試。

## Dev Server

```bash
# 如果沒在跑，啟動：
cd /Users/openclaw/.openclaw/shared/projects/titan
npm run dev -- -p 3100
# URL: http://mac-mini.tailde842d.ts.net:3100
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| 主管 | admin@titan.local | Titan@2026 |
| 工程師A | eng-a@titan.local | Titan@2026 |
| 工程師B | eng-b@titan.local | Titan@2026 |
| 工程師C | eng-c@titan.local | Titan@2026 |
| 工程師D | eng-d@titan.local | Titan@2026 |

## Current Data State

已透過 API seed + 部分 UI 操作建立的數據：

| Resource | Count | Source |
|----------|-------|--------|
| Annual Plan | 1 (信科部 2026 年度計劃) | API seed |
| Monthly Goals | 13 (12 months + 1 QA test) | API seed + UI |
| Tasks | ~21 (30 seeded, 20 visible in kanban + 1 UI created) | Mixed |
| KPIs | 7 (KPI-01~06 + KPI-QA-01) | API seed + UI |
| Documents | 7 (6 seeded + 1 QA verify) | API seed |
| Time Entries | 69+ (API) + timer entries | Mixed |
| Subtasks | 20 (2 per first 10 tasks) | API seed |
| Deliverables | 5 | API seed |
| Users | 5 (1 manager + 4 engineers) | DB seed |

## Bugs Fixed This Session (PR #783 merged)

- **#777**: Document parentId null → `z.string().nullish()`
- **#778**: Time Entry taskId null → `z.string().nullish()`
- **#779**: Notification prefs payload → `{ preferences: [...] }`

## Known Issues (Unfixed)

| # | Issue | Severity |
|---|-------|----------|
| 1 | KPI achievement update API 成功但 dashboard 顯示 0% | MEDIUM |
| 2 | 看板新增任務後計數可能未即時更新 | MEDIUM |
| 3 | Task PATCH response 回傳舊資料 | LOW |
| 4 | favicon.ico 404 | LOW |
| 5 | 404 頁面為英文 | LOW |

## ✅ Already Tested (UI)

- [x] 登入（正確/錯誤/空欄位）
- [x] 登出 → redirect 到 /login
- [x] Dashboard 主管視角（統計卡片、KPI、工時分佈、投入率）
- [x] 看板 5 欄顯示 + 新增任務 (prompt)
- [x] 任務卡片顯示（優先度/分類/A角B角/預估工時/截止日）
- [x] 任務詳情面板開啟（標題/描述/狀態/優先度/分類/A角B角/截止日/工時/子任務/交付項）
- [x] 甘特圖頁面載入 + 12 月份軸
- [x] 年度計畫頁面 + 新增月度目標（UI 建立）
- [x] KPI 頁面 + 新增 KPI（UI 建立 KPI-QA-01）
- [x] 知識庫頁面載入 + 文件列表
- [x] 工時紀錄頁面 + Timer start/stop + 自動建立工時
- [x] 報表 5 個 tab 全部載入（週報/月報/KPI/計畫外/趨勢）
- [x] 團隊動態 audit log
- [x] 個人設定 3 tab（個資/通知偏好/安全）
- [x] 通知偏好 8 toggle
- [x] Command Palette (Ctrl+K) 搜尋 + 導航
- [x] 深色模式切換
- [x] 通知面板（空態）
- [x] 變更密碼頁面
- [x] 404 頁面

## ❌ Not Yet Tested (UI — 需接續)

### 優先：透過 UI 操作（非 API seed）
- [ ] **任務詳情完整編輯**：開啟任務 → 修改每個欄位（title, desc, status, priority, category, A角, B角, due date, estimated hours）→ 儲存 → 重新開啟驗證
- [ ] **子任務 UI CRUD**：在任務詳情中新增子任務 → toggle done → 刪除
- [ ] **交付項 UI CRUD**：新增交付項 → 修改狀態 → 刪除
- [ ] **篩選器逐一驗證**：負責人下拉（5 人）、優先度下拉（4 級）、分類下拉（6 類）→ 每個選項點擊後驗證結果正確
- [ ] **工時格子手動輸入**：點 + → 填入工時/分類/備註 → 儲存 → 驗證格子顯示
- [ ] **工時刪除**：點已有工時 → 刪除 → 驗證格子清空
- [ ] **工時列表模式**：切換到列表 → 驗證數據一致
- [ ] **工時週切換**：上週/本週/下週 → 驗證日期更新
- [ ] **知識庫文件建立**：UI 新增 → 編輯內容 → 儲存 → 驗證
- [ ] **知識庫文件搜尋**：輸入關鍵字 → 驗證結果
- [ ] **KPI 連結任務**：打開 KPI → link task → 驗證
- [ ] **年度計畫展開**：點擊月度目標 → 展開看任務列表
- [ ] **報表匯出按鈕**：每個 tab 的匯出按鈕點擊
- [ ] **報表數據正確性**：完成任務數/工時合計 vs dashboard 交叉驗證

### 權限測試：工程師帳號
- [ ] **工程師登入**：eng-a@titan.local → 驗證「工程師視角」
- [ ] **Dashboard 差異**：工程師看到「我的工作狀況」不是「團隊整體」
- [ ] **任務篩選**：只看到自己被指派的任務
- [ ] **無法存取 admin**：/admin 路由被擋
- [ ] **工程師建立任務**：在看板新增 → 指派給自己
- [ ] **工程師記錄工時**：在工時頁記錄 → 驗證
- [ ] **工程師修改設定**：個人資料 + 通知偏好

### 10 輪自動化
- [ ] 寫 `e2e/full-year-qa.spec.ts` Playwright spec
- [ ] 跑 `npx playwright test e2e/full-year-qa.spec.ts --repeat-each=10`

## How to Resume

新 session 貼上：

```
讀取 .claude/plan/qa-handoff.md，接續 TITAN UI 驅動 QA 測試。
從「❌ Not Yet Tested」的第一項開始，用 Playwright MCP browser 工具操作畫面。
Dev server: http://mac-mini.tailde842d.ts.net:3100
```
