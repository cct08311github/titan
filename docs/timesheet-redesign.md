# TITAN 工時模組重構設計書 v2.0

> 版本：v2.0 | 日期：2026-03-26
> 狀態：設計階段（Draft）
> 前版：v1.0 已完成 Phase 1 全部功能（Timer、描述、列表視圖、任務選擇）

---

## 目錄

1. [Part 1：PM — 最佳典範研究 + 產品重新定位](#part-1pm--最佳典範研究--產品重新定位)
2. [Part 2：System Architect — 功能重構方案](#part-2system-architect--功能重構方案)

---

# Part 1：PM — 最佳典範研究 + 產品重新定位

## 1.1 競品分析

### 1.1.1 Toggl Track

| 面向 | 分析 |
|------|------|
| **易用性核心** | 「One-click timer」是其招牌。首頁就是一個大輸入框 + Play 按鈕，不需要先選專案就能開始計時。事後再補分類即可。 |
| **關鍵互動模式** | 1 click 開始計時、1 click 停止。手動輸入僅需填「描述 + 時長」兩個欄位。週檢視用橫向時間列（timeline）呈現。 |
| **記錄時間的步驟** | Timer 模式：1 click（開始）→ 1 click（停止）= **2 clicks**。手動模式：輸入描述 → 輸入時長 → 選專案（可選）= **3 步驟**。 |
| **行動端體驗** | 原生 iOS/Android App，支援 widget 一鍵開始計時。離線支援，上線後自動同步。 |
| **使用者最愛** | 「無摩擦的開始方式」、「漂亮的週報圖表」、「跨裝置同步」。Review 關鍵字：simple、fast、just works。 |

### 1.1.2 Harvest

| 面向 | 分析 |
|------|------|
| **易用性核心** | 以「專案 > 任務」兩層結構為中心。每日時間表格（day view）是主畫面，每列 = 一個專案/任務組合。 |
| **關鍵互動模式** | 點擊 "+" 新增列 → 選專案 → 選任務 → 輸入時長。也支援 timer。Timesheet approval workflow 成熟。 |
| **記錄時間的步驟** | 已有列的情況：1 click 在格子輸入 = **1-2 clicks**。新列：選專案 → 選任務 → 輸入 = **3-4 clicks**。 |
| **行動端體驗** | 原生 App，支援 timer + 手動輸入。UI 精簡但功能完整。 |
| **使用者最愛** | 「專案成本追蹤」、「Invoice 整合」、「Manager approval flow」。適合顧問/接案公司。 |

### 1.1.3 Clockify

| 面向 | 分析 |
|------|------|
| **易用性核心** | 免費產品中功能最完整。首頁 = timer bar（類似 Toggl）。支援 Timesheet 模式（週格子檢視），與 Timer 模式可切換。 |
| **關鍵互動模式** | Timesheet 模式：週一到日的格子表格，每列 = 專案+任務。直接在格子裡輸入數字。Timer 模式同 Toggl。 |
| **記錄時間的步驟** | Timesheet 模式：直接在格子輸入數字 = **1 click + type**。是所有產品中最少步驟的手動輸入。 |
| **行動端體驗** | 原生 App + PWA。Timer 一鍵啟動。 |
| **使用者最愛** | 「免費又完整」、「Timesheet view 超直覺」、「報表強大」。缺點：UI 稍顯擁擠。 |

### 1.1.4 Jira Tempo

| 面向 | 分析 |
|------|------|
| **易用性核心** | 與 Jira Issue 深度整合。在 Issue 頁面直接 log work，時間自動歸屬到 Issue。週檢視 = 日曆 + 格子。 |
| **關鍵互動模式** | 從 Issue 頁 log work：1 click 開 dialog → 輸入時長 → 送出 = **3 clicks**。Timesheet 格子：直接輸入。 |
| **記錄時間的步驟** | 格子模式：**1 click + type**。Issue 模式：**3 clicks**。 |
| **行動端體驗** | 依賴 Jira Mobile，體驗中等。Tempo 自己無獨立 mobile app。 |
| **使用者最愛** | 「與任務無縫整合」、「不用離開 Jira」。缺點：學習曲線高、設定複雜。 |

### 1.1.5 Linear（Cycle Tracking）

| 面向 | 分析 |
|------|------|
| **易用性核心** | 不是傳統 timesheet，而是以 Cycle（sprint）為單位自動追蹤任務完成率。時間是「推算」而非「手動填」。 |
| **關鍵互動模式** | 自動化：任務在 cycle 中移動時自動計算。手動調整：在 Issue 上設定 estimate → 完成時自動記錄。 |
| **記錄時間的步驟** | **0 clicks**（自動）。但不支援精確工時記錄。 |
| **行動端體驗** | 原生 App，但 cycle tracking 主要在 desktop 使用。 |
| **使用者最愛** | 「不用手動記時間」、「自動化報表」。缺點：不適合需要精確工時的場景（如計費、勞動法規遵循）。 |

### 1.1.6 Kimai（TITAN 正在替換的系統）

| 面向 | 分析 |
|------|------|
| **易用性核心** | 開源 PHP 系統。功能完整但 UI 陳舊。Timer + 手動輸入雙模式。 |
| **關鍵互動模式** | 點擊 "+" → 選客戶 → 選專案 → 選活動 → 輸入時長 + 描述 → 儲存 = **5-6 clicks**。 |
| **記錄時間的步驟** | **5-6 clicks** 最少。比所有商業產品都多。 |
| **行動端體驗** | 響應式網頁，無原生 App。Mobile 體驗差。 |
| **使用者最愛** | 「免費開源」、「自架掌控資料」。缺點：UI 過時、操作步驟多、缺乏現代 UX。 |

---

## 1.2 競品易用性比較矩陣

| 產品 | 最少操作步驟 | Timer 支援 | 週格子檢視 | 模板/快捷 | Mobile 體驗 | 審批流程 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Toggl Track | 2 clicks | 優 | 有 | 有（常用項目） | 優 | 無 |
| Harvest | 1-2 clicks | 有 | 有（日為主） | 有（收藏） | 良 | 有 |
| **Clockify** | **1 click + type** | 有 | **有（最佳）** | 有 | 良 | 有（付費） |
| Jira Tempo | 1 click + type | 有 | 有 | 有（複製週） | 中 | 有 |
| Linear | 0（自動） | N/A | N/A | N/A | 良 | N/A |
| Kimai | 5-6 clicks | 有 | 有（但笨重） | 無 | 差 | 有 |
| **TITAN 現狀** | **3-4 clicks** | 有 | 有（但有問題） | 有（API 存在但 UI 未整合） | 中 | 有 |

---

## 1.3 TITAN 現狀問題診斷

閱讀完目前的程式碼後，核心問題如下：

### UX 問題

1. **格子互動摩擦大**：點擊格子 → 彈出 popover → 填寫 4 個欄位（工時、分類、備註、加班）→ 點儲存。至少 **4-5 次互動** 才能記錄一筆。（`time-entry-cell.tsx` L159-L247）
2. **格子只顯示數字**：格子內只顯示「2h」，看不到分類和備註，必須再點開才能看。（`time-entry-cell.tsx` L144-L155）
3. **只支援週一到週五**：`DAYS = ["一", "二", "三", "四", "五"]`（`timesheet-grid.tsx` L13），假日加班無法在格子裡記錄。
4. **每格只對應一筆**：`getEntry()` 用 `find()` 只取第一筆（`timesheet-grid.tsx` L37-L41），同一天同一任務無法記錄多筆。
5. **Timer 與格子斷裂**：Timer 建立的 entry 和格子裡的 entry 是分開的流程，Timer 停止後需手動 refresh。
6. **模板功能未整合到 UI**：API 存在（`/templates`、`/templates/[id]/apply`）但頁面上沒有模板按鈕。
7. **複製上週功能未整合到 UI**：`/copy-week` API 存在但頁面沒有入口。
8. **批次輸入無 UI**：`/batch` API 存在但沒有對應的前端。
9. **手機體驗差**：格子表格在手機上需要橫向滾動，popover 可能被截斷。
10. **月報/結算無前端入口**：`/settle-month` 和 `/stats` 的數據無法滿足 Manager 月度審核需求。

### 資料模型問題

1. **overtime 欄位未被 API 處理**：Prisma schema 有 `overtime Boolean`，但 `createTimeEntrySchema`（`validators/shared/time-entry.ts`）和 API route 都沒有傳遞 overtime。前端 cell 有勾選框但 save 時沒送出。
2. **TimeEntryTemplate entries 用 JSON string**：不利於查詢和驗證。（`schema.prisma` L477）
3. **缺少「加班類型」區分**：只有 Boolean，無法區分平日加班 vs 假日加班。

---

## 1.4 新產品定位

### 核心互動原則

> **「記錄工時，2 步以內完成。」**

- 已有列的格子：**直接輸入數字 → 自動儲存** = 1 步
- 新增一筆：**點格子 → 輸入數字 → Enter** = 2 步
- Timer：**1 click 開始 → 1 click 停止** = 2 步

### 目標 UX 標竿

**以 Clockify 的 Timesheet 模式為主要參考，融合 Toggl 的 Timer 體驗。**

理由：
- Clockify 的週格子是業界最直覺的手動輸入方式（直接在格子裡 type 數字）
- Toggl 的 timer 是最低摩擦的自動計時
- 兩者結合 = 覆蓋手動 + 自動兩種使用場景

### 保留的現有設計

| 項目 | 理由 |
|------|------|
| 週檢視為主視圖 | 正確的設計選擇，與 Clockify/Harvest 一致 |
| TimeCategory 分類系統（6 類） | 合理，符合專案管理需求 |
| Timer start/stop API | 架構正確，只需改善前端整合 |
| 模板/複製週 API | 架構正確，需要前端整合 |
| Audit trail（TS-08） | 合規需求，必須保留 |
| Manager 鎖定/結算流程（TS-24/TS-25） | 業務流程正確 |
| Kimai 匯入 API（TS-31） | 遷移用，保留 |

### 完全重新設計的項目

| 項目 | 理由 |
|------|------|
| **格子互動方式** | 從 popover 改為 inline editing（直接在格子內輸入） |
| **格子顯示資訊** | 增加分類色條、hover 顯示備註 |
| **週日範圍** | 從週一~五改為週一~日（支援假日加班） |
| **加班標記** | 從 checkbox 改為自動偵測 + 手動標記雙模式 |
| **手機體驗** | 手機改用日檢視（而非格子），搭配大按鈕 + swipe 切換日期 |
| **Timer 整合** | Timer 位置從側欄提升到頂部 sticky bar，停止後直接填入格子 |
| **月報檢視** | 新增 Manager 專用月報頁面 |
| **快捷操作列** | 新增：複製上週、套用模板、批次填入 |

---

# Part 2：System Architect — 功能重構方案

## 2.1 新 UI 線框描述

### 2.1.1 主頁面結構（Desktop — 1024px+）

```
+------------------------------------------------------------------+
| [Sticky Timer Bar]                                                |
| +--------------------------------------------------------------+ |
| | > 開始計時  |  選擇任務 v  |  00:00:00  |  正在計時：XX任務   | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
| [Header Row]                                                      |
| +--------------------------------------------------------------+ |
| | 工時紀錄   2026年 3/23 -- 3/29         < 本週 >  | 格子|列表| | |
| |                                                                | |
| | [複製上週] [套用模板 v] [+ 新增列]             週|月 檢視      | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
| [Weekly Grid -- 主內容區]                                         |
| +---------+------+------+------+------+------+------+------+---+ |
| | 任務     | 週一 | 週二 | 週三 | 週四 | 週五 | 週六 | 週日 |合計| |
| |         | 3/23 | 3/24 | 3/25 | 3/26 | 3/27 | 3/28 | 3/29 |   | |
| +---------+------+------+------+------+------+------+------+---+ |
| | # 任務A | [8 ] |[7.5] | [8 ] | [  ] | [  ] | [  ] | [  ] |23.5|
| | # 任務B | [  ] |[0.5] | [  ] | [  ] | [  ] | [  ] | [  ] |0.5| |
| | o 自由   | [  ] | [  ] | [  ] | [  ] | [  ] | [  ] | [  ] | -- | |
| +---------+------+------+------+------+------+------+------+---+ |
| | 每日合計 |  8   |  8   |  8   |  --  |  --  |  --  |  --  | 24 | |
| +---------+------+------+------+------+------+------+------+---+ |
|                                                                   |
| * 綠色=正常  橘色=超時(>8h)  紫色=假日                             |
| * 格子直接輸入數字，按 Enter 或 Tab 自動儲存                        |
| * 點擊已有數字的格子可展開詳細編輯（分類、備註、加班標記）            |
+------------------------------------------------------------------+
| [Summary Panel]                                                   |
| +-------------------------------------------------------------+  |
| | 本週 24.0h | 任務投入率 97% | ======== 原始規劃 23.5h        |  |
| |                              | =        追加任務  0.5h       |  |
| +-------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 2.1.2 格子互動細節

#### 空格子（尚無記錄）

```
狀態 1: 未 focus
+------+
|  +   |  <-- 灰色虛線框，hover 顯示 "點擊新增"
+------+

狀態 2: 點擊後 -> 直接進入 inline edit
+------+
| [  ] |  <-- input 自動 focus，游標閃爍，可直接輸入數字
+------+

狀態 3: 輸入數字後按 Enter 或 Tab
+------+
|  8   |  <-- 自動儲存，預設 category=PLANNED_TASK
+------+     按 Tab 跳到右邊下一個格子
```

#### 已有記錄的格子

```
狀態 1: 顯示模式
+------+
| # 8  |  <-- 左邊色條 = 分類顏色，數字 = 工時
|  OT  |  <-- 如果是加班，右下角顯示 OT badge
+------+

狀態 2: 單擊 -> inline edit 數字
+------+
| [8 ] |  <-- 數字變成可編輯 input，修改後 Enter 儲存
+------+

狀態 3: 雙擊或長按 -> 展開詳細編輯面板（非 popover，而是格子下方展開）
+------------------------------------------+
| 工時: [8    ]  分類: [原始規劃 v]          |
| 備註: [完成使用者模組開發_____________]     |
| [x] 加班（平日/假日）  [平日加班 v]        |
|                        [儲存] [刪除] [取消] |
+------------------------------------------+
```

#### 同一天同一任務多筆記錄

```
格子顯示：
+------+
| # 8  |
| +0.5 |  <-- 下方顯示額外筆數及時數
+------+

展開後：
+--------------------------------------+
| #1  8h   原始規劃  開發使用者模組       |
| #2  0.5h 追加任務  緊急 bug fix        |
| [+ 新增一筆]                          |
+--------------------------------------+
```

### 2.1.3 手機版（<640px）— 日檢視模式

```
+-----------------------------+
| [Sticky Timer Bar -- 精簡版] |
| > 00:00:00    [開始]         |
+-----------------------------+
|    <  3/26（三）今天  >      |  <-- swipe 左右切換日期
+-----------------------------+
| +------------------------+  |
| | # 任務A                |  |
| |   8h  原始規劃          |  |  <-- 點擊展開編輯
| |   開發使用者模組        |  |
| +------------------------+  |
| +------------------------+  |
| | # 任務B                |  |
| |   0.5h  追加任務        |  |
| |   Bug fix               |  |
| +------------------------+  |
|                             |
| +------------------------+  |
| | 今日合計: 8.5h          |  |
| +------------------------+  |
|                             |
|      [+ 新增工時記錄]       |  <-- FAB 按鈕
+-----------------------------+
```

### 2.1.4 Manager 月報檢視

```
+--------------------------------------------------------------+
| 月報  2026 年 3 月        [篩選成員 v]  [結算本月]             |
+--------------------------------------------------------------+
| +----------+-------+-------+-------+------+------+--------+  |
| | 成員      | 正常  | 平日OT | 假日OT | 總計  | 投入率 | 狀態  |  |
| +----------+-------+-------+-------+------+------+--------+  |
| | 王小明    | 160h  |  12h  |  8h   | 180h | 85%  | v 已鎖 |  |
| | 李小華    | 152h  |   4h  |  0h   | 156h | 92%  | o 未鎖 |  |
| +----------+-------+-------+-------+------+------+--------+  |
|                                                               |
| [分類分佈圓餅圖]           [每週趨勢折線圖]                     |
+--------------------------------------------------------------+
```

---

## 2.2 資料模型變更

### 2.2.1 現有 Prisma Schema

```prisma
enum TimeCategory {
  PLANNED_TASK
  ADDED_TASK
  INCIDENT
  SUPPORT
  ADMIN
  LEARNING
}

model TimeEntry {
  id          String       @id @default(cuid())
  taskId      String?
  userId      String
  date        DateTime     @db.Date
  hours       Float
  category    TimeCategory @default(PLANNED_TASK)
  description String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  startTime   DateTime?
  endTime     DateTime?
  overtime    Boolean      @default(false)
  locked      Boolean      @default(false)
  isRunning   Boolean      @default(false)
  task        Task?        @relation(fields: [taskId], references: [id])
  user        User         @relation(fields: [userId], references: [id])
  @@index([taskId])
  @@index([userId])
  @@index([date])
  @@index([userId, isRunning])
}

model TimeEntryTemplate {
  id        String   @id @default(cuid())
  name      String
  userId    String
  entries   String   // JSON string
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  @@index([userId])
  @@map("time_entry_templates")
}
```

### 2.2.2 提議的 Schema 變更

```prisma
// --- 新增 enum -------------------------------------------------

enum OvertimeType {
  NONE        // 非加班
  WEEKDAY     // 平日加班
  HOLIDAY     // 假日加班（國定假日/週末）
}

// --- TimeEntry 修改 --------------------------------------------

model TimeEntry {
  id          String       @id @default(cuid())
  taskId      String?
  userId      String
  date        DateTime     @db.Date
  hours       Float
  category    TimeCategory @default(PLANNED_TASK)
  description String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  // 計時器
  startTime   DateTime?
  endTime     DateTime?
  isRunning   Boolean      @default(false)

  // 加班 -- 從 Boolean 改為 enum（向下相容遷移）
  overtime     Boolean      @default(false)   // 保留，遷移期間使用
  overtimeType OvertimeType @default(NONE)    // 新欄位：加班類型

  // 鎖定
  locked      Boolean      @default(false)

  // * 新增：排序用（同日同任務多筆時的排序）
  sortOrder   Int          @default(0)

  task Task? @relation(fields: [taskId], references: [id])
  user User  @relation(fields: [userId], references: [id])

  @@index([taskId])
  @@index([userId])
  @@index([date])
  @@index([userId, isRunning])
  @@index([userId, date])           // * 新增：加速「某使用者某天所有 entries」查詢
}

// --- TimeEntryTemplate 修改 ------------------------------------

model TimeEntryTemplate {
  id        String                @id @default(cuid())
  name      String
  userId    String
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt

  // * 從 JSON string 改為關聯表
  items     TimeEntryTemplateItem[]
  user      User                  @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("time_entry_templates")
}

// * 新增 model
model TimeEntryTemplateItem {
  id         String       @id @default(cuid())
  templateId String
  taskId     String?
  hours      Float
  category   TimeCategory @default(PLANNED_TASK)
  description String?
  sortOrder  Int          @default(0)

  template TimeEntryTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  task     Task?             @relation(fields: [taskId], references: [id])

  @@index([templateId])
  @@map("time_entry_template_items")
}

// --- 新增：使用者偏好設定 ----------------------------------------

model TimesheetPreference {
  id            String   @id @default(cuid())
  userId        String   @unique
  defaultView   String   @default("grid")   // "grid" | "list" | "day"
  showWeekends  Boolean  @default(true)
  defaultCategory TimeCategory @default(PLANNED_TASK)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@map("timesheet_preferences")
}
```

### 2.2.3 變更摘要

| 變更 | 類型 | 影響 | 遷移策略 |
|------|------|------|----------|
| 新增 `OvertimeType` enum | 新增 | 無破壞 | 新增 enum + 欄位，預設 `NONE` |
| `overtimeType` 欄位 | 新增 | 無破壞 | 新欄位預設 `NONE`，遷移腳本將 `overtime=true` 轉為 `WEEKDAY` |
| `sortOrder` on TimeEntry | 新增 | 無破壞 | 預設 0 |
| 複合 index `[userId, date]` | 新增 | 無破壞 | 加速查詢 |
| `TimeEntryTemplateItem` model | 新增 | 無破壞 | 新表，遷移腳本拆解現有 JSON |
| `TimesheetPreference` model | 新增 | 無破壞 | 新表 |
| `TimeEntryTemplate.entries` | 移除（Phase 5） | 需遷移 | Phase 1 保留 + 新表並存，Phase 5 移除 JSON 欄位 |

---

## 2.3 API 重新設計

### 2.3.1 現有 API 清單

| Method | Path | 用途 | 處置 |
|--------|------|------|:----:|
| GET | `/api/time-entries` | 列表查詢 | 修改 |
| POST | `/api/time-entries` | 新增 | 修改 |
| PUT | `/api/time-entries/[id]` | 更新 | 修改 |
| DELETE | `/api/time-entries/[id]` | 刪除 | 保留 |
| POST | `/api/time-entries/start` | 啟動 timer | 保留 |
| POST | `/api/time-entries/stop` | 停止 timer | 保留 |
| GET | `/api/time-entries/running` | 取得執行中 timer | 保留 |
| GET | `/api/time-entries/stats` | 統計 | 修改 |
| POST | `/api/time-entries/batch` | 批次建立 | 修改 |
| POST | `/api/time-entries/copy-week` | 複製上週 | 保留 |
| GET | `/api/time-entries/templates` | 模板列表 | 修改 |
| POST | `/api/time-entries/templates` | 建立模板 | 修改 |
| POST | `/api/time-entries/templates/[id]/apply` | 套用模板 | 保留 |
| PATCH | `/api/time-entries/[id]/review` | 鎖定/解鎖 | 保留 |
| POST | `/api/time-entries/settle-month` | 月結 | 保留 |
| POST | `/api/time-entries/import-kimai` | Kimai 匯入 | 保留 |

### 2.3.2 修改的 API

#### `POST /api/time-entries` — 新增欄位

```typescript
// 新增 request body 欄位
interface CreateTimeEntryBody {
  date: string;            // "2026-03-26"
  hours: number;           // 0.25 ~ 24
  taskId?: string | null;
  category?: TimeCategory; // 預設 PLANNED_TASK
  description?: string;
  overtimeType?: OvertimeType; // 新增：NONE | WEEKDAY | HOLIDAY
  sortOrder?: number;          // 新增：同日同任務排序
}
```

#### `PUT /api/time-entries/[id]` — 新增欄位

```typescript
interface UpdateTimeEntryBody {
  date?: string;
  hours?: number;
  taskId?: string;
  category?: TimeCategory;
  description?: string;
  overtimeType?: OvertimeType; // 新增
  sortOrder?: number;          // 新增
}
```

#### `POST /api/time-entries/batch` — 放寬重複限制

```typescript
// 現有行為：同 date + taskId 視為重複，直接拒絕
// 新行為：同 date + taskId 允許多筆（移除 overlap 檢查）
// 保留：批次內自身重複偵測 -> 改為自動設定 sortOrder
interface BatchCreateBody {
  entries: Array<{
    date: string;
    hours: number;
    taskId?: string;
    category?: TimeCategory;
    description?: string;
    overtimeType?: OvertimeType; // 新增
  }>;
}
```

#### `GET /api/time-entries/stats` — 增加月報數據

```typescript
// 新增 query params
// ?period=week|month  （預設 week）
// ?year=2026&month=3  （month 模式用）

// 新增 response 欄位
interface StatsResponse {
  totalHours: number;
  regularHours: number;            // 新增：非加班時數
  weekdayOvertimeHours: number;    // 新增：平日加班時數
  holidayOvertimeHours: number;    // 新增：假日加班時數
  breakdown: CategoryBreakdown[];
  taskInvestmentRate: number;
  entryCount: number;
  // 月報模式增加
  weeklyTrend?: WeeklyTrend[];     // 每週時數趨勢
  memberSummary?: MemberSummary[]; // Manager 專用：各成員摘要
}

interface WeeklyTrend {
  weekStart: string;
  totalHours: number;
  overtimeHours: number;
}

interface MemberSummary {
  userId: string;
  userName: string;
  regularHours: number;
  weekdayOvertimeHours: number;
  holidayOvertimeHours: number;
  totalHours: number;
  taskInvestmentRate: number;
  lockedCount: number;
  totalCount: number;
}
```

### 2.3.3 新增 API

#### `PUT /api/time-entries/inline` — Inline 快速儲存

專為格子 inline editing 設計的快速端點：只接收 `hours`，其餘欄位自動填入預設值。

```typescript
// PUT /api/time-entries/inline
interface InlineUpsertBody {
  taskId: string | null;
  date: string;           // "2026-03-26"
  hours: number;          // 直接覆寫
}

// 行為：
// 1. 找到 userId + date + taskId + sortOrder=0 的 entry
// 2. 若存在 -> 更新 hours
// 3. 若不存在 -> 建立新 entry（category=使用者預設, description=null）
// 4. 若 hours=0 -> 刪除該 entry
//
// Response: 更新後的 TimeEntry | { deleted: true }
```

#### `GET/PUT /api/time-entries/preferences` — 使用者偏好

```typescript
// GET /api/time-entries/preferences
// Response: TimesheetPreference

// PUT /api/time-entries/preferences
interface PreferencesBody {
  defaultView?: "grid" | "list" | "day";
  showWeekends?: boolean;
  defaultCategory?: TimeCategory;
}
```

#### `POST /api/time-entries/templates/from-week` — 從當週建立模板

```typescript
// POST /api/time-entries/templates/from-week
interface CreateTemplateFromWeekBody {
  name: string;
  weekStart: string; // "2026-03-23"
}

// 行為：取得該週所有 entries，去重後建立 template
// （只保留 taskId + hours + category + description，不保留日期）
```

---

## 2.4 React 元件分解

### 2.4.1 元件樹

```
app/(app)/timesheet/
  page.tsx                        <-- 頁面入口（Server Component wrapper）
  timesheet-client.tsx            <-- Client Component 主邏輯（從 page.tsx 拆出）

app/components/timesheet/         <-- * 新目錄：所有 timesheet 子元件
  timer-bar.tsx                   <-- Sticky Timer Bar（取代 timer-widget.tsx）
  week-header.tsx                 <-- 週導航 + 操作按鈕列
  weekly-grid.tsx                 <-- 週格子表格（取代 timesheet-grid.tsx）
  inline-cell.tsx                 <-- 單一格子（取代 time-entry-cell.tsx）
  cell-detail-panel.tsx           <-- 格子詳細編輯面板（雙擊展開）
  multi-entry-cell.tsx            <-- 同日同任務多筆顯示
  daily-view.tsx                  <-- 手機日檢視（新增）
  daily-entry-card.tsx            <-- 日檢視中的單筆卡片（新增）
  list-view.tsx                   <-- 列表檢視（重構自 timesheet-list-view.tsx）
  summary-panel.tsx               <-- 統計面板（重構自 time-summary.tsx）
  template-picker.tsx             <-- 模板選擇下拉（新增）
  template-save-dialog.tsx        <-- 儲存模板 dialog（新增）
  copy-week-button.tsx            <-- 複製上週按鈕（新增）
  month-report.tsx                <-- Manager 月報（新增）
  month-report-table.tsx          <-- 月報表格（新增）
  month-report-charts.tsx         <-- 月報圖表（新增）
  overtime-badge.tsx              <-- 加班標記 badge（新增）
  use-timesheet.ts                <-- * Custom hook：所有資料 fetch/mutate 邏輯
```

### 2.4.2 關鍵元件規格

#### `use-timesheet.ts` — 核心 Custom Hook

```typescript
interface UseTimesheetReturn {
  // State
  entries: TimeEntry[];
  weekStart: Date;
  loading: boolean;
  error: string | null;
  stats: StatsData | null;
  viewMode: ViewMode;
  runningTimer: RunningEntry | null;
  templates: Template[];
  preferences: TimesheetPreference;

  // Week navigation
  setWeekStart: (d: Date) => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToThisWeek: () => void;

  // CRUD
  inlineSave: (taskId: string | null, date: string, hours: number) => Promise<void>;
  detailSave: (id: string | undefined, data: DetailSaveData) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Timer
  startTimer: (taskId?: string) => Promise<void>;
  stopTimer: () => Promise<void>;

  // Shortcuts
  copyWeek: () => Promise<void>;
  applyTemplate: (templateId: string, date: string) => Promise<void>;
  saveAsTemplate: (name: string) => Promise<void>;

  // View
  setViewMode: (mode: ViewMode) => void;
}
```

所有 fetch/mutation 邏輯集中在此 hook，元件只負責渲染和使用者互動。

#### `inline-cell.tsx` — 格子元件（最核心的 UX 改進）

```typescript
interface InlineCellProps {
  entries: TimeEntry[];              // 可能多筆（同日同任務）
  taskId: string | null;
  date: string;
  isWeekend: boolean;
  isToday: boolean;
  onInlineSave: (hours: number) => void;      // 快速儲存（只改數字）
  onDetailOpen: (entryId?: string) => void;   // 開啟詳細面板
  onNavigate: (direction: "next" | "prev" | "up" | "down") => void;
}

// 行為：
// - 單擊：進入 inline edit mode（input 出現，直接輸入數字）
// - Enter/Tab：儲存並跳到下一格
// - Escape：取消
// - 雙擊/右鍵：開啟 detail panel
// - 顯示：[色條] [數字]h [OT badge]
// - 多筆時顯示：主筆數字 + "+N" 標記
```

#### `timer-bar.tsx` — Sticky Timer Bar

```typescript
interface TimerBarProps {
  runningTimer: RunningEntry | null;
  tasks: TaskOption[];
  onStart: (taskId?: string) => Promise<void>;
  onStop: () => Promise<void>;
}

// 行為：
// - 固定在頁面頂部
// - 未計時：顯示 [> 開始] + [任務選擇 dropdown]
// - 計時中：顯示 [|| 停止] + [00:12:34] + [正在計時：任務名稱]
// - 計時中背景微綠色脈動動畫
// - 停止後自動 refresh entries（現有 onTimerChange 邏輯保留）
```

#### `cell-detail-panel.tsx` — 詳細編輯面板

```typescript
interface CellDetailPanelProps {
  entries: TimeEntry[];              // 該格子的所有 entries
  taskId: string | null;
  date: string;
  onSave: (data: DetailSaveData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddEntry: () => void;            // 同格新增一筆
  onClose: () => void;
}

// 行為：
// - 在格子下方展開（不是 popover，不會被截斷）
// - 多筆時每筆顯示一列
// - 每列可獨立編輯：工時、分類、備註、加班類型
// - [+ 新增一筆] 按鈕在底部
// - Escape 關閉
```

---

## 2.5 遷移計劃

### 2.5.1 Phase 0：準備（無程式碼變更）

- [ ] 建立 GitHub Issue：`[TS-40] Timesheet 模組重構`
- [ ] 建立 sub-issues 對應每個 phase
- [ ] 備份現有 production 資料庫

### 2.5.2 Phase 1：資料模型遷移（向下相容）

**目標**：新增欄位和表，不破壞現有功能。

```
分支：feat/ts-40-schema-migration
```

1. 建立 Prisma migration：
   - 新增 `OvertimeType` enum
   - 新增 `TimeEntry.overtimeType` 欄位（預設 `NONE`）
   - 新增 `TimeEntry.sortOrder` 欄位（預設 `0`）
   - 新增 `TimeEntry` 複合 index `[userId, date]`
   - 新增 `TimeEntryTemplateItem` model
   - 新增 `TimesheetPreference` model

2. 資料遷移腳本（`scripts/migrate-overtime.ts`）：

```typescript
// 將現有 overtime=true 轉換為 overtimeType=WEEKDAY
await prisma.timeEntry.updateMany({
  where: { overtime: true },
  data: { overtimeType: "WEEKDAY" },
});

// 將現有 TimeEntryTemplate.entries JSON 拆解到 TimeEntryTemplateItem
const templates = await prisma.timeEntryTemplate.findMany();
for (const t of templates) {
  const entries = JSON.parse(t.entries);
  for (let i = 0; i < entries.length; i++) {
    await prisma.timeEntryTemplateItem.create({
      data: {
        templateId: t.id,
        taskId: entries[i].taskId || null,
        hours: entries[i].hours,
        category: entries[i].category ?? "PLANNED_TASK",
        description: entries[i].description || null,
        sortOrder: i,
      },
    });
  }
}
```

3. 測試：確認現有所有 tests 通過（新欄位有預設值，不影響既有邏輯）。

**預計工時**：2-3 天

### 2.5.3 Phase 2：API 擴充

**目標**：新增/修改 API，同時保持舊 API 相容。

```
分支：feat/ts-40-api-enhancements
```

1. 修改 `POST /api/time-entries`：接受 `overtimeType`
2. 修改 `PUT /api/time-entries/[id]`：接受 `overtimeType`
3. 修改 `POST /api/time-entries/batch`：移除同日同任務重複限制，接受 `overtimeType`
4. 修改 `GET /api/time-entries/stats`：增加 `period`、月報數據
5. 新增 `PUT /api/time-entries/inline`
6. 新增 `GET/PUT /api/time-entries/preferences`
7. 新增 `POST /api/time-entries/templates/from-week`
8. 修改 validators：更新 `createTimeEntrySchema`、`updateTimeEntrySchema`
9. 為所有新/修改的端點撰寫測試

**預計工時**：3-4 天

### 2.5.4 Phase 3：前端重構 — 核心

**目標**：重構格子互動 + Timer bar + 週末支援。

```
分支：feat/ts-40-ui-redesign-core
```

1. 建立 `app/components/timesheet/` 目錄
2. 實作 `use-timesheet.ts` custom hook
3. 實作 `inline-cell.tsx`（inline editing 核心）
4. 實作 `weekly-grid.tsx`（週一~日、多筆支援）
5. 實作 `timer-bar.tsx`（sticky timer）
6. 實作 `week-header.tsx`（導航 + 操作按鈕）
7. 重構 `page.tsx` 使用新元件
8. 端到端測試

**預計工時**：5-7 天

### 2.5.5 Phase 4：前端重構 — 進階功能

**目標**：模板 UI、複製上週、手機版、月報。

```
分支：feat/ts-40-ui-redesign-advanced
```

1. 實作 `template-picker.tsx` + `template-save-dialog.tsx`
2. 實作 `copy-week-button.tsx`
3. 實作 `daily-view.tsx` + `daily-entry-card.tsx`（手機版）
4. 實作 `cell-detail-panel.tsx`（多筆編輯、加班類型選擇）
5. 實作 `month-report.tsx` + `month-report-table.tsx` + `month-report-charts.tsx`
6. 響應式切換：desktop 自動格子，mobile 自動日檢視
7. 端到端測試

**預計工時**：5-7 天

### 2.5.6 Phase 5：清理 + 移除舊程式碼

**目標**：移除已被取代的元件。

```
分支：feat/ts-40-cleanup
```

1. 移除 `app/components/time-entry-cell.tsx`
2. 移除 `app/components/timesheet-grid.tsx`
3. 移除 `app/components/timesheet-list-view.tsx`
4. 移除 `app/components/timer-widget.tsx`
5. 移除 `app/components/time-summary.tsx`
6. 移除 `TimeEntryTemplate.entries` JSON 欄位（schema migration）
7. 移除 `TimeEntry.overtime` Boolean 欄位
8. 更新所有 import references
9. 全量回歸測試

**預計工時**：2-3 天

---

## 2.6 總體時程與風險

### 時程估計

| Phase | 工作天數 | 累計 |
|-------|:---:|:---:|
| Phase 0：準備 | 0.5 | 0.5 |
| Phase 1：Schema 遷移 | 2-3 | 3.5 |
| Phase 2：API 擴充 | 3-4 | 7.5 |
| Phase 3：前端核心 | 5-7 | 14.5 |
| Phase 4：前端進階 | 5-7 | 21.5 |
| Phase 5：清理 | 2-3 | 24.5 |
| **總計** | **18-25 工作天** | |

### 風險與對策

| 風險 | 影響 | 對策 |
|------|------|------|
| 資料遷移失敗（overtime boolean -> enum） | 高 | 遷移前完整備份，遷移腳本加入 dry-run 模式，Phase 1 保留舊欄位不刪除 |
| 格子 inline editing 在不同瀏覽器行為不一致 | 中 | 用 Playwright e2e 測試覆蓋 Chrome/Firefox/Safari |
| 手機版日檢視與桌面版資料不同步 | 中 | 共用 `use-timesheet` hook，單一資料源 |
| Phase 3 期間使用者同時使用新舊 UI | 低 | Phase 3 用 feature flag 控制，完成後一次切換 |
| Template JSON -> 關聯表遷移遺漏 | 中 | 遷移腳本加入計數驗證：轉換前後 entry 總數必須一致 |

### 回滾方案

每個 Phase 是獨立的 branch + PR，若某 Phase 出問題：
- **Phase 1**：`prisma migrate rollback` 回復 schema
- **Phase 2**：新 API 端點刪除即可，舊端點未動
- **Phase 3-4**：feature flag 關閉，回到舊 UI
- **Phase 5**：不回滾（只在所有功能確認穩定後執行）

---

## 附錄 A：鍵盤導航規格

格子支援完整鍵盤操作（Accessibility + 效率）：

| 按鍵 | 非編輯狀態 | 編輯狀態 |
|------|-----------|---------|
| `Enter` | 進入編輯 | 儲存並退出編輯 |
| `Escape` | -- | 取消編輯 |
| `Tab` | 移到右邊格子 | 儲存並移到右邊格子 |
| `Shift+Tab` | 移到左邊格子 | 儲存並移到左邊格子 |
| `Arrow Up` | 移到上方格子 | -- |
| `Arrow Down` | 移到下方格子 | -- |
| `Delete` | 刪除該格 entry | -- |
| 數字鍵 | 進入編輯並輸入 | 輸入 |

## 附錄 B：分類顏色對照

| 分類 | 代碼 | 色條顏色 | 用途說明 |
|------|------|---------|---------|
| 原始規劃 | `PLANNED_TASK` | 藍 (`blue-500`) | Sprint 內的計畫任務 |
| 追加任務 | `ADDED_TASK` | 紫 (`purple-500`) | Sprint 中途加入的任務 |
| 突發事件 | `INCIDENT` | 紅 (`red-500`) | 線上事故處理 |
| 用戶支援 | `SUPPORT` | 橘 (`orange-500`) | 客戶/內部支援 |
| 行政庶務 | `ADMIN` | 灰 (`slate-400`) | 會議、行政、雜務 |
| 學習成長 | `LEARNING` | 綠 (`emerald-500`) | 培訓、讀書會、自學 |

## 附錄 C：加班自動偵測邏輯

```typescript
function detectOvertimeType(date: Date, dailyTotal: number): OvertimeType {
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  // 週六日 -> 假日加班
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "HOLIDAY";
  }

  // TODO: 整合國定假日 API（可後續擴充）
  // if (isPublicHoliday(date)) return "HOLIDAY";

  // 平日超過 8 小時的部分 -> 平日加班
  if (dailyTotal > 8) {
    return "WEEKDAY";
  }

  return "NONE";
}

// 使用場景：
// 1. inline save 時自動偵測並設定 overtimeType
// 2. 使用者可在 detail panel 手動覆寫
```

## 附錄 D：與現有程式碼的對照表

| 現有檔案 | 處置 | 新檔案 |
|---------|------|--------|
| `app/(app)/timesheet/page.tsx` | 重構 | `page.tsx` + `timesheet-client.tsx` |
| `app/components/time-entry-cell.tsx` | 取代 | `app/components/timesheet/inline-cell.tsx` |
| `app/components/timesheet-grid.tsx` | 取代 | `app/components/timesheet/weekly-grid.tsx` |
| `app/components/timesheet-list-view.tsx` | 重構 | `app/components/timesheet/list-view.tsx` |
| `app/components/timer-widget.tsx` | 取代 | `app/components/timesheet/timer-bar.tsx` |
| `app/components/time-summary.tsx` | 重構 | `app/components/timesheet/summary-panel.tsx` |
| `services/time-entry-service.ts` | 修改 | 新增 overtimeType 相關邏輯 |
| `validators/shared/time-entry.ts` | 修改 | 新增 overtimeType、sortOrder 欄位 |
| `app/api/time-entries/route.ts` | 修改 | 接受新欄位 |
| `app/api/time-entries/batch/route.ts` | 修改 | 放寬重複限制 |
| `app/api/time-entries/stats/route.ts` | 修改 | 增加月報數據 |
| `app/api/time-entries/templates/route.ts` | 修改 | 改用 TemplateItem 關聯 |
| -- | 新增 | `app/api/time-entries/inline/route.ts` |
| -- | 新增 | `app/api/time-entries/preferences/route.ts` |
| -- | 新增 | `app/api/time-entries/templates/from-week/route.ts` |
