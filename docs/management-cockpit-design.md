# TITAN 管理駕駛艙（Management Cockpit）設計文件

> **版本**: v1.0
> **日期**: 2026-03-26
> **目的**: 解決五大模組（年度計劃、KPI、儀表板、甘特圖、看板）各自獨立、管理者無法一頁掌握全局的核心問題

---

## 一、問題診斷

### 現況痛點

TITAN 目前的五個核心模組彼此孤立：

| 模組 | 路徑 | 看到什麼 | 看不到什麼 |
|------|------|---------|-----------|
| 儀表板 `/dashboard` | 週完成數、逾期數、工時分佈、KPI 達成率 | 只看「本週」快照，無法追溯到年度計畫 |
| 年度計畫 `/plans` | 年度計畫 → 月度目標 → 任務列表 | 看不到 KPI 達成率、工時投入、甘特時程 |
| KPI `/kpi` | KPI 指標列表、連結任務、達成率 | 看不到對應的計畫進度、工時消耗 |
| 甘特圖 `/gantt` | 月度目標 → 任務時程、里程碑 | 看不到 KPI、工時、完成率統計 |
| 看板 `/kanban` | 任務狀態拖拉、篩選 | 完全脫離計畫/KPI 脈絡 |

**結論：管理者要掌握「計畫 X 是否健康」，需要跳轉至少 4 個頁面，無法在同一視角下交叉比對。**

### 現有資料模型關聯（已具備）

```
AnnualPlan (年度計畫)
  ├── monthlyGoals[] (月度目標)
  │     └── tasks[] (任務, via monthlyGoalId)
  ├── linkedTasks[] (直接關聯任務, via annualPlanId)
  ├── milestones[] (里程碑)
  └── deliverables[] (交付項)

Task (任務)
  ├── kpiLinks[] → KPITaskLink → KPI (KPI 連結)
  ├── timeEntries[] (工時紀錄)
  ├── subTasks[] (子任務)
  └── taskChanges[] (延期/變更紀錄)

KPI (指標)
  ├── taskLinks[] → KPITaskLink → Task
  ├── achievements[] (填報紀錄)
  └── histories[] (歷史數據)
```

**關鍵發現：資料層的關聯已經存在（annualPlanId on Task, KPITaskLink, monthlyGoalId），但 UI 層沒有利用這些關聯建立統一視圖。**

---

## 二、競品研究

### 1. Jira — Epics/Roadmap 階層

**全局觀機制：** Roadmap 視圖 + Advanced Roadmap (Plans)
- **階層**：Initiative → Epic → Story → Subtask
- **一頁看全局**：Advanced Roadmap 可以在同一頁看到跨專案的 Epic 進度條、時程、依賴關係
- **鑽取深度**：2 clicks（Roadmap → Epic → Story list）
- **KPI 整合**：無原生 KPI，需靠 Dashboard gadget 拼湊
- **優點**：強大的跨專案 rollup 計算
- **缺點**：過度複雜，中小團隊學習成本高

### 2. Monday.com — High-level Dashboard

**全局觀機制：** Dashboard + Workload View
- **階層**：Workspace → Board → Group → Item → Subitem
- **一頁看全局**：Dashboard 可以拉不同 Board 的 widget（圖表、數字、電池圖）到同一頁
- **鑽取深度**：1 click（widget → 原始 Board item）
- **KPI 整合**：透過 Formula Column + Dashboard Number Widget 模擬
- **優點**：Widget 可高度自訂，視覺化優秀
- **缺點**：沒有原生「目標 → 指標 → 任務」的語義連結

### 3. Asana — Portfolio + Goals

**全局觀機制：** Portfolio View + Goals
- **階層**：Goal → Project → Section → Task → Subtask
- **一頁看全局**：Portfolio 頁面顯示所有專案的狀態（On Track / At Risk / Off Track）、進度條、Owner
- **鑽取深度**：2 clicks（Portfolio → Project → Task）
- **KPI 整合**：Goals 功能可設定 metric target（如「Q1 營收 1000 萬」），自動 rollup 子目標進度
- **優點**：Goal cascade 是原生功能，上下對齊自然
- **缺點**：Goals 和 Project 的連結是手動的，不會自動反映任務完成率

