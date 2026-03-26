# TITAN — 統一系統設計文件
## Unified System Design v4.0

**文件日期：** 2026-03-26
**版本：** 4.0（統一版，整合 Dashboard/Cockpit/Timesheet/Knowledge/Reports/User Journey）
**適用對象：** 5 人銀行 IT 團隊（1 位主管林志偉 + 4 位工程師：Bob、Carol、Dave、Eve）
**部署環境：** 封閉內網（Air-gapped），無網際網路連線
**基於：** titan-architecture-v3.md 所有 Prisma Schema、API、Wireframe

---

## 目錄

1. [系統全局架構圖：六大模組如何連接](#1-系統全局架構圖)
2. [使用者旅程（Design Thinking 實境）](#2-使用者旅程)
3. [模組一：Management Cockpit（主管駕駛艙）](#3-management-cockpit)
4. [模組二：Timesheet v3（工時管理）](#4-timesheet-v3)
5. [模組三：Knowledge Base v2（知識庫）](#5-knowledge-base-v2)
6. [模組四：Reports v2（報表中心）](#6-reports-v2)
7. [模組五：Kanban + Gantt（任務視覺化）](#7-kanban-gantt)
8. [模組六：Strategic Cascade（計畫層級）](#8-strategic-cascade)
9. [跨模組資料流與 API 整合](#9-cross-module-data-flow)
10. [完整元件清單與命名規範](#10-component-inventory)
11. [完整資料模型關係圖](#11-data-model-relationships)

---

## 1. 系統全局架構圖

### 1.1 六大模組連接方式

```
                        ┌─────────────────────────────────────────┐
                        │          TITAN 統一系統                    │
                        │                                           │
                        │   使用者登入後，根據 Role 決定首頁：        │
                        │   - Manager → ManagementCockpitPage       │
                        │   - Engineer → EngineerDashboardPage      │
                        └─────────────┬───────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
    │  Management        │   │  Kanban +       │   │  Strategic        │
    │  Cockpit           │   │  Gantt          │   │  Cascade          │
    │  (模組一)           │   │  (模組五)       │   │  (模組六)          │
    │                    │   │                 │   │                   │
    │  讀取:              │   │  讀取/寫入:     │   │  讀取/寫入:        │
    │  - Task summary    │   │  - Task CRUD    │   │  - KPI             │
    │  - KPI achievement │   │  - SubTask      │   │  - AnnualPlan      │
    │  - TimeEntry stats │   │  - TaskChange   │   │  - MonthlyGoal     │
    │  - Notification    │   │  - Notification │   │  - Milestone       │
    │  - TaskChange      │   │                 │   │  - Deliverable     │
    └────────┬───────────┘   └────────┬────────┘   └─────────┬─────────┘
             │                        │                       │
             │         ┌──────────────┴──────────────┐       │
             │         │        共用資料層             │       │
             │         │                              │       │
             │         │  Task ← TaskChange           │       │
             │         │  Task ← TimeEntry            │       │
             │         │  Task ← KPITaskLink → KPI    │       │
             │         │  Task ← SubTask              │       │
             │         │  MonthlyGoal ← Task          │       │
             │         │  AnnualPlan ← MonthlyGoal    │       │
             │         │  Document ← DocumentVersion  │       │
             │         └──────────────┬──────────────┘       │
             │                        │                       │
    ┌────────▼───────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
    │  Timesheet v3      │   │  Knowledge      │   │  Reports v2       │
    │  (模組二)           │   │  Base v2        │   │  (模組四)          │
    │                    │   │  (模組三)        │   │                   │
    │  讀取/寫入:         │   │  讀取/寫入:      │   │  讀取:             │
    │  - TimeEntry       │   │  - Document     │   │  - 所有模組資料    │
    │  - Task (連結)     │   │  - DocVersion   │   │  - TimeEntry聚合  │
    │  - 自動更新         │   │  - 全文搜尋     │   │  - Task聚合       │
    │    Task.actualHours│   │                 │   │  - KPI聚合        │
    └────────────────────┘   └─────────────────┘   └───────────────────┘
```

### 1.2 路由對照表

| 路徑 | 頁面元件名稱 | 模組 | 預設存取 |
|------|------------|------|---------|
| `/` | `ManagementCockpitPage` (Manager) / `EngineerDashboardPage` (Engineer) | 模組一 | 全員 |
| `/board` | `KanbanBoardPage` | 模組五 | 全員 |
| `/gantt` | `GanttChartPage` | 模組五 | 全員 |
| `/timesheet` | `TimesheetWeeklyPage` | 模組二 | 全員 |
| `/timesheet/calendar` | `TimesheetCalendarPage` | 模組二 | 全員 |
| `/wiki` | `KnowledgeBasePage` | 模組三 | 全員 |
| `/wiki/:slug` | `DocumentViewPage` | 模組三 | 全員 |
| `/wiki/:slug/edit` | `DocumentEditPage` | 模組三 | 全員 |
| `/reports` | `ReportsCenterPage` | 模組四 | 全員 (內容受權限控管) |
| `/reports/weekly` | `WeeklyReportPage` | 模組四 | 全員 |
| `/reports/monthly` | `MonthlyReportPage` | 模組四 | Manager |
| `/reports/kpi` | `KPIReportPage` | 模組四 | 全員 |
| `/reports/unplanned` | `UnplannedWorkloadPage` | 模組四 | Manager |
| `/plans` | `StrategicCascadePage` | 模組六 | 全員 |
| `/plans/:id` | `AnnualPlanDetailPage` | 模組六 | 全員 |
| `/settings/users` | `UserManagementPage` | 系統 | Manager |
| `/login` | `LoginPage` | 系統 | 未登入 |

---

## 2. 使用者旅程（Design Thinking 實境）

### 2.1 主管林志偉的一天

#### 08:35 — 開機，打開瀏覽器，輸入 `http://10.1.1.50:3000`

**畫面：LoginPage**

```
┌────────────────────────────────────────────────┐
│                                                │
│              ┌──────────────┐                  │
│              │   TITAN      │                  │
│              │   ─────      │                  │
│              │   銀行 IT    │                  │
│              │   工作管理    │                  │
│              └──────────────┘                  │
│                                                │
│         帳號  ┌─────────────────────┐          │
│               │ wei.lin              │          │
│               └─────────────────────┘          │
│         密碼  ┌─────────────────────┐          │
│               │ ••••••••             │          │
│               └─────────────────────┘          │
│                                                │
│              [ 登入 ]                           │
│                                                │
└────────────────────────────────────────────────┘
```

**操作流程：** 林志偉輸入帳號 `wei.lin`、密碼 → 點擊「登入」→ POST `/api/auth/login` → 設置 HTTP-only Cookie → 302 重導至 `/`

**從登入到看到今日全局：1 次點擊（登入按鈕），0.8 秒載入。**

#### 08:35:01 — 首頁 ManagementCockpitPage 載入

系統同時發出 4 個 API 請求（並行）：
1. `GET /api/cockpit/summary?date=2026-03-26` — 四張摘要卡
2. `GET /api/kpis?year=2026` — KPI 達成概況
3. `GET /api/cockpit/team-workload?month=2026-03` — 團隊工作負載
4. `GET /api/notifications?unreadOnly=true` — 未讀通知數

**林志偉看到的畫面（ManagementCockpitPage 精確佈局）：**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────┐                                                                       │
│ │TITAN │  [🔔 3]                              林志偉（主管）  [我的設定] [登出]  │
│ └──────┘                                                                       │
├──────────┬──────────────────────────────────────────────────────────────────────┤
│          │                                                                      │
│  ◄ 首頁  │  ── 摘要卡片列（CockpitSummaryRow） ─────────────────────────────   │
│  看板    │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  甘特圖  │  │ WeekProgress │ │ OverdueTasks │ │ DelayChange  │ │ Unplanned    ││
│  知識庫  │  │ Card         │ │ Card         │ │ Card         │ │ Card         ││
│  工時紀錄│  │              │ │              │ │              │ │              ││
│  報表    │  │   72%        │ │   3 件       │ │  3延期 2變更 │ │  8件 29%     ││
│          │  │ ████████░░   │ │ 紅底 ⚠       │ │ 橘底 ⚠      │ │ 橘底 計畫外  ││
│          │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│          │                                                                      │
│          │  ── KPI 達成概況（KPIAchievementPanel） ──────────────────────────   │
│          │  ┌──────────────────────────────────────────────────────────────────┐│
│          │  │ KPI-01  系統可用率      99.7/99.5  █████████████████████  達成 ✓ ││
│          │  │ KPI-02  事件解決時效    92/95      ████████████████░░░░  進行中⚠ ││
│          │  │ KPI-03  資安稽核完成    75/100     ███████████░░░░░░░░░  進行中  ││
│          │  │ KPI-04  員工訓練時數    35/40h     ██████████████░░░░░░  進行中  ││
│          │  │ KPI-05  系統變更成功率  99.2/98    █████████████████████  達成 ✓ ││
│          │  │                                                                  ││
│          │  │ 加權年度達成率：90.4%                      [查看詳細報表 →]      ││
│          │  └──────────────────────────────────────────────────────────────────┘│
│          │                                                                      │
│          │  ── 團隊工作負載（TeamWorkloadTable） ────────────────────────────   │
│          │  ┌──────────────────────────────────────────────────────────────────┐│
│          │  │ 成員   任務數  工時投入率              計畫外%    狀態           ││
│          │  │ ────── ────── ──────────────────────── ────────  ──────         ││
│          │  │ 林志偉  8件   ███████░░  88%          18%        正常           ││
│          │  │ Bob    11件   █████████  92%          35%  ⚠     計畫外偏高     ││
│          │  │ Carol   6件   ██████░░░  72%          12%        正常           ││
│          │  │ Dave    9件   ████████░  85%          22%        正常           ││
│          │  │ Eve     4件   ████░░░░░  55%           8%        工時偏低       ││
│          │  │                                                                  ││
│          │  │ 點擊成員姓名 → 展開該成員本月任務細項                            ││
│          │  └──────────────────────────────────────────────────────────────────┘│
│          │                                                                      │
│          │  ── 左右分欄 ─────────────────────────────────────────────────────   │
│          │  ┌────────────────────────────┐ ┌──────────────────────────────────┐│
│          │  │ 逾期任務（OverdueTaskList）│ │ 即將到期（UpcomingPanel）        ││
│          │  │                            │ │                                  ││
│          │  │ [P0] 更新核心交換機韌體    │ │ 里程碑:                          ││
│          │  │  Bob(A) Dave(B) 逾期3天    │ │  03/28  Q1資安稽核  ⚠ 2天後     ││
│          │  │  [→ 開啟任務]              │ │                                  ││
│          │  │                            │ │ 任務:                            ││
│          │  │ [P1] AD 帳號清查報告       │ │  03/27 [P1] 資安政策文件  林志偉 ││
│          │  │  Carol(A) 逾期1天          │ │  03/28 [P2] 備份系統測試  Eve    ││
│          │  │  [→ 開啟任務]              │ │  03/28 [P0] 季度漏洞掃描  Dave   ││
│          │  │                            │ │                                  ││
│          │  │ [P1] SSL 憑證續約          │ │ 點擊任一項 → 開啟                ││
│          │  │  Dave(A) Bob(B) 逾期1天    │ │ TaskDetailSheet 側板              ││
│          │  │  [→ 開啟任務]              │ │                                  ││
│          │  └────────────────────────────┘ └──────────────────────────────────┘│
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

**佈局精確說明：**
- **頂部導覽列（TopNavBar）**：左側 TITAN logo，中央留空，右側通知鈴 `NotificationBell`（紅點數字）、使用者名稱+角色、設定齒輪、登出
- **左側邊欄（SideNav）**：6 個導覽項目，當前頁面高亮（indigo-500 左邊框），寬度固定 200px
- **主內容區**：padding 24px，max-width 1280px，由上至下分 4 個區塊
  - 第 1 行：`CockpitSummaryRow`，4 張 `StatCard` 水平排列，每張 1/4 寬
  - 第 2 行：`KPIAchievementPanel`，全寬 Card，內含 `KPIProgressBar` 列表
  - 第 3 行：`TeamWorkloadTable`，全寬 Card，HTML table，每列含 `ProgressBar` 元件
  - 第 4 行：左右 50/50 分欄 — 左側 `OverdueTaskList`，右側 `UpcomingPanel`（含里程碑 + 任務子區塊）

#### 08:36 — 林志偉注意到 Bob 計畫外負荷 35%，點擊 Bob 的名字

**操作流程：** 點擊 `TeamWorkloadTable` 中「Bob」→ 該列展開（Accordion），顯示 `MemberTaskBreakdown` 元件

**API 請求：** `GET /api/tasks?assigneeId=user_bob&dueDateFrom=2026-03-01&dueDateTo=2026-03-31`

**展開後顯示：**

```
│ Bob    11件   █████████  92%          35%  ⚠     計畫外偏高     │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Bob 本月任務明細（MemberTaskBreakdown）                      ││
│ │                                                              ││
│ │ 分類        件數   工時     佔比                              ││
│ │ [PLANNED]    6件   110h    65.5%    ████████████████          ││
│ │ [ADDED]      2件    25h    14.9%    ████                     ││
│ │ [INCIDENT]   1件    15h     8.9%    ███                      ││
│ │ [SUPPORT]    1件    10h     6.0%    ██                       ││
│ │ [ADMIN]      1件     5h     3.0%    █                        ││
│ │ [LEARNING]   0件     3h     1.8%    █                        ││
│ │                                                              ││
│ │ 計畫外來源:                                                  ││
│ │  · 監控系統告警 → 路由器告警調查 (15h)                       ││
│ │  · 主管臨時指派 → 網路設備韌體盤點 (10h)                    ││
│ │  · 用戶支援 → 財務部印表機連線問題 (10h)                    ││
│ │                                                              ││
│ │ [下個月調降 Bob 計畫外比例 → 建議重分配 SUPPORT 給 Eve]      ││
│ └──────────────────────────────────────────────────────────────┘│
```

**點擊次數：1 次（點擊 Bob 名字），無需跳轉頁面。**

#### 08:37 — 林志偉點擊逾期任務「更新核心交換機韌體」的「→ 開啟任務」按鈕

**操作流程：** 點擊 → 從右側滑入 `TaskDetailSheet`（shadcn/ui Sheet 元件，寬度 480px）

**API 請求：** `GET /api/tasks/task_xxx`（含 subTasks、comments、activities、timeEntries、deliverables）

**TaskDetailSheet 精確佈局：**

```
┌──────────────────────────────────────────────────┐
│ ✕                    任務詳情                     │
├──────────────────────────────────────────────────┤
│                                                  │
│ [P0] [PLANNED]                        逾期 3 天  │
│ ──────────────────────────────────────────────── │
│ 更新核心交換機韌體                               │
│                                                  │
│ 狀態 ──────── [IN_PROGRESS ▼]  ← 可點擊切換     │
│ A 角 ──────── Bob  [🔵]                          │
│ B 角 ──────── Dave [🟢]                          │
│ 截止日 ────── 2026-03-21 (逾期3天)  [延期]       │
│ 預估工時 ──── 4h                                 │
│ 實際工時 ──── 2h (自動從 TimeEntry 彙整)         │
│ 月度目標 ──── 3月：網路基礎設施更新              │
│ 連結 KPI ──── KPI-01 系統可用率                  │
│                                                  │
│ ── 子任務（SubTaskChecklist） ────────── 1/3 完成│
│ ☑ 確認新韌體版本相容性                           │
│ ☐ 排定維護窗口並通知相關單位                     │
│ ☐ 執行韌體更新並驗證                             │
│ [+ 新增子任務]                                   │
│                                                  │
│ ── 交付項（DeliverableList） ─────────────────── │
│ 📄 韌體更新報告    [文件]  [未開始]  ← 可點擊    │
│ 📄 測試驗證記錄    [報告]  [未開始]              │
│ [+ 新增交付項]                                   │
│                                                  │
│ ── 工時紀錄（TimeEntryMiniList） ────────────── │
│ 03/18  4.0h  韌體下載與相容性測試                │
│ 03/19  3.0h  測試環境模擬更新                    │
│ [+ 記錄工時]   ← 點擊彈出 TimeEntryPopover       │
│                                                  │
│ ── 留言（CommentThread） ─────────────────────── │
│ Bob 03/19 14:30                                  │
│   廠商通知新韌體有已知 bug，等待修正版           │
│                                                  │
│ Dave 03/20 09:15                                 │
│   已確認備援方案，可隨時接手                     │
│                                                  │
│ [輸入留言...]              [送出]                 │
│                                                  │
│ ── 變更記錄（ChangeLogTimeline） ─────────────── │
│ 🕐 03/21 林志偉 延期 03/21 → 03/28              │
│   原因：等待廠商提供修正版韌體                   │
│ 🕐 03/18 林志偉 建立任務                         │
│                                                  │
├──────────────────────────────────────────────────┤
│          [刪除任務]              [儲存變更]       │
└──────────────────────────────────────────────────┘
```

**元件組成：**
- `TaskDetailSheet`（最外層 Sheet）
  - `TaskHeader`：優先級 Badge + 分類 Badge + 逾期天數
  - `TaskMetaFields`：狀態 Select、A/B 角 Avatar+Name、截止日 DatePicker、工時數字
  - `SubTaskChecklist`：每項含 Checkbox + 文字，底部 inline input 新增
  - `DeliverableList`：每項含 icon + 名稱 + type Badge + status Badge
  - `TimeEntryMiniList`：僅顯示最近 5 筆，底部按鈕觸發 `TimeEntryPopover`
  - `CommentThread`：留言列表 + 底部 textarea 輸入框
  - `ChangeLogTimeline`：時間軸，由上至下由新至舊

#### 08:38 — 林志偉決定記錄延期，點擊截止日旁邊的「延期」按鈕

**操作流程：** 點擊「延期」→ 展開 `DelayDialog`（shadcn/ui Dialog，居中 Modal）

```
┌─────────────────────────────────────────────┐
│                記錄延期                    ✕ │
├─────────────────────────────────────────────┤
│                                             │
│  原截止日：2026-03-21                       │
│                                             │
│  新截止日：┌──────────────────┐             │
│            │ 2026-03-28  📅   │             │
│            └──────────────────┘             │
│                                             │
│  延期原因：┌──────────────────────────────┐ │
│            │ 等待廠商提供修正版韌體，       │ │
│            │ 預計 3/27 到貨                 │ │
│            └──────────────────────────────┘ │
│                                             │
│           [取消]          [確認延期]         │
│                                             │
└─────────────────────────────────────────────┘
```

**API 請求：** `PATCH /api/tasks/task_xxx/delay`
```json
{
  "newDueDate": "2026-03-28",
  "reason": "等待廠商提供修正版韌體，預計 3/27 到貨"
}
```

**後端自動觸發：**
1. 寫入 `TaskChange` 記錄（changeType: DELAY, oldValue: "2026-03-21", newValue: "2026-03-28"）
2. 建立 `Notification`（type: TASK_CHANGED, userId: user_bob, title: "你的任務「更新核心交換機韌體」已延期至 03/28"）
3. 建立 `Notification`（type: TASK_CHANGED, userId: user_dave, title: "你備援的任務「更新核心交換機韌體」已延期至 03/28"）
4. 寫入 `TaskActivity`（action: "DELAY", detail: { from: "2026-03-21", to: "2026-03-28" }）
5. 更新 `CockpitSummaryRow` 中 `DelayChangeCard` 計數：3延期 → 4延期
6. 前端顯示 Toast：「已記錄延期，Bob 和 Dave 已收到通知」

**點擊次數：2 次（「延期」按鈕 + 「確認延期」按鈕）**

#### 08:40 — 林志偉點擊左側「報表」，查看計畫外負荷報表

**操作流程：** 點擊 SideNav「報表」→ 跳轉至 `/reports` → `ReportsCenterPage` → 預設顯示 `UnplannedWorkloadPage`（Manager 預設分頁）

**從 Cockpit 到看到計畫外負荷：1 次點擊（側邊欄「報表」）**

（詳見 [模組四：Reports v2](#6-reports-v2) 完整佈局）

#### 08:45 — 林志偉匯出本月報表 PDF，準備給副總看

**操作流程：** 在 `UnplannedWorkloadPage` 右上角點擊「匯出 PDF」→ 下載 `IT部門計畫外負荷報表_202603.pdf`

**API 請求：** `GET /api/reports/export/pdf?type=unplanned-workload&month=2026-03`

**點擊次數：1 次**

---

### 2.2 工程師 Bob 的一天

#### 08:50 — Bob 開機登入

**畫面：EngineerDashboardPage**

系統同時發出 3 個 API 請求：
1. `GET /api/cockpit/my-summary?date=2026-03-26` — 個人摘要卡
2. `GET /api/tasks?assigneeId=me&status=TODO,IN_PROGRESS&sort=priority,dueDate` — 今日任務
3. `GET /api/notifications?unreadOnly=true` — 未讀通知

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  ◄ 首頁  │  早安，Bob！ 2026-03-26（週四）                                      │
│  看板    │                                                                      │
│  甘特圖  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│  知識庫  │  │ TodayTasks   │ │ WeekHours    │ │ OverdueMy    │                 │
│  工時紀錄│  │ Card         │ │ Card         │ │ Card         │                 │
│  報表    │  │   5 件待辦   │ │  22.5/40h    │ │   1 件逾期   │                 │
│          │  │              │ │ ████████░░   │ │  ⚠ 需處理    │                 │
│          │  └──────────────┘ └──────────────┘ └──────────────┘                 │
│          │                                                                      │
│          │  ── 今日任務（TodayTaskList） ──── 依優先級排序 ─────────────────── │
│          │                                                                      │
│          │  ┌────────────────────────────────────────────────────────────────┐  │
│          │  │ ⬤ [P0] [PLANNED] 更新核心交換機韌體                          │  │
│          │  │   IN_PROGRESS · 截止 03/28 · A角:我 B角:Dave                  │  │
│          │  │   預估 4h · 已記 2h · 進度 33%                                │  │
│          │  │                                                                │  │
│          │  │   [▶ 開始計時]  [📝 記工時]  [→ 開啟詳情]                     │  │
│          │  ├────────────────────────────────────────────────────────────────┤  │
│          │  │ ⬤ [P0] [ADDED] 路由器告警調查                                │  │
│          │  │   TODO · 截止 03/26 今日到期 · A角:我 B角:Dave                │  │
│          │  │   追加原因: 監控系統告警 · 預估 4h                            │  │
│          │  │                                                                │  │
│          │  │   [▶ 開始計時]  [📝 記工時]  [→ 開啟詳情]                     │  │
│          │  ├────────────────────────────────────────────────────────────────┤  │
│          │  │ ⬤ [P1] [PLANNED] 網路監控告警調整                            │  │
│          │  │   TODO · 截止 03/27 · A角:我                                  │  │
│          │  │   預估 3h · 尚未開始                                          │  │
│          │  │                                                                │  │
│          │  │   [▶ 開始計時]  [📝 記工時]  [→ 開啟詳情]                     │  │
│          │  ├────────────────────────────────────────────────────────────────┤  │
│          │  │ ...（更多任務）                                                │  │
│          │  └────────────────────────────────────────────────────────────────┘  │
│          │                                                                      │
│          │  ── 通知（NotificationList，最近 5 則） ────────────────────────── │
│          │  🔴 03/26 08:38 你的任務「更新核心交換機韌體」已延期至 03/28       │
│          │  ⚪ 03/25 17:00 Dave 在「路由器告警調查」留言                      │
│          │  ⚪ 03/25 09:00 你被指派為「網路監控告警調整」的 A 角              │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

**元件組成（EngineerDashboardPage）：**
- `GreetingHeader`：早安 + 使用者名稱 + 當日日期 + 星期
- `PersonalSummaryRow`：3 張 `StatCard`
  - `TodayTasksCard`：今日任務件數
  - `WeekHoursCard`：本週已記工時 / 40h 目標，含 ProgressBar
  - `OverdueMyCard`：個人逾期任務件數
- `TodayTaskList`：任務卡列表，每張卡包含：
  - `TaskPriorityBadge`（P0 紅 / P1 橘 / P2 藍 / P3 灰）
  - `TaskCategoryBadge`（PLANNED 紫藍 / ADDED 橘 / INCIDENT 紅 / SUPPORT 天藍 / ADMIN 灰 / LEARNING 綠）
  - 任務標題（text-sm font-medium）
  - 狀態 + 截止日 + A/B 角（text-xs text-zinc-400）
  - 工時進度（text-xs）
  - 3 個操作按鈕：
    - `AutoTimerButton`（▶ 開始計時）：點擊開始本機計時，再點擊停止並自動填入工時
    - `QuickTimeEntryButton`（📝 記工時）：觸發 `TimeEntryPopover`
    - `OpenDetailButton`（→ 開啟詳情）：觸發 `TaskDetailSheet`
- `NotificationList`：最近 5 則通知，紅點表示未讀

#### 09:00 — Bob 開始處理路由器告警，點擊「▶ 開始計時」

**操作流程：**
1. 在「路由器告警調查」卡片上，點擊「▶ 開始計時」
2. 按鈕變為「⏸ 00:00:05」，背景色從 zinc-900 變為 indigo-900/20（微微發光）
3. 計時器使用 `localStorage` 持久化（關閉瀏覽器不會丟失）
4. 任務狀態自動從 TODO 變為 IN_PROGRESS

**自動觸發 API：** `PATCH /api/tasks/task_yyy/status` → `{ "status": "IN_PROGRESS" }`

**AutoTimerWidget 元件規格：**
- 狀態：`idle` → `running` → `paused` → `stopped`
- 資料儲存：`localStorage` key = `titan_timer_{taskId}`，值 = `{ startedAt, elapsed, paused }`
- 精度：秒級，UI 顯示 HH:MM:SS
- 停止時：自動彈出 `TimeEntryPopover`，`hours` 欄位預填計時結果（四捨五入至 0.25h）

#### 11:30 — Bob 解決路由器問題，點擊「⏸ 02:31:45」停止計時

**操作流程：**
1. 點擊計時按鈕 → 計時停止
2. 自動彈出 `TimeEntryPopover`

```
┌──────────────────────────────────────────┐
│ 記錄工時                              ✕  │
├──────────────────────────────────────────┤
│ 任務：路由器告警調查                     │
│ 日期：2026-03-26  類別：[ADDED    ▼]    │
│ 工時：[2.5] 小時（計時結果：2h31m）      │
│ 備註：[確認 BGP 鄰居重建，根因為]       │
│       [ISP 端設備重啟導致]               │
│                                          │
│              [取消]    [儲存]             │
└──────────────────────────────────────────┘
```

**API 請求：** `POST /api/time-entries`
```json
{
  "taskId": "task_yyy",
  "date": "2026-03-26",
  "hours": 2.5,
  "category": "ADDED_TASK",
  "description": "確認 BGP 鄰居重建，根因為 ISP 端設備重啟導致"
}
```

**後端自動觸發：**
1. 更新 `Task.actualHours`：0 → 2.5
2. Toast：「工時已記錄：2.5 小時」

**點擊次數：2 次（停止計時 + 儲存）**

#### 11:32 — Bob 完成任務，將狀態拖到 DONE

**操作流程：** Bob 決定去看板快速更新 → 點擊 SideNav「看板」→ 找到「路由器告警調查」卡片 → 拖曳至 DONE 欄

**或者在 Dashboard 上直接操作：** 點擊「→ 開啟詳情」→ 在 `TaskDetailSheet` 中將狀態下拉改為 DONE → 自動儲存

**API 請求：** `PATCH /api/tasks/task_yyy/status` → `{ "status": "DONE" }`

**後端自動觸發：**
1. 更新 `MonthlyGoal.progressPct`（重新計算該月度目標下所有任務完成率）
2. 更新 `AnnualPlan.progressPct`
3. 建立 `TaskActivity`（action: "STATUS_CHANGED", detail: { from: "IN_PROGRESS", to: "DONE" }）
4. 建立 `Notification`（type: TASK_ASSIGNED, userId: manager, title: "Bob 已完成「路由器告警調查」"）

#### 17:00 — Bob 下班前去工時頁面確認本日工時

**操作流程：** 點擊 SideNav「工時紀錄」→ `TimesheetWeeklyPage`

（詳見 [模組二：Timesheet v3](#4-timesheet-v3) 完整佈局）

---

## 3. Management Cockpit（模組一：主管駕駛艙）

### 3.1 頁面元件樹

```
ManagementCockpitPage
├── CockpitSummaryRow
│   ├── StatCard (WeekProgressCard)
│   │   └── ProgressBar
│   ├── StatCard (OverdueTasksCard)
│   ├── StatCard (DelayChangeCard)
│   └── StatCard (UnplannedCard)
├── KPIAchievementPanel
│   └── KPIProgressBar (×5, one per KPI)
│       ├── Badge (status: 達成/進行中)
│       └── ProgressBar (actual/target)
├── TeamWorkloadTable
│   └── TeamMemberRow (×5)
│       ├── Avatar
│       ├── ProgressBar (engagementRate)
│       ├── Badge (unplannedWarning, 當 >30% 時顯示)
│       └── MemberTaskBreakdown (Accordion 展開)
│           ├── CategoryBreakdownChart (水平 bar chart)
│           └── UnplannedSourceList
├── OverdueTaskList
│   └── OverdueTaskItem (×N)
│       ├── PriorityBadge
│       ├── AssigneeAvatarPair (A角 + B角)
│       ├── OverdueDaysBadge
│       └── OpenTaskButton → triggers TaskDetailSheet
└── UpcomingPanel
    ├── MilestoneUpcoming
    │   └── MilestoneItem (×N)
    └── TaskUpcoming
        └── UpcomingTaskItem (×N)
```

### 3.2 API 端點

| 端點 | 方法 | 說明 | 回應資料 |
|------|------|------|---------|
| `/api/cockpit/summary` | GET | 四張摘要卡資料 | `{ weekProgressPct, overdueCount, delayCount, scopeChangeCount, unplannedCount, unplannedRatio }` |
| `/api/cockpit/team-workload` | GET | 團隊工作負載 | `{ members: [{ name, taskCount, engagementRate, unplannedRate, byCategory }] }` |
| `/api/cockpit/overdue` | GET | 逾期任務列表 | `{ tasks: [{ id, title, priority, primaryAssignee, backupAssignee, overdueDays }] }` |
| `/api/cockpit/upcoming` | GET | 即將到期（7天內） | `{ milestones: [...], tasks: [...] }` |

**`GET /api/cockpit/summary?date=2026-03-26` 完整回應：**
```json
{
  "success": true,
  "data": {
    "weekProgressPct": 0.72,
    "weekTasksDone": 5,
    "weekTasksTotal": 7,
    "overdueCount": 3,
    "overdueTasks": [
      { "id": "task_xxx", "title": "更新核心交換機韌體", "overdueDays": 3 }
    ],
    "delayCount": 3,
    "scopeChangeCount": 2,
    "unplannedCount": 8,
    "unplannedRatio": 0.286,
    "unplannedHours": 45,
    "totalHours": 155
  }
}
```

### 3.3 StatCard 互動規格

每張 StatCard 均可點擊，跳轉至對應深入頁面：

| 卡片 | 點擊跳轉 | 點擊次數到目標 |
|------|---------|-------------|
| WeekProgressCard | `/board?status=DONE&week=current` | 1 次 |
| OverdueTasksCard | 展開本頁 `OverdueTaskList`（scroll to） | 1 次 |
| DelayChangeCard | `/reports?tab=delay-change&month=current` | 1 次 |
| UnplannedCard | `/reports?tab=unplanned&month=current` | 1 次 |

### 3.4 Engineer Dashboard（EngineerDashboardPage）

與 Cockpit 共用路由 `/`，後端根據 `GET /api/auth/me` 回傳的 `role` 決定渲染哪個元件。

**差異對照：**

| 區塊 | Manager (Cockpit) | Engineer (Dashboard) |
|------|-------------------|---------------------|
| 摘要卡 | 4 張（全隊進度、逾期、延期、計畫外） | 3 張（我的待辦、我的工時、我的逾期） |
| 第 2 區 | KPI 達成概況（全部 KPI） | 今日任務列表（僅自己的） |
| 第 3 區 | 團隊工作負載表 | 最近通知列表 |
| 第 4 區 | 逾期任務 + 即將到期 | 本週工時摘要 mini chart |

---

## 4. Timesheet v3（模組二：工時管理）

### 4.1 雙視圖設計

工時模組提供兩種視圖，透過 `TimesheetViewToggle` 切換：

| 視圖 | 路徑 | 元件 | 適用場景 |
|------|------|------|---------|
| 週表視圖 | `/timesheet` | `TimesheetWeeklyPage` | 快速填寫每日工時，一覽本週分配 |
| 月曆視圖 | `/timesheet/calendar` | `TimesheetCalendarPage` | 檢視整月工時分配，找出空白日 |

### 4.2 週表視圖（TimesheetWeeklyPage）精確佈局

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  首頁    │  工時紀錄                                                            │
│  看板    │                                                                      │
│  甘特圖  │  ┌──────────────────────────────────────────────────────────────┐    │
│  知識庫  │  │ [週表] [月曆]    [< 上一週] 2026-03-23 ~ 03-27 [下一週 >]  │    │
│ ◄工時紀錄│  │                                                              │    │
│  報表    │  │ 人員：[Bob ▼] ← Manager 可切換，Engineer 鎖定自己           │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌──────────────────────────────────────────────────────────────────┐│
│          │  │                                TimesheetWeeklyGrid               ││
│          │  │                                                                  ││
│          │  │ 任務 / 工時類別            │ 週一  │ 週二  │ 週三  │ 週四  │ 週五  │ 合計 ││
│          │  │                            │03/23 │03/24 │03/25 │03/26 │03/27 │      ││
│          │  │ ──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────││
│          │  │ [PLANNED] 更新交換機韌體  │  -   │  3.0 │  -   │  -   │  -   │  3.0 ││
│          │  │ [ADDED]   路由器告警調查  │  -   │  -   │  -   │  2.5 │  -   │  2.5 ││
│          │  │ [PLANNED] 機房設備清冊    │  2.0 │  -   │  2.0 │  -   │  -   │  4.0 ││
│          │  │ [PLANNED] 網路監控調整    │  -   │  -   │  3.0 │  4.0 │  -   │  7.0 ││
│          │  │ [ADMIN]   週例會          │  1.0 │  -   │  -   │  -   │  1.0 │  2.0 ││
│          │  │ [SUPPORT] 財務部印表機    │  -   │  1.5 │  -   │  -   │  -   │  1.5 ││
│          │  │ ──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────││
│          │  │ [+ 新增工時列]            │      │      │      │      │      │      ││
│          │  │ ──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────││
│          │  │ 每日合計                  │  3.0 │  4.5 │  5.0 │  6.5 │  1.0 │ 20.0 ││
│          │  │                                                                  ││
│          │  │ 空白格子背景色：zinc-800（可點擊）                               ││
│          │  │ 有值格子背景色：zinc-900（粗體數字）                             ││
│          │  │ 當日欄位背景色：indigo-900/10（微亮高亮）                        ││
│          │  └──────────────────────────────────────────────────────────────────┘│
│          │                                                                      │
│          │  ┌────────────────────────────────┐ ┌──────────────────────────────┐ │
│          │  │ WeekCategorySummary            │ │ WeekEngagementGauge          │ │
│          │  │ (本週工時分類長條圖)           │ │ (投入率儀表板)               │ │
│          │  │                                │ │                              │ │
│          │  │ PLANNED  14.0h ██████████████ │ │     ┌─────────┐              │ │
│          │  │ ADDED     2.5h ██             │ │     │  70%    │              │ │
│          │  │ SUPPORT   1.5h █              │ │     │ 投入率  │              │ │
│          │  │ ADMIN     2.0h ██             │ │     └─────────┘              │ │
│          │  │                                │ │  PLANNED / Total = 14/20    │ │
│          │  │ 計畫外: 4.0h (20%)            │ │                              │ │
│          │  └────────────────────────────────┘ └──────────────────────────────┘ │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

### 4.3 格子點擊互動（TimeEntryPopover）

**操作：** 使用者點擊週表中任一空白格子（如 週四 × 機房設備清冊）

**彈出 TimeEntryPopover：**

```
┌──────────────────────────────────────┐
│ 記錄工時                          ✕  │
├──────────────────────────────────────┤
│ 任務：[機房設備清冊更新        ▼]   │
│       ← 下拉含全部進行中任務         │
│       ← 也可選「無任務（行政）」     │
│                                      │
│ 日期：2026-03-26（週四）             │
│       ← 自動填入點擊的格子日期       │
│                                      │
│ 類別：[PLANNED_TASK            ▼]   │
│       ← 自動根據任務分類預填         │
│       ← PLANNED 任務 → PLANNED_TASK │
│       ← ADDED 任務 → ADDED_TASK     │
│       ← 無任務 → 可選 ADMIN/LEARNING│
│                                      │
│ 工時：[    ] 小時                    │
│       ← 輸入框，支援 0.25 步進       │
│       ← Tab 鍵跳至備註欄            │
│                                      │
│ 備註：[                          ]   │
│       ← 選填，text-xs               │
│                                      │
│           [取消]      [儲存]         │
│           Esc         Enter          │
└──────────────────────────────────────┘
```

**鍵盤快捷操作：**
- 點擊空白格 → Popover 出現，焦點自動到「工時」input
- 輸入數字 → Tab → 輸入備註 → Enter = 儲存
- Esc = 取消關閉

**API 請求：** `POST /api/time-entries`
```json
{
  "taskId": "task_zzz",
  "date": "2026-03-26",
  "hours": 2.0,
  "category": "PLANNED_TASK",
  "description": "完成 B 棟機房清點"
}
```

**後端觸發：** 自動更新 `Task.actualHours += 2.0`

**已有值的格子：** 點擊 → Popover 預填現有值，可修改或刪除
- 修改：`PATCH /api/time-entries/:id`
- 刪除：Popover 底部有「刪除此筆」連結 → AlertDialog 確認 → `DELETE /api/time-entries/:id`

### 4.4 月曆視圖（TimesheetCalendarPage）精確佈局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [週表] [月曆]    [< 上月] 2026 年 3 月 [下月 >]    人員：[Bob ▼]          │
│                                                                              │
│  日   一    二    三    四    五    六                                        │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                                │
│  │     │     │     │     │     │     │  1  │                                │
│  │     │     │     │     │     │     │  -  │                                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                                │
│  │  2  │  3  │  4  │  5  │  6  │  7  │  8  │                                │
│  │  -  │ 7.5h│ 8.0h│ 6.5h│ 7.0h│ 8.0h│  -  │                                │
│  │     │ ███ │████ │ ██  │ ███ │████ │     │                                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                                │
│  │  9  │ 10  │ 11  │ 12  │ 13  │ 14  │ 15  │                                │
│  │  -  │ 8.0h│ 7.0h│ 8.5h│ 6.0h│ 7.5h│  -  │                                │
│  │     │████ │ ███ │████ │ ██  │ ███ │     │                                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                                │
│  │ 16  │ 17  │ 18  │ 19  │ 20  │ 21  │ 22  │                                │
│  │  -  │ 4.0h│ 6.0h│ 4.0h│ 8.5h│ 5.0h│  -  │                                │
│  │     │ █   │ ██  │ █   │████ │ ██  │     │                                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                                │
│  │ 23  │ 24  │ 25  │ 26  │ 27  │ 28  │ 29  │                                │
│  │  -  │ 3.0h│ 4.5h│ 6.5h│     │     │  -  │                                │
│  │     │ █   │ █   │ ██  │ ⚠空 │ ⚠空 │     │                                │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                                │
│  │ 30  │ 31  │     │     │     │     │     │                                │
│  │  -  │     │     │     │     │     │     │                                │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                                │
│                                                                              │
│  色標圖例：                                                                  │
│  █ = PLANNED (紫藍)  █ = ADDED (橘)  █ = INCIDENT (紅)                      │
│  █ = SUPPORT (天藍)  █ = ADMIN (灰)  █ = LEARNING (綠)                      │
│  ⚠空 = 工作日無工時記錄（amber 邊框高亮）                                    │
│                                                                              │
│  月統計：總工時 132.5h / 目標 176h (75.3%)                                   │
│  投入率：PLANNED 78% · 計畫外 18% · 行政 4%                                  │
│                                                                              │
│  點擊任一日期格 → 展開該日 DayDetailPanel：                                   │
│  ┌──────────────────────────────────────┐                                    │
│  │ 2026-03-26（週四）   合計 6.5h       │                                    │
│  │ ── 工時明細 ──                       │                                    │
│  │ [ADDED]   路由器告警   2.5h  [編輯]  │                                    │
│  │ [PLANNED] 網路監控     4.0h  [編輯]  │                                    │
│  │ [+ 補記工時]                         │                                    │
│  └──────────────────────────────────────┘                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**月曆格子色彩規則：**
- `>= 8h`：emerald-900/30 背景（充足）
- `5-7.9h`：zinc-900 背景（正常）
- `1-4.9h`：amber-900/20 背景（偏低）
- `0h 且為工作日`：amber 邊框 + ⚠ 標記（提醒補填）
- 週末 / 假日：zinc-950 背景（最深色，區隔）

**色條：** 每個日期格內有一條 4px 高的水平色條，按工時分類比例著色（PLANNED 紫藍 + ADDED 橘 + ...），一眼看出這天做了什麼類型的工作。

### 4.5 工時與任務的資料關係

```
Task (id: task_xxx)
 │
 ├── category: PLANNED
 │
 ├── TimeEntry (id: te_001)
 │   ├── date: 2026-03-24
 │   ├── hours: 3.0
 │   ├── category: PLANNED_TASK  ← 自動從 Task.category 對應
 │   └── description: "測試環境更新驗證"
 │
 ├── TimeEntry (id: te_002)
 │   ├── date: 2026-03-25
 │   ├── hours: 2.0
 │   ├── category: PLANNED_TASK
 │   └── description: "排定維護窗口"
 │
 └── actualHours: 5.0  ← SUM(timeEntries.hours) 自動計算
```

**自動計算觸發鏈：**
1. `POST /api/time-entries` → 新增工時
2. → 後端 hook：`UPDATE Task SET actualHours = (SELECT SUM(hours) FROM time_entries WHERE taskId = ?)`
3. → 若 Task 屬於 MonthlyGoal → 不影響 progressPct（進度由 SubTask 完成率計算，非工時）
4. → 工時統計 API `/api/time-entries/stats` 即時反映

---

## 5. Knowledge Base v2（模組三：知識庫）

### 5.1 頁面佈局（KnowledgeBasePage）

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  首頁    │  ┌────────────────────────────────────────────────────────────┐      │
│  看板    │  │ 🔍 搜尋知識庫...                          SearchBar       │      │
│  甘特圖  │  └────────────────────────────────────────────────────────────┘      │
│ ◄知識庫  │                                                                      │
│  工時紀錄│  ┌──────────────────────────┬─────────────────────────────────────┐  │
│  報表    │  │  DocTreeNav (240px)      │  DocumentContentArea                │  │
│          │  │                          │                                     │  │
│          │  │  📁 基礎設施            │  防火牆設定規範          v3          │  │
│          │  │    📄 網路架構說明      │  ─────────────────────────────────  │  │
│          │  │    📄 防火牆設定規範 ◄  │  更新者: Dave · 2026-03-10          │  │
│          │  │    📄 VPN 操作手冊      │  [編輯] [版本歷史] [匯出 PDF]       │  │
│          │  │  📁 資訊安全            │                                     │  │
│          │  │    📄 資安政策總覽      │  ## 概述                            │  │
│          │  │    📁 事件應變          │  本文件定義銀行 IT 部門防火牆設定   │  │
│          │  │      📄 DDoS 應變      │  的標準規範...                       │  │
│          │  │      📄 勒索軟體應變   │                                     │  │
│          │  │  📁 系統維護            │  ## 防火牆規則原則                  │  │
│          │  │    📄 備份作業規範      │  1. **預設拒絕（Default Deny）**    │  │
│          │  │    📄 季度維護清單      │  2. **最小權限原則**                │  │
│          │  │  📁 使用者管理          │     所有存取規則必須遵循...         │  │
│          │  │    📄 帳號申請流程      │                                     │  │
│          │  │    📄 權限管理規範      │  ## 標準連接埠白名單               │  │
│          │  │                          │  | 連接埠 | 協定 | 用途      |     │  │
│          │  │  ──────────────────────  │  |--------|------|----------|     │  │
│          │  │  [+ 新增文件]            │  | 443    | TCP  | HTTPS    |     │  │
│          │  │  [+ 新增資料夾]          │  | 8443   | TCP  | 管理介面 |     │  │
│          │  │                          │  | 22     | TCP  | SSH      |     │  │
│          │  │                          │                                     │  │
│          │  │                          │  ── 版本歷史（VersionTimeline） ── │  │
│          │  │                          │  v3  03/10  Dave  新增IPv6規則     │  │
│          │  │                          │  v2  02/15  Alice 更新管理埠       │  │
│          │  │                          │  v1  01/05  Dave  初版             │  │
│          │  │                          │  [查看 v2 內容]  [比較 v2↔v3]     │  │
│          │  └──────────────────────────┴─────────────────────────────────────┘  │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

### 5.2 編輯模式（DocumentEditPage）

**操作：** 點擊「編輯」按鈕 → 路由跳轉至 `/wiki/firewall-rules/edit`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← 返回                                          自動儲存中... 最後儲存 3秒前│
│                                                                              │
│  ┌──────────────────────────────┬──────────────────────────────────────────┐ │
│  │  Markdown 編輯器             │  即時預覽                                │ │
│  │  (MarkdownEditor)            │  (MarkdownPreview)                       │ │
│  │                              │                                          │ │
│  │  ## 概述                     │  概述                                    │ │
│  │                              │  ────                                    │ │
│  │  本文件定義銀行 IT 部門      │  本文件定義銀行 IT 部門防火牆設定       │ │
│  │  防火牆設定的標準規範...     │  的標準規範...                           │ │
│  │                              │                                          │ │
│  │  ## 防火牆規則原則           │  防火牆規則原則                          │ │
│  │                              │  ──────────                              │ │
│  │  1. **預設拒絕**             │  1. 預設拒絕（Default Deny）             │ │
│  │  2. **最小權限原則**         │  2. 最小權限原則                         │ │
│  │  |                           │                                          │ │
│  └──────────────────────────────┴──────────────────────────────────────────┘ │
│                                                                              │
│  [工具列] **B** *I* ~~S~~ `Code` 📋 | H1 H2 H3 | 📎圖片 📄表格 🔗連結   │
│                                                                              │
│                                           [取消]  [儲存並建立新版本]         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**自動儲存邏輯：**
- 每次按鍵後 debounce 3 秒 → `PATCH /api/documents/:id` → 更新 content（不建立新版本）
- 右上角顯示「自動儲存中...」→「已儲存（N 秒前）」
- 點擊「儲存並建立新版本」→ `PATCH /api/documents/:id` 帶 `createVersion: true` → 建立 DocumentVersion 記錄 → 版本號 +1

### 5.3 版本差異比較（DocumentDiffPage）

**操作：** 在版本歷史中點擊「比較 v2↔v3」→ 進入 `/wiki/firewall-rules/diff?from=2&to=3`

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 返回  防火牆設定規範  版本比較 v2 ↔ v3                       │
│                                                                  │
│  ┌──────────────────────────┬──────────────────────────────────┐ │
│  │  v2 (2026-02-15 Alice)  │  v3 (2026-03-10 Dave)            │ │
│  ├──────────────────────────┼──────────────────────────────────┤ │
│  │  ## 標準連接埠白名單     │  ## 標準連接埠白名單             │ │
│  │  | 443 | TCP | HTTPS |  │  | 443 | TCP | HTTPS |           │ │
│  │  | 8443| TCP | 管理  |  │  | 8443| TCP | 管理介面 |        │ │
│  │  | 22  | TCP | SSH   |  │  | 22  | TCP | SSH（限IT）|      │ │
│  │                          │+ ## IPv6 防火牆規則               │ │
│  │                          │+ 所有 IPv4 規則同步套用至 IPv6   │ │
│  │                          │+ 額外封鎖 IPv6 Teredo tunnel     │ │
│  └──────────────────────────┴──────────────────────────────────┘ │
│                                                                  │
│  紅色背景 = 刪除    綠色背景 = 新增    黃色背景 = 修改           │
│                                                                  │
│  [還原至 v2]                                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.4 全文搜尋（SearchBar）

**操作：** 在搜尋列輸入 "防火牆" → debounce 300ms → `GET /api/documents/search?q=防火牆`

**後端實作：** PostgreSQL `tsvector` + `to_tsquery('zhparser', '防火牆')`，支援中文斷詞

**搜尋結果（SearchResultDropdown）：**

```
┌────────────────────────────────────────────────────┐
│ 搜尋結果：3 筆                                     │
├────────────────────────────────────────────────────┤
│ 📄 防火牆設定規範                                  │
│    基礎設施 > 防火牆設定規範                        │
│    ...定義銀行 IT 部門【防火牆】設定的標準...       │
│                                                    │
│ 📄 DDoS 應變流程                                   │
│    資訊安全 > 事件應變 > DDoS 應變流程              │
│    ...步驟三：啟用邊界【防火牆】ACL 封鎖...         │
│                                                    │
│ 📄 網路架構說明                                    │
│    基礎設施 > 網路架構說明                          │
│    ...核心層【防火牆】設備型號：Fortinet 600E...    │
│                                                    │
└────────────────────────────────────────────────────┘
```

**點擊搜尋結果 → 跳轉至該文件頁面，搜尋關鍵字高亮。**

### 5.5 知識庫 API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `GET /api/documents/tree` | GET | 文件樹（巢狀 JSON，含 id, title, slug, parentId, children[]） |
| `GET /api/documents/search?q=xxx` | GET | 全文搜尋，回傳 { id, title, slug, breadcrumb, snippet } |
| `GET /api/documents/:idOrSlug` | GET | 文件內容（含 content, version, updater, updatedAt） |
| `POST /api/documents` | POST | 建立文件 `{ title, content, parentId?, slug }` |
| `PATCH /api/documents/:id` | PATCH | 更新文件 `{ content, createVersion? }` |
| `DELETE /api/documents/:id` | DELETE | 刪除文件（含所有版本） |
| `GET /api/documents/:id/versions` | GET | 版本列表 `[{ version, createdBy, createdAt, snippet }]` |
| `GET /api/documents/:id/versions/:ver` | GET | 特定版本完整內容 |
| `POST /api/documents/:id/restore/:ver` | POST | 還原至特定版本 |

---

## 6. Reports v2（模組四：報表中心）

### 6.1 報表中心入口（ReportsCenterPage）精確佈局

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  首頁    │  報表中心                                                            │
│  看板    │                                                                      │
│  甘特圖  │  ┌──────────────────────────────────────────────────────────────┐    │
│  知識庫  │  │ ReportTabNav                                                │    │
│ ◄報表    │  │                                                              │    │
│  工時紀錄│  │ [週報] [月報] [KPI達成] [計畫外負荷] [延期變更]             │    │
│          │  │                                                              │    │
│          │  │ 匯出：[匯出 PDF ▼] [匯出 Excel ▼]                          │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ← 以下區域根據選中的 Tab 切換 →                                     │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

### 6.2 週報分頁（WeeklyReportTab）

**API：** `GET /api/reports/weekly?week=2026-W13`

```
┌──────────────────────────────────────────────────────────────────┐
│  IT 部門週報                                                     │
│  [< 上一週]  2026-03-23 ~ 03-27（第 13 週）  [下一週 >]        │
│                                                                  │
│  ── 本週摘要（WeekSummaryCards） ───────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 完成 5件 │ │ 進行中7件│ │ 逾期 3件 │ │ 計畫外2件│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ── 完成事項（CompletedTaskList） ──────────────────────────── │
│  ✅ Bob 完成「網路監控告警規則更新」[PLANNED] (7h)              │
│  ✅ Eve 完成「季度備份系統測試」[PLANNED] (6h)                  │
│  ✅ Carol 完成「AD 帳號清查報告」[PLANNED] (12h)               │
│  ✅ Bob 完成「路由器告警調查」[ADDED] (2.5h)                   │
│  ✅ Dave 完成「SSL 憑證續約」[PLANNED] (4h)                    │
│                                                                  │
│  ── 進行中（InProgressTaskList） ──────────────────────────── │
│  🔵 Bob [P0][PLANNED] 更新核心交換機韌體 (進度 33%, 截止03/28)│
│  🔵 Dave [P1][PLANNED] DR 演練準備 (進度 50%, 截止04/07)      │
│  ... (共 7 件)                                                   │
│                                                                  │
│  ── 逾期未完成（OverdueList） ────────────────────────────── │
│  ⚠ (無，已全部在本週處理)                                       │
│                                                                  │
│  ── 本週計畫外任務（UnplannedThisWeek） ──────────────────── │
│  🔶 Bob [ADDED] 路由器告警調查 — 來源：監控系統告警 (2.5h)    │
│  🔶 Carol [SUPPORT] 財務部報表查詢問題 — 來源：財務部黃課長(1h)│
│                                                                  │
│  ── 下週重點（NextWeekPlan） ─────────────────────────────── │
│  （自動生成：從下週到期且狀態非 DONE 的任務列出）               │
│  📌 Bob 03/28 [P0] 更新核心交換機韌體 — 需完成韌體更新        │
│  📌 Dave 03/28 [P0] 季度漏洞掃描                               │
│  📌 Eve 03/28 [P2] 備份系統測試                                │
│                                                                  │
│  ── 主管備註（ManagerNotes）── 可編輯區 ─────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Bob 本月計畫外負荷 35%，建議下月調整任務分配，            │  │
│  │ 將部分 SUPPORT 任務分配給工時較低的 Eve。                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│            [編輯後匯出 PDF]   [直接匯出 PDF]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**週報自動生成邏輯：**
1. `CompletedTaskList`：`GET /api/tasks?status=DONE&completedDateFrom=weekStart&completedDateTo=weekEnd`
2. `InProgressTaskList`：`GET /api/tasks?status=IN_PROGRESS,REVIEW`
3. `UnplannedThisWeek`：`GET /api/tasks?category=ADDED,INCIDENT,SUPPORT&createdFrom=weekStart&createdTo=weekEnd`
4. `NextWeekPlan`：`GET /api/tasks?status=TODO,IN_PROGRESS&dueDateFrom=nextWeekStart&dueDateTo=nextWeekEnd`
5. `ManagerNotes`：存於 `localStorage` key `titan_weekly_notes_{weekId}`，匯出 PDF 時包含

### 6.3 計畫外負荷分頁（UnplannedWorkloadTab）

**API：** `GET /api/reports/unplanned-workload?month=2026-03`

```
┌──────────────────────────────────────────────────────────────────┐
│  計畫外負荷報表          2026 年 3 月                            │
│  [< 上月]  [本月]  [下月 >]                                     │
│                                                                  │
│  ── 總覽（UnplannedOverviewCards） ──────────────────────────── │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │ 計畫任務: 20件 │ │ 計畫外: 8件    │ │ 計畫外比: 28.6%│       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │ 計畫工時:110h  │ │ 計畫外工時:45h │ │ 計畫外工時:29% │       │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
│                                                                  │
│  ── 來源分析（UnplannedSourceChart） ─────────── 水平長條圖 ── │
│                                                                  │
│  監控系統告警  ████████████████████  3件  18h                    │
│  用戶支援請求  ██████████████████████████  4件  20h              │
│  主管臨時指派  ████████  1件  7h                                 │
│                                                                  │
│  ── 分類統計（UnplannedCategoryPie） ──────── 圓餅圖 ────────  │
│                                                                  │
│       ADDED (追加)     4件  22h  ████████████  49%               │
│       INCIDENT (突發)  2件  15h  ████████      33%               │
│       SUPPORT (支援)   2件   8h  ████          18%               │
│                                                                  │
│  ── 各人計畫外負荷（UnplannedPerPersonTable） ───────────────  │
│                                                                  │
│  成員     計畫外任務  計畫外工時  計畫外工時比  狀態             │
│  ──────  ──────────  ──────────  ──────────── ──────           │
│  Bob     3件 ⚠       22h ⚠       35.5%         ⚠ 偏高          │
│  Dave    2件          12h         18.2%         正常            │
│  Carol   2件           8h         13.2%         正常            │
│  林志偉  1件           3h          5.7%         正常            │
│  Eve     0件           0h          0.0%         正常            │
│                                                                  │
│  ⚠ 警示門檻：計畫外工時比 > 30% 時標記為「偏高」               │
│                                                                  │
│  ── 趨勢圖（UnplannedTrendChart） ── 最近 6 個月折線圖 ──────  │
│                                                                  │
│  35% ┤                                          *               │
│  30% ┤                              *                            │
│  25% ┤              *   *                                        │
│  20% ┤  *                                                        │
│  15% ┤                                                           │
│      └──┬──────┬──────┬──────┬──────┬──────┬──                  │
│        10月   11月   12月    1月    2月    3月                    │
│                                                                  │
│  ── 主管可加註意見 ─────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [可編輯] 建議措施：將 SUPPORT 類任務部分轉由 Eve 承接，  │  │
│  │ Bob 聚焦於 PLANNED 核心基礎設施任務。                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 KPI 達成報表分頁（KPIReportTab）

**API：** `GET /api/reports/kpi?year=2026`

```
┌──────────────────────────────────────────────────────────────────┐
│  KPI 達成報表          2026 年度                                 │
│  [2025 ▼]  ← 年度選擇                                          │
│                                                                  │
│  ── KPI 總覽（KPIOverviewTable） ────────────────────────────── │
│                                                                  │
│  編號       名稱               權重  目標    實際   達成率 狀態  │
│  ────────  ─────────────────  ────  ──────  ────── ────── ────  │
│  KPI-01    系統可用率          30%   99.5%   99.7%  100.2% ✓達成│
│  KPI-02    事件解決時效        25%   95%     92%     96.8% ⚠進行│
│  KPI-03    資安稽核完成        20%   100%    75%     75.0%  進行│
│  KPI-04    員工訓練時數        15%   40h     35h     87.5%  進行│
│  KPI-05    系統變更成功率      10%   98%     99.2%  101.2% ✓達成│
│  ──────── ─────────────────  ────  ──────  ────── ──────        │
│  加權年度達成率                                      90.4%       │
│  ████████████████████████████████████████░░░░░░░░░              │
│                                                                  │
│  ── KPI-02 展開明細（KPIDetailAccordion）──── 點擊列展開 ──── │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ KPI-02 事件解決時效                                      │  │
│  │ 目標：95% 事件在 4 小時內解決                            │  │
│  │ 實際：92%（46/50 件事件在時效內完成）                    │  │
│  │                                                          │  │
│  │ 連結任務:                                                │  │
│  │  ✅ [DONE] 建立事件分級 SOP        貢獻權重: 0.3        │  │
│  │  🔵 [IN_PROGRESS] 導入自動派工     貢獻權重: 0.4        │  │
│  │  🔵 [IN_PROGRESS] 訓練一線人員     貢獻權重: 0.3        │  │
│  │                                                          │  │
│  │ 交付項:                                                  │  │
│  │  📄 事件分級 SOP 文件    [已驗收] ✓                      │  │
│  │  📄 自動派工系統測試報告 [進行中]                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ── 達成率雷達圖（KPIRadarChart） ───────── 五邊形雷達圖 ──── │
│                                                                  │
│           系統可用率 (100%)                                      │
│              ╱╲                                                  │
│       訓練  ╱  ╲  事件解決                                     │
│       (88%)╱    ╲ (97%)                                        │
│           ╱      ╲                                              │
│       變更 ╲    ╱  資安稽核                                    │
│       (101%)╲╱    (75%)                                        │
│                                                                  │
│  藍色區域 = 實際值   灰色虛線 = 目標值                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.5 月報分頁（MonthlyReportTab）

**API：** `GET /api/reports/monthly?month=2026-03`

```
┌──────────────────────────────────────────────────────────────────┐
│  月報          2026 年 3 月                                      │
│  [< 上月]  [本月]  [下月 >]                                     │
│                                                                  │
│  ── 月度目標達成（MonthlyGoalProgress） ──────────────────────  │
│                                                                  │
│  目標: 資安稽核準備                                              │
│    進度: 83%  ████████████████████░░░░  3/4 任務完成              │
│    ✅ 資安稽核報告 (Alice)                                       │
│    ✅ AD 帳號清查 (Carol)                                        │
│    ✅ 安全政策文件更新 (Alice)                                   │
│    🔵 季度漏洞掃描 (Dave) — 截止 03/28                          │
│                                                                  │
│  目標: 網路基礎設施更新                                          │
│    進度: 60%  ████████████░░░░░░░░  3/5 任務完成                  │
│    ✅ 網路監控告警規則更新 (Bob)                                  │
│    ✅ SSL 憑證續約 (Dave)                                        │
│    ✅ 路由器告警調查 (Bob) [ADDED]                               │
│    🔵 更新核心交換機韌體 (Bob) — 截止 03/28                     │
│    🔵 機房設備清冊更新 (Bob) — 截止 03/31                       │
│                                                                  │
│  ── 任務統計（MonthlyTaskStats） ──────────── 圓餅圖 + 表格 ── │
│                                                                  │
│  完成: 12件  進行中: 5件  逾期: 1件  取消: 0件                   │
│                                                                  │
│  ── 每人工時統計（PersonHoursChart） ────── 堆疊長條圖 ──────── │
│                                                                  │
│  林志偉 ██████████████████████████████████████  (52h)            │
│  Bob    ████████████████████████████████████████████████ (168h)   │
│  Carol  ████████████████████████████████ (61h)                   │
│  Dave   ████████████████████████████████████████ (66h)           │
│  Eve    ██████████████████████████ (50h)                         │
│                                                                  │
│  色標: █PLANNED  █ADDED  █INCIDENT  █SUPPORT  █ADMIN  █LEARNING │
│                                                                  │
│  ── 延期與變更摘要（DelayChangeSummary） ─────────────────────  │
│  延期 3件: 交換機韌體(+7天)、AD清查(+2天)、SSL憑證(+1天)       │
│  變更 2件: DR演練準備(範圍擴大)、漏洞掃描(範圍縮減)             │
│  [查看詳細 → 跳至延期變更分頁]                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.6 延期變更分頁（DelayChangeTab）

**API：** `GET /api/reports/delay-change?month=2026-03`

```
┌──────────────────────────────────────────────────────────────────┐
│  延期與變更追蹤          2026 年 3 月                            │
│                                                                  │
│  ── 統計摘要 ─────────────────────────────────────────────────  │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐               │
│  │ 延期: 4件  │ │ 變更: 2件  │ │ 平均延期: 3.3天│               │
│  └────────────┘ └────────────┘ └────────────────┘               │
│                                                                  │
│  ── 變更時間軸（ChangeTimeline） ──────── 由新至舊 ───────────  │
│                                                                  │
│  03/26 15:30  林志偉                                             │
│    DELAY  「更新核心交換機韌體」03/21 → 03/28                   │
│    原因：等待廠商提供修正版韌體                                  │
│    影響：A角 Bob, B角 Dave                                       │
│                                                                  │
│  03/22 10:00  林志偉                                             │
│    SCOPE_CHANGE  「DR 演練準備」                                 │
│    原因：副總要求擴大演練範圍，需納入分行 DR 場景               │
│    舊範圍：僅總行核心系統  →  新範圍：含 3 間分行               │
│    預估工時：8h → 16h                                            │
│                                                                  │
│  03/20 17:00  Carol                                              │
│    DELAY  「AD 帳號清查報告」03/20 → 03/22                      │
│    原因：發現異常帳號需額外調查確認                              │
│                                                                  │
│  03/19 09:00  Dave                                               │
│    DELAY  「SSL 憑證續約」03/19 → 03/20                         │
│    原因：CA 簽發延遲                                             │
│                                                                  │
│  03/15 14:00  林志偉                                             │
│    SCOPE_CHANGE  「季度漏洞掃描」                                │
│    原因：資安組確認可縮減外部 IP 掃描範圍                        │
│    舊範圍：含 DMZ + 外部  →  新範圍：僅 DMZ                     │
│    預估工時：12h → 8h                                            │
│                                                                  │
│  ── 各人延期統計 ─────────────────────────────────────────────  │
│  Bob:    1次延期 (平均 7天)                                      │
│  Carol:  1次延期 (平均 2天)                                      │
│  Dave:   1次延期 (平均 1天)                                      │
│  林志偉: 1次延期（代 Bob 申請）                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.7 PDF 匯出規格

**操作：** 點擊「匯出 PDF」按鈕 → `GET /api/reports/export/pdf?type=weekly&week=2026-W13`

**PDF 產生技術：** `@react-pdf/renderer` 在 Server-side 渲染

**PDF 內容結構：**
1. 封面頁：TITAN logo + 報表名稱 + 期間 + 產出日期
2. 摘要頁：統計卡片數據 + 關鍵指標
3. 詳細頁：與網頁版相同的表格與列表（無互動元素）
4. 附註頁：主管備註（若有）

**檔名格式：** `IT部門{報表名}_{期間}.pdf`，例如 `IT部門計畫外負荷報表_202603.pdf`

---

## 7. Kanban + Gantt（模組五：任務視覺化）

### 7.1 看板頁面（KanbanBoardPage）精確佈局

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  首頁    │  ┌──────────────────────────────────────────────────────────────┐    │
│ ◄看板    │  │ KanbanToolbar                                               │    │
│  甘特圖  │  │                                                              │    │
│  知識庫  │  │ [看板] [甘特圖]  ← ViewToggle                               │    │
│  工時紀錄│  │                                                              │    │
│  報表    │  │ 篩選: [全部成員▼] [全部優先級▼] [全部分類▼] [標籤▼] [日期▼]│    │
│          │  │                                                              │    │
│          │  │ 分類圖例: ●PLANNED ●ADDED ●INCIDENT ●SUPPORT ●ADMIN ●LEARN │    │
│          │  │                                                              │    │
│          │  │ [匯入Excel]  [+ 新增任務]                                   │    │
│          │  └──────────────────────────────────────────────────────────────┘    │
│          │                                                                      │
│          │  ┌────────────┬────────────┬────────────┬──────────┬──────────┐     │
│          │  │ BACKLOG(3) │ TODO (5)   │IN_PROGRESS │REVIEW(2) │ DONE(8)  │     │
│          │  │            │            │   (4)      │          │          │     │
│          │  ├────────────┤────────────┤────────────┤──────────┤──────────┤     │
│          │  │ TaskCard   │ TaskCard   │ TaskCard   │ TaskCard │ TaskCard │     │
│          │  │ ┌────────┐│ ┌────────┐│ ┌────────┐│ ┌──────┐│ ┌──────┐│     │
│          │  │ │[P3]    ││ │[P1]    ││ │[P0] ⚠  ││ │[P1]  ││ │      ││     │
│          │  │ │[ADMIN] ││ │[PLAN]  ││ │[PLAN]  ││ │[PLAN]││ │ ...  ││     │
│          │  │ │整理測試││ │網路監控││ │更新核心││ │資安  ││ │      ││     │
│          │  │ │環境文件││ │告警調整││ │交換機  ││ │政策  ││ │      ││     │
│          │  │ │        ││ │        ││ │逾期5天 ││ │文件  ││ │      ││     │
│          │  │ │A:Bob   ││ │ 03/27  ││ │A:Bob   ││ │A:Wei ││ │      ││     │
│          │  │ │B:-     ││ │A:Bob   ││ │B:Dave  ││ │B:-   ││ │      ││     │
│          │  │ │        ││ │B:-     ││ │ 33%    ││ │      ││ │      ││     │
│          │  │ └────────┘│ └────────┘│ └────────┘│ └──────┘│ └──────┘│     │
│          │  │ ┌────────┐│ ┌────────┐│ ┌────────┐│ ┌──────┐│          │     │
│          │  │ │[P2]    ││ │[P0]    ││ │[P1]    ││ │[P2]  ││          │     │
│          │  │ │[LEARN] ││ │[ADDED] ││ │[PLAN]  ││ │[PLAN]││          │     │
│          │  │ │閱讀資安││ │路由器  ││ │機房設備││ │AD帳號││          │     │
│          │  │ │政策文件││ │告警調查││ │清冊    ││ │清查  ││          │     │
│          │  │ │A:Bob   ││ │追加:監控││ │A:Bob   ││ │A:Car ││          │     │
│          │  │ └────────┘│ │A:Bob   ││ │B:Dave  ││ └──────┘│          │     │
│          │  │ [+新增]   │ │B:Dave  ││ └────────┘│          │          │     │
│          │  │           │ └────────┘│            │          │          │     │
│          │  └────────────┴────────────┴────────────┴──────────┴──────────┘     │
│          │                                                                      │
│          │  拖曳互動：@dnd-kit 拖放                                             │
│          │  - 卡片可在欄位間水平拖曳 → PATCH /api/tasks/:id/status              │
│          │  - Optimistic UI：拖曳時立即移動，API 失敗時 Toast + 回滾            │
│          │  - 點擊卡片 → 右側滑入 TaskDetailSheet                               │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

### 7.2 TaskCard 元件規格

```
TaskCard（shadcn Card，高度自適應，寬度填滿欄位）
├── 頂部行：
│   ├── PriorityBadge（左上角）
│   │   P0: bg-red-500/20 text-red-400 "P0"
│   │   P1: bg-orange-500/20 text-orange-400 "P1"
│   │   P2: bg-blue-500/20 text-blue-400 "P2"
│   │   P3: bg-zinc-500/20 text-zinc-400 "P3"
│   ├── CategoryBadge（緊接右側）
│   │   PLANNED:  bg-indigo-600/20 text-indigo-400 "原始"
│   │   ADDED:    bg-orange-600/20 text-orange-400 "追加"
│   │   INCIDENT: bg-red-700/20 text-red-400 "突發"
│   │   SUPPORT:  bg-sky-600/20 text-sky-400 "支援"
│   │   ADMIN:    bg-zinc-600/20 text-zinc-400 "行政"
│   │   LEARNING: bg-emerald-600/20 text-emerald-400 "學習"
│   └── OverdueBadge（右上角，僅逾期時顯示）
│       bg-red-900/30 text-red-400 "逾期N天"
├── 中間：TaskTitle（text-sm font-medium text-zinc-100，最多 2 行）
├── 若為 ADDED：AddedSourceTag（text-xs text-orange-400 "追加自: {source}"）
├── 底部行：
│   ├── DueDate（text-xs text-zinc-400，逾期時 text-red-400）
│   ├── AssigneeAvatarPair（右側）
│   │   ├── A角 Avatar（24x24, 圓形，有 Tooltip 顯示全名）
│   │   └── B角 Avatar（24x24, 圓形，半透明，有 Tooltip）
│   └── ProgressMini（若有 SubTask，顯示 "2/5" text-xs）
└── 懸停效果：bg-zinc-800，左邊框 2px 品牌藍（indigo-500）
```

### 7.3 甘特圖頁面（GanttChartPage）精確佈局

```
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│          │                                                                      │
│  首頁    │  ┌──────────────────────────────────────────────────────────────┐    │
│  看板    │  │ GanttToolbar                                                │    │
│ ◄甘特圖  │  │ [看板] [甘特圖]    時間範圍：[月] [季] [年]                 │    │
│  知識庫  │  │ [< 上一期] [今日] [下一期 >]   篩選：[全部成員▼]           │    │
│  工時紀錄│  └──────────────────────────────────────────────────────────────┘    │
│  報表    │                                                                      │
│          │  ┌────────────────────────────┬─────────────────────────────────────┐│
│          │  │ GanttTaskList (左側 300px) │ GanttTimeline (右側，可水平捲動)    ││
│          │  │                            │ 03/23  03/26  03/28  04/01  04/07   ││
│          │  │                            │  一      四     六     三     二     ││
│          │  ├────────────────────────────┼─────────────────────────────────────┤│
│          │  │◆ 2026 IT 年度計畫          │ ═══════════════════════════════════ ││
│          │  │  ◇ Q1 資安稽核  ⚠2天      │            ◇━━━(03/28)             ││
│          │  │  ◇ H1 網路更新            │                     ◇──────(06/30) ││
│          │  ├────────────────────────────┼─────────────────────────────────────┤│
│          │  │▸ 3月: 資安稽核準備         │                                     ││
│          │  │  [P1] Alice 資安稽核報告   │ ████████████████                    ││
│          │  │  [P1] Carol AD帳號清查     │ ████████████████████        ← 完成  ││
│          │  │  [P0] Dave 漏洞掃描        │         ░░░░░░░░████               ││
│          │  ├────────────────────────────┼─────────────────────────────────────┤│
│          │  │▸ 3月: 網路設施更新         │                                     ││
│          │  │  [P0] Bob 交換機韌體       │ ████████████░░░░░░░░░░░   ← 延期⚠  ││
│          │  │  [P0] Bob 路由器告警[追加] │         ████                ← 完成  ││
│          │  │  [P2] Bob 機房清冊         │     ░░░░░░████████████             ││
│          │  │  [P1] Dave DR演練          │           ░░░░░░░░░░░████████      ││
│          │  │  [P2] Dave SSL憑證         │ ████████████████████████   ← 完成  ││
│          │  ├────────────────────────────┼─────────────────────────────────────┤│
│          │  │                            │ 圖例:                               ││
│          │  │                            │ ████ 進行中/完成  ░░░░ 計畫中       ││
│          │  │                            │ ◇ 里程碑  │今日  ⚠逾期             ││
│          │  └────────────────────────────┴─────────────────────────────────────┘│
│          │                                                                      │
│          │  互動：                                                              │
│          │  · 點擊任務條 → 開啟 TaskDetailSheet                                │
│          │  · 拖曳任務條右端 → 調整截止日 → 自動彈出 DelayDialog               │
│          │  · 點擊里程碑 ◇ → Tooltip 顯示里程碑詳情                            │
│          │  · 今日線：紅色虛線垂直貫穿                                         │
│          │  · 逾期任務：任務條右端超過今日線部分為紅色                          │
│          │                                                                      │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

**甘特圖任務條色彩規則：**
- PLANNED 進行中：indigo-500
- PLANNED 完成：indigo-400（較淺，帶 checkmark）
- ADDED 進行中：orange-500
- ADDED 完成：orange-400
- INCIDENT：red-500
- 計畫中（未開始）：對應色的 zinc-700（半透明）
- 逾期部分：red-500（從截止日到今日的多出段）

### 7.4 新增任務 Dialog（CreateTaskDialog）

**操作：** 看板頁點擊「+ 新增任務」→ 居中 Dialog

```
┌────────────────────────────────────────────────────────────┐
│                    新增任務                              ✕  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  標題 *   ┌────────────────────────────────────────────┐  │
│           │                                              │  │
│           └────────────────────────────────────────────┘  │
│                                                            │
│  分類 *   [PLANNED          ▼]  ← TaskCategorySelect      │
│                                                            │
│  ── 以下欄位僅當分類 = ADDED 時顯示 ──────────────────── │
│  追加日期  [2026-03-26 📅]                                 │
│  追加原因  ┌────────────────────────────────────────┐     │
│            │                                          │     │
│            └────────────────────────────────────────┘     │
│  追加來源  [監控系統告警     ▼]  ← 可自訂輸入            │
│  ── ──────────────────────────────────────────────────── │
│                                                            │
│  優先級    [P2 (中)          ▼]                            │
│  A 角 *   [選擇成員...       ▼]  ← UserSelect             │
│  B 角     [選擇成員...       ▼]  ← UserSelect             │
│  截止日   [選擇日期   📅]                                  │
│  開始日   [選擇日期   📅]                                  │
│  預估工時 [    ] 小時                                      │
│  月度目標 [3月: 網路基礎設施更新  ▼]  ← GoalSelect       │
│  標籤     [infrastructure] [network] [+ 新增]             │
│                                                            │
│  描述     ┌────────────────────────────────────────────┐  │
│           │ Markdown 支援                                │  │
│           │                                              │  │
│           └────────────────────────────────────────────┘  │
│                                                            │
│              [取消]                    [建立任務]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**API 請求：** `POST /api/tasks`

**後端觸發：**
1. 建立 Task 記錄
2. 若有 A 角 → 建立 Notification（type: TASK_ASSIGNED, userId: A角）
3. 若有 B 角 → 建立 Notification（type: TASK_ASSIGNED, userId: B角）
4. 建立 TaskActivity（action: "CREATED"）
5. 前端：Kanban 對應欄位即時新增卡片（Optimistic UI）
6. Toast：「任務已建立：{title}」

---

## 8. Strategic Cascade（模組六：計畫層級）

### 8.1 計畫瀏覽頁面（StrategicCascadePage）

**路徑：** `/plans`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  計畫管理                                         [從上年複製範本] [+ 建立]  │
│                                                                              │
│  ── 年度選擇 ──                                                             │
│  [2026 ▼]                                                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ StrategicCascadeView（四層級瀑布）                                    │  │
│  │                                                                        │  │
│  │ ╔══════════════════════════════════════════════════════════════════╗  │  │
│  │ ║ KPI 層（KPIRow）                                                ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ KPI-01 系統可用率(30%)    ████████████████████  100.2% ✓        ║  │  │
│  │ ║ KPI-02 事件解決時效(25%)  ████████████████░░░░   96.8% ⚠       ║  │  │
│  │ ║ KPI-03 資安稽核完成(20%)  ███████████░░░░░░░░░   75.0%         ║  │  │
│  │ ║ KPI-04 員工訓練時數(15%)  ██████████████░░░░░░   87.5%         ║  │  │
│  │ ║ KPI-05 變更成功率(10%)    ████████████████████  101.2% ✓       ║  │  │
│  │ ╠══════════════════════════════════════════════════════════════════╣  │  │
│  │ ║ 年度計畫層（AnnualPlanRow）                                     ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 2026 IT 部門年度計畫         整體進度: 72%                      ║  │  │
│  │ ║ ████████████████████████████████░░░░░░░░░░░░                    ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 里程碑:                                                         ║  │  │
│  │ ║  ◇ Q1 資安稽核完成  03/28  [⚠ 2天後]                           ║  │  │
│  │ ║  ◇ H1 網路更新完成  06/30  [133天後]                           ║  │  │
│  │ ║  ◇ 資安認證取得      09/30  [185天後]                           ║  │  │
│  │ ║  ◇ 年度目標結案      12/15  [262天後]                           ║  │  │
│  │ ╠══════════════════════════════════════════════════════════════════╣  │  │
│  │ ║ 月度目標層（MonthlyGoalGrid）                                   ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 1月  完成 ✓  │ 2月 完成 ✓  │ 3月  83% 🔵  │ 4月  0% ░       ║  │  │
│  │ ║ 帳號盤點     │ 資安訓練    │ 資安稽核準備  │ DR演練         ║  │  │
│  │ ║              │             │ 網路設施更新  │ 系統優化       ║  │  │
│  │ ║ ────────────┼─────────────┼──────────────┼──────────── ...  ║  │  │
│  │ ║              │             │              │                   ║  │  │
│  │ ║ 點擊月份 → 展開該月任務列表                                   ║  │  │
│  │ ╠══════════════════════════════════════════════════════════════════╣  │  │
│  │ ║ 任務層（展開 3 月後）                                           ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 目標: 資安稽核準備 (83%)                                        ║  │  │
│  │ ║  ✅ [P1] 資安稽核報告撰寫        Alice      DONE               ║  │  │
│  │ ║  ✅ [P1] AD 帳號清查              Carol      DONE               ║  │  │
│  │ ║  ✅ [P1] 安全政策文件更新         Alice      DONE               ║  │  │
│  │ ║  🔵 [P0] 季度漏洞掃描            Dave       IN_PROGRESS        ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 目標: 網路基礎設施更新 (60%)                                    ║  │  │
│  │ ║  🔵 [P0] 更新核心交換機韌體      Bob(A)/Dave(B)  IN_PROGRESS   ║  │  │
│  │ ║  ✅ [P0] 路由器告警調查 [追加]   Bob(A)/Dave(B)  DONE          ║  │  │
│  │ ║  🔵 [P2] 機房設備清冊更新        Bob        IN_PROGRESS        ║  │  │
│  │ ║  ✅ [P1] SSL 憑證續約            Dave       DONE               ║  │  │
│  │ ║  ✅ [P1] 網路監控告警規則更新    Bob        DONE               ║  │  │
│  │ ║                                                                  ║  │  │
│  │ ║ 點擊任一任務 → 開啟 TaskDetailSheet                             ║  │  │
│  │ ╚══════════════════════════════════════════════════════════════════╝  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 雙向追溯的資料模型關係

```
KPI (id: kpi_01, title: "系統可用率", target: 99.5, actual: 99.7)
  │
  └── KPITaskLink (kpiId: kpi_01, taskId: task_switch, weight: 1.0)
       │
       └── Task (id: task_switch, title: "更新核心交換機韌體")
            │
            ├── monthlyGoalId → MonthlyGoal (id: goal_03_net, title: "網路基礎設施更新")
            │                    │
            │                    └── annualPlanId → AnnualPlan (id: plan_2026, year: 2026)
            │                                       │
            │                                       └── Milestone (title: "H1 網路更新完成")
            │
            ├── SubTask[] → 完成率影響 Task.progressPct
            │   ├── SubTask (title: "確認韌體相容性", done: true)
            │   ├── SubTask (title: "排定維護窗口", done: false)
            │   └── SubTask (title: "執行更新驗證", done: false)
            │   → progressPct = 1/3 = 33%
            │
            ├── TimeEntry[] → 彙整為 Task.actualHours
            │   ├── TimeEntry (date: 03/18, hours: 4.0)
            │   └── TimeEntry (date: 03/19, hours: 3.0)
            │   → actualHours = 7.0
            │
            ├── TaskChange[] → 延期/變更記錄
            │   └── TaskChange (type: DELAY, old: "03/21", new: "03/28")
            │
            └── Deliverable[] → 交付項
                ├── Deliverable (title: "韌體更新報告", status: NOT_STARTED)
                └── Deliverable (title: "測試驗證記錄", status: NOT_STARTED)

向上彙整鏈（自動計算）：
  SubTask(1/3=33%) → Task.progressPct(33%)
    → MonthlyGoal.progressPct = AVG(tasks.progressPct) = (100+100+100+33+60)/5 = 78.6%
      → AnnualPlan.progressPct = AVG(monthlyGoals.progressPct) = (100+100+83+78.6+...)/12
```

### 8.3 計畫範本複製流程

**操作：** 點擊「從上年複製範本」按鈕 → Dialog

```
┌────────────────────────────────────────────┐
│  從前一年複製年度計畫架構              ✕   │
├────────────────────────────────────────────┤
│                                            │
│  來源年度：[2025 ▼]                       │
│  目標年度：2026（自動填入）                │
│  計畫名稱：[2026 IT 部門年度計畫     ]    │
│                                            │
│  複製內容：                                │
│  ☑ 月度目標架構（12 個月度目標的標題）    │
│  ☑ 里程碑架構（里程碑名稱與順序）         │
│  ☐ KPI 架構（KPI 名稱與目標值）           │
│                                            │
│  ⚠ 僅複製架構，不複製任務內容與工時資料   │
│                                            │
│           [取消]       [複製並建立]         │
│                                            │
└────────────────────────────────────────────┘
```

**API 請求：** `POST /api/plans/copy-template`
```json
{
  "fromYear": 2025,
  "toYear": 2026,
  "title": "2026 IT 部門年度計畫",
  "copyMonthlyGoals": true,
  "copyMilestones": true,
  "copyKPIs": false
}
```

---

## 9. 跨模組資料流與 API 整合

### 9.1 當 Bob 完成一個子任務時的完整觸發鏈

```
使用者操作：Bob 在 TaskDetailSheet 中勾選 SubTask「排定維護窗口」
                │
                ▼
前端 API 呼叫：PATCH /api/subtasks/st_002/toggle
                │
                ▼
後端步驟 1：UPDATE sub_tasks SET done = true WHERE id = 'st_002'
                │
                ▼
後端步驟 2：計算 Task.progressPct
            SELECT COUNT(*) FILTER (WHERE done = true) / COUNT(*) FROM sub_tasks WHERE taskId = 'task_switch'
            結果：2/3 = 66.7%
            UPDATE tasks SET progressPct = 66.7 WHERE id = 'task_switch'
                │
                ▼
後端步驟 3：計算 MonthlyGoal.progressPct
            SELECT AVG(progressPct) FROM tasks WHERE monthlyGoalId = 'goal_03_net'
            結果：(100 + 100 + 66.7 + 100 + 100) / 5 = 93.3%
            UPDATE monthly_goals SET progressPct = 93.3 WHERE id = 'goal_03_net'
                │
                ▼
後端步驟 4：計算 AnnualPlan.progressPct
            SELECT AVG(progressPct) FROM monthly_goals WHERE annualPlanId = 'plan_2026'
            UPDATE annual_plans SET progressPct = ... WHERE id = 'plan_2026'
                │
                ▼
後端步驟 5：若 KPI 設定 autoCalc = true，重算 KPI.actual
            SELECT 加權平均(task.progressPct * link.weight) FROM kpi_task_links JOIN tasks ...
            UPDATE kpis SET actual = ... WHERE id = 'kpi_01'
                │
                ▼
後端步驟 6：建立 TaskActivity
            INSERT INTO task_activities (taskId, userId, action, detail)
            VALUES ('task_switch', 'user_bob', 'SUBTASK_DONE', '{"subTaskTitle": "排定維護窗口"}')
                │
                ▼
前端回應：
  1. TaskDetailSheet 中 SubTaskChecklist 即時更新勾選狀態
  2. TaskCard 上 ProgressMini 顯示 "2/3"
  3. StrategicCascadePage 中 MonthlyGoal 進度條更新
  4. ManagementCockpitPage 中 WeekProgressCard 百分比更新
  5. Toast：「子任務已完成：排定維護窗口」
```

### 9.2 完整 API 呼叫矩陣

| 頁面 | 載入時 API 呼叫 | 使用者操作觸發 API |
|------|---------------|-------------------|
| ManagementCockpitPage | `cockpit/summary`, `kpis?year`, `cockpit/team-workload`, `notifications` | 點擊成員→`tasks?assigneeId`; 點擊任務→`tasks/:id` |
| EngineerDashboardPage | `cockpit/my-summary`, `tasks?assigneeId=me`, `notifications` | 開始計時→`tasks/:id/status`; 記工時→`POST time-entries` |
| KanbanBoardPage | `tasks/kanban`, `users`（篩選用） | 拖曳→`tasks/:id/status`; 新增→`POST tasks`; 點擊→`tasks/:id` |
| GanttChartPage | `tasks/gantt`, `milestones`, `plans/:id` | 拖曳截止日→`tasks/:id/delay`; 點擊→`tasks/:id` |
| TimesheetWeeklyPage | `time-entries?userId&dateFrom&dateTo`, `tasks?assigneeId=me&status!=DONE` | 點擊格子→`POST/PATCH time-entries`; 刪除→`DELETE time-entries/:id` |
| TimesheetCalendarPage | `time-entries?userId&month` | 點擊日期→展開當日明細; 編輯→`PATCH time-entries/:id` |
| KnowledgeBasePage | `documents/tree`, `documents/:slug` | 搜尋→`documents/search`; 編輯→`PATCH documents/:id` |
| ReportsCenterPage | 依選中 Tab：`reports/weekly` / `reports/monthly` / `reports/kpi` / `reports/unplanned-workload` / `reports/delay-change` | 匯出→`reports/export/pdf` or `reports/export/excel` |
| StrategicCascadePage | `kpis?year`, `plans?year`, `goals?planId`, `milestones?planId` | 展開月份→`tasks?goalId`; 複製範本→`POST plans/copy-template` |

---

## 10. 完整元件清單與命名規範

### 10.1 共用元件（`/components/shared/`）

| 元件名稱 | 用途 | 所在模組 |
|---------|------|---------|
| `TopNavBar` | 頂部導覽列：logo + 通知鈴 + 使用者 + 登出 | 全局 Layout |
| `SideNav` | 左側導覽列：6 個頁面入口 | 全局 Layout |
| `NotificationBell` | 通知鈴鐺 + 紅點數字 + 下拉列表 | TopNavBar |
| `NotificationDropdown` | 通知列表面板 | NotificationBell |
| `TaskDetailSheet` | 任務詳情右側滑入面板（480px） | Cockpit, Kanban, Gantt, Strategic |
| `TaskHeader` | 任務詳情標頭（Priority + Category + 逾期） | TaskDetailSheet |
| `TaskMetaFields` | 任務詳情欄位組（狀態/A角/B角/日期/工時） | TaskDetailSheet |
| `SubTaskChecklist` | 子任務勾選列表 | TaskDetailSheet |
| `DeliverableList` | 交付項列表 | TaskDetailSheet |
| `TimeEntryMiniList` | 工時摘要列表（最近 5 筆） | TaskDetailSheet |
| `CommentThread` | 留言串 | TaskDetailSheet |
| `ChangeLogTimeline` | 變更記錄時間軸 | TaskDetailSheet |
| `TimeEntryPopover` | 工時快速輸入 Popover | Timesheet, Dashboard |
| `DelayDialog` | 延期記錄 Dialog | TaskDetailSheet, Gantt |
| `CreateTaskDialog` | 新增任務 Dialog | Kanban |
| `StatCard` | 統計摘要卡片 | Cockpit, Dashboard, Reports |
| `PriorityBadge` | 優先級標籤（P0-P3） | TaskCard, TaskDetailSheet |
| `CategoryBadge` | 任務分類標籤（6 色） | TaskCard, TaskDetailSheet |
| `UserSelect` | 使用者選擇下拉 | CreateTaskDialog, TaskMetaFields |
| `GoalSelect` | 月度目標選擇下拉 | CreateTaskDialog |
| `AutoTimerWidget` | 本機計時器（localStorage 持久化） | EngineerDashboard |

### 10.2 頁面元件（`/app/(dashboard)/`）

| 元件名稱 | 路徑 | 說明 |
|---------|------|------|
| `ManagementCockpitPage` | `/` (Manager) | 主管駕駛艙 |
| `EngineerDashboardPage` | `/` (Engineer) | 工程師首頁 |
| `KanbanBoardPage` | `/board` | 看板 |
| `GanttChartPage` | `/gantt` | 甘特圖 |
| `TimesheetWeeklyPage` | `/timesheet` | 工時週表 |
| `TimesheetCalendarPage` | `/timesheet/calendar` | 工時月曆 |
| `KnowledgeBasePage` | `/wiki` | 知識庫 |
| `DocumentViewPage` | `/wiki/:slug` | 文件檢視 |
| `DocumentEditPage` | `/wiki/:slug/edit` | 文件編輯 |
| `ReportsCenterPage` | `/reports` | 報表中心 |
| `StrategicCascadePage` | `/plans` | 計畫層級 |
| `AnnualPlanDetailPage` | `/plans/:id` | 年度計畫詳情 |
| `UserManagementPage` | `/settings/users` | 使用者管理 |
| `LoginPage` | `/login` | 登入 |

### 10.3 Cockpit 子元件（`/components/cockpit/`）

| 元件名稱 | 說明 |
|---------|------|
| `CockpitSummaryRow` | 4 張摘要卡水平排列 |
| `WeekProgressCard` | 本週完成率 |
| `OverdueTasksCard` | 逾期件數 |
| `DelayChangeCard` | 延期 + 變更件數 |
| `UnplannedCard` | 計畫外件數 + 比例 |
| `KPIAchievementPanel` | KPI 進度條列表 |
| `KPIProgressBar` | 單個 KPI 進度條 |
| `TeamWorkloadTable` | 團隊工作負載表 |
| `TeamMemberRow` | 單人工作負載列（可展開） |
| `MemberTaskBreakdown` | 展開後的任務分類明細 |
| `OverdueTaskList` | 逾期任務列表 |
| `OverdueTaskItem` | 單個逾期任務項 |
| `UpcomingPanel` | 即將到期面板 |
| `MilestoneUpcoming` | 即將到期里程碑 |
| `TaskUpcoming` | 即將到期任務 |

### 10.4 Timesheet 子元件（`/components/timesheet/`）

| 元件名稱 | 說明 |
|---------|------|
| `TimesheetViewToggle` | 週表/月曆切換 |
| `TimesheetWeeklyGrid` | 週表格狀表格 |
| `TimesheetCalendarGrid` | 月曆格子 |
| `DayDetailPanel` | 月曆中點擊日期展開的明細 |
| `WeekCategorySummary` | 本週工時分類長條圖 |
| `WeekEngagementGauge` | 投入率儀表板 |
| `QuickTimeEntryButton` | 快速記工時按鈕 |

### 10.5 Kanban 子元件（`/components/kanban/`）

| 元件名稱 | 說明 |
|---------|------|
| `KanbanToolbar` | 工具列（篩選 + 圖例 + 操作按鈕） |
| `KanbanColumn` | 單個狀態欄（BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE） |
| `TaskCard` | 任務卡片 |
| `AssigneeAvatarPair` | A 角 + B 角頭像 |
| `ProgressMini` | 子任務進度 mini 顯示 |
| `ViewToggle` | 看板/甘特圖切換 |

### 10.6 Reports 子元件（`/components/reports/`）

| 元件名稱 | 說明 |
|---------|------|
| `ReportTabNav` | 報表分頁導覽 |
| `WeeklyReportTab` | 週報內容 |
| `MonthlyReportTab` | 月報內容 |
| `KPIReportTab` | KPI 達成報表 |
| `UnplannedWorkloadTab` | 計畫外負荷報表 |
| `DelayChangeTab` | 延期變更追蹤 |
| `UnplannedSourceChart` | 計畫外來源長條圖 |
| `UnplannedCategoryPie` | 計畫外分類圓餅圖 |
| `UnplannedPerPersonTable` | 各人計畫外負荷表 |
| `UnplannedTrendChart` | 計畫外趨勢折線圖 |
| `KPIOverviewTable` | KPI 總覽表格 |
| `KPIDetailAccordion` | KPI 展開明細 |
| `KPIRadarChart` | KPI 雷達圖 |
| `PersonHoursChart` | 每人工時堆疊長條圖 |
| `ManagerNotes` | 主管備註可編輯區 |

---

## 11. 完整資料模型關係圖

### 11.1 核心實體關係

```
User
 ├── 1:N → AnnualPlan (createdBy)
 ├── 1:N → Task (primaryAssigneeId)  ← A角
 ├── 1:N → Task (backupAssigneeId)   ← B角
 ├── 1:N → Task (creatorId)
 ├── 1:N → TaskComment (userId)
 ├── 1:N → TaskActivity (userId)
 ├── 1:N → TaskChange (changedBy)
 ├── 1:N → TimeEntry (userId)
 ├── 1:N → Document (createdBy, updatedBy)
 ├── 1:N → DocumentVersion (createdBy)
 ├── 1:N → Notification (userId)
 ├── 1:N → Permission (granteeId, granterId)
 ├── 1:N → KPI (createdBy)
 └── 1:N → Deliverable (acceptedBy)

KPI
 ├── N:M → Task (through KPITaskLink)
 └── 1:N → Deliverable

AnnualPlan
 ├── 1:N → MonthlyGoal
 ├── 1:N → Milestone
 └── 1:N → Deliverable

MonthlyGoal
 ├── 1:N → Task
 └── 1:N → Deliverable

Task
 ├── 1:N → SubTask
 ├── 1:N → TaskComment
 ├── 1:N → TaskActivity
 ├── 1:N → TaskChange
 ├── 1:N → TimeEntry
 ├── N:M → KPI (through KPITaskLink)
 └── 1:N → Deliverable

Document
 ├── 1:N → Document (self-referencing tree: parentId)
 └── 1:N → DocumentVersion
```

### 11.2 計算欄位自動更新規則

| 欄位 | 計算公式 | 觸發時機 |
|------|---------|---------|
| `Task.progressPct` | `COUNT(subTasks WHERE done=true) / COUNT(subTasks)` | SubTask toggle |
| `Task.actualHours` | `SUM(timeEntries.hours WHERE taskId = this.id)` | TimeEntry CRUD |
| `MonthlyGoal.progressPct` | `AVG(tasks.progressPct WHERE monthlyGoalId = this.id)` | Task.progressPct 變更 |
| `AnnualPlan.progressPct` | `AVG(monthlyGoals.progressPct WHERE annualPlanId = this.id)` | MonthlyGoal.progressPct 變更 |
| `KPI.actual` (autoCalc=true) | `SUM(task.progressPct * link.weight) / SUM(link.weight)` for linked tasks | Task.progressPct 變更 |

### 11.3 通知觸發規則

| 事件 | NotificationType | 接收者 | 觸發 API |
|------|-----------------|--------|---------|
| 任務指派 | TASK_ASSIGNED | A角, B角 | POST tasks, PATCH tasks/:id/assign |
| 任務到期前 7 天 | TASK_DUE_SOON | A角 | Cron job (每日 08:00) |
| 任務逾期 | TASK_OVERDUE | A角, Manager | Cron job (每日 08:00) |
| 任務被評論 | TASK_COMMENTED | A角 (若留言者非 A角) | POST tasks/:id/comments |
| 里程碑到期前 7 天 | MILESTONE_DUE | Manager | Cron job (每日 08:00) |
| B 角被啟用 | BACKUP_ACTIVATED | B角 | Manager 手動操作 |
| 任務延期/變更 | TASK_CHANGED | A角, B角 | PATCH tasks/:id/delay, /scope-change |

---

*文件版本：v4.0（統一版）｜ 建立日期：2026-03-26 ｜ TITAN 銀行 IT 團隊工作管理系統*

*本文件整合 Management Cockpit、Timesheet v3（週表+月曆雙視圖）、Knowledge Base v2（全文搜尋+版本差異）、Reports v2（5 種報表+PDF/Excel 匯出）、Kanban+Gantt（拖曳+互動）、Strategic Cascade（KPI→年度計畫→月度目標→任務四層瀑布），為 TITAN 系統的完整統一設計規格。*
