# TITAN 產品願景 v2.0 — 全面產品重新設計

> **版本**: v2.0
> **日期**: 2026-03-26
> **角色**: Chief Product Officer
> **定位**: THE definitive product document — 全產品一體化設計藍圖
> **機密等級**: 內部機密

---

## 結論先行

TITAN 目前是 12 個功能模組的集合體，不是一個產品。管理者需要跳轉 4+ 頁面才能回答「我的團隊現在怎麼樣？」；工程師每天要花 15 分鐘在不同頁面之間填報各種資訊。

本文件提出的重新設計核心主張：

1. **TITAN 不是工具集，是一個決策引擎** — 從「記錄工作」轉型為「驅動工作」
2. **資訊流必須雙向流通** — 戰略向下分解到每日任務，執行成果向上聚合到 KPI
3. **使用者體驗的北極星指標** — 工程師每天與 TITAN 互動不超過 30 秒即可完成當日記錄

---

# Part 1：管理理論基礎

## 1.1 Peter Drucker — 目標管理 (MBO)

### 核心原理
Drucker 在《管理的實踐》(1954) 中提出：組織的每一層級都應設定明確目標，這些目標必須從上而下層層分解，且每一層的貢獻都可衡量。

### 對 TITAN 的啟示

**目標瀑布（Goal Cascade）是 TITAN 的骨架。**

```
銀行 IT 部門使命
  「確保核心系統 99.95% 可用性，支撐業務不中斷運作」
    │
    ├── 年度目標 A：核心系統穩定運維
    │     ├── Q1 OKR：完成 Oracle 19c → 19.22 升級
    │     │     ├── 3 月里程碑：SIT 測試完成
    │     │     │     ├── 週任務：TC-001~003 執行
    │     │     │     └── 每日：志偉巡檢 + 測試執行
    │     │     └── KPI：升級零 downtime
    │     └── Q2 OKR：DR 演練成功率 100%
    │
    └── 年度目標 B：團隊效能提升
          ├── Q1 OKR：TITAN 導入使用率 >80%
          └── KPI：行政作業時間減少 60%
```

**TITAN 現況缺口**：`AnnualPlan → MonthlyGoal → Task` 的層級已存在，但缺少「組織使命」和「季度 OKR」這兩層。更關鍵的是，目前的層級是靜態的紀錄結構，不是動態的目標追蹤系統。

**設計決策**：
- 新增 `OrganizationObjective`（組織目標）作為最上層容器，年度計畫對齊到組織目標
- 在 `MonthlyGoal` 之上插入 `QuarterlyOKR` 層級，每個 OKR 有 2-5 個 Key Results
- 每個 Key Result 自動從關聯任務的完成率計算進度，實現 Drucker 所說的「可衡量的貢獻」

## 1.2 OKR (Objectives & Key Results) — Doerr/Google

### 核心原理
OKR 的力量在於四個超能力：聚焦 (Focus)、對齊 (Align)、追蹤 (Track)、延伸 (Stretch)。Google 的實踐顯示，OKR 的透明性（全公司可見）是最強的對齊機制。

### 對 TITAN 的啟示

**現有 KPI 系統是「考核導向」，需要轉型為「驅動導向」。**

目前 TITAN 的 KPI model 是結果記錄工具（填報達成率），不是過程驅動工具。Doerr 模型強調：

1. **Objective 是定性的方向**（如「讓核心系統堅不可摧」）
2. **Key Result 是定量的里程碑**（如「MTTR < 30 分鐘」「零 P1 事件」）
3. **兩者的進度由實際工作自動推導**

**設計決策**：
- KPI 重新定位為 Key Result，歸屬於 Objective（年度目標）
- `KPI.actual` 不再是手動填報的欄位，而是從以下來源自動計算：
  - 關聯任務完成率（`KPITaskLink`）
  - 監控系統指標（`MonitoringAlert` + `KPIHistory`）
  - 事件記錄統計（`IncidentRecord.mttrMinutes` 平均值）
- Dashboard 上每個 Objective 顯示 confidence score：🟢 On Track / 🟡 At Risk / 🔴 Off Track

## 1.3 Balanced Scorecard — Kaplan/Norton

### 核心原理
平衡計分卡從四個維度衡量組織健康：財務、客戶、內部流程、學習與成長。避免只看單一指標的盲點。

### 對 TITAN 的啟示

銀行 IT 團隊的四個維度應重新定義為：

| BSC 維度 | 銀行 IT 定義 | TITAN 對應指標 | 資料來源 |
|---------|-------------|---------------|---------|
| **服務品質** | 系統可用性 & 事件回應 | SLA 達成率、MTTR、P1 事件數 | `IncidentRecord`, `MonitoringAlert` |
| **內部用戶** | 業務單位滿意度 | 工單回應時間、重複事件率 | `Task` (category=SUPPORT), `IncidentRecord` |
| **流程效率** | 計畫執行力 & 變更控制 | 計畫完成率、變更成功率 | `AnnualPlan.progressPct`, `ChangeRecord` |
| **團隊成長** | 能力發展 & 知識累積 | 學習工時佔比、知識庫文件數 | `TimeEntry` (category=LEARNING), `Document` count |

**設計決策**：
- 管理駕駛艙 (Cockpit) 的四象限佈局直接對應 BSC 四維度
- 每個象限不超過 3 個核心指標，避免資訊過載
- 指標全部自動計算，管理者無需手動維護

## 1.4 Lean Management — 消除浪費

### 核心原理
Lean 識別七種浪費：過度生產、等待、運輸、過度加工、庫存、動作、缺陷。在知識工作中，最大的浪費是「等待資訊」和「重複溝通」。

### 對 TITAN 的啟示

**TITAN 目前的資訊浪費清單**：

| 浪費類型 | 現況表現 | 年度成本估算 |
|---------|---------|------------|
| 等待（Waiting） | 主管 Email 問進度 → 工程師回覆 → 主管彙整，平均 2-3 封 Email | ~NTD 120,000/年 |
| 動作（Motion） | 工程師在 4 個頁面間切換記錄同一件事 | ~NTD 80,000/年 |
| 過度加工（Over-processing） | 手動產出週報/月報，內容 80% 可自動生成 | ~NTD 60,000/年 |
| 缺陷（Defects） | 工時延後填報導致資料不準確 | 無法量化，但影響決策品質 |
| 重複溝通（Transport） | 同一件事在 Teams + Email + TITAN 重複記錄 | ~NTD 50,000/年 |

**設計決策**：
- **Single Source of Truth**：任務狀態變更自動觸發所有關聯更新（工時、進度、通知）
- **Zero-copy Reporting**：週報/月報 100% 自動生成，管理者只需閱讀和批註
- **Context-switching Elimination**：工程師的所有日常操作在同一頁面完成（My Day view）

## 1.5 Theory of Constraints (TOC) — 識別瓶頸

### 核心原理
Goldratt 的制約理論：系統的產出取決於最慢的環節。找到瓶頸 → 充分利用瓶頸 → 讓其他環節配合瓶頸 → 打破瓶頸。

### 對 TITAN 的啟示

**銀行 IT 5 人團隊的瓶頸分析**：

```
需求湧入 → [主管分派] → [工程師執行] → [主管驗收] → 交付
               ↑                              ↑
           瓶頸 1：資訊不足                瓶頸 2：驗收等待
           主管不知道誰有空               工程師完成後等主管看
```

- **瓶頸 1**：主管的分派決策品質受限於資訊延遲。工程師實際忙什麼？哪些任務被卡住？目前只能靠問。
- **瓶頸 2**：工程師完成任務後，等待驗收的時間平均 1-3 天（陳經理很忙）。

**設計決策**：
- **打破瓶頸 1**：Dashboard 即時顯示每位工程師的工作負荷熱力圖（Workload Heatmap），主管一眼判斷誰可以接新任務
- **打破瓶頸 2**：REVIEW 狀態的任務自動產生通知 + 在主管 Dashboard 頂部以紅色徽章顯示「N 項待驗收」
- **WIP Limit**：看板每人 IN_PROGRESS 上限 3 個（可調），超過時系統警示「你確定要開始新任務嗎？」

## 1.6 Agile/Scrum — Sprint 節奏

### 核心原理
Scrum 的三個支柱：透明、檢視、調適。Sprint 提供固定節奏，讓團隊定期反思和改進。

### 對 TITAN 的啟示

5 人銀行 IT 團隊不適合完整 Scrum（沒有 PO、沒有 SM、日常維運佔 40%+），但需要借用三個核心機制：

| Scrum 機制 | TITAN 適配 | 實作方式 |
|-----------|-----------|---------|
| Sprint Planning | **週一早會** | 主管在 Cockpit 檢視上週完成率 → 調整本週任務 → 自動產出週計畫 |
| Daily Stand-up | **非同步更新** | 工程師每天結束前一鍵回報（取代站會） |
| Sprint Review/Retro | **月底回顧** | 自動產出月報 + 「本月改善建議」提示 |