### 4. Notion — Linked Databases + Rollup

**全局觀機制：** Relation + Rollup properties + Dashboard page
- **階層**：自定義，通常為 OKR DB → Project DB → Task DB
- **一頁看全局**：用一個 Page 嵌入多個 Linked Database View，配合 Rollup 計算進度
- **鑽取深度**：1 click（表格 row → 詳情頁）
- **KPI 整合**：Rollup property 可計算關聯任務的完成率、總工時等
- **優點**：極度彈性，可以建立任意關聯
- **缺點**：需要用戶自己建立公式和 rollup，沒有預設的管理視角

### 5. Linear — Cycles + Roadmaps

**全局觀機制：** Projects + Roadmap + Insights
- **階層**：Project → Issue → Sub-issue
- **一頁看全局**：Insights 頁面（burn-up chart, velocity, SLA metrics），Roadmap 顯示 Project 時程
- **鑽取深度**：1 click（Project card → Issue list）
- **KPI 整合**：無原生 KPI，但 SLA metrics 和 cycle time 是內建的
- **優點**：設計極簡，Insights 自動計算，零設定
- **缺點**：沒有「年度計畫 → 月度目標」的概念，偏工程而非管理

### 6. ClickUp — Everything View + Goals

**全局觀機制：** Everything View + Goals + Dashboards
- **階層**：Workspace → Space → Folder → List → Task → Subtask
- **一頁看全局**：Everything View 可跨所有 Space 看所有任務；Goals 可設定 Target（number/currency/true-false），自動追蹤
- **鑽取深度**：1 click（Goal → linked task list）
- **KPI 整合**：Goals 就是 KPI 的概念，可設定數值目標並連結任務
- **優點**：Goals + Dashboard + Time Tracking 深度整合
- **缺點**：功能太多，介面擁擠

### 7. Microsoft Project / Planner

**全局觀機制：** Portfolio Dashboard + Gantt + Resource Management
- **階層**：Portfolio → Program → Project → Task → Subtask
- **一頁看全局**：Portfolio Dashboard 顯示所有專案的健康狀態（紅黃綠燈）、里程碑、資源分配
- **鑽取深度**：2 clicks（Portfolio → Project → Gantt）
- **KPI 整合**：透過 Power BI 連接器做自訂報表
- **優點**：企業級資源管理、基線比較
- **缺點**：過於笨重，不適合敏捷團隊

### 8. OKR Tools (Lattice, 15Five)

**全局觀機制：** OKR Cascade View
- **階層**：Company OKR → Department OKR → Team OKR → Individual OKR
- **一頁看全局**：Tree/Cascade 視圖，每個 Objective 下面展開 Key Results，顯示進度百分比
- **鑽取深度**：1 click（KR → check-in history）
- **KPI 整合**：Key Results 就是 KPI，原生支援
- **優點**：對齊(alignment)視覺化做得最好，一眼看到上下游
- **缺點**：不管任務執行面，只管目標層

### 9. Salesforce Dashboard

**全局觀機制：** Multi-widget configurable dashboard
- **一頁看全局**：拖拉式 Dashboard Builder，每個 widget 是一個 report/chart
- **鑽取深度**：1 click（widget → drill down to records）
- **優點**：Widget 可從任何 object 拉資料，極度彈性
- **設計啟發**：可配置的 widget grid 是最成熟的管理駕駛艙模式

### 10. Google Workspace (Goals/OKRs)

**全局觀機制：** Google Goals (Vids/OKRs) + Calendar + Tasks
- **一頁看全局**：有限，Google 的整合偏鬆散
- **設計啟發**：反面教材 — 分散在不同產品中的目標管理體驗很差

---

### 競品總結：關鍵設計模式

