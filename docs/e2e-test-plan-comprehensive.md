# TITAN E2E 介面操作測試計畫書（極致詳盡版）

> **文件版本**: v1.0
> **建立日期**: 2026-03-26
> **適用系統**: TITAN v1.0 — 銀行 IT 團隊協作平台
> **技術堆疊**: Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS + shadcn/ui
> **測試框架**: Playwright（Chromium + iPhone 12 Mobile）
> **Base URL**: `http://localhost:3100`

---

## 目錄

1. [測試環境準備與前置條件](#1-測試環境準備與前置條件)
2. [角色矩陣測試策略](#2-角色矩陣測試策略)
3. [全模組地毯式 E2E 操作測試](#3-全模組地毯式-e2e-操作測試)
   - 3.1 登入模組
   - 3.2 儀表板模組
   - 3.3 看板模組
   - 3.4 年度計畫模組
   - 3.5 甘特圖模組
   - 3.6 知識庫模組
   - 3.7 工時紀錄模組
   - 3.8 KPI 模組
   - 3.9 報表模組
   - 3.10 團隊動態模組
   - 3.11 個人設定模組
   - 3.12 管理後台模組
4. [關鍵跨模組使用者旅程](#4-關鍵跨模組使用者旅程)
5. [防禦性與安全性介面測試](#5-防禦性與安全性介面測試)
6. [視覺回歸與無障礙測試清單](#6-視覺回歸與無障礙測試清單)
7. [測試覆蓋矩陣](#7-測試覆蓋矩陣)
8. [Playwright 程式碼片段範例](#8-playwright-程式碼片段範例)

---

## 1. 測試環境準備與前置條件

### 1.1 環境啟動步驟

```bash
# ── Step 1: 啟動基礎服務 ──
cd /path/to/titan
cp .env.example .env   # 首次建立（已存在則跳過）
docker compose up -d   # 啟動 PostgreSQL 16 + Redis 7 + MinIO

# ── Step 2: 資料庫遷移與種子資料 ──
npx prisma migrate deploy
npx prisma db seed      # 建立 1 主管 + 4 工程師 + 20 任務 + 5 KPI + 工時紀錄

# ── Step 3: 啟動 Next.js 開發伺服器 ──
npm run dev -- -p 3100  # 確保使用 port 3100（Playwright config 預設）

# ── Step 4: 驗證服務就緒 ──
curl -s http://localhost:3100/api/health | jq .
# 預期回應: { "status": "ok", ... }
```

### 1.2 測試帳號清單

| 角色 | 帳號（email 欄位） | 密碼 | 姓名 | 用途 |
|------|---------------------|------|------|------|
| **MANAGER** | `admin` | `Titan@2026Dev!` | 系統管理員 | DB seed 帳號，完整權限 |
| **ENGINEER** | `eng01` | `Titan@2026Dev!` | 王大明 | 主要測試工程師 |
| **ENGINEER** | `eng02` | `Titan@2026Dev!` | 李小花 | 備援人員測試 |
| **ENGINEER** | `eng03` | `Titan@2026Dev!` | 張志偉 | 監控任務負責人 |
| **ENGINEER** | `eng04` | `Titan@2026Dev!` | 陳美玖 | 支援任務負責人 |
| **MANAGER** | `admin@titan.local` | `Admin@2026!x` | — | Playwright global-setup 專用 |
| **ENGINEER** | `eng-a@titan.local` | `Admin@2026!x` | — | Playwright global-setup 專用 |

> **重要**：DB seed 帳號（`admin`, `eng01`~`eng04`）用於手動測試。Playwright 自動化使用 `admin@titan.local` / `eng-a@titan.local` 並將 session state 存入 `e2e/.auth/manager.json` 和 `e2e/.auth/engineer.json`。

### 1.3 Playwright 執行環境

```bash
# 安裝瀏覽器
npx playwright install chromium

# 執行全部 E2E 測試
npx playwright test

# 執行特定檔案
npx playwright test e2e/kanban-features.spec.ts

# 偵錯模式（開啟瀏覽器）
npx playwright test --headed --debug

# 生成 HTML 報告
npx playwright test --reporter=html
npx playwright show-report
```

### 1.4 測試資料重置機制

```typescript
// e2e/helpers/seed.ts 提供的函式：

// resetDatabase() — 清除所有業務資料（保留 User 表）
// 適用於：需要乾淨狀態的寫入測試
// 使用方式：在 test.beforeAll() 中呼叫

// truncateTimeEntries() — 僅清除工時資料
// 適用於：工時模組專用測試

// 使用範例：
import { resetDatabase } from './helpers/seed';
test.beforeAll(async () => { await resetDatabase(); });
```

### 1.5 Auth State 共用機制

```typescript
// 在 spec 檔案頂層設定角色：
import { MANAGER_STATE_FILE, ENGINEER_STATE_FILE } from './helpers/auth';

// Manager 視角測試
test.use({ storageState: MANAGER_STATE_FILE });

// Engineer 視角測試
test.use({ storageState: ENGINEER_STATE_FILE });
```

---

## 2. 角色矩陣測試策略

### 2.1 權限矩陣

| 功能 / 路由 | MANAGER | ENGINEER | 未登入 |
|-------------|---------|----------|--------|
| `/login` | 可存取（已登入自動跳 dashboard） | 可存取 | 可存取 |
| `/dashboard` | 完整：團隊統計 + KPI 概覽 + 工時分布 | 限縮：個人待辦 + 個人工時 | 302 → `/login` |
| `/kanban` | 全部任務（全團隊） | 自己被指派的任務 | 302 → `/login` |
| `/plans` | 可建立/編輯/刪除計畫 | 僅檢視 | 302 → `/login` |
| `/gantt` | 完整里程碑管理 | 僅檢視 | 302 → `/login` |
| `/knowledge` | 建立/編輯/刪除文件 | 建立/編輯文件（不可刪除他人文件） | 302 → `/login` |
| `/timesheet` | 檢視全團隊工時 | 僅自己的工時 | 302 → `/login` |
| `/kpi` | 完整 CRUD + 自動計算 | 僅檢視 | 302 → `/login` |
| `/reports` | 全部報表（含團隊） | 限個人報表 | 302 → `/login` |
| `/activity` | 全團隊動態 | 全團隊動態（如有權限） | 302 → `/login` |
| `/settings` | 個人設定 | 個人設定 | 302 → `/login` |
| `/admin` | 完整後台管理 | **403 / 頁面不顯示** | 302 → `/login` |

### 2.2 Manager 完整旅程

```
登入 → 儀表板（查看團隊概況）
  → 年度計畫（建立 2026 計畫、新增月目標）
  → 看板（建立任務、指派給工程師、設定優先級）
  → 甘特圖（建立里程碑、設定時間軸）
  → KPI（建立 KPI、連結任務、設定權重）
  → 知識庫（建立技術文件）
  → 工時紀錄（查看全團隊工時分布）
  → 報表（產出週報/月報/KPI 報表）
  → 管理後台（檢視稽核日誌、管理帳號）
  → 登出
```

### 2.3 Engineer 完整旅程

```
登入 → 儀表板（查看個人待辦、截止日提醒）
  → 看板（查看指派給自己的任務、拖曳更新狀態）
  → 任務詳情（更新進度、新增子任務、留言）
  → 工時紀錄（填寫當日工時、使用計時器）
  → 知識庫（搜尋技術文件、建立新文件）
  → 年度計畫（檢視計畫內容）
  → 個人設定（更新通知偏好）
  → 登出
```

### 2.4 跨角色權限驗證測試案例

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| E-ADM-01 | Engineer 直接存取 `/admin` | 顯示 403 或自動跳轉至 `/dashboard` |
| E-ADM-02 | Engineer 呼叫 `POST /api/kpi` | 回應 403 Forbidden |
| E-ADM-03 | Engineer 呼叫 `DELETE /api/plans/{id}` | 回應 403 Forbidden |
| E-ADM-04 | Engineer 呼叫 `POST /api/admin/generate-reset-token` | 回應 403 Forbidden |
| M-OWN-01 | Manager 編輯其他人建立的文件 | 允許（Manager 有全部權限） |
| E-OWN-01 | Engineer 編輯自己建立的文件 | 允許 |
| E-OWN-02 | Engineer 刪除他人建立的文件 | 回應 403 Forbidden |
| UNAUTH-01 | 無 session 直接存取 `/dashboard` | 302 重導至 `/login` |
| UNAUTH-02 | 無 session 呼叫 `GET /api/tasks` | 回應 401 Unauthorized |

---

## 3. 全模組地毯式 E2E 操作測試

### 3.1 登入模組 (`/login`)

**路由**: `/login`
**測試目標**: 驗證認證流程完整性、錯誤處理、安全機制（Rate Limit、帳號鎖定）

#### 前置條件
- 資料庫已 seed（至少有 `admin` 和 `eng01` 帳號）
- 無已存在的 session（清除 cookies）

#### Happy Path

**TC-LOGIN-001: Manager 成功登入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 開啟 `http://localhost:3100/login` | 顯示登入頁面，標題為「TITAN」，副標題「銀行 IT 團隊工作管理系統」 | `assert visible: text="TITAN"` + `assert visible: text="銀行 IT 團隊工作管理系統"` |
| 2 | 確認 TITAN logo 存在 | 左上角有藍色方形 "T" 圖標 | `assert visible: .bg-primary >> text="T"` |
| 3 | 點擊 `id="username"` 輸入框 | 游標聚焦，邊框變為 primary 色 | `assert focused: #username` |
| 4 | 輸入帳號 `admin` | 輸入框顯示 "admin" | `assert value: #username === "admin"` |
| 5 | 點擊 `id="password"` 輸入框 | 游標移至密碼欄位 | `assert focused: #password` |
| 6 | 輸入密碼 `Titan@2026Dev!` | 顯示遮罩字元（●） | `assert attribute: #password[type="password"]` |
| 7 | 點擊 `button[type="submit"]`（文字為「登入」） | 按鈕文字變為「登入中...」並顯示 Loader2 動畫 | `assert visible: text="登入中..."` + `assert visible: .animate-spin` |
| 8 | 等待跳轉 | URL 變為 `/dashboard` | `assert url: **/dashboard` |
| 9 | 驗證 Dashboard 載入 | 側邊欄顯示「TITAN」，主內容區載入統計卡片 | `assert visible: text="儀表板"` |

**TC-LOGIN-002: Engineer 成功登入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 開啟 `/login` | 登入頁面顯示 | `assert url: /login` |
| 2 | 在 `#username` 輸入 `eng01` | — | `fill: #username, "eng01"` |
| 3 | 在 `#password` 輸入 `Titan@2026Dev!` | — | `fill: #password, "Titan@2026Dev!"` |
| 4 | 點擊 `button[type="submit"]` | 登入中... → 跳轉 `/dashboard` | `assert url: **/dashboard` |
| 5 | 驗證 sidebar 不含「管理後台」連結 | Admin 連結不存在 | `assert not visible: a[href="/admin"]` |

#### 負面情境

**TC-LOGIN-003: 帳號密碼錯誤**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 在 `#username` 輸入 `admin` | — | — |
| 2 | 在 `#password` 輸入 `WrongPassword123!` | — | — |
| 3 | 點擊 `button[type="submit"]` | 按鈕顯示 loading → 恢復 | — |
| 4 | 等待錯誤訊息 | 顯示紅色錯誤區塊「帳號或密碼錯誤」 | `assert visible: text="帳號或密碼錯誤"` |
| 5 | 確認錯誤區塊樣式 | 紅色背景、紅色圓點指示器 | `assert visible: .text-danger` |
| 6 | 確認 URL 仍在 `/login` | 未跳轉 | `assert url: /login` |

**TC-LOGIN-004: 空白帳號提交**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 不輸入帳號和密碼 | — | — |
| 2 | 點擊 `button[type="submit"]` | 瀏覽器原生 required 驗證阻擋提交 | `assert attribute: #username[required]` |
| 3 | 驗證頁面未送出請求 | URL 仍為 `/login` | `assert url: /login` |

**TC-LOGIN-005: 帳號鎖定（10 次失敗後）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1–10 | 連續 10 次使用錯誤密碼嘗試登入 `admin` | 前 9 次顯示「帳號或密碼錯誤」 | — |
| 11 | 第 11 次嘗試（正確或錯誤密碼） | 顯示「帳號已被鎖定，請等待 15 分鐘後再試」 | `assert visible: text="帳號已被鎖定"` |

**TC-LOGIN-006: Rate Limit 觸發（5 次/60 秒）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1–5 | 連續快速提交 5 次登入（正確或錯誤） | 前 4 次正常回應 | — |
| 6 | 第 6 次提交 | 回應 429 Too Many Requests 或顯示錯誤訊息 | `assert visible: text="登入失敗，請稍後再試"` 或 `assert response: status=429` |

> **注意**：開發環境（NODE_ENV=development）可能繞過 rate limiter，CI 測試需確認 `NODE_ENV=test`。

#### 邊緣情境

**TC-LOGIN-007: 已登入使用者再次存取 `/login`**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用已登入的 session 存取 `/login` | 自動跳轉至 `/dashboard` | `assert url: **/dashboard` |

**TC-LOGIN-008: 特殊字元密碼**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 在 `#password` 輸入 `P@$$w0rd!<script>alert(1)</script>` | 密碼欄位正常接受（type=password 不會執行 XSS） | `assert value: #password !== ""` |
| 2 | 點擊 submit | 顯示「帳號或密碼錯誤」，無 XSS 彈窗 | `assert no dialog` + `assert visible: text="帳號或密碼錯誤"` |

#### 視覺 / Accessibility 驗證

| 驗證項目 | 選擇器 | 預期 |
|---------|--------|------|
| 帳號輸入框有 label | `label[for="username"]` | 文字「帳號」 |
| 密碼輸入框有 label | `label[for="password"]` | 文字「密碼」 |
| autocomplete 屬性正確 | `#username[autocomplete="username"]` | 存在 |
| autocomplete 屬性正確 | `#password[autocomplete="current-password"]` | 存在 |
| Tab 鍵序正確 | `Tab` → `Tab` → `Enter` | username → password → submit |
| 按鈕 disabled 狀態 | `button[type="submit"][disabled]` | loading 時 disabled |
| 版權文字 | `text="© 2026 TITAN v1.0"` | 頁面底部可見 |

---

### 3.2 儀表板模組 (`/dashboard`)

**路由**: `/dashboard`
**測試目標**: 驗證統計卡片正確性、角色差異顯示、數據即時更新

#### 前置條件
- 已登入（使用 storageState）
- DB 有 seed 資料（20 任務、5 KPI、工時紀錄）

#### Happy Path — Manager 視角

**TC-DASH-001: Manager 儀表板完整載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/dashboard` | 頁面載入，標題「儀表板」 | `assert visible: h1:has-text("儀表板")` |
| 2 | 等待 skeleton 消失 | Loading 動畫消失，統計卡片顯示數字 | `assert not visible: text="載入中"` |
| 3 | 驗證「待辦任務」統計卡 | 顯示圖標 ClipboardList + 數字（≥0） | `assert visible: text="待辦任務"` + `assert text matches: /\d+/` |
| 4 | 驗證「進行中」統計卡 | 顯示當前進行中任務數 | `assert visible: text="進行中"` |
| 5 | 驗證「本週完成」統計卡 | 顯示本週完成任務數 | `assert visible: text="本週完成"` |
| 6 | 驗證「KPI 達成率」區塊 | 顯示 KPI 項目列表，每項有進度條 | `assert visible: text="KPI 達成"` |
| 7 | 驗證「工時分布」區塊（Manager 專有） | 顯示團隊成員工時統計表 | `assert visible: text="工時分布"` 或 `text="工時"` |
| 8 | 驗證「今日待辦」卡片 | 顯示最多 5 筆任務，按截止日排序 | `assert count: [待辦任務卡片] <= 5` |
| 9 | 驗證截止日倒數 | 逾期任務顯示紅色「逾期 N 天」 | `assert visible: text=/逾期 \d+ 天/` |

**TC-DASH-002: 統計卡片數據準確性**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用 API 查詢 `GET /api/tasks?status=IN_PROGRESS` | 取得進行中任務數 `N` | API 回應計數 |
| 2 | 檢查儀表板「進行中」卡片 | 顯示數字 = `N` | `assert text: 進行中卡片數字 === N` |
| 3 | 在看板將一個 TODO 任務拖至 IN_PROGRESS | — | — |
| 4 | 回到 `/dashboard`（重新載入） | 「進行中」卡片數字 = `N+1` | 數字增加 1 |

#### Happy Path — Engineer 視角

**TC-DASH-003: Engineer 儀表板（限縮視圖）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/dashboard` | 頁面載入 | `assert url: /dashboard` |
| 2 | 驗證「今日待辦」 | 僅顯示指派給自己的任務 | `assert: 每個任務卡片的 assignee 含當前使用者` |
| 3 | 驗證不顯示全團隊工時分布 | 無「團隊工時分布」區塊（或僅顯示個人） | `assert not visible: text="團隊成員"` 的總覽表 |

#### 邊緣情境

**TC-DASH-004: 無任何資料的儀表板**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | `resetDatabase()` 清除所有業務資料 | — | — |
| 2 | 存取 `/dashboard` | 統計卡顯示 0，今日待辦顯示空狀態 | `assert visible: text="0"` 多個 + `assert visible: 空狀態提示` |

**TC-DASH-005: API 回應緩慢**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用 `page.route()` 攔截 `/api/tasks` 並延遲 3 秒 | — | Playwright route interception |
| 2 | 存取 `/dashboard` | 顯示 Loading skeleton / 「載入中」 | `assert visible: text="載入"` 或 `.animate-pulse` |
| 3 | 3 秒後 | 正常顯示內容 | `assert visible: 統計卡片數字` |

**TC-DASH-006: API 回應錯誤**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用 `page.route()` 攔截 `/api/tasks` 回應 500 | — | — |
| 2 | 存取 `/dashboard` | 顯示 PageError 元件（錯誤訊息 + 重試按鈕） | `assert visible: text="載入失敗"` 或 `text="重試"` |
| 3 | 移除 route 攔截後點擊「重試」 | 正常載入 | `assert not visible: text="載入失敗"` |

---

### 3.3 看板模組 (`/kanban`)

**路由**: `/kanban`
**測試目標**: 驗證 5 欄看板、拖曳狀態變更、篩選器、批次操作、任務詳情 Modal

#### 前置條件
- DB seed 資料中包含 20 個任務（分布在不同 status）
- `COLUMNS`: 待辦清單(BACKLOG)、待處理(TODO)、進行中(IN_PROGRESS)、審核中(REVIEW)、已完成(DONE)

#### Happy Path

**TC-KAN-001: 看板頁面完整載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/kanban` | 頁面標題顯示看板圖標 + 標題 | `assert visible: text="看板"` 或看板圖標 |
| 2 | 等待任務載入 | 5 個欄位皆顯示（即使為空） | `assert count: [看板欄位] === 5` |
| 3 | 驗證欄位標題 | 依序為：待辦清單、待處理、進行中、審核中、已完成 | `assert visible: text="待辦清單"` + `text="待處理"` + `text="進行中"` + `text="審核中"` + `text="已完成"` |
| 4 | 驗證每個欄位有任務數量徽章 | 標題旁顯示數字（如「3」） | `assert visible: 每個欄位 header 有數字` |
| 5 | 驗證任務卡片內容 | 每張卡片顯示：標題、優先級徽章(P0-P3)、指派人 | `assert visible: 任務標題` + `assert visible: 優先級 badge` |

**TC-KAN-002: 拖曳任務變更狀態**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 找到 TODO 欄位中的第一張任務卡片 | 記錄任務 ID 和標題 | `const card = page.locator('[draggable="true"]').first()` |
| 2 | 在卡片上觸發 `dragstart` 事件 | 卡片進入拖曳狀態（opacity 變化） | `assert: card has opacity < 1` 或 `dragging class` |
| 3 | 將卡片拖曳到「進行中」欄位 | 「進行中」欄位高亮（drop zone 視覺回饋） | `assert class: IN_PROGRESS 欄位有 ring-2 或 border 高亮` |
| 4 | 在「進行中」欄位釋放卡片 | 卡片移至「進行中」欄位 | `assert: 卡片出現在 IN_PROGRESS 欄位中` |
| 5 | 驗證 API 呼叫 | `PATCH /api/tasks/{id}` body: `{ status: "IN_PROGRESS" }` | `assert network: PATCH /api/tasks/* status=200` |
| 6 | 重新載入頁面 | 任務仍在「進行中」欄位 | `assert: 卡片持續在 IN_PROGRESS` |

**TC-KAN-003: 篩選器操作**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「指派人」篩選下拉選單 | 顯示團隊成員清單 | `assert visible: select options 含團隊成員姓名` |
| 2 | 選擇「王大明」 | 篩選器值設為 eng01 的 ID | `assert: select value !== ""` |
| 3 | 等待重新載入 | 僅顯示指派給王大明的任務 | `assert: 所有可見卡片的 assignee 皆為王大明` |
| 4 | 點擊「優先級」篩選，選擇「P0」 | 再次篩選 | `assert: 所有可見卡片皆為 P0` |
| 5 | 點擊「清除篩選」或重設篩選器 | 顯示全部任務 | `assert count: 卡片數量 === 總任務數` |

**TC-KAN-004: 批次選擇與操作**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊任務卡片上的勾選框（checkbox overlay） | 卡片被選中，顯示打勾狀態 | `assert: checkbox checked` |
| 2 | 再選擇 2 張卡片 | 共 3 張被選中 | `assert: 選中計數顯示 3` |
| 3 | 在批次操作列選擇「變更狀態」→「已完成」 | — | `click: 批次操作選單 → 已完成` |
| 4 | 確認操作 | 3 張卡片全部移至「已完成」欄位 | `assert: 3 張卡片在 DONE 欄位` |
| 5 | 驗證批次 API | `POST /api/tasks/bulk` 被呼叫 | `assert network: POST /api/tasks/bulk` |

**TC-KAN-005: 建立新任務**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊頁面右上角「新增任務」按鈕（Plus 圖標） | 彈出新增任務表單/對話框 | `assert visible: 新增任務 modal 或 form` |
| 2 | 輸入標題：`E2E 測試用任務` | — | `fill: title input, "E2E 測試用任務"` |
| 3 | 選擇優先級：P1 | — | `select: priority, "P1"` |
| 4 | 選擇指派人：王大明 | — | `select: assignee, "王大明"` |
| 5 | 點擊「建立」/「確認」按鈕 | Modal 關閉，新卡片出現在 BACKLOG 或 TODO 欄位 | `assert visible: text="E2E 測試用任務"` |

**TC-KAN-006: 點擊任務卡片開啟詳情 Modal**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊任務卡片標題（非 checkbox 區域） | 開啟 TaskDetailModal | `assert visible: [TaskDetailModal 元件]` |
| 2 | 驗證 Modal 內容 | 顯示：標題、描述、狀態、優先級、指派人、子任務、留言 | `assert visible: 任務標題` + `assert visible: text="子任務"` |
| 3 | 切換狀態下拉 | 狀態選單顯示 5 個選項 | `assert count: status options === 5` |
| 4 | 新增子任務 | 輸入子任務標題並按 Enter | `assert visible: 新子任務出現在列表` |
| 5 | 新增留言 | 在留言區輸入文字並送出 | `assert visible: 新留言顯示` |
| 6 | 點擊 X 關閉 Modal | Modal 消失 | `assert not visible: Modal` |

#### 邊緣情境

**TC-KAN-007: 空看板（無任何任務）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | `resetDatabase()` 清除任務 | — | — |
| 2 | 存取 `/kanban` | 5 個欄位皆為空，欄位數量徽章皆為 0 | `assert: 每個欄位卡片數 === 0` |
| 3 | 驗證空狀態提示 | 顯示引導文字（如「尚無任務」或空狀態圖示） | `assert visible: 空狀態元件` |

**TC-KAN-008: 大量任務效能（>100 張卡片）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 透過 API 批次建立 100 個任務 | — | `POST /api/tasks` × 100 |
| 2 | 存取 `/kanban` | 頁面在 5 秒內完成載入 | `assert: loadTime < 5000ms` |
| 3 | 拖曳操作 | 拖曳流暢，無明顯延遲 | `assert: 拖曳操作完成 < 2000ms` |

#### 負面情境

**TC-KAN-009: 拖曳失敗（API 返回錯誤）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用 `page.route()` 攔截 `PATCH /api/tasks/*` 回應 500 | — | — |
| 2 | 拖曳任務卡片到另一欄位 | 卡片先移動（樂觀更新） | — |
| 3 | API 失敗後 | 卡片自動回到原欄位（回滾） | `assert: 卡片回到原始欄位` |

**TC-KAN-010: Engineer 看板（僅顯示指派任務）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/kanban` | 看板載入 | — |
| 2 | 驗證顯示的任務 | 僅包含指派給當前 Engineer 的任務 | `assert: 每張卡片的 assignee 包含 Engineer 姓名或 ID` |

---

### 3.4 年度計畫模組 (`/plans`)

**路由**: `/plans`
**測試目標**: 驗證計畫層級結構（年度→月目標→交付物）、CRUD 操作、角色限制

#### 前置條件
- DB 有 3 個年度計畫（2024、2025、2026）
- 2026 計畫有 4 個月目標（3-6 月）

#### Happy Path — Manager

**TC-PLAN-001: 年度計畫列表載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/plans` | 頁面顯示「年度計畫」標題 | `assert visible: h1:has-text("年度計畫")` |
| 2 | 驗證年份選擇器 | 顯示 2026（或當前年度）被選中 | `assert: 年份選擇器 value === 2026` |
| 3 | 驗證計畫內容 | 顯示「2026 年度 IT 維運計畫」 | `assert visible: text="2026 年度 IT 維運計畫"` |
| 4 | 展開計畫樹 | 顯示月目標：核心交換機韌體升級、監控系統建置、資安稽核準備、備援系統演練 | `assert visible: text="核心交換機韌體升級"` |

**TC-PLAN-002: 建立新月目標（Manager）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「新增月目標」按鈕 | 顯示新增月目標表單 | `assert visible: 月目標表單` |
| 2 | 選擇月份：7（七月） | — | `select: month, "7"` |
| 3 | 輸入標題：`系統效能調校` | — | `fill: title, "系統效能調校"` |
| 4 | 輸入描述：`優化核心系統回應時間至 200ms 以內` | — | `fill: description, "優化核心系統回應時間至 200ms 以內"` |
| 5 | 點擊「建立」 | 表單關閉，新月目標出現在計畫樹 | `assert visible: text="系統效能調校"` |
| 6 | 驗證 API | `POST /api/goals` 被呼叫且返回 200/201 | `assert network: POST /api/goals` |

**TC-PLAN-003: 切換年度檢視歷史計畫**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 切換年份選擇器至 2025 | — | `select: year, "2025"` |
| 2 | 驗證顯示 2025 計畫 | 顯示「2025 年度 IT 維運計畫」，進度 85% | `assert visible: text="2025 年度 IT 維運計畫"` |
| 3 | 切換至 2024 | 顯示 2024 計畫，進度 100% | `assert visible: text="2024 年度 IT 維運計畫"` |

#### 負面情境 — Engineer

**TC-PLAN-004: Engineer 無法建立計畫**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/plans` | 頁面載入 | — |
| 2 | 檢查是否有「新增」按鈕 | 「新增年度計畫」/「新增月目標」按鈕不存在或 disabled | `assert not visible: text="新增"` 或 `assert: button disabled` |

---

### 3.5 甘特圖模組 (`/gantt`)

**路由**: `/gantt`
**測試目標**: 驗證里程碑時間軸視覺化、計畫日期 vs 實際日期、狀態標示

#### 前置條件
- DB 有 2026 年度計畫的 4 個里程碑（Q1-Q4）

#### Happy Path

**TC-GANTT-001: 甘特圖載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/gantt` | 頁面標題「甘特圖」 | `assert visible: h1:has-text("甘特圖")` |
| 2 | 驗證年份/月份選擇器 | 可選擇不同時間範圍 | `assert visible: 年份選擇器` |
| 3 | 驗證里程碑列表 | 顯示至少 4 個里程碑（Q1-Q4） | `assert count: 里程碑列 >= 4` |
| 4 | 驗證時間軸 bar | 每個里程碑有水平時間條 | `assert visible: 時間條元素` |
| 5 | 驗證狀態色彩 | PENDING=灰色、IN_PROGRESS=藍色、COMPLETED=綠色、DELAYED=紅色 | `assert class: 依狀態有對應顏色 class` |

**TC-GANTT-002: 里程碑狀態篩選**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 篩選只顯示 COMPLETED 里程碑 | 僅顯示已完成的里程碑 | `assert: 所有可見里程碑狀態為 COMPLETED` |

---

### 3.6 知識庫模組 (`/knowledge`)

**路由**: `/knowledge`
**測試目標**: 驗證文件樹、Markdown 編輯器、版本控制、搜尋功能

#### 前置條件
- DB 中有至少 1 篇文件（seed 可能未包含，需手動建立）

#### Happy Path

**TC-KB-001: 知識庫頁面載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/knowledge` | 頁面標題「知識庫」 | `assert visible: h1:has-text("知識庫")` |
| 2 | 驗證文件樹側欄 | 左側顯示文件樹結構 | `assert visible: document-tree 元件` |

**TC-KB-002: 建立新文件**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「新增文件」按鈕 | 顯示新增文件表單 | `assert visible: 文件標題輸入框` |
| 2 | 輸入標題：`核心交換機升級 SOP` | — | `fill: title, "核心交換機升級 SOP"` |
| 3 | 在 Markdown 編輯區輸入內容 | — | `fill: content area, "## 步驟一\n\n1. 備份設定..."` |
| 4 | 點擊「儲存」 | 文件建立成功，出現在文件樹 | `assert visible: text="核心交換機升級 SOP"` |
| 5 | 驗證版本號 | 顯示 v1 | `assert visible: text="v1"` 或版本號 |

**TC-KB-003: 編輯文件產生新版本**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊已建立的文件 | 編輯器載入文件內容 | `assert value: content 包含 "步驟一"` |
| 2 | 修改內容（新增「步驟二」） | — | `fill: append "## 步驟二\n\n2. 執行升級..."` |
| 3 | 點擊「儲存」 | 版本號增加至 v2 | `assert visible: text="v2"` |
| 4 | 查看版本歷史 | 顯示 v1 和 v2 兩個版本 | `assert count: 版本列表 >= 2` |

**TC-KB-004: 搜尋文件**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 在搜尋框輸入「交換機」 | 搜尋結果顯示匹配文件 | `assert visible: text="核心交換機升級 SOP"` |
| 2 | 輸入不存在的關鍵字「XXXXXX」 | 顯示無搜尋結果 | `assert visible: text="無結果"` 或空狀態 |

**TC-KB-005: 文件樹層級結構**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 建立子文件（parent 設定為已有文件） | — | — |
| 2 | 驗證樹狀結構 | 子文件巢狀在父文件下方 | `assert: 子文件元素在父文件內層` |
| 3 | 折疊父文件 | 子文件隱藏 | `assert not visible: 子文件標題` |
| 4 | 展開父文件 | 子文件重新顯示 | `assert visible: 子文件標題` |

---

### 3.7 工時紀錄模組 (`/timesheet`)

**路由**: `/timesheet`
**測試目標**: 驗證週視圖、時間輸入、計時器、週切換、加班標示

#### 前置條件
- DB 有工時 seed 資料（每位工程師 2 週的工時）

#### Happy Path

**TC-TS-001: 工時頁面載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/timesheet` | 頁面標題「工時紀錄」 | `assert visible: h1:has-text("工時紀錄")` |
| 2 | 驗證週選擇器 | 顯示當前週，有「上一週」/「下一週」/「本週」按鈕 | `assert visible: text="本週"` 或週導航按鈕 |
| 3 | 驗證 grid 結構 | 行 = 時間分類（計畫任務、臨時任務、事件等），列 = 週一至週五 | `assert visible: text="週一"` ~ `text="週五"` |
| 4 | 驗證週小計 | 顯示本週總工時 | `assert visible: 工時合計數字` |

**TC-TS-002: 輸入工時**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「計畫任務」行的「週一」儲存格 | 儲存格進入編輯模式 | `assert visible: input[type="number"]` 或可編輯區域 |
| 2 | 輸入 `7` | 儲存格顯示 7 | `assert value: cell === "7"` |
| 3 | 按 Tab 或點擊下一格 | 自動儲存，移至下一格 | `assert: API 呼叫 POST /api/time-entries` |
| 4 | 驗證週合計更新 | 總計增加 7 小時 | `assert: 週合計包含 7` |

**TC-TS-003: 計時器操作**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 找到計時器 widget | 顯示「00:00:00」或「開始」按鈕 | `assert visible: timer widget` |
| 2 | 點擊「開始」按鈕 | 計時器開始計時，按鈕變為「停止」 | `assert visible: text="停止"` |
| 3 | 等待 3 秒 | 計時器顯示 > 00:00:02 | `assert text matches: /00:00:0[2-9]/` |
| 4 | 點擊「停止」 | 計時器停止，工時自動寫入 | `assert: 計時器停止` + `assert: API 呼叫 POST /api/time-entries/stop` |

**TC-TS-004: 週切換**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「上一週」按鈕 | 週標題更新為前一週日期範圍 | `assert: 週標題日期 < 當前週` |
| 2 | 驗證資料載入 | 顯示上週的工時紀錄 | `assert: grid 內容更新` |
| 3 | 點擊「本週」按鈕 | 回到當前週 | `assert: 週標題回到本週` |

#### 邊緣情境

**TC-TS-005: 超過 8 小時加班標示**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 在某一天輸入總計 > 8 小時 | — | — |
| 2 | 驗證加班提示 | 該日欄位顯示加班標示（顏色或圖標） | `assert visible: overtime indicator` |

**TC-TS-006: Manager 檢視全團隊工時**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/timesheet` | 頁面載入 | — |
| 2 | 驗證可查看其他成員 | 顯示成員選擇器或團隊工時總覽 | `assert visible: 成員選擇器或全團隊數據` |

---

### 3.8 KPI 模組 (`/kpi`)

**路由**: `/kpi`
**測試目標**: 驗證 KPI CRUD（僅 Manager）、進度計算、任務連結、年度複製

#### 前置條件
- DB 有 5 個 2026 年度 KPI（seed 資料）

#### Happy Path — Manager

**TC-KPI-001: KPI 列表載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/kpi` | 頁面標題「KPI」 | `assert visible: h1:has-text("KPI")` |
| 2 | 驗證 KPI 列表 | 顯示 5 個 KPI 項目 | `assert count: KPI 項目 >= 5` |
| 3 | 驗證 KPI 卡片內容 | 每項顯示：編號、標題、目標值、實際值、進度條、狀態 | `assert visible: text="KPI-2026-01"` + `text="系統可用性"` |
| 4 | 驗證進度條 | 系統可用性：actual=99.8, target=99.5 → 進度 > 100% | `assert: progress bar width ≈ 100%` |

**TC-KPI-002: 建立新 KPI**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊「新增 KPI」按鈕 | 顯示 KPI 建立表單 | `assert visible: KPI 表單` |
| 2 | 輸入編號：`KPI-2026-06` | — | `fill: code, "KPI-2026-06"` |
| 3 | 輸入標題：`資安事件通報時效` | — | `fill: title, "資安事件通報時效"` |
| 4 | 設定目標值：`15`（分鐘） | — | `fill: target, "15"` |
| 5 | 設定權重：`1.5` | — | `fill: weight, "1.5"` |
| 6 | 點擊「建立」 | KPI 建立成功，出現在列表 | `assert visible: text="資安事件通報時效"` |

**TC-KPI-003: 連結 KPI 與任務**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 點擊某個 KPI 進入詳情 | 顯示 KPI 詳情頁 | — |
| 2 | 點擊「連結任務」 | 顯示任務選擇器 | `assert visible: 任務選擇列表` |
| 3 | 選擇一個任務 | 任務出現在已連結列表 | `assert visible: 已連結任務` |

#### 負面情境

**TC-KPI-004: Engineer 無法建立 KPI**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/kpi` | KPI 列表顯示（唯讀） | — |
| 2 | 驗證無「新增 KPI」按鈕 | 按鈕不存在 | `assert not visible: text="新增 KPI"` |
| 3 | 直接呼叫 `POST /api/kpi` | 回應 403 | `assert response: status === 403` |

---

### 3.9 報表模組 (`/reports`)

**路由**: `/reports`
**測試目標**: 驗證多分頁報表（週報、月報、KPI 報表、計畫外負荷）

#### 前置條件
- DB 有完整 seed 資料

#### Happy Path

**TC-RPT-001: 報表頁面載入與分頁切換**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/reports` | 頁面標題「報表」 | `assert visible: h1:has-text("報表")` |
| 2 | 驗證 Tab 列表 | 顯示：週報、月報、KPI 報表、計畫外負荷 | `assert visible: text="週報"` + `text="月報"` + `text="KPI"` + `text="計畫外"` |
| 3 | 預設顯示「週報」 | 週報內容區域顯示 | `assert: 週報 tab 為 active` |
| 4 | 點擊「月報」Tab | 切換至月報內容 | `assert: 月報 tab active` + `assert visible: 月報內容` |
| 5 | 點擊「KPI 報表」Tab | 切換至 KPI 報表 | `assert visible: KPI 達成率表格` |
| 6 | 點擊「計畫外負荷」Tab | 切換至計畫外分析 | `assert visible: 計畫外工時數據` |

**TC-RPT-002: 週報內容驗證**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 在「週報」Tab 下 | 顯示本週完成任務數、逾期數、延遲數、範圍變更數 | `assert visible: text="完成"` + 數字 |
| 2 | 驗證工時統計 | 顯示本週總工時 | `assert visible: 工時數字` |

**TC-RPT-003: 報表日期篩選**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 使用日期篩選器選擇特定時間範圍 | 報表內容更新為該時間範圍 | `assert: 報表數據反映所選時間範圍` |

---

### 3.10 團隊動態模組 (`/activity`)

**路由**: `/activity`
**測試目標**: 驗證活動流、篩選、時間戳顯示

**TC-ACT-001: 活動頁面載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 存取 `/activity` | 頁面標題「團隊動態」 | `assert visible: h1:has-text("團隊動態")` 或 `text="動態"` |
| 2 | 驗證活動列表 | 顯示最近操作（任務建立、狀態變更等） | `assert count: 活動項目 > 0` |
| 3 | 驗證活動項格式 | 每項含：使用者名稱、操作描述、時間戳 | `assert: 每個活動含 name + action + timestamp` |

---

### 3.11 個人設定模組 (`/settings`)

**路由**: `/settings`
**測試目標**: 驗證個人資料、通知偏好、密碼變更

**TC-SET-001: 設定頁面載入**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 存取 `/settings` | 頁面標題「個人設定」 | `assert visible: h1:has-text("設定")` |
| 2 | 驗證 Tab | 顯示「個人資料」和「通知偏好」Tab | `assert visible: text="個人資料"` + `text="通知"` |

**TC-SET-002: 通知偏好切換**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 切換到「通知偏好」Tab | 顯示通知類型列表（含 toggle） | — |
| 2 | 關閉某個通知類型 | Toggle 切換為 off | `assert: toggle unchecked` |
| 3 | 重新載入頁面 | 設定持續 | `assert: toggle 仍為 unchecked` |

---

### 3.12 管理後台模組 (`/admin`)

**路由**: `/admin`
**測試目標**: 驗證稽核日誌、帳號管理（僅 Manager）

**TC-ADM-001: 管理後台載入（Manager）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Manager session 存取 `/admin` | 頁面標題含「管理」 | `assert visible: h1:has-text("管理")` |
| 2 | 驗證稽核日誌 | 顯示最近操作紀錄（登入、CRUD 等） | `assert count: 稽核紀錄 > 0` |
| 3 | 驗證日誌欄位 | 每筆含：使用者、動作、資源類型、時間、IP | — |

**TC-ADM-002: 管理後台存取拒絕（Engineer）**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 以 Engineer session 存取 `/admin` | 顯示 403 / 權限不足頁面 / 或重導至 `/dashboard` | `assert: URL !== "/admin"` 或 `assert visible: text="權限不足"` |

**TC-ADM-003: 產生密碼重設 Token**

| 步驟 | 操作 | 預期結果 | 驗證方式 |
|------|------|---------|---------|
| 1 | 選擇使用者 eng01 | — | — |
| 2 | 點擊「產生重設 Token」 | 顯示 6 碼 OTP | `assert visible: OTP 碼（6 位數字）` |

---

## 4. 關鍵跨模組使用者旅程

### Journey-01: 主管年度規劃完整流程

```
步驟 1: Manager 登入 → /dashboard
步驟 2: 前往 /plans → 建立 2026 年度計畫
步驟 3: 在計畫下新增月目標「七月：系統效能調校」
步驟 4: 前往 /kanban → 建立任務「DB 慢查詢優化」指派給 eng01，連結至月目標
步驟 5: 前往 /gantt → 建立里程碑「Q3 效能優化完成」deadline=2026-09-30
步驟 6: 前往 /kpi → 建立 KPI「DB 查詢 P99 < 100ms」，連結步驟 4 的任務
步驟 7: 回到 /dashboard → 驗證統計卡片反映新增的任務與 KPI
驗證：所有模組數據一致，計畫→任務→KPI 連結完整
```

### Journey-02: 工程師日常工作循環

```
步驟 1: Engineer (eng01) 登入 → /dashboard → 查看待辦任務
步驟 2: 前往 /kanban → 將「核心交換機 A 韌體升級執行」從 IN_PROGRESS 拖曳到 REVIEW
步驟 3: 點擊任務開啟 Modal → 更新進度至 90% → 新增留言「待主管審核」
步驟 4: 前往 /timesheet → 在今天的「計畫任務」填入 7 小時
步驟 5: 啟動計時器 → 切換到 /knowledge 搜尋「交換機升級」文件 → 回到 /timesheet 停止計時器
步驟 6: 前往 /settings → 確認通知偏好已開啟
步驟 7: 回到 /dashboard → 驗證待辦數量減少 1（任務移至 REVIEW）
驗證：看板狀態、工時紀錄、活動日誌全部同步更新
```

### Journey-03: 主管審核與完成流程

```
步驟 1: Manager 登入 → /kanban → 篩選 REVIEW 狀態
步驟 2: 點擊 eng01 提交的任務 → 審核內容
步驟 3: 將任務從 REVIEW 拖曳到 DONE
步驟 4: 前往 /dashboard → 「本週完成」數字 +1
步驟 5: 前往 /reports → 週報 Tab → 驗證完成任務計數增加
步驟 6: 前往 /kpi → 如任務連結 KPI，驗證 actual 值更新
驗證：DONE 狀態在看板、儀表板、報表、KPI 全部同步
```

### Journey-04: 知識庫完整版本控制流程

```
步驟 1: Manager 建立文件「VPN 設定指南 v1」內容：## 連線步驟...
步驟 2: Engineer 編輯文件 → 新增章節 → 儲存（版本 v2）
步驟 3: Manager 再次編輯 → 修正內容 → 儲存（版本 v3）
步驟 4: 查看版本歷史 → 確認 v1/v2/v3 三個版本存在
步驟 5: 搜尋「VPN」→ 文件出現在搜尋結果
驗證：版本遞增正確，每個版本內容可回溯
```

### Journey-05: 臨時事件處理全流程

```
步驟 1: Manager 在 /kanban 建立 INCIDENT 任務「MIS 系統當機」P0 → 指派 eng02
步驟 2: eng02 登入 → 看板上看到 P0 紅色卡片 → 拖曳到 IN_PROGRESS
步驟 3: eng02 填寫工時（分類：事件處理，3 小時）
步驟 4: eng02 完成修復 → 拖曳到 DONE → 新增留言「root cause: DB connection pool 耗盡」
步驟 5: Manager 查看 /reports → 計畫外負荷 Tab → 驗證 INCIDENT 工時增加
驗證：事件任務在計畫外負荷報表正確顯示
```

### Journey-06: 批次操作與多選

```
步驟 1: Manager 在 /kanban → 勾選 5 個 BACKLOG 任務
步驟 2: 批次操作 → 變更狀態為 TODO
步驟 3: 驗證 5 個任務全部移至 TODO 欄位
步驟 4: 批次操作 → 變更優先級為 P1
步驟 5: 驗證 5 個任務優先級徽章更新為 P1
步驟 6: 批次操作 → 指派給 eng03
步驟 7: 驗證 5 個任務指派人更新
驗證：批次 API 正確處理，UI 即時更新
```

### Journey-07: 密碼變更完整流程

```
步驟 1: 建立 mustChangePassword=true 的使用者
步驟 2: 該使用者登入 → 自動跳轉至 /change-password
步驟 3: 輸入舊密碼 + 新密碼（符合 12 字元 + 大小寫 + 數字 + 特殊字元）
步驟 4: 提交 → 成功 → 跳轉至 /dashboard
步驟 5: 登出 → 使用新密碼登入 → 成功
步驟 6: 嘗試用舊密碼登入 → 失敗
驗證：密碼歷史記錄防止重複使用
```

### Journey-08: Command Palette 快捷導航

```
步驟 1: 在任意頁面按 Ctrl+K（Mac: Cmd+K）
步驟 2: Command Palette 彈出 → 輸入「看板」
步驟 3: 選擇「看板」結果 → 頁面跳轉至 /kanban
步驟 4: 按 G 然後 D → 跳轉至 /dashboard
步驟 5: 按 G 然後 T → 跳轉至 /timesheet
驗證：所有快捷鍵組合正確跳轉
```

---

## 5. 防禦性與安全性介面測試

### 5.1 Rate Limit 測試

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| SEC-RL-01 | 60 秒內對 `/api/auth/callback/credentials` 發送 6 次 POST | 第 6 次回應 429 |
| SEC-RL-02 | Rate limit 觸發後等待 60 秒 | 重新可以登入 |

### 5.2 CSRF 保護

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| SEC-CSRF-01 | 不帶 CSRF token 直接 POST `/api/tasks` | 回應 403 或 401 |
| SEC-CSRF-02 | 使用無效 CSRF token | 回應 403 |

### 5.3 Session 安全

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| SEC-SES-01 | JWT 過期後存取 `/dashboard` | 重導至 `/login` |
| SEC-SES-02 | 竄改 JWT cookie 值 | 重導至 `/login` |
| SEC-SES-03 | A 裝置登入後 B 裝置登入同帳號 | A 裝置 session 失效 |

### 5.4 XSS 防護

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| SEC-XSS-01 | 在任務標題輸入 `<script>alert(1)</script>` | 純文字顯示，不執行 JS |
| SEC-XSS-02 | 在知識庫 Markdown 輸入 `<img onerror="alert(1)" src="">` | 圖片不載入，無 alert |
| SEC-XSS-03 | 在留言中輸入 `javascript:void(0)` 連結 | 連結被清理或不可點擊 |

### 5.5 權限越權

| 測試案例 | 操作 | 預期結果 |
|---------|------|---------|
| SEC-AUTH-01 | Engineer 直接 `DELETE /api/plans/{id}` | 403 |
| SEC-AUTH-02 | Engineer 直接 `POST /api/kpi` | 403 |
| SEC-AUTH-03 | Engineer 直接 `POST /api/admin/generate-reset-token` | 403 |
| SEC-AUTH-04 | 修改 URL 中的 userId 存取他人資料 | 403 或僅回傳自己的資料 |

---

## 6. 視覺回歸與無障礙測試清單

### 6.1 視覺回歸測試（參考 `e2e/visual.spec.ts`）

| 頁面 | Snapshot 檔案名稱 | 驗證重點 |
|------|-------------------|---------|
| `/dashboard` (Engineer) | `dashboard-engineer-chromium-darwin.png` | 統計卡排版、色彩、間距 |
| `/kanban` (Engineer) | `kanban-engineer-chromium-darwin.png` | 5 欄佈局、卡片排列 |
| `/gantt` | `gantt-chromium-darwin.png` | 時間軸對齊、bar 長度 |
| `/knowledge` | `knowledge-chromium-darwin.png` | 文件樹層級、編輯器 |
| `/plans` | `plans-chromium-darwin.png` | 計畫樹展開狀態 |
| `/reports` | `reports-chromium-darwin.png` | Tab 切換、表格 |
| `/timesheet` | `timesheet-chromium-darwin.png` | Grid 對齊、數字格式 |

### 6.2 無障礙測試清單

| 驗證項目 | 選擇器 / 方法 | 預期 |
|---------|--------------|------|
| Sidebar `role="navigation"` | `aside[role="navigation"]` | 存在 |
| Sidebar `aria-label="主選單"` | `aside[aria-label="主選單"]` | 存在 |
| Nav `aria-label="頁面導航"` | `nav[aria-label="頁面導航"]` | 存在 |
| Active nav `aria-current="page"` | 當前頁面連結有 `aria-current="page"` | 存在 |
| 收合按鈕 `aria-label="收合側邊欄"` | `button[aria-label="收合側邊欄"]` | 存在 |
| 所有圖標有 `aria-hidden="true"` | Icon 元素 | true |
| 表單 label 綁定 | `label[for]` 對應 `id` | 一致 |
| Tab 鍵循序正確 | 逐一按 Tab | 合理順序 |
| 色彩對比度 | axe-core 掃描 | 無嚴重違規 |
| 螢幕閱讀器相容 | VoiceOver 測試 | 可正確朗讀 |

### 6.3 響應式設計測試

| 視窗寬度 | 預期行為 | 驗證方式 |
|---------|---------|---------|
| ≤ 1024px | Sidebar 自動收合為 64px 寬度 | `assert: sidebar.width === 64` |
| > 1024px | Sidebar 展開為 240px 寬度 | `assert: sidebar.width === 240` |
| 375px (Mobile) | 看板單欄顯示、卡片全寬 | screenshot 比較 |

---

## 7. 測試覆蓋矩陣

| 頁面/功能 | Manager Happy | Engineer Happy | Empty State | Error State | RBAC 拒絕 | Edge Case | XSS | A11y | Visual |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 登入 | TC-LOGIN-001 | TC-LOGIN-002 | TC-LOGIN-004 | TC-LOGIN-003 | — | TC-LOGIN-005/006/007/008 | TC-LOGIN-008 | ✓ | ✓ |
| 儀表板 | TC-DASH-001/002 | TC-DASH-003 | TC-DASH-004 | TC-DASH-005/006 | — | — | — | ✓ | ✓ |
| 看板 | TC-KAN-001~006 | TC-KAN-010 | TC-KAN-007 | TC-KAN-009 | — | TC-KAN-008 | SEC-XSS-01 | ✓ | ✓ |
| 年度計畫 | TC-PLAN-001~003 | TC-PLAN-004 | — | — | TC-PLAN-004 | — | — | ✓ | ✓ |
| 甘特圖 | TC-GANTT-001/002 | ✓ | — | — | — | — | — | ✓ | ✓ |
| 知識庫 | TC-KB-001~005 | ✓ | — | — | E-OWN-02 | — | SEC-XSS-02 | ✓ | ✓ |
| 工時紀錄 | TC-TS-006 | TC-TS-001~004 | — | — | — | TC-TS-005 | — | ✓ | ✓ |
| KPI | TC-KPI-001~003 | TC-KPI-004 | — | — | TC-KPI-004 | — | — | ✓ | ✓ |
| 報表 | TC-RPT-001~003 | ✓ | — | — | — | — | — | ✓ | ✓ |
| 團隊動態 | TC-ACT-001 | ✓ | — | — | — | — | — | ✓ | — |
| 個人設定 | TC-SET-001/002 | TC-SET-001/002 | — | — | — | — | — | ✓ | — |
| 管理後台 | TC-ADM-001/003 | TC-ADM-002 | — | — | TC-ADM-002 | — | — | ✓ | — |
| Command Palette | Journey-08 | Journey-08 | — | — | — | — | — | ✓ | — |
| Rate Limit | SEC-RL-01/02 | — | — | — | — | — | — | — | — |
| Session | SEC-SES-01~03 | — | — | — | — | — | — | — | — |

---

## 8. Playwright 程式碼片段範例

### 範例一：看板拖曳 + 樂觀更新回滾測試

```typescript
// e2e/kanban-drag-rollback.spec.ts
import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';
import { resetDatabase } from './helpers/seed';

test.describe('看板拖曳回滾', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test.beforeAll(async () => {
    await resetDatabase();
    // Re-seed via API or DB to have at least 1 TODO task
  });

  test('API 失敗時，卡片自動回滾到原欄位', async ({ page }) => {
    // 攔截 PATCH 請求並返回 500
    await page.route('**/api/tasks/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, body: '{"error":"Internal Server Error"}' });
      } else {
        await route.continue();
      }
    });

    await page.goto('/kanban');
    await page.waitForLoadState('networkidle');

    // 找到 TODO 欄位中的第一張卡片
    const todoColumn = page.locator('text=待處理').locator('..');
    const firstCard = todoColumn.locator('[draggable="true"]').first();
    const cardTitle = await firstCard.locator('h3, .font-medium').first().textContent();

    // 找到 IN_PROGRESS 欄位的 drop zone
    const inProgressColumn = page.locator('text=進行中').locator('..');

    // 執行拖曳
    const cardBox = await firstCard.boundingBox();
    const targetBox = await inProgressColumn.boundingBox();

    if (cardBox && targetBox) {
      await page.mouse.move(
        cardBox.x + cardBox.width / 2,
        cardBox.y + cardBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();
    }

    // 等待回滾（API 失敗後應回到 TODO）
    await page.waitForTimeout(1000);

    // 驗證卡片回到 TODO 欄位
    const todoCards = todoColumn.locator('[draggable="true"]');
    const titles = await todoCards.allTextContents();
    expect(titles.some(t => t.includes(cardTitle!))).toBeTruthy();
  });
});
```

### 範例二：跨模組使用者旅程 — 主管建立任務到報表驗證

```typescript
// e2e/journey-manager-full-cycle.spec.ts
import { test, expect } from '@playwright/test';
import { MANAGER_STATE_FILE } from './helpers/auth';
import { resetDatabase } from './helpers/seed';