**設計決策**：
- 引入「週」作為最小管理單元：Dashboard 預設檢視為「本週」
- 月度目標分解為 4-5 個週目標，每週結束自動計算 velocity
- 回顧報告自動標註：完成率低於 70% 的月份 → 紅色警示 + 「建議回顧」提示

---

# Part 2：產品設計原則

## 2.1 Jobs to be Done (JTBD)

### 管理者僱用 TITAN 做什麼工作？

> 「當我在週一早上 8:30 進入辦公室，打開電腦，我想在 60 秒內知道：
> (a) 上週的計畫完成了嗎？
> (b) 這週有什麼關鍵任務？
> (c) 有沒有任何紅燈警示需要我立刻處理？
> 這樣我就能帶著信心走進早會。」
>
> — 陳經理（虛擬人物誌，銀行 IT 主管）

**JTBD 定義**：
```
When I [am preparing for the weekly team meeting]
I want to [see a single-page summary of plan health, team workload, and risks]
So I can [make informed decisions about priorities and resource allocation]
```

### 工程師僱用 TITAN 做什麼工作？

> 「我不想花時間管理管理系統。我想做完事情，點一下，系統幫我記好。
> 下班前 30 秒看一眼明天該做什麼就好。」
>
> — 林志偉（虛擬人物誌，銀行 IT 維運工程師）

**JTBD 定義**：
```
When I [finish a piece of work (fix a bug, close an incident, complete a test)]
I want to [record it with minimal effort — ideally one click]
So I can [get back to my real work immediately, and have accurate records at month-end]
```

## 2.2 Progressive Disclosure — 漸進式揭露

### 設計原則
- **第一眼**：只顯示健康狀態（紅黃綠燈）和數字摘要
- **第二眼**（一次點擊）：展開看趨勢圖表和列表
- **第三眼**（兩次點擊）：進入完整詳情頁面

### TITAN 三層資訊架構

```
Layer 0（Dashboard 首屏）          Layer 1（展開/側邊欄）        Layer 2（詳情頁）
┌──────────────────────┐      ┌─────────────────────┐     ┌──────────────────┐
│ 🟢 核心系統可用性 99.9% │ →   │ 本月 SLA 趨勢圖       │ →  │ 事件列表 + 根因分析 │
│ 🟡 計畫進度 67%       │ →   │ 月度目標完成對照表    │ →  │ 任務詳情 + 甘特圖   │
│ 🔴 待驗收 3 項        │ →   │ 待驗收任務清單       │ →  │ 任務卡片全欄位      │
│ 📊 本週速率 12 pts    │ →   │ 週 velocity 趨勢     │ →  │ 各成員貢獻明細      │
└──────────────────────┘      └─────────────────────┘     └──────────────────┘
```

## 2.3 Atomic Habits — 讓記錄成為習慣

### James Clear 的四法則在 TITAN 的應用

| 法則 | 行為設計 | TITAN 實作 |
|------|---------|-----------|
| **顯而易見 (Obvious)** | 把提示放在必經之路上 | Dashboard 首頁顯示「今日已記錄 0 小時」黃色提醒條 |
| **有吸引力 (Attractive)** | 把好行為和正向獎勵關聯 | 完成記錄後顯示「今日工時記錄完成 ✓」綠色成就感 |
| **容易做到 (Easy)** | 減少摩擦到最低 | 一鍵回報：任務完成 → 自動記錄工時（基於計時器或估算值）|
| **令人滿足 (Satisfying)** | 即時正向回饋 | 週末顯示「本週完成 N 項任務，投入 N 小時」個人摘要卡 |

### 30 秒目標的行為設計

```
08:30 開啟 TITAN
  ↓ 0 秒（自動載入）
「今天該做什麼」列表已在首頁
  ↓ 做了一上午的事
12:00 回到 TITAN
  ↓ 5 秒
點擊已完成的任務 → 「完成」按鈕 → 工時自動記錄
  ↓ 5 秒
點擊下一項任務 → 「開始」按鈕 → 計時器啟動
  ↓ 下午做事
17:00 準備下班
  ↓ 10 秒
Dashboard 顯示「今日小結：完成 3 項，工時 7.5h」
確認 → 下班
  ↓
累計互動時間：~20 秒
```

## 2.4 Don't Make Me Think — 最小認知負荷

### Steve Krug 的核心原則在 TITAN 的應用

1. **每個頁面的目的在 5 秒內明確** — 大標題 + 關鍵數字優先
2. **不要讓使用者做無謂的選擇** — 新增任務時自動帶入合理預設值（今天日期、當前使用者、P2 優先級）
3. **導航是路標，不是路障** — 側邊欄永遠可見，當前位置高亮
4. **搜尋是安全網** — Ctrl+K 全站搜尋永遠可用，覆蓋 100% 功能

### 認知負荷審計（現況 vs 目標）

| 操作 | 現況步驟 | 目標步驟 | 減少幅度 |
|------|---------|---------|---------|
| 新增事件任務 | 6 clicks（新增→改priority→改category→填描述→填欄位→儲存）| 2 clicks（事件按鈕→填核心資訊→自動分類）| -67% |
| 記錄每日工時 | 12 clicks（切到工時頁→選日期→選任務→填時數×N筆→儲存）| 3 clicks（確認自動建議→微調→送出）| -75% |
| 查看計畫健康 | 4 page switches（Dashboard→Plans→KPI→Gantt）| 0 switches（Cockpit 一頁全覽）| -100% |
| 產出週報 | 30 min（手動彙整）| 1 click（自動產生）| -97% |

## 2.5 The Principle of Least Effort — 最小努力原則

### Zipf's Law 在使用者行為的應用

使用者永遠選擇阻力最小的路徑。如果 TITAN 的記錄流程比「不記錄」更花力氣，使用者就會選擇不記錄。

**設計原則**：TITAN 的每一個記錄動作都必須比「不記錄」更容易。

| 場景 | 不記錄的成本 | TITAN 記錄的成本 | 差距 |
|------|------------|----------------|------|
| 完成一項任務 | 0 秒（什麼都不做）| 必須低於 5 秒 | TITAN 負擔 < 5 秒 |
| 事件處理完成 | 0 秒 | 必須低於 30 秒 | TITAN 提供快速事件範本 |
| 每日工時回報 | 0 秒 | 必須低於 15 秒 | TITAN 自動建議 + 一鍵確認 |

**實現機制**：
- **Smart Defaults**：系統從最近行為推測最可能的輸入（上週的任務分布 → 本週建議）
- **Auto-tracking**：計時器 + 任務狀態變更 = 80% 工時自動記錄
- **Batch Confirm**：一天結束時，系統列出「今日自動記錄」清單，使用者只需一鍵確認

---

# Part 3：統一產品架構

## 3.1 系統一體化概念

TITAN v2 不再是「模組的集合」，而是「一個有不同視角的系統」。

### 核心資料流（管理者視角）

```
組織使命                    ← 靜態設定，年度調整
  ↓
年度目標（AnnualPlan）      ← 年初設定，季度檢視
  ↓ 分解
季度 OKR                    ← 每季初設定，月度追蹤
  ↓ 分解
月度里程碑（Milestone）     ← 每月初確認，週度追蹤
  ↓ 分解
每週衝刺（Sprint/Week）     ← 每週一規劃，每日追蹤
  ↓ 分解
每日任務（Task）            ← 即時更新
  ↓
  ├── KPI 追蹤      ← 從 Task 完成率 + 監控指標自動聚合
  ├── 進度儀表      ← 從各層級 progressPct 自動計算
  ├── 風險警報      ← 從逾期/SLA/事件自動觸發
  ├── 健康燈號      ← 綜合評分：🟢 > 80% / 🟡 60-80% / 🔴 < 60%
  ├── 速率圖表      ← 從每週完成任務數自動繪製
  └── 工時記錄      ← 從計時器 + 任務完成自動產生
```

### 核心資料流（使用者視角）

```
早上開 TITAN
  ↓
「My Day」首頁：今天該做什麼（自動排序：P0 > 逾期 > 今日到期 > 進行中）
  ↓
點擊任務 → 內嵌側邊面板（不離開首頁）
  ↓
做事（TITAN 在背景默默記錄）
  ↓
完成任務 → 拖到 DONE 或點「完成」按鈕
  ↓
系統自動：
  ├── 記錄工時（計時器停止 or 估算值）
  ├── 更新任務進度
  ├── 向上聚合月度目標進度
  ├── 刷新 KPI 達成率
  └── 通知主管「志偉完成了 TC-003」
  ↓
下班前 Dashboard 顯示：「今日完成 3 項 | 工時 7.5h | 記錄完整 ✓」
  ↓
30 秒完成一天的記錄
```

## 3.2 五個核心體驗（不是五個模組）