| 模式 | 採用者 | TITAN 適用性 |
|------|--------|-------------|
| **階層式 Cascade View** | Asana Goals, OKR tools, ClickUp | 高 — TITAN 已有 AnnualPlan → MonthlyGoal → Task 階層 |
| **Widget-based Dashboard** | Monday, Salesforce, ClickUp | 中高 — 適合管理者自訂關注面向 |
| **Portfolio Health Map** | MS Project, Asana Portfolio | 中 — TITAN 目前是單年度計畫，非多專案 |
| **Auto-rollup Progress** | Notion Rollup, ClickUp Goals | 高 — TITAN 已有 autoCalc on KPI |
| **Traffic Light Status** | MS Project, Asana | 高 — 簡單直覺，適合快速判斷 |
| **Drill-down in ≤2 clicks** | Linear, Monday | 必須 — 這是核心 UX 要求 |

---

## 三、6-Panel Expert Review（10 輪辯論）

### 議題 1：統一「戰略地圖」是否過度工程？

**Round 1 — PM（產品經理）**
不是過度工程。目前管理者要跳 4 個頁面才能理解「這個計畫健不健康」，這是核心體驗缺陷。一頁式的戰略地圖是 MVP 必要功能。

**Round 2 — 前端工程師**
同意方向，但擔心效能。如果一頁載入 AnnualPlan + MonthlyGoals + Tasks + KPIs + TimeEntries，API 回應可能超過 2 秒。建議用 summary API 預先聚合。

**Round 3 — 後端工程師**
可以做一個 `/api/cockpit/summary` API，在後端用 Prisma 聚合計算。避免前端做 N+1 請求。資料結構大致：
```ts
{
  plan: { id, title, year, progressPct },
  goals: [{ month, title, progressPct, taskStats: { total, done, inProgress, overdue } }],
  kpis: [{ code, title, target, actual, achievementRate, status }],
  workload: { totalHours, plannedRate, unplannedRate },
  alerts: [{ type, message, severity }]
}
```

**Round 4 — UX 設計師**
戰略地圖不是過度工程，但「全部展開」是。用 Progressive Disclosure：首屏只顯示 Plan-level 摘要（紅黃綠燈 + 進度條），點擊才展開月度目標 → 任務。參考 Asana Portfolio 的卡片摘要。

**Round 5 — 資安顧問**
注意權限。Engineer 不該看到 `visibility: MANAGER` 的 KPI。cockpit API 需要根據 role 過濾資料。

**Round 6 — 維運工程師**
建議 cockpit API 加 cache header（stale-while-revalidate 60s），避免每次進入 dashboard 都打 heavy query。

**共識：不是過度工程，但必須分層載入 + 後端聚合 + 權限過濾。**

---

### 議題 2：最小可行的關聯機制是什麼？

**Round 1 — 後端工程師**
現有資料模型已具備：
- `Task.annualPlanId` → 任務直接關聯年度計畫
- `Task.monthlyGoalId` → 任務關聯月度目標
- `KPITaskLink` → KPI 與任務 M:N 關聯
- `TimeEntry.taskId` → 工時關聯任務

所以「Plan → Goal → Task → KPI / TimeEntry」的鏈路已經完整，**不需要新增任何資料表**。

**Round 2 — PM**
但有個缺口：KPI 沒有直接關聯到 AnnualPlan 或 MonthlyGoal。目前 KPI 只透過 taskLinks 間接與計畫相關。如果一個 KPI 的連結任務分散在不同計畫下，管理者無法快速看到「計畫 X 關聯了哪些 KPI」。

**Round 3 — 前端工程師**
可以在後端 cockpit API 中做反查：找出 plan 下所有 task → 找出這些 task 的 kpiLinks → 聚合出 plan-level KPI 列表。不需要改 schema。