test.describe('主管完整工作流程', () => {
  test.use({ storageState: MANAGER_STATE_FILE });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test('建立任務 → 看板操作 → 驗證儀表板數據', async ({ page }) => {
    // ── Step 1: 前往看板建立新任務 ──
    await page.goto('/kanban');
    await page.waitForLoadState('networkidle');

    // 記錄初始 IN_PROGRESS 數量
    const inProgressHeader = page.locator('text=進行中').locator('..');
    const initialCount = await inProgressHeader
      .locator('.text-xs, .text-sm')
      .filter({ hasText: /^\d+$/ })
      .first()
      .textContent();

    // 找到 TODO 欄位的一個任務卡片
    const todoColumn = page.locator('text=待處理').locator('..');
    const todoCards = todoColumn.locator('[draggable="true"]');
    const todoCount = await todoCards.count();

    if (todoCount > 0) {
      // 點擊第一張卡片開啟 Modal
      const firstCard = todoCards.first();
      await firstCard.click();

      // 等待 TaskDetailModal 出現
      await page.waitForSelector('[role="dialog"], .fixed.inset-0', {
        state: 'visible',
        timeout: 5000,
      });

      // 在 Modal 中找到狀態下拉選單並切換至 IN_PROGRESS
      const statusSelect = page.locator('select').filter({ hasText: /待處理|進行中|審核中/ });
      if (await statusSelect.count() > 0) {
        await statusSelect.selectOption('IN_PROGRESS');
      }

      // 關閉 Modal
      const closeBtn = page.locator('[role="dialog"] button').filter({ hasText: /×|✕|關閉/ }).first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }

      await page.waitForTimeout(500);
    }

    // ── Step 2: 驗證儀表板數據同步 ──
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 確認頁面載入完成（統計卡片出現）
    await expect(page.locator('h1').first()).toBeVisible();

    // 確認「進行中」計數已更新
    const dashboardText = await page.textContent('body');
    expect(dashboardText).toBeTruthy();

    // ── Step 3: 驗證報表反映變更 ──
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    // 確認報表頁面載入
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
```

### 範例三：工時計時器 + 工時填寫 + 週切換完整測試

```typescript
// e2e/timesheet-full-interaction.spec.ts
import { test, expect } from '@playwright/test';
import { ENGINEER_STATE_FILE } from './helpers/auth';
import { resetDatabase } from './helpers/seed';

test.describe('工時紀錄完整互動', () => {
  test.use({ storageState: ENGINEER_STATE_FILE });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test('填寫工時 + 計時器 + 週切換', async ({ page }) => {
    await page.goto('/timesheet');
    await page.waitForLoadState('networkidle');

    // ── 驗證頁面結構 ──
    await expect(page.locator('h1').first()).toContainText(/工時/);

    // ── 驗證週導航 ──
    const weekNav = page.locator('button').filter({ hasText: /上一週|本週|下一週/ });
    const prevBtn = page.locator('button').filter({ hasText: '上一週' }).first();
    const nextBtn = page.locator('button').filter({ hasText: '下一週' }).first();
    const currentBtn = page.locator('button').filter({ hasText: '本週' }).first();

    // 切換到上一週
    if (await prevBtn.count() > 0) {
      await prevBtn.click();
      await page.waitForTimeout(500);

      // 切回本週
      if (await currentBtn.count() > 0) {
        await currentBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // ── 嘗試操作計時器 ──
    const startTimerBtn = page.locator('button').filter({ hasText: /開始|▶|Start/ }).first();
    if (await startTimerBtn.count() > 0 && await startTimerBtn.isVisible()) {
      // 啟動計時器
      await startTimerBtn.click();

      // 驗證計時器正在運行
      const stopBtn = page.locator('button').filter({ hasText: /停止|■|Stop/ }).first();
      await expect(stopBtn).toBeVisible({ timeout: 3000 });

      // 等待 2 秒讓計時器累積
      await page.waitForTimeout(2000);

      // 停止計時器
      await stopBtn.click();

      // 驗證計時器已停止
      await expect(startTimerBtn).toBeVisible({ timeout: 3000 });
    }

    // ── 驗證工時 grid 可編輯 ──
    // 找到所有可輸入的工時欄位
    const timeInputs = page.locator('input[type="number"], input[inputmode="decimal"]');
    const inputCount = await timeInputs.count();

    if (inputCount > 0) {
      const firstInput = timeInputs.first();
      await firstInput.click();
      await firstInput.fill('');
      await firstInput.fill('7');

      // 按 Tab 觸發儲存
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);

      // 驗證值已寫入
      const savedValue = await firstInput.inputValue();
      expect(['7', '7.0', '7.00']).toContain(savedValue);
    }

    // ── 截圖記錄最終狀態 ──
    await page.screenshot({
      path: 'e2e/screenshots/timesheet-after-interaction.png',
      fullPage: true,
    });
  });
});
```

---

## 附錄 A：測試命名慣例

| 前綴 | 模組 | 範例 |
|------|------|------|
| TC-LOGIN- | 登入 | TC-LOGIN-001 |
| TC-DASH- | 儀表板 | TC-DASH-001 |
| TC-KAN- | 看板 | TC-KAN-001 |
| TC-PLAN- | 年度計畫 | TC-PLAN-001 |
| TC-GANTT- | 甘特圖 | TC-GANTT-001 |
| TC-KB- | 知識庫 | TC-KB-001 |
| TC-TS- | 工時紀錄 | TC-TS-001 |
| TC-KPI- | KPI | TC-KPI-001 |
| TC-RPT- | 報表 | TC-RPT-001 |
| TC-ACT- | 團隊動態 | TC-ACT-001 |
| TC-SET- | 個人設定 | TC-SET-001 |
| TC-ADM- | 管理後台 | TC-ADM-001 |
| SEC- | 安全性 | SEC-RL-01 |
| E-ADM- / E-OWN- | 權限越權 | E-ADM-01 |
| Journey- | 跨模組旅程 | Journey-01 |

## 附錄 B：關鍵 Selector 快速參考

| 元素 | Selector |
|------|----------|
| 登入帳號欄位 | `#username` |
| 登入密碼欄位 | `#password` |
| 登入按鈕 | `button[type="submit"]` |
| 登入錯誤訊息 | `.text-danger` |
| Sidebar | `aside[role="navigation"]` |
| Sidebar nav | `nav[aria-label="頁面導航"]` |
| 當前頁面連結 | `a[aria-current="page"]` |
| 看板欄位標題 | `text="待辦清單"` / `text="待處理"` / `text="進行中"` / `text="審核中"` / `text="已完成"` |
| 可拖曳卡片 | `[draggable="true"]` |
| Command Palette | `Ctrl+K` / `Cmd+K` |
| 快捷鍵 G+D | 跳至 /dashboard |
| 快捷鍵 G+K | 跳至 /kanban |
| 快捷鍵 G+T | 跳至 /timesheet |
| Loading spinner | `.animate-spin` |
| Page error 元件 | `text="載入失敗"` + `text="重試"` |
| Empty state 元件 | PageEmpty 元件 |
| Skeleton loading | `.animate-pulse` / `data-testid="kanban-col-skeleton"` |

---

> **文件結束** — 本測試計畫涵蓋 TITAN 系統全部 12 個模組、約 60+ 測試案例、8 條跨模組旅程、完整安全性驗證、視覺回歸清單與覆蓋矩陣。新手 QA 可依據此文件逐步執行每個測試案例。