| 體驗 | 對應路徑 | 核心問題 | 目標使用者 |
|------|---------|---------|-----------|
| **My Day** | `/` (Dashboard) | 「今天該做什麼？」 | 工程師 |
| **Big Picture** | `/cockpit` | 「我們的目標走到哪了？」 | 主管 |
| **Get It Done** | `/kanban` | 「讓我專注做事」 | 工程師 |
| **Track Time** | Embedded in tasks | 「自動幫我記好」 | 工程師（被動） |
| **Know More** | `/knowledge` | 「這件事之前怎麼處理的？」 | 全員 |

注意：甘特圖、報表、KPI、年度計畫不再是獨立「模組」，而是上述五個體驗中的「檢視方式」（Views）。

## 3.3 統一資訊架構

```
TITAN
├── 🏠 My Day（Dashboard）
│     ├── 今日待辦列表（auto-sorted）
│     ├── 快速行動列（Quick Actions）
│     │     ├── + 新任務
│     │     ├── 🚨 回報事件
│     │     ├── ⏱ 開始計時
│     │     └── 📝 快速筆記
│     ├── 今日工時摘要條
│     └── 通知中心
│
├── 📊 Cockpit（管理駕駛艙）← 僅 MANAGER/ADMIN
│     ├── BSC 四象限
│     │     ├── 服務品質指標
│     │     ├── 內部用戶滿意
│     │     ├── 流程效率指標
│     │     └── 團隊成長指標
│     ├── 計畫健康地圖（Plan → OKR → Milestone，紅黃綠燈）
│     ├── 團隊工作負荷熱力圖
│     ├── 週 Velocity 趨勢
│     └── 待處理事項（待驗收、待核准、逾期警示）
│
├── 📋 Work（工作空間）
│     ├── 看板視圖（Kanban）← 預設
│     ├── 列表視圖（Table）
│     ├── 甘特視圖（Gantt）
│     ├── 日曆視圖（Calendar）
│     └── 篩選器：計畫/目標/指派人/狀態/標籤
│
├── 🎯 Goals（目標與計畫）
│     ├── 年度計畫概覽（AnnualPlan cards）
│     ├── OKR 樹狀圖（Objective → Key Results → Tasks）
│     ├── 里程碑時間軸（Timeline）
│     └── KPI Dashboard（指標卡片 + 趨勢圖）
│
├── 📖 Knowledge（知識庫）
│     ├── 文件樹
│     ├── 全文搜尋
│     └── 任務關聯文件側欄
│
├── 📈 Reports（報表中心）← 自動產生
│     ├── 週報（auto-generated）
│     ├── 月報（auto-generated）
│     ├── KPI 報告
│     ├── 工時統計
│     └── 自訂報表 Builder
│
├── ⚙️ Admin
│     ├── 使用者管理
│     ├── 稽核日誌
│     ├── 系統設定
│     └── 備份狀態
│
└── 🔍 全站搜尋（Ctrl+K）
```

---

# Part 4：模組整合地圖

## 4.1 所有模組如何連接為一個系統

```
                    ┌─────────────────────────────────┐
                    │      TITAN Unified Data Layer     │
                    │  ┌───────────────────────────┐   │
                    │  │   OrganizationObjective     │   │
                    │  │         ↓                   │   │
                    │  │   AnnualPlan + KPI           │   │
                    │  │      ↓         ↓            │   │
                    │  │ MonthlyGoal  KPITaskLink     │   │
                    │  │      ↓         ↓            │   │
                    │  │    Task ←─────→ Task         │   │
                    │  │      ↓                      │   │
                    │  │  TimeEntry + SubTask         │   │
                    │  └───────────────────────────┘   │
                    └──────────┬──────────┬────────────┘
                               │          │
          ┌────────────────────┤          ├────────────────────┐
          │                    │          │                    │
    ┌─────▼─────┐      ┌──────▼─────┐  ┌─▼────────────┐  ┌──▼───────┐
    │  My Day    │      │  Cockpit   │  │   Work       │  │ Reports  │
    │ (Dashboard)│      │ (管理駕駛艙)│  │ (看板/甘特)  │  │ (自動產出)│
    │            │      │            │  │              │  │          │
    │ 顯示：     │      │ 聚合：     │  │ 操作：       │  │ 產出：   │
    │ - 今日任務 │      │ - 計畫健康 │  │ - 拖拉狀態  │  │ - 週報   │
    │ - 工時提醒 │      │ - KPI 達成 │  │ - 更新進度  │  │ - 月報   │
    │ - 通知    │      │ - 團隊負荷 │  │ - 記錄工時  │  │ - KPI 報 │
    └───────────┘      └────────────┘  └──────────────┘  └──────────┘
```

### 4.2 六大整合原則

**1. Dashboard 是入口，不是獨立頁面**
- Dashboard 不展示自己的資料，它聚合所有模組的摘要
- 每一個 widget 都是通往其他體驗的「門」：點擊任務數 → 進入看板；點擊 KPI → 進入目標頁

**2. Kanban 是工作發生的地方，連結到計畫和 KPI**
- 每張任務卡片上顯示它歸屬的月度目標和關聯的 KPI
- 拖拉到 DONE 時，自動向上刷新月度目標進度 + KPI 達成率
- 看板支援按「計畫」「目標」「KPI」分組顯示（Group by）

**3. Timesheet 是自動的，從計時器 + 任務完成衍生**
- 不再有獨立的「工時紀錄」頁面作為主要入口
- 工時記錄嵌入在任務操作中：開始任務 → 計時器啟動 → 完成任務 → 工時自動記錄
- `/timesheet` 頁面保留為「工時審閱與調整」用途，主要由主管使用
- 工程師看到的是 Dashboard 上的「今日工時 7.5h」摘要條

**4. Reports 是產生的，不是手動建的**
- 週報在每週五 17:00 自動產生草稿，主管確認後發布
- 月報在每月最後一個工作日自動產生
- 報表內容 100% 來自系統資料，不需要人工填寫
- 管理者只需要閱讀 + 批註 + 確認

**5. Knowledge 是上下文相關的，連結到任務**
- 任務詳情面板中顯示「相關文件」區塊（已有 `TaskDocument` model）
- 建立新知識文件時，可直接關聯到當前任務
- 事件處理完成後，系統提示「是否要建立根因分析文件？」

**6. Gantt 是一種檢視方式，不是獨立模組**
- Gantt 是 Work 頁面的一個 tab（與看板、列表、日曆並列）
- 共用相同的篩選器和資料來源
- 里程碑在 Gantt 上以菱形標記顯示，同時也在 Cockpit 時間軸上出現

---

# Part 5：關鍵設計決策

## 5.1 點擊數分析

### 管理者：從開啟 TITAN 到獲取關鍵資訊

| 資訊需求 | 現況 | v2 目標 | 路徑 |
|---------|------|---------|------|
| 計畫整體健康 | 4 clicks + 4 page loads | **0 clicks**（Cockpit 首屏） | 自動載入 |
| 誰在做什麼 | 3 clicks | **1 click**（展開負荷圖） | Cockpit → Workload |
| 本月 KPI 達成率 | 2 clicks | **0 clicks**（Cockpit 首屏） | BSC 象限 |
| 逾期任務清單 | 2 clicks | **1 click**（展開待處理） | Cockpit → Overdue |
| 本週週報 | 30 min 手動 | **1 click**（確認自動草稿） | Reports → 本週 |

### 工程師：從完成工作到記錄完成

| 操作 | 現況 | v2 目標 | 路徑 |
|------|------|---------|------|
| 回報任務完成 | 3 clicks（找任務→改狀態→確認） | **1 click**（My Day 列表直接點完成） | Dashboard inline |
| 記錄工時 | 6 clicks（切頁→選日期→選任務→填數字→確認×N） | **0 clicks**（自動從計時器/完成動作記錄） | Auto |
| 回報事件 | 6+ clicks（新增任務→改類型→改優先級→填詳情） | **2 clicks**（快速行動→事件範本→填核心資訊） | Quick Action |
| 查看明天任務 | 2 clicks | **0 clicks**（My Day 底部自動顯示「明日預覽」） | Auto |

## 5.2 資訊向上流動（Team → Manager）

```
工程師的日常操作
  ↓ 自動觸發
Task 狀態變更事件
  ↓ Event Bus / Database Trigger
  ├── 1. 更新 Task.status + Task.progressPct
  ├── 2. 重新計算 MonthlyGoal.progressPct（所有關聯任務加權平均）
  ├── 3. 重新計算 AnnualPlan.progressPct（所有月度目標加權平均）
  ├── 4. 重新計算 KPI.actual（透過 KPITaskLink 加權計算）
  ├── 5. 更新 Cockpit 快取（stale-while-revalidate）
  └── 6. 若觸發風險條件 → 產生 Notification 給 MANAGER
        風險條件：
        - 任務逾期超過 2 天
        - 月度目標進度落後預期 20%+
        - KPI 達成率低於 60%
        - P0/P1 事件發生
```