**Round 4 — 後端工程師**
確認可行。Prisma query：
```ts
const plan = await prisma.annualPlan.findFirst({
  where: { year },
  include: {
    monthlyGoals: {
      include: {
        tasks: {
          include: {
            kpiLinks: { include: { kpi: true } },
            timeEntries: { select: { hours: true } }
          }
        }
      }
    },
    linkedTasks: {
      include: {
        kpiLinks: { include: { kpi: true } },
        timeEntries: { select: { hours: true } }
      }
    }
  }
});
```
但這會很重。改用聚合查詢更好。

**Round 5 — UX 設計師**
同意不要改 schema。用「計算出來的關聯」展示即可。管理者不需要手動建立「KPI → Plan」的關聯，系統自動從 task links 推導。

**Round 6 — 資安顧問**
注意 linked tasks 可能包含其他團隊的任務。cockpit 顯示時要注意 data leakage。

**共識：MVP 不需要新增資料表。用後端聚合查詢從 task 鏈路推導所有關聯。未來可考慮加 `KPI.annualPlanId` 直接關聯。**

---

### 議題 3：如何將 KPI 進度與任務進度並排顯示？

**Round 1 — UX 設計師**
核心設計：雙軸進度卡。每個月度目標卡片上同時顯示：
- 左側：任務完成率（DONE / Total tasks）
- 右側：關聯 KPI 平均達成率

用不同顏色區分：藍色 = 任務進度，綠色 = KPI 達成。

**Round 2 — PM**
更好的做法：用「健康指數」綜合兩者。例如：
- 健康 = 任務完成率 ≥ KPI 達成率（執行跟上目標）
- 風險 = 任務完成率 < KPI 達成率 × 0.8（執行落後）
- 危險 = 已過時間 > 75% 但 KPI 達成 < 50%

**Round 3 — 前端工程師**
建議用 Split Progress Bar：一個 bar 裡面左半是「任務完成率」右半是「KPI 達成率」，中間用分隔線。hover 顯示明細。

**Round 4 — 後端工程師**
cockpit API 可以為每個 goal 計算：
```ts
{
  goalId: string,
  taskProgress: { total, done, inProgress, overdue },
  kpiProgress: { linked: number, avgAchievement: number, behindCount: number },
  hoursSpent: number,
  healthStatus: 'HEALTHY' | 'AT_RISK' | 'CRITICAL'
}
```

**Round 5 — 維運工程師**
healthStatus 的計算邏輯要可配置。不同團隊對「風險」的定義不同。建議用 config 或 env var。

**Round 6 — 資安顧問**
KPI 明細中如果包含 `visibility: MANAGER` 的指標，Engineer 視角下要隱藏。但 healthStatus 仍可顯示（因為不洩露具體數值）。

**共識：雙軸進度 + 自動健康狀態指示燈。healthStatus 由後端計算，前端顯示為紅黃綠燈。**

---

### 議題 4：儀表板應該是可配置（Widget）還是固定佈局？

**Round 1 — PM**
Phase 1 用固定佈局。理由：
1. TITAN 是內部工具，用戶 < 20 人
2. Widget 系統的開發成本是固定佈局的 3-5 倍
3. 管理者的需求高度相似（不像 Salesforce 那種跨行業工具）

**Round 2 — UX 設計師**
同意。但建議設計時把每個 section 做成獨立元件，方便 Phase 2 改為可拖拉 widget。

**Round 3 — 前端工程師**
React 元件化本來就會這樣做。建議用 CSS Grid 做 responsive layout，每個 section 是一個 `<CockpitSection>` 元件。Phase 2 可以加 react-grid-layout。

**Round 4 — 後端工程師**
固定佈局的好處是 API 可以做成一個 endpoint 返回所有資料。Widget 系統需要每個 widget 獨立 fetch。

**Round 5 — 維運工程師**
固定佈局好維護。Widget 系統的 localStorage 設定會造成「你的 dashboard 和我的 dashboard 不一樣」的支援困擾。

**Round 6 — 資安顧問**
固定佈局更容易做權限控制 — 一個 API 一次判斷。Widget 系統每個 widget 都要獨立驗權。

**共識：Phase 1 固定佈局，元件化設計預留 Phase 2 widget 化空間。**