**關鍵設計**：工程師不需要做任何「向上回報」的動作。他們只需要做自己的工作（移動任務卡片、完成子任務），所有的向上聚合由系統自動完成。

## 5.3 方向向下流動（Strategy → Daily Work）

```
主管在 Cockpit 設定年度計畫
  ↓
分解為月度目標（MonthlyGoal）
  ↓ 指派給工程師
工程師在 My Day 看到「本月目標」區塊
  ↓
月度目標分解為任務（Task）
  ↓ 自動出現在看板
工程師在看板上看到新任務，帶有標籤：
  「📌 來自：2026年度計畫 > 3月：Oracle升級」
  ↓
每日任務自動按優先級排序出現在 My Day
```

**關鍵設計**：每一個任務都帶有「血統資訊」（Lineage）——它屬於哪個月度目標、哪個年度計畫、關聯哪個 KPI。工程師做的每一件事都知道「為什麼做」。

## 5.4 30 秒規則的保證機制

為確保「工程師每天與 TITAN 互動不超過 30 秒」，設計以下保護機制：

| 機制 | 說明 |
|------|------|
| **Smart Time Suggest** | 系統根據計時器資料和任務狀態變更，自動建議今日工時分配。工程師只需「一鍵確認」或「微調」 |
| **Auto-complete Detection** | 當所有 SubTask 完成時，系統自動提示「是否將主任務標記為完成？」 |
| **Daily Digest** | 每天 17:00 彈出「今日小結」通知：已完成 N 項 / 工時 N h / 未記錄項目 N 個。一鍵確認即完成 |
| **Carry-over** | 未完成任務自動帶入下一天的 My Day，不需要手動搬移 |
| **Quick Log** | 在 Dashboard 上直接輸入「做了什麼 + 花了多久」，系統自動匹配或建立任務 |

---

# Part 6：六人專家小組評審 (10 輪，繁體中文)

## 專家介紹

| # | 角色 | 專長 | 在本評審中的職責 |
|---|------|------|----------------|
| 1 | **管理學教授**（王教授）| MBO/OKR/BSC 理論、組織行為學 | 驗證管理理論的正確應用 |
| 2 | **UX 設計總監**（張總監）| 企業軟體 UX、Design System、可用性測試 | 驗證使用者體驗設計 |
| 3 | **銀行 IT 主管**（陳經理）| 15 年銀行 IT 管理、金管會稽核經驗 | 驗證銀行 IT 實務需求 |
| 4 | **資深工程師**（林工程師）| Next.js / Prisma / PostgreSQL、TITAN codebase 熟悉 | 驗證技術可行性 |
| 5 | **行為心理學家**（黃博士）| 行為設計、習慣養成、動機理論 | 驗證採用策略和習慣養成 |
| 6 | **產品策略顧問**（李顧問）| SaaS 產品策略、PMF、成長策略 | 驗證產品市場契合度 |

---

### 議題 1：OKR + BSC + MBO 三重框架是否過度設計？

**Round 1 — 王教授（管理學）**
這三個框架在理論上不衝突，但在 5 人團隊的實務上需要極度簡化。MBO 的核心是「目標對齊」，OKR 的核心是「透明追蹤」，BSC 的核心是「多維度平衡」。我的建議：不要讓使用者知道他在用哪個框架。系統設計應該把三者的精華無縫融入，而不是要使用者學習三套概念。

**Round 2 — 陳經理（銀行 IT 主管）**
完全同意簡化。我不需要知道什麼是 OKR，我只需要看到「今年要做什麼」→「這個月做了多少」→「有沒有問題」。銀行的管理文化是「上面交代什麼就做什麼」，不是 Google 那種自下而上的 OKR。所以 TITAN 的目標層級應該是 top-down 的，不要有「個人 OKR」這種東西。

**Round 3 — 李顧問（產品策略）**
陳經理說得對。5 人團隊不需要 OKR 的完整儀式（季度設定會議、check-in rhythm、scoring）。但 OKR 的「Key Result 自動追蹤」概念很好。我建議：在 UI 上叫「年度目標」和「關鍵指標」就好，底層邏輯借用 OKR 的自動聚合。

**Round 4 — 張總監（UX）**
從使用者認知負荷來看，三層目標（組織使命 → 年度目標 → 月度目標）加上 KPI 和 BSC 四象限，資訊量已經太大。建議：Cockpit 首屏只顯示「年度目標 + 月度目標 + 紅黃綠燈」，BSC 四象限放在第二層（點擊「詳細分析」才展開）。

**Round 5 — 黃博士（行為心理學）**
框架過多會造成「選擇癱瘓」（choice paralysis）。管理者看到太多指標反而不知道該關注什麼。心理學研究顯示，人同時能處理的資訊維度是 4±1 個。我建議 Cockpit 首屏不超過 4 個核心指標卡片。

**Round 6 — 林工程師（技術）**
從實作角度，三個框架的資料模型可以共用 `AnnualPlan → MonthlyGoal → Task → KPI` 這條鏈路。不需要新增「OrganizationObjective」model，把 AnnualPlan 本身的 `description` 欄位當作「組織使命/年度方向」即可。Less schema = less maintenance。

**Round 7 — 王教授（管理學）**
回應林工程師：我同意簡化 schema，但 AnnualPlan 的 description 和「組織使命」的語義不同。建議在 AnnualPlan 上新增一個 `vision` 欄位（String?），讓主管可以填「今年的大方向」。這不會增加太多複雜度，但讓年度計畫有「北極星」。

**Round 8 — 陳經理（銀行 IT 主管）**
我支持 vision 欄位。每年初部門主管會在簡報裡講「今年的重點方向」，有一個地方記錄下來很有用。但不要叫它「組織使命」，太嚴肅了。叫「年度方針」或「年度願景」就好。

**Round 9 — 李顧問（產品策略）**
回到核心問題：這不是過度設計嗎？我認為不是，因為我們不是在新增三套系統，而是在現有系統上加一層「聚合視圖」。技術上只需要一個 `/api/cockpit/summary` API。風險是設計者（我們）理解框架，但使用者（陳經理的團隊）不理解。所以 UI 上絕對不能出現 MBO、OKR、BSC 這些術語。

**Round 10 — 張總監（UX）**
最終建議：用使用者的語言，不用管理學的語言。

| 管理框架概念 | TITAN UI 用語 |
|-------------|-------------|
| Objective | 年度目標 |
| Key Result | 關鍵指標 |
| BSC 四維度 | 服務品質 / 用戶滿意 / 執行效率 / 團隊成長 |
| Sprint | 本週工作 |
| Velocity | 完成速率 |
| WIP Limit | 同時進行上限 |

**共識**：框架底層可以使用，但 UI 上完全透明化。新增 `AnnualPlan.vision` 欄位。Cockpit 首屏不超過 4 個核心指標卡片。不新增 OrganizationObjective model。

---

### 議題 2：「30 秒完成一天記錄」是否現實？

**Round 1 — 黃博士（行為心理學）**
30 秒是一個很好的行為設計目標，但需要拆解。根據 Fogg 行為模型（B = MAP），行為發生需要動機 (Motivation)、能力 (Ability) 和提示 (Prompt) 同時到位。30 秒的目標解決了「能力」問題（足夠簡單），但「動機」和「提示」也很重要。

**Round 2 — 陳經理（銀行 IT 主管）**
動機方面，工程師最大的動機是「月底不被主管追問」和「年終考績有據可查」。如果 TITAN 能在月底自動產出每人的工作摘要，這本身就是最大的動機——你不用到時候還要翻 Email 回憶這個月做了什麼。

**Round 3 — 林工程師（技術）**
30 秒的前提是「Smart Time Suggest」能足夠聰明。技術上：
1. 從 `TimeEntry` 的歷史模式學習（上週一做了哪些任務 → 本週一可能也做）
2. 從 `Task.status` 變更推算工時（IN_PROGRESS 開始 → DONE 結束 = 工時）
3. 從計時器 (`isRunning`) 精確記錄

但第 2 點有陷阱：工程師可能同時處理多個任務，狀態變更不代表全程都在做那件事。

**Round 4 — 張總監（UX）**
解決林工程師的顧慮：不要試圖 100% 自動化。80/20 法則——自動記錄 80% 的工時（來自計時器和明確的任務完成），剩下 20%（碎片化時間、行政會議）用「Quick Log」快速補充。

互動流程設計：
```
17:00 Daily Digest 通知彈出
┌──────────────────────────────────────┐
│  📋 今日小結                          │
│                                      │
│  ✅ TC-003 備份驗證       2.0h  [✓]  │
│  ✅ 巡檢                  0.5h  [✓]  │
│  ⏱ Oracle patch 研究     3.0h  [✓]  │
│  ───────────────────────────────     │
│  已記錄：5.5h  │  目標：8.0h         │
│                                      │
│  ⚠ 缺少 2.5h，快速補充：            │
│  [會議 1h] [行政 0.5h] [+自訂]      │
│                                      │
│         [確認並送出]                  │
└──────────────────────────────────────┘
```

**Round 5 — 王教授（管理學）**
從管理角度補充：Drucker 說「衡量什麼就管理什麼」，但也警告過度衡量會讓人為了指標而非目標行動。如果工時追蹤太精確，工程師可能會刻意湊滿 8 小時，而不是誠實記錄。建議：系統容許「未完整記錄」，只在差距超過 2 小時時才提醒。

**Round 6 — 李顧問（產品策略）**
30 秒作為「北極星指標」是好的，但要定義清楚什麼算「完成記錄」。建議定義為：
- **Level 1（15 秒）**：確認自動記錄的任務完成和工時 → 一鍵確認
- **Level 2（30 秒）**：Level 1 + 補充缺漏 → 快速選擇
- **Level 3（60 秒）**：Level 2 + 詳細描述（僅事件/變更管理時需要）

90% 的日子，Level 1 就足夠了。

**Round 7 — 黃博士（行為心理學）**
提示 (Prompt) 的設計很關鍵。建議不要用 17:00 的彈出通知（工程師可能正在處理事情），而是用「關閉 TITAN 前」的攔截。就像 IDE 的「你有未儲存的檔案」。

```
使用者關閉 TITAN 或切換到其他頁面 30 分鐘後：
「今日尚有 2.5h 未記錄，要快速補充嗎？」
[補充] [明天再說] [今天不需要]
```

但注意：這個攔截必須非常輕量，不能阻斷使用者的操作。Banner 通知 > Modal 攔截。

**Round 8 — 陳經理（銀行 IT 主管）**
實務上，我的工程師有三種人：
1. **勤勞型**（2/4 人）：會主動記錄，TITAN 現有功能就夠了
2. **忘記型**（1/4 人）：不是不願意，是太忙忘了。Smart Suggest + 一鍵確認對他最有效
3. **抗拒型**（1/4 人）：覺得記錄是浪費時間。需要讓他看到好處（月底自動產出的工作摘要）

30 秒的設計主要是解決第 2 和第 3 種人。

**Round 9 — 林工程師（技術）**
技術實現路徑明確：
1. `TimeEntry.isRunning` 已實作 → 計時器自動工時可行
2. `Task.status` 變更事件已有 `TaskActivity` → 可從中推算
3. Smart Suggest = 前一天/上一週同日的 TimeEntry 模式 → 簡單查詢
4. Daily Digest = 新 API `/api/time-entries/daily-summary` + 前端 Banner 元件

工作量估算：2-3 個 Sprint（每 Sprint 1 週）可完成 MVP。

**Round 10 — 張總監（UX）**
最終 UX 決策：
- 使用 Dashboard 頂部的持久 Banner（不是 Modal，不是 Notification）
- 未記錄工時 > 2h 時顯示黃色 Banner
- 所有自動記錄用虛線框表示（「系統建議」），使用者確認後變實線（「已確認」）
- 週末不提醒
- 最多提醒一次/天

**共識**：30 秒目標可行，通過「自動記錄 80% + 一鍵確認 + 輕量提醒」實現。技術上 2-3 Sprint 可完成。不使用 Modal 攔截，用 Dashboard Banner。容許 2h 以下的記錄差距。

---

### 議題 3：Cockpit 應該取代現有 Dashboard 還是並存？

**Round 1 — 張總監（UX）**
不應該有兩個 Dashboard。使用者只應該有「一個家」。但管理者和工程師的「家」不同。建議：`/` 根路徑根據角色自動導向不同的首頁體驗。MANAGER 看到 Cockpit，ENGINEER 看到 My Day。

**Round 2 — 林工程師（技術）**
技術上可行。`middleware.ts` 已有 role 判斷邏輯。但要注意：主管有時也需要看「My Day」（因為主管也有自己的任務）。建議在 Cockpit 頂部保留一行「我的待辦：N 項」的折疊區塊。

**Round 3 — 陳經理（銀行 IT 主管）**
我同時需要兩個視角。早上到辦公室第一件事看 Cockpit（團隊全局），但我自己也有文件要寫、會議要開。建議：Cockpit 作為 MANAGER 的首頁，但左上角有一個明顯的切換按鈕「切換到個人視圖」。

**Round 4 — 王教授（管理學）**
Mintzberg 的管理者角色理論指出，管理者同時扮演「資訊角色」（監控者、傳播者）和「決策角色」（資源分配者、問題處理者）。Cockpit 服務「資訊角色」，My Day 服務「決策角色」中的個人執行。兩者缺一不可。

**Round 5 — 黃博士（行為心理學）**
從行為設計角度，「預設首頁」非常重要——它是使用者每天第一個看到的東西，決定了 TITAN 在使用者心中的定位。如果 MANAGER 預設看到 Cockpit，TITAN = 管理工具。如果預設看到 My Day，TITAN = 個人助手。

建議 MANAGER 預設看 Cockpit（因為管理是他的主要職責），但用一個清晰的 Tab 切換（不是藏在角落的按鈕）。

**Round 6 — 李顧問（產品策略）**
同意黃博士。Tab 切換比頁面跳轉好。建議：

```
┌─────────────────────────────────────────────┐
│  [📊 團隊全局]  [📋 我的工作]               │
├─────────────────────────────────────────────┤
│                                             │
│  （根據 tab 顯示 Cockpit 或 My Day）         │
│                                             │
└─────────────────────────────────────────────┘
```

ENGINEER 只看到「我的工作」tab，沒有「團隊全局」（除非有特殊權限）。

**Round 7 — 林工程師（技術）**
現有 `DashboardPage` 元件已有 `ManagerDashboard` 和 `EngineerDashboard` 的分支。重構為 Tab 元件不難。Cockpit 的資料用 `/api/cockpit/summary` 聚合 API 載入，My Day 的資料用現有的 `/api/tasks` + `/api/time-entries` API。

**Round 8 — 張總監（UX）**
最終 UI 方案：
- MANAGER 首頁：雙 Tab（「團隊全局」預設選中 + 「我的工作」）
- ENGINEER 首頁：單一「我的工作」（無 Tab header，全屏使用）
- ADMIN 首頁：同 MANAGER
- 「團隊全局」的內容 = Cockpit（BSC 四象限 + 計畫健康 + 負荷圖）
- 「我的工作」的內容 = My Day（今日待辦 + 快速行動 + 工時摘要）

**Round 9 — 陳經理（銀行 IT 主管）**
補充一個需求：當有緊急事項時（P0/P1 事件、SLA 即將到期），不管在哪個 Tab，都要在頂部顯示紅色警示條。主管和工程師都需要看到。

**Round 10 — 李顧問（產品策略）**
同意。全局警示條是跨角色的，不受 Tab 影響。

最終架構：
```
┌─── 全局警示條（P0/P1 事件、SLA 警示）────────┐
├─────────────────────────────────────────────┤
│  [📊 團隊全局]  [📋 我的工作]  ← MANAGER    │
│  或                                          │
│  我的工作（全屏）              ← ENGINEER    │
├─────────────────────────────────────────────┤
│  Tab 內容區                                  │
└─────────────────────────────────────────────┘
```

**共識**：Cockpit 和 My Day 合併為同一頁面的雙 Tab。MANAGER 預設「團隊全局」，ENGINEER 只有「我的工作」。全局警示條跨角色顯示。

---

### 議題 4：工時自動追蹤的精確度 vs. 隱私

**Round 1 — 黃博士（行為心理學）**
自動追蹤會觸發「被監控感」，這是 Self-Determination Theory 中最傷害「自主感」(Autonomy) 的因素。如果工程師覺得 TITAN 在監視他們的每一分鐘，採用率會暴跌。

**Round 2 — 陳經理（銀行 IT 主管）**
銀行的管理文化比較嚴格，工程師對「記錄工時」本身不排斥（Kimai 已經在用了）。他們排斥的是「繁瑣的記錄過程」，不是「被追蹤」這件事。但我同意，不應該追蹤到分鐘級別。小時級就夠了。

**Round 3 — 王教授（管理學）**
Drucker 的名言：「人們做你檢查的，不做你期望的。」工時追蹤的目的不是監控，而是讓管理者理解「時間都花在哪裡」。以 0.5 小時為最小單位就足夠了。

**Round 4 — 張總監（UX）**
設計原則：自動追蹤是「幫你記錄」，不是「監視你」。UI 上的關鍵差異：

❌ 不好的設計：「林志偉今天 09:15-09:52 在處理 Task#123」（監控感）
✅ 好的設計：「系統建議：巡檢 0.5h, Oracle patch 研究 3h」（助手感）

呈現方式決定感受。

**Round 5 — 林工程師（技術）**
技術上，計時器 (`isRunning`, `startTime`, `endTime`) 已經精確到秒。但顯示和儲存可以不同。建議：
- 儲存精確值（`startTime`, `endTime`）用於計算
- 顯示四捨五入到 0.25h（15 分鐘）
- 報表中只顯示「小時數」，不顯示精確起迄時間
- 主管無法查看個人的精確計時記錄，只能看聚合工時