---

### 議題 5：行動裝置的管理者體驗

**Round 1 — UX 設計師**
管理者最常在手機上做兩件事：
1. 看「有沒有異常」→ Alert 紅燈
2. 看「整體進度」→ 計畫完成率

建議 Mobile First 設計：
- 頂部：Alert 橫幅（紅/黃）
- 中間：年度計畫進度環形圖
- 下方：可收合的月度目標卡片列表

**Round 2 — 前端工程師**
目前的 Tailwind responsive 已經有 `sm:` breakpoint。cockpit page 用 stack layout（mobile）和 grid layout（desktop）即可。

**Round 3 — PM**
手機不需要甘特圖，太小看不了。Mobile 的重點是 summary + alerts。甘特圖和看板留給桌面。

**Round 4 — 後端工程師**
可以在 cockpit API 加 `?compact=true` 參數，只返回 summary 級資料，減少手機端 payload。

**Round 5 — 維運工程師**
如果未來加 PWA push notification（已有 `/api/notifications/push`），可以在 healthStatus 變 CRITICAL 時自動推播。

**Round 6 — 資安顧問**
Mobile 場景要注意螢幕擷取風險。敏感的 KPI 數據在 mobile 顯示時可以用模糊處理（tap to reveal）。

**共識：Mobile First，stack layout + alert banner + progress ring。不在手機顯示甘特圖。**

---

### 議題 6：一頁載入所有資料的效能問題

**Round 1 — 後端工程師**
測算：假設年度計畫有 12 個月度目標，每個目標 10 個任務，每個任務 5 個工時紀錄 + 1 個 KPI link：
- 任務：120 筆
- 工時：600 筆
- KPI links：120 筆

如果用 Prisma include 全撈，JSON 大約 200-400KB。在內網可接受，但不夠優雅。

**Round 2 — 前端工程師**
建議分層載入：
1. 首屏（< 100ms）：只載 plan summary + healthStatus（1 API call, < 5KB）
2. 展開月度目標：lazy load goal detail（per-goal API）
3. 展開甘特圖：lazy load gantt data

**Round 3 — 維運工程師**
加 Redis cache 層。cockpit summary 的 cache TTL 可以設 60 秒 — 管理者不需要即時更新，1 分鐘延遲完全可以接受。

**Round 4 — PM**
同意分層。首屏載入 < 1 秒是硬性要求。

**Round 5 — UX 設計師**
用 skeleton loading 處理展開時的等待。不要讓整頁空白。

**Round 6 — 資安顧問**
cache 層要注意 per-user cache key（role-based），避免 Engineer 拿到 Manager 的 cache 資料。

**共識：cockpit API 分兩層 — summary（輕量首屏）+ detail（展開時 lazy load）。可選 Redis cache。**

---

## 四、TITAN 管理駕駛艙設計方案

### 核心概念：戰略地圖（Strategy Map）

一個管理者專用頁面，從年度計畫向下鑽取到每日執行，最多 3 次點擊到達任意層級。

### 4.1 資訊架構

```
┌─────────────────────────────────────────────────────────┐
│  管理駕駛艙 — 2026 年度                    [切換年度 ◄►]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Alert Banner ─────────────────────────────────────┐ │
│  │ ⚠ 3 月目標「資安稽核準備」進度 30%，但已過月份 75%    │ │
│  │ ⚠ KPI-03 系統可用性已連續 2 個月未達標               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ 年度計畫摘要 ────────────────────────────────────┐  │
│  │  📊 整體進度 ██████████░░░░ 65%                    │  │
│  │                                                    │  │
│  │  🟢 KPI 達成  7/12     🔴 KPI 落後  2/12          │  │
│  │  ✅ 任務完成  85/120   ⏰ 逾期任務  5              │  │
│  │  ⏱  累計工時  1,250h   📈 計畫內投入率 78%         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ 月度目標追蹤 (可展開) ───────────────────────────┐  │
│  │                                                    │  │
│  │  [1月 ██████████ 100%] [2月 ████████░░ 80%]       │  │
│  │  [3月 ████░░░░░░  30%] [4月 ░░░░░░░░░░  0%]  ... │  │
│  │       ⚠ AT_RISK                                    │  │
│  │                                                    │  │
│  │  ▼ 展開 3月 — 資安稽核準備                         │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ 任務進度    ████░░ 4/12 完成                 │  │  │
│  │  │ KPI 關聯    KPI-03: 系統可用性 92%/99.9%     │  │  │
│  │  │            KPI-07: 稽核缺失 3/0              │  │  │
│  │  │ 工時投入    本月 45h / 預估 120h              │  │  │
│  │  │ 逾期任務    2 項 [點擊查看]                   │  │  │
│  │  │ ── 甘特時程 ─────────────────────────────── │  │  │
│  │  │ [Task A ████████░░░░]                        │  │  │
│  │  │ [Task B ░░████░░░░░░]                        │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ KPI 健康看板 ────────────────────────────────────┐  │
│  │  KPI-01 服務可用性   ██████████ 99.5%  🟢 ON_TRACK│  │
│  │  KPI-02 客訴件數     ████░░░░░░  4/10  🟡 AT_RISK │  │
│  │  KPI-03 系統可用性   ██░░░░░░░░ 92%    🔴 BEHIND  │  │
│  │  ...                                               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ 里程碑時間軸 ────────────────────────────────────┐  │
│  │  Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  ...  │  │
│  │        ◆         ◆                   ◆             │  │
│  │      v1.0    稽核日              上線日             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 鑽取路徑（Drill-down Path）

| 起點 | Click 1 | Click 2 | Click 3 |
|------|---------|---------|---------|
| 年度摘要 | → 月度目標卡片展開 | → 任務詳情 Modal | → 子任務/工時/留言 |
| KPI 看板 | → KPI 詳情（連結任務列表） | → 任務詳情 Modal | — |
| Alert 橫幅 | → 跳轉到對應月度目標 | → 任務詳情 | — |
| 里程碑時間軸 | → 里程碑詳情 popup | → 相關任務列表 | — |
| 月度甘特圖 | → 任務詳情 Modal | — | — |

**所有層級皆可在 ≤ 3 clicks 到達具體任務。**

### 4.3 健康狀態演算法

```typescript
type HealthStatus = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

function calculateHealth(
  goal: { month: number; progressPct: number },
  taskStats: { total: number; done: number; overdue: number },
  kpiStats: { avgAchievement: number; behindCount: number },
  currentMonth: number
): HealthStatus {
  const timeElapsedPct = currentMonth >= goal.month
    ? 100
    : ((currentMonth - 1) / goal.month) * 100;

  // CRITICAL conditions
  if (taskStats.overdue > taskStats.total * 0.3) return 'CRITICAL';
  if (kpiStats.behindCount > 0 && timeElapsedPct > 75) return 'CRITICAL';
  if (goal.progressPct < timeElapsedPct * 0.5) return 'CRITICAL';

  // AT_RISK conditions
  if (taskStats.overdue > 0) return 'AT_RISK';
  if (kpiStats.avgAchievement < timeElapsedPct * 0.8) return 'AT_RISK';
  if (goal.progressPct < timeElapsedPct * 0.8) return 'AT_RISK';

  return 'HEALTHY';
}
```

### 4.4 Alert 系統

自動產生的警示條件：

| 條件 | 嚴重度 | 訊息範例 |
|------|--------|---------|
| 月度目標進度 < 時間消耗 × 50% | CRITICAL | 「3月目標進度 30%，但月份已過 75%」 |
| KPI 連續 2 期未達標 | CRITICAL | 「KPI-03 系統可用性連續 2 月未達標」 |
| 任務逾期 > 目標內任務 30% | CRITICAL | 「3月目標下 12 個任務中 5 個已逾期」 |
| 月度目標進度 < 時間消耗 × 80% | WARNING | 「3月目標進度略落後，建議檢視」 |
| 單一任務逾期 > 7 天 | WARNING | 「任務 X 已逾期 10 天」 |
| KPI 本期未填報 | INFO | 「KPI-05 本月尚未填報」 |

### 4.5 API 設計

#### Endpoint 1: Cockpit Summary (首屏)

```
GET /api/cockpit/summary?year=2026
```

Response:
```typescript
interface CockpitSummary {
  plan: {
    id: string;
    title: string;
    year: number;
    progressPct: number;
    healthStatus: HealthStatus;
  } | null;