**Round 6 — 李顧問（產品策略）**
同意林工程師的方案。另外建議：工程師可以隨時修改系統建議的工時記錄（不鎖死自動記錄），這給了使用者「掌控感」，符合 Self-Determination Theory 的自主需求。

**Round 7 — 黃博士（行為心理學）**
很好。增加「掌控感」的另一個方法：讓使用者可以關閉自動建議（在設定頁面），回到純手動模式。即使沒人真的關閉，「可以關閉」這個選項的存在就能降低焦慮。

**Round 8 — 陳經理（銀行 IT 主管）**
從稽核角度，我需要知道工時有沒有被修改。如果工程師修改了系統建議的工時，AuditLog 要記錄「原始值 vs 修改值」。這不是為了抓人，是為了金管會稽核時能說清楚資料來源。

**Round 9 — 林工程師（技術）**
`AuditLog` 已有 `metadata` (JSONB) 欄位，可以存 `{ before: 3.0, after: 2.5, source: "auto_suggest", modifiedBy: "user" }`。不需要新增 schema。

**Round 10 — 張總監（UX）**
最終決策：
1. 自動記錄以「建議」形式呈現（虛線框 + 「系統建議」標籤）
2. 使用者可一鍵確認或修改
3. 最小顯示單位 0.25h
4. 主管看不到個人精確計時，只看聚合
5. 修改記錄寫入 AuditLog
6. 可在設定中關閉自動建議

**共識**：自動追蹤以「助手建議」呈現，非監控。使用者保有完全修改權。最小單位 0.25h。修改留 audit trail。

---

### 議題 5：技術實作的優先順序和風險

**Round 1 — 林工程師（技術）**
整個 v2 的技術改動規模：

| 改動 | 估算 | 風險 |
|------|------|------|
| Cockpit API (`/api/cockpit/summary`) | 1 Sprint | 低 — 純查詢聚合 |
| Dashboard 重構（Tab + My Day + Cockpit）| 2 Sprint | 中 — 前端大改，需要仔細測試 |
| Smart Time Suggest | 1 Sprint | 低 — 基於歷史資料的簡單推薦 |
| Daily Digest Banner | 0.5 Sprint | 低 |
| Task inline actions (完成、開始計時等) | 1 Sprint | 低 |
| Auto-rollup (Task → Goal → Plan → KPI) | 1 Sprint | 中 — 需要處理邊界案例 |
| Report auto-generation | 2 Sprint | 中 — 模板設計需要迭代 |
| Work 頁面整合（看板/列表/甘特/日曆 tabs）| 2 Sprint | 高 — 涉及路由重構 |
| 全局搜尋增強 | 0.5 Sprint | 低 |
| **總計** | **~11 Sprint（11 週）** | |

**Round 2 — 李顧問（產品策略）**
11 週太長了。建議用 MoSCoW 排序，先做 Must-have（能在 4 週內讓使用者感受到顯著差異的部分）。

**Round 3 — 陳經理（銀行 IT 主管）**
對我來說最迫切的是 Cockpit（我現在要跳 4 個頁面）和 Auto-rollup（我要手動算進度）。工程師最迫切的是 My Day（知道今天做什麼）和 Smart Time Suggest（不用花時間記工時）。

**Round 4 — 張總監（UX）**
建議分三個階段：

**Phase A（4 週）— 核心體驗重塑**
1. Dashboard 重構 → Tab 分離（Cockpit + My Day）
2. Cockpit API + BSC 四象限
3. My Day 視圖 + Task inline actions
4. Auto-rollup（Task → Goal → Plan）

**Phase B（4 週）— 效率革命**
5. Smart Time Suggest + Daily Digest
6. Quick Log + Quick Action
7. Auto-report generation (週報)
8. Work 頁面 Tab 化

**Phase C（3 週）— 精緻化**
9. 知識庫上下文連結
10. 月報自動化
11. 全局搜尋增強
12. 行為數據分析（使用率 dashboard）

**Round 5 — 林工程師（技術）**
Phase A 的技術依賴圖：

```
AnnualPlan.vision 欄位  ──┐
                          ├──→ Cockpit API ──→ Cockpit UI
Auto-rollup 邏輯  ────────┘
                                    ↕
Task inline actions ──→ My Day UI ──→ Dashboard Tab 元件
```

建議先做 Auto-rollup 和 Cockpit API（後端），同時前端做 Dashboard Tab 重構。平行開發可壓縮到 3 週。

**Round 6 — 黃博士（行為心理學）**
Phase A 上線後，一定要做一件事：讓團隊在早會上使用 Cockpit 做 5 分鐘的「本週狀態檢視」。這個儀式化的行為是習慣養成的關鍵觸發器。如果第一週沒有人用，後面就很難救了。

**Round 7 — 王教授（管理學）**
同意。變革管理中，「Quick Win」非常重要。Phase A 要有一個讓所有人驚豔的功能。我認為是「自動產出的本週摘要」——以前主管要花 2 小時整理，現在 TITAN 自動完成。這是最直觀的價值展示。

**Round 8 — 陳經理（銀行 IT 主管）**
把自動週報加進 Phase A。即使只是簡單版本（本週完成任務列表 + 工時統計 + 下週計畫），對我來說就是殺手級功能。

**Round 9 — 林工程師（技術）**
可以把簡化版週報加進 Phase A。用 `/api/reports/weekly-auto` API 聚合：
```ts
{
  period: "2026-W13",
  completedTasks: [...],
  timeStats: { total, byCategory, byPerson },
  nextWeekPlanned: [...],
  alerts: [...]
}
```
前端用一個 Report Preview 元件渲染，支援 PDF 匯出。工作量增加 0.5 Sprint，Phase A 變成 4.5 週。

**Round 10 — 李顧問（產品策略）**
最終優先順序確認：

**Phase A（5 週）— 核心體驗重塑 + Quick Win**
1. `AnnualPlan.vision` 欄位 + Auto-rollup (1w)
2. Cockpit API + Cockpit UI (1.5w)
3. My Day + Task inline actions (1w)
4. Dashboard Tab 整合 (0.5w)
5. 自動週報 MVP (1w)

**Phase B（4 週）— 效率革命**
6. Smart Time Suggest + Daily Digest (1.5w)
7. Quick Log + Quick Action bar (1w)
8. Work 頁面 Tab 化（看板/甘特/列表統一）(1.5w)

**Phase C（3 週）— 精緻化**
9. 知識庫上下文 + 月報自動化 (1.5w)
10. 全局搜尋增強 + 使用率分析 (1.5w)

**共識**：Phase A 5 週，包含自動週報作為 Quick Win。Phase B 4 週。Phase C 3 週。總計 12 週。Phase A 完成後做使用者回饋收集，根據回饋調整 Phase B/C 優先順序。

---

### 議題 6：如何確保使用者真的會用？

**Round 1 — 黃博士（行為心理學）**
這是整個產品重設計中最重要的問題。功能再好，沒人用就是零。行為改變的三大障礙：
1. **習慣慣性**：工程師已經習慣 Kimai + Excel + Email 的方式
2. **學習成本**：新系統需要時間適應
3. **感知價值不足**：「為什麼要換？原來的也能用」

**Round 2 — 陳經理（銀行 IT 主管）**
在銀行裡，推動新系統的最有效手段不是說服，而是：
1. 主管帶頭用（我在早會上用 Cockpit 看進度，團隊自然會跟）
2. 移除替代方案（Kimai 下線，Excel 追蹤表不再更新）
3. 和考績連結（年終評估的工作記錄來源是 TITAN）

聽起來有點強制，但 5 人團隊不需要做大規模變革管理。我帶頭，他們跟。

**Round 3 — 王教授（管理學）**
Kotter 的變革八步驟：建立緊迫感 → 組建引導團隊 → 形成願景 → 溝通願景 → 賦權行動 → 創造短期成果 → 鞏固成果 → 融入文化。

對 5 人團隊來說可以壓縮為：
1. **建立緊迫感**：「下次金管會稽核要看完整的工作記錄」
2. **展示短期成果**：Phase A 上線的自動週報
3. **移除障礙**：Kimai 下線
4. **融入文化**：每週早會用 Cockpit

**Round 4 — 李顧問（產品策略）**
建議採用「Soft Launch + Hard Switch」策略：
- Week 1-2：TITAN v2 和 Kimai 並行，讓工程師自願嘗試
- Week 3：收集回饋，修正最痛的 UX 問題
- Week 4：Kimai 唯讀（不能再新增）
- Week 6：Kimai 下線

**Round 5 — 張總監（UX）**
Onboarding 體驗是第一印象，必須精心設計：

```
首次登入 TITAN v2
  ↓
「歡迎回來！TITAN 有了新面貌」
  ↓
30 秒導覽（非強制，可跳過）：
  1. 這是你的「每日工作台」（指向 My Day）
  2. 完成任務只需點這裡（指向 ✓ 按鈕）
  3. 工時會自動記錄（指向工時摘要條）
  ↓
「開始吧！」
```