  overview: {
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
    totalKPIs: number;
    onTrackKPIs: number;
    behindKPIs: number;
    totalHours: number;
    plannedRate: number;  // 計畫內投入率 %
  };

  goalSummaries: Array<{
    id: string;
    month: number;
    title: string;
    progressPct: number;
    healthStatus: HealthStatus;
    taskCount: number;
    doneCount: number;
    overdueCount: number;
  }>;

  kpiSummaries: Array<{
    id: string;
    code: string;
    title: string;
    target: number;
    actual: number;
    achievementRate: number;
    status: string;
  }>;

  alerts: Array<{
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    category: 'GOAL' | 'KPI' | 'TASK' | 'MILESTONE';
    message: string;
    targetId: string;
    targetType: string;
  }>;

  milestones: Array<{
    id: string;
    title: string;
    type: string;
    plannedEnd: string;
    status: string;
  }>;
}
```

#### Endpoint 2: Goal Detail (展開時 lazy load)

```
GET /api/cockpit/goal/:goalId
```

Response:
```typescript
interface CockpitGoalDetail {
  goal: {
    id: string;
    month: number;
    title: string;
    progressPct: number;
    healthStatus: HealthStatus;
  };

  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    startDate: string | null;
    dueDate: string | null;
    progressPct: number;
    hoursSpent: number;
  }>;

  kpis: Array<{
    id: string;
    code: string;
    title: string;
    achievementRate: number;
    status: string;
  }>;

  hoursBreakdown: {
    total: number;
    planned: number;
    unplanned: number;
  };
}
```

### 4.6 前端元件結構

```
app/(app)/cockpit/page.tsx          # 管理駕駛艙主頁
app/components/cockpit/
  ├── cockpit-alert-banner.tsx      # 警示橫幅
  ├── cockpit-plan-summary.tsx      # 年度計畫摘要卡
  ├── cockpit-goal-grid.tsx         # 月度目標格狀圖
  ├── cockpit-goal-detail.tsx       # 展開的月度目標詳情
  ├── cockpit-kpi-health.tsx        # KPI 健康看板
  ├── cockpit-milestone-timeline.tsx # 里程碑時間軸
  └── cockpit-mini-gantt.tsx        # 內嵌迷你甘特圖
```

### 4.7 Mobile Responsive 設計

```
Desktop (≥ 1024px):
┌─ Alert ─────────────────────────────────────┐
│ [Plan Summary Card]    [KPI Health Panel]    │
│ [Goal Grid — 4 columns]                     │
│ [Milestone Timeline]                         │
└──────────────────────────────────────────────┘

Tablet (768-1023px):
┌─ Alert ─────────────────┐
│ [Plan Summary]           │
│ [KPI Health — 2 col]     │
│ [Goal Grid — 2 columns]  │
│ [Milestone Timeline]     │
└──────────────────────────┘