不要做長篇 tutorial。3 個重點，30 秒講完。

**Round 6 — 黃博士（行為心理學）**
加入遊戲化的「微獎勵」：
- 連續 5 天記錄完整 → 顯示「本週全勤」小成就
- 首次用 Quick Action 回報事件 → 「快速回應者」徽章
- 但不要做排行榜！這會在小團隊造成壓力和對立

僅限正向回饋，不做負面比較。

**Round 7 — 陳經理（銀行 IT 主管）**
遊戲化不適合銀行。我的工程師會覺得幼稚。刪掉徽章和成就。保留「本週記錄完整 ✓」的簡單確認就好——這是實用資訊，不是遊戲。

**Round 8 — 黃博士（行為心理學）**
接受。不同文化背景的團隊對遊戲化的接受度不同。銀行文化確實偏保守。改用「實用型正向回饋」：
- 「本週記錄完整 ✓」— 讓使用者知道他不會被追問
- 「本月累計完成 23 項任務」— 年終考績的數據基礎
- 「你的平均回應時間：2.3 小時」— 專業能力的客觀數據

**Round 9 — 林工程師（技術）**
Onboarding 導覽可以用 `react-joyride` 或 `shepherd.js`，元件化實作。Phase A 加入簡單版本（3 步驟），Phase B 根據使用者回饋優化。

微獎勵的資料不需要新 model，從現有 `TimeEntry` 和 `Task` 聚合即可。

**Round 10 — 李顧問（產品策略）**
最終採用策略：

| 時間 | 行動 | 負責人 |
|------|------|--------|
| Phase A 上線前 1 週 | 15 分鐘 demo 給團隊看（Cockpit + My Day） | 主管 (陳經理) |
| Phase A 上線 Week 1 | TITAN v2 + Kimai 並行 | 全員 |
| Phase A 上線 Week 2 | 收集回饋 + hotfix | 開發團隊 |
| Phase A 上線 Week 3 | Kimai 唯讀 | 主管決定 |
| Phase A 上線 Week 5 | Kimai 下線 | 系統管理員 |
| 每週 | 早會用 Cockpit（5 分鐘） | 主管 |
| 每月 | 使用率檢視（誰沒在用？個別溝通） | 主管 |

**共識**：主管帶頭使用 + 移除替代方案 + 簡短 onboarding + 實用型正向回饋。不做遊戲化。Soft Launch 2 週 → Hard Switch。

---

### 議題 7：與現有系統（Plane, Outline）的定位區分

**Round 1 — 林工程師（技術）**
TITAN 的 Docker Compose 中包含 Plane（專案管理）和 Outline（知識庫）。如果 TITAN 本身也做看板和知識庫，是否和這兩個工具功能重疊？

**Round 2 — 陳經理（銀行 IT 主管）**
好問題。Plane 和 Outline 是 TITAN 平台的一部分——它們是底層基礎設施。但 TITAN 的 Web App（Next.js 那個）才是使用者每天面對的東西。如果使用者需要同時用 TITAN Web App 和 Plane，那是 UX 災難。

**Round 3 — 李顧問（產品策略）**
需要明確定位：

| 系統 | 定位 | 使用頻率 |
|------|------|---------|
| TITAN Web App | 日常工作管理入口 | 每天，主要介面 |
| Plane | 長期專案管理（大型跨部門專案） | 偶爾，大專案才用 |
| Outline | 知識庫和文件協作 | 經常，寫文件時 |
| Homepage | 系統入口頁 | 極少（書籤直接進各系統） |

TITAN Web App 應該包含 80% 的日常看板/工時/KPI 功能。只有超出 5 人 IT 團隊範圍的大型專案才需要 Plane。

**Round 4 — 張總監（UX）**
Outline 的知識庫功能比 TITAN 內建的 Document model 成熟很多（Markdown 協作、搜尋、版本控制）。建議 TITAN 的知識庫模組做「Outline 的門面」——用 API 串接 Outline，在 TITAN 介面中嵌入/連結 Outline 的文件。不要維護兩套文件系統。

**Round 5 — 林工程師（技術）**
技術上，TITAN 已有 `TaskDocument.outlineDocumentId` 關聯 Outline 文件。可以擴展為在任務側邊欄中直接預覽 Outline 文件內容（用 Outline 的 API `GET /api/documents/:id`）。TITAN 內建的 Document model 可以逐步遷移到 Outline，避免維護兩套。

**Round 6 — 王教授（管理學）**
從管理角度，工具整合的原則是「一個入口，多個引擎」。使用者不需要知道背後是 Outline 還是 TITAN 的 Document model，他只需要在 TITAN 裡搜尋到文件、連結到任務。

**Round 7 — 黃博士（行為心理學）**
每多一個系統，使用者的認知負荷就增加一倍。如果使用者需要記住「工作在 TITAN，文件在 Outline，大專案在 Plane」，他們會混亂。最好的體驗是：使用者只知道 TITAN，TITAN 在背後幫他整合。

**Round 8 — 陳經理（銀行 IT 主管）**
同意。我的團隊不需要知道 Outline 是什麼。他們在 TITAN 裡寫文件（背後存到 Outline），在 TITAN 裡搜尋文件（背後查 Outline），在 TITAN 裡看任務相關文件（背後連 Outline）。

**Round 9 — 林工程師（技術）**
長期目標明確，但短期內 Outline 有自己的編輯器（rich text + Markdown），不是 TITAN 的前端能輕易複製的。建議：
- 短期（Phase A-B）：TITAN 內的知識庫頁面顯示文件列表 + 點擊跳轉到 Outline（新分頁）
- 中期（Phase C）：在 TITAN 側邊欄中 iframe 嵌入 Outline 文件檢視
- 長期（v3）：用 Outline API 在 TITAN 中直接編輯

**Round 10 — 李顧問（產品策略）**
同意漸進式整合。Phase A-B 不需要動 Outline 整合，保持現狀。Phase C 做嵌入檢視。v3 做完整整合。不要一次做太多。

**共識**：TITAN Web App 是唯一的日常入口。Outline 是知識庫引擎，Plane 是大型專案引擎，都在 TITAN 的整合層之下。漸進式整合，Phase A-B 不動。

---

### 議題 8：行動端和離線體驗

**Round 1 — 張總監（UX）**
銀行內網通常沒有 Wi-Fi（資安限制），工程師在伺服器機房或會議室可能沒有網路。需要某種離線支援嗎？

**Round 2 — 陳經理（銀行 IT 主管）**
我的工程師 90% 時間在辦公桌前（有網路），10% 在機房（有網路，但不方便開電腦）。在機房時用手機填工時的場景確實有，但頻率低。PWA 離線支援在 product-roadmap 裡排在 P3，我認為暫時不需要。

**Round 3 — 林工程師（技術）**
PWA 離線支援需要 Service Worker + IndexedDB + Sync API，工作量大（6+ Sprint）。考慮到使用場景不頻繁，不建議 Phase A-C 做。

**Round 4 — 黃博士（行為心理學）**
但行動端的「響應式體驗」很重要。即使不離線，用手機瀏覽器快速查看今日任務和點擊完成——這個場景很實用（開會時用手機快速操作）。

**Round 5 — 張總監（UX）**
同意行動端響應式是必要的（已在 product-requirements 中標記為 P2）。建議 Phase B 做「行動端核心操作」：
1. My Day 的行動端版面
2. 一鍵完成任務
3. 工時確認

不做看板拖拉（太複雜）、不做 Cockpit（螢幕太小不適合）。

**共識**：行動端響應式在 Phase B，僅限 My Day + 任務完成 + 工時確認。離線 PWA 延後到 v3。

---

### 議題 9：資安與稽核合規

**Round 1 — 陳經理（銀行 IT 主管）**
所有新功能都必須通過以下資安要求：
1. AuditLog 記錄所有操作（已實作）
2. RBAC 權限控制（已實作）
3. 資料不外傳（Air-gapped 環境保證）
4. Session 管理（JWT Blacklist + Timeout 已實作）

**Round 2 — 林工程師（技術）**
Cockpit API 需要特別注意：聚合查詢如果回傳了 ENGINEER 看不到的 KPI（`visibility: MANAGER`），就是權限洩漏。所有新 API 必須通過 RBAC middleware。

**Round 3 — 王教授（管理學）**
從管理角度，Cockpit 的資料如果太透明也有問題。例如「團隊工作負荷熱力圖」如果讓 ENGINEER 看到，可能造成團隊內部比較和壓力。建議只有 MANAGER/ADMIN 可見。

**Round 4 — 黃博士（行為心理學）**
同意。社會比較 (Social Comparison Theory) 在小團隊中特別有害。4 個人的工時和完成率一比較，最少的那個會感受到巨大壓力，即使他可能在做最複雜的任務。

**Round 5 — 林工程師（技術）**
確認：Cockpit 所有資料 API 加 `role: [MANAGER, ADMIN]` guard。ENGINEER 存取 `/cockpit` 路徑時 redirect 到 `/`。前端也做 role check 不渲染 Tab。

**共識**：Cockpit 僅 MANAGER/ADMIN 可見。所有新 API 通過 RBAC。AuditLog 覆蓋 Cockpit 操作。個人工時比較資料不對 ENGINEER 開放。

---

### 議題 10：成功指標與驗收標準

**Round 1 — 李顧問（產品策略）**
v2 上線後如何衡量成功？建議定義量化指標：

**Round 2 — 陳經理（銀行 IT 主管）**
對我來說，成功 = 三件事：
1. 我不再需要手動整理週報
2. 我打開 TITAN 就知道團隊狀態
3. 金管會稽核時資料完整可查

**Round 3 — 黃博士（行為心理學）**
從使用者採用角度：
1. DAU（每日活躍使用者）= 5/5（全員每天使用）
2. 工時記錄完整率 > 90%（每人每天 > 6h 記錄）
3. 平均互動時間 < 60 秒/天（趨近 30 秒目標）

**Round 4 — 張總監（UX）**
從 UX 品質角度：
1. 任務完成操作 ≤ 2 clicks
2. Cockpit 載入 < 2 秒
3. 使用者滿意度問卷 > 4/5

**Round 5 — 林工程師（技術）**
從技術品質角度：
1. Cockpit API 回應 < 500ms
2. Auto-rollup 計算 < 200ms
3. 零權限洩漏（E2E 測試覆蓋）
4. 測試覆蓋率 > 85%

**Round 6-10 — 綜合討論**

最終 KPI 定義：

| 類別 | 指標 | 目標值 | 衡量方式 |
|------|------|--------|---------|
| **採用率** | DAU | 5/5（100%） | 登入日誌 |
| **採用率** | 工時記錄完整率 | > 90% | `SUM(hours)/expected_hours` |
| **效率** | 管理者資訊獲取時間 | < 60 秒 | Cockpit 載入 + 首屏足夠 |
| **效率** | 工程師每日記錄時間 | < 60 秒 | 互動日誌分析 |
| **效率** | 週報產出時間 | < 5 分鐘（含主管審閱） | 從「產生」到「確認」的時間差 |
| **品質** | 使用者滿意度 | > 4/5 | 季度問卷 |
| **品質** | 資料完整性 | 100% audit trail | 稽核抽查 |
| **技術** | Cockpit API P95 延遲 | < 500ms | Prometheus metrics |
| **技術** | 頁面載入 | < 2 秒 | Lighthouse / 實測 |
| **技術** | 測試覆蓋率 | > 85% | Jest coverage report |

**共識**：上線 30 天後進行第一次效益檢視。90 天後進行正式 ROI 對比分析（對照 ROI 分析報告的預估值）。

---

# 附錄 A：資料模型變更清單

v2 所需的 schema 變更（保守，最小必要改動）：

| 變更 | 說明 | 影響 |
|------|------|------|
| `AnnualPlan.vision` (String?) | 年度方針/願景 | 新增欄位，不影響現有資料 |
| 無新 Model | Cockpit 透過聚合查詢實現 | 零 schema 風險 |
| 無刪除 | 所有現有 model 保留 | 完全向後相容 |

# 附錄 B：API 新增清單

| API | 方法 | 說明 | 權限 |
|-----|------|------|------|
| `/api/cockpit/summary` | GET | Cockpit 聚合資料 | MANAGER, ADMIN |
| `/api/cockpit/workload` | GET | 團隊工作負荷圖 | MANAGER, ADMIN |
| `/api/time-entries/daily-summary` | GET | 個人每日工時摘要 | 本人 |
| `/api/time-entries/suggest` | GET | Smart Time Suggest | 本人 |
| `/api/reports/weekly-auto` | GET | 自動週報 | MANAGER, ADMIN |
| `/api/reports/monthly-auto` | GET | 自動月報 | MANAGER, ADMIN |

# 附錄 C：實施時程總覽

```
Week 01-05: Phase A — 核心體驗重塑
  ├── W1: AnnualPlan.vision + Auto-rollup 邏輯
  ├── W2-3: Cockpit API + UI
  ├── W3-4: My Day + Task inline actions
  ├── W4: Dashboard Tab 整合
  └── W5: 自動週報 MVP

Week 06-09: Phase B — 效率革命
  ├── W6-7: Smart Time Suggest + Daily Digest
  ├── W7-8: Quick Log + Quick Action
  └── W8-9: Work 頁面 Tab 化

Week 10-12: Phase C — 精緻化
  ├── W10-11: 知識庫上下文 + 月報自動化
  └── W11-12: 全局搜尋增強 + 使用率分析

Week 13-14: Stabilization + Soft Launch
Week 15: Hard Switch (Kimai 下線)
Week 17: 30 天效益檢視
```

# 附錄 D：風險登記冊

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| Phase A 延期（前端重構複雜度） | 中 | Cockpit 推遲上線 | 每週 demo，及早發現 |
| 使用者不願切換（Kimai 慣性） | 中 | 採用率低 | Soft Launch + 主管帶頭 |
| Cockpit 效能（聚合查詢慢） | 低 | UX 受損 | Cache + Materialized View |
| Auto-rollup 計算錯誤 | 低 | 管理者看到錯誤數據 | 單元測試 + 手動驗算對比 |
| 新功能影響穩定性 | 低 | 信任度下降 | Feature flag + 分階段發布 |

---

*本文件由 TITAN CPO 撰寫，經 6 位專家 10 輪評審確認。作為 TITAN v2 產品重新設計的最高指導文件。*

*CPO: Claude Opus 4.6 | TITAN Product Vision v2.0 | 2026-03-26*

---

## 補充：任務優先級與緊急指揮機制

### 管理者端：標記重點/緊急

**Big Picture（駕駛艙）操作：**
1. 任何任務卡片 → 點「🔥」圖標 → 標記為「管理者關注」
2. 設定優先級：P0 緊急 / P1 重要 / P2 一般
3. 填寫「為什麼緊急」備註（如「金管會下週檢查」）
4. 系統自動推送通知給負責人（in-app + email）

**看板操作：**
- 拖到「緊急」swimlane
- 或右鍵 →「標記為緊急」

### 經辦端：如何感知優先級

**My Day 首頁排序邏輯（每天打開第一眼）：**
```
┌─────────────────────────────────────┐
│ 🔴 緊急任務（管理者標記）              │  ← 最頂部，紅底
│   └ 核心系統 Patch                    │
│     陳經理：「金管會下週檢查，必須今天完成」│
│   └ 資安事件通報                      │
│     14:00 前必須完成（SLA 倒數 2h）    │
├─────────────────────────────────────┤
│ 🟡 今日到期                           │  ← 第二區
│   └ LDAP 整合測試                     │
├─────────────────────────────────────┤
│ ⚪ 進行中                             │  ← 第三區
│   └ 前端 LCP 優化                     │
│   └ Docker 設定                       │
└─────────────────────────────────────┘
```

**視覺區分系統：**
| 級別 | 邊框 | 圖標 | 排序 | 通知 |
|------|------|------|------|------|
| P0 緊急 | 紅色 | 🔥 | 置頂 | 即時推送 |
| P1 重要 | 橘色 | ⭐ | 次之 | 常規通知 |
| P2 一般 | 無 | 無 | 正常 | 無 |
| 管理者關注 | 紅色脈動光暈 | 👁️ | 最頂 | 即時推送+原因 |

### Schema 變更

現有 `Task.priority` (P0-P3) 足夠。新增：
- `Task.managerFlagged: Boolean @default(false)` — 管理者關注標記
- `Task.flagReason: String?` — 標記原因
- `Task.flaggedAt: DateTime?` — 標記時間
- `Task.flaggedBy: String?` — 標記人 ID

### API 變更

- `PATCH /api/tasks/{id}/flag` — 管理者標記/取消（MANAGER only）
  - body: `{ flagged: true, reason: "金管會下週檢查" }`
  - 自動建立 Notification + AuditLog
- `GET /api/tasks/my-day` — 回傳按優先級排序的今日任務
  - 排序：managerFlagged > P0 > P1 > dueDate today > in_progress

### 前端元件

- `FlagButton` — 🔥 按鈕（管理者可見）
- `FlagBadge` — 紅色脈動光暈 + 原因 tooltip（所有人可見）
- `MyDayList` — 三區排序（緊急/今日到期/進行中）

### 與其他體驗的整合

- **Big Picture**：管理者關注的任務在駕駛艙卡片上突出顯示
- **Get It Done**：看板上 flagged 任務有紅色光暈，不會被淹沒
- **Track Time**：經辦處理緊急任務時 Timer 自動建議分類為 INCIDENT
- **Know More**：緊急任務如有關聯 SOP 文件，自動在任務詳情中顯示