Mobile (< 768px):
┌─ Alert ─────────────┐
│ [Plan Progress Ring] │
│ [Quick Stats Row]    │
│ [Goal List — stack]  │
│ [KPI List — stack]   │
│ (No Gantt/Timeline)  │
└──────────────────────┘
```

---

## 五、實作計畫

### Phase 1 — MVP（建議 2-3 週）

| 項目 | 說明 | 預估工時 |
|------|------|---------|
| `GET /api/cockpit/summary` | 後端聚合 API，含 health 計算 | 8h |
| `GET /api/cockpit/goal/:id` | 月度目標展開 detail API | 4h |
| `cockpit/page.tsx` + 元件 | 前端主頁 + 6 個子元件 | 16h |
| Alert 系統 | 後端自動計算 alerts | 4h |
| Mobile responsive | stack layout + progress ring | 4h |
| 測試 | API test + E2E | 4h |
| **合計** | | **40h** |

### Phase 2 — 增強（未來）

- Widget 化：引入 react-grid-layout，讓管理者自訂 dashboard
- KPI → AnnualPlan 直接關聯：加 `kpi.annualPlanId` FK
- 推播通知：healthStatus 變 CRITICAL 時推 Discord/Telegram
- 趨勢圖：月度 KPI 達成率折線圖
- 跨年度比較：去年 vs 今年同期
- PDF 匯出：管理報告一鍵匯出

### Phase 3 — 智慧化（遠期）

- AI 異常偵測：自動識別進度異常模式
- 預測分析：基於歷史資料預測 KPI 年底達成率
- 建議行動：「建議增加資源到目標 X」

---

## 六、技術決策記錄

| 決策 | 選擇 | 理由 |
|------|------|------|
| 佈局模式 | 固定佈局（Phase 1） | 開發成本低，用戶數少，管理者需求相似 |
| API 模式 | 後端聚合 summary + lazy load detail | 首屏 < 1s，展開時 per-section 載入 |
| Schema 變更 | 不需要（Phase 1） | 現有關聯足夠推導所有資料 |
| Health 演算法 | 後端計算，基於時間/進度/逾期三軸 | 避免前端重複計算，確保一致性 |
| Cache 策略 | HTTP stale-while-revalidate 60s | 管理者視角不需要即時更新 |
| 權限控制 | cockpit API 過濾 `visibility: MANAGER` KPI | 保護敏感指標 |
| 行動裝置 | Stack layout + 省略甘特圖 | 小螢幕不適合時程圖 |

---

## 七、與現有模組的整合策略

管理駕駛艙**不取代**現有 5 個模組，而是作為**入口層**連結它們：

```
                    ┌─────────────────┐
                    │  管理駕駛艙       │  ← 新增（入口層）
                    │  /cockpit        │
                    └───────┬─────────┘
                            │ drill-down links
          ┌─────────┬───────┼───────┬──────────┐
          │         │       │       │          │
     ┌────▼───┐ ┌──▼───┐ ┌▼────┐ ┌▼─────┐ ┌──▼───┐
     │ Plans  │ │ KPI  │ │Gantt│ │Kanban│ │Dash  │  ← 現有模組
     │/plans  │ │/kpi  │ │/gantt│ │/kanban│ │/dashboard│
     └────────┘ └──────┘ └─────┘ └──────┘ └──────┘
```

- 駕駛艙的 Alert → 點擊跳轉到 `/plans` 或 `/kpi`
- 駕駛艙的甘特迷你圖 → 點擊跳轉到 `/gantt?month=3`
- 駕駛艙的任務統計 → 點擊跳轉到 `/kanban?goal=xxx`
- 現有 `/dashboard` 保留作為「個人/團隊日常工作」視角
- `/cockpit` 是「戰略全局」視角

**導航整合**：在側邊欄加入「管理駕駛艙」入口（僅 MANAGER / ADMIN 可見）。

---

## 附錄：名詞對照

| 英文 | 中文 | TITAN 對應 |
|------|------|-----------|
| Strategy Map | 戰略地圖 | cockpit 主頁 |
| Annual Plan | 年度計畫 | AnnualPlan model |
| Monthly Goal | 月度目標 | MonthlyGoal model |
| KPI | 關鍵績效指標 | KPI model |
| Health Status | 健康狀態 | HEALTHY / AT_RISK / CRITICAL |
| Drill-down | 鑽取 | 點擊展開/跳轉 |
| Cockpit | 駕駛艙 | 管理者專用 dashboard |
| Alert | 警示 | 自動產生的異常通知 |
