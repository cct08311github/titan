# TITAN Reports v2 — 管理報表模組重新設計

> **版本**: v2.0
> **日期**: 2026-03-26
> **目的**: 從管理者視角重新設計報表模組，與管理駕駛艙整合，解決「報表不為管理者服務」的核心問題
> **前置文件**: [management-cockpit-design.md](./management-cockpit-design.md)

---

## 一、問題診斷

### 現有報表模組（v1）的缺陷

| 現有 Tab | 內容 | 管理者痛點 |
|----------|------|-----------|
| 週報 | 本週完成數、逾期數、工時分類 | 只有快照，無趨勢；看不到與計畫目標的關係 |
| 月報 | 月度任務統計、完成率 | 與年度計畫脫節，不知道「這個月該做什麼、做了多少」 |
| 工時分佈 | 人員 x 工時類別 | 無法回答「團隊有沒有過勞」「工時投在對的地方嗎」 |
| 完成率 | 週/月任務完成趨勢 | 純粹計數，不考慮優先級和計畫權重 |
| KPI 報表 | KPI 達成率列表 | 只有當前值，沒有月趨勢、沒有與任務投入的交叉分析 |
| 計畫外負荷 | 計畫/計畫外工時比 | 有用但缺乏來源分析和月度對比 |
| 趨勢分析 | KPI/負荷/逾期的月度表格 | 方向正確但維度太少，且不支持匯出 |
| 稽核報表 | 工時+任務原始資料匯出 | 只有原始資料，缺乏稽核人員需要的摘要和合規指標 |

### 核心問題

**報表模組是「資料展示」而不是「管理決策支援」。**

一個銀行 IT 主管每天需要回答的問題：
1. 我的年度計畫還有救嗎？（earned value / 進度 vs 時間消耗）
2. 團隊的產能是否被計畫外工作侵蝕？（utilization trend）
3. 誰過勞了？誰閒著？（workload distribution）
4. KPI 到年底能達標嗎？（trend projection）
5. 稽核要來了，合規紀錄齊全嗎？（compliance checklist）
6. 加班是否合理？哪個月最嚴重？（overtime analysis）

**現有報表無法回答以上任何一題。**

### 與管理駕駛艙的關係

```
┌────────────────────────────────────────┐
│  管理駕駛艙 /cockpit                    │ ← 即時快照：現在狀態如何？
│  (real-time snapshot)                   │
├────────────────────────────────────────┤
│         │ drill-down links              │
│         ▼                               │
│  報表中心 /reports                       │ ← 歷史分析：我們怎麼走到這裡的？
│  (historical trends & analysis)         │    未來預測：接下來會怎樣？
└────────────────────────────────────────┘
```

- **Cockpit** = 即時健康快照（紅黃綠燈、當前進度）
- **Reports** = 歷史趨勢與深度分析（怎麼走到現在、接下來怎麼辦）
- Cockpit 上的每個指標都可以連結到對應的 Report 做 drill-down

---

## 二、競品研究（聚焦管理報表）

### 1. Jira — 報表導向

| 報表 | 管理價值 | TITAN 適用性 |
|------|---------|-------------|
| Burndown Chart | Sprint 內任務消化速度 | 中 — TITAN 不用 Sprint，但月度目標等效 |
| Velocity Report | 每 Sprint 完成 Story Points | 高 — 可改為每月完成任務數/工時 |
| Epic Report | Epic 進度 vs 預估完成日 | 高 — 等同年度計畫 Earned Value |
| Control Chart | 任務 cycle time 分佈 | 中 — 適合分析處理效率 |
| Created vs Resolved | 累積需求 vs 完成趨勢 | 高 — 可看是否「越做越多」 |

**啟發**：Jira 的 Epic Report 做了 scope change tracking —— 追蹤「原始範疇」vs「現在範疇」，這對管理者非常重要。

### 2. Monday.com — 可配置 Dashboard

| 功能 | 管理價值 |
|------|---------|
| Chart Widget | 從任何 Board 拉資料做圖表 |
| Numbers Widget | 單一數字大字呈現（KPI 達成率） |
| Battery Widget | 進度百分比視覺化 |
| Pivot Table | 多維度交叉分析 |
| Workload Widget | 人員工作量分佈 |

**啟發**：Monday 的 pivot table 概念 —— 讓管理者選擇「行 = 人員」「列 = 月份」「值 = 工時」，自助式分析。

### 3. Asana — Portfolio + Goals

| 報表 | 管理價值 |
|------|---------|
| Portfolio Status | 多專案健康一覽（On Track / At Risk / Off Track） |
| Workload View | 每人每週工作量 vs 產能上限 |
| Goals Progress | OKR 達成率趨勢，自動 rollup |
| Custom Fields Report | 依自訂欄位做篩選統計 |

**啟發**：Asana Workload 的「產能上限」概念 —— 每人每月可用工時 vs 已分配工時，這是 TITAN 缺少的。

### 4. ClickUp — 深度整合報表

| 報表 | 管理價值 |
|------|---------|
| Time Tracking Report | 工時 by person / by task / by date |
| Workload View | 點數或工時制的負荷分佈 |
| Custom Dashboard | Widget-based，可拉多 Space 資料 |
| Goals + Targets | 數值型目標追蹤（等同 KPI） |

**啟發**：ClickUp 的 Time Tracking Report 支援「billable vs non-billable」分類，TITAN 可用「計畫 vs 計畫外」替代。

### 5. Microsoft Project — 企業級報表

| 報表 | 管理價值 |
|------|---------|
| Resource Utilization | 人員使用率（已分配 / 可用） |
| Cost Report | 預算 vs 實際成本 |
| Earned Value Analysis | EV / PV / AC → SPI, CPI |
| Baseline Comparison | 基線計畫 vs 實際進度偏差 |
| Milestone Report | 里程碑達成 / 延遲追蹤 |

**啟發**：Earned Value 是最成熟的計畫健康指標。TITAN 可簡化為「進度 vs 時間消耗比」。

### 6. Power BI / Tableau — BI 工具

| 功能 | 管理價值 |
|------|---------|
| Configurable Dashboard | 拖拉式建構，任意維度 |
| Drill-through | 從摘要點擊進入明細 |
| Scheduled Reports | 定時寄送 PDF/Excel 給管理層 |
| Row-level Security | 依角色過濾資料 |

**啟發**：Scheduled Reports（定期寄送報表）對忙碌的主管非常有價值。不用登入系統也能掌握狀態。

### 7. Linear — 工程導向 Insights

| 報表 | 管理價值 |
|------|---------|
| Cycle Analytics | 完成週期時間分析 |
| Project Insights | 專案燃盡圖 |
| Velocity | 每 Cycle 完成量趨勢 |
| SLA Metrics | 回應/解決時效達標率 |

**啟發**：Linear 的 Insights 完全自動計算、零設定，管理者不需要建 query。TITAN 應效法這點。

### 8. Tempo Timesheets — 工時報表專家

| 報表 | 管理價值 |
|------|---------|
| Logged vs Planned | 實際工時 vs 預估工時偏差 |
| Team Utilization | 團隊利用率（logged / available） |
| Billable Report | 可計費工時佔比 |
| Approval Status | 工時審核進度 |

**啟發**：Tempo 的「logged vs planned」是工時管理的核心 —— 計畫了 8 小時，實際花了 12 小時，代表估算有問題。

### 9. Lattice — OKR/績效報表

| 報表 | 管理價值 |
|------|---------|
| Goal Progress | OKR 達成率趨勢，可設定 check-in 頻率 |
| Performance Reviews | 績效評分分佈、校準 |
| Alignment View | 上下級目標對齊可視化 |
| Analytics Dashboard | 參與度、完成率等 meta-metrics |

**啟發**：Lattice 的 check-in trend —— 每次填報的 KPI 值畫成折線圖，一眼看出趨勢。TITAN 的 KPI achievements 已有這些資料。

### 10. 競品總結

| 設計模式 | 採用者 | TITAN 決策 |
|---------|--------|-----------|
| **Earned Value / 進度 vs 時間** | MS Project, Jira Epic | 必做 — 計畫健康的核心指標 |
| **人員 utilization（logged / available）** | Asana, Tempo, ClickUp | 必做 — 管理者最在意的資源問題 |
| **KPI 趨勢折線圖** | Lattice, Linear | 必做 — 已有資料，缺乏視覺化 |
| **Scheduled Report（定期寄送）** | Power BI, Tableau | Phase 2 — 實用但非 MVP |
| **Pivot / 自助分析** | Monday, Power BI | Phase 3 — 用戶數太少，ROI 低 |
| **Drill-through（摘要 → 明細）** | Power BI, Salesforce | 必做 — 與 Cockpit 整合的核心 |
| **匯出 PDF + Excel** | 全部 | 必做 — 銀行主管會議必須紙本/附件 |

---

## 三、Reports v2 報表分類設計

### 總覽架構

```
報表中心 /reports
├── 組織績效  (Org Performance)
│   ├── 團隊產能利用率
│   ├── 計畫外工作佔比趨勢
│   └── 人員工作量分佈
│
├── 項目管理  (Project Management)
│   ├── 年度計畫 Earned Value
│   ├── 任務完成速率（Velocity / Throughput）
│   ├── 逾期任務分析
│   └── 里程碑達成率
│
├── KPI 報表  (Performance Metrics)
│   ├── KPI 達成率趨勢
│   ├── KPI 與任務投入相關性
│   └── 跨 KPI 綜合評分
│
├── 工時報表  (Time & Attendance)
│   ├── 個人/團隊月工時摘要
│   ├── 加班分析
│   └── 工時 vs 任務效率
│
└── 稽核報表  (Compliance)
    ├── 變更管理紀錄摘要
    ├── 事件處理時效
    └── 權限異動紀錄
```

---

### 3.1 組織績效報表（Org Performance）

#### R-ORG-01: 團隊產能利用率

**管理者問題**：「我的團隊產能用在刀口上了嗎？」

| 欄位 | 說明 |
|------|------|
| 期間選擇 | 月 / 季 / 年 |
| 每人可用工時 | 工作天數 x 8h（扣國假、特休；可配置） |
| 每人實際登錄工時 | sum(TimeEntry.hours) |
| 利用率 | 登錄工時 / 可用工時 x 100% |
| 計畫投入率 | PLANNED_TASK 工時 / 登錄工時 |
| 熱力圖 | 行=人員, 列=月份, 色=利用率（綠>80%, 黃60-80%, 紅<60%） |

**視覺化**：
- 主圖：人員 x 月份 熱力圖
- 副圖：團隊平均利用率折線（含去年同期對比）
- 門檻線：80% utilization target（可配置）

**資料來源**：
```
TimeEntry (hours, category, date, userId)
User (available hours = workingDays * 8)
```

**Cockpit 連結**：Cockpit 的「累計工時 / 計畫內投入率」→ 點擊進入此報表

---

#### R-ORG-02: 計畫外工作佔比趨勢

**管理者問題**：「計畫外的事情越來越多嗎？這個趨勢有改善嗎？」

| 欄位 | 說明 |
|------|------|
| 月度趨勢 | 12 個月的 planned / unplanned 比率 |
| 計畫外來源 | INCIDENT / SUPPORT / ADMIN 各佔多少 |
| 年度對比 | 今年 vs 去年同期 |
| 警告門檻 | 計畫外 > 30% 標紅（可配置） |

**視覺化**：
- 堆疊長條圖：每月 planned（藍）+ unplanned（橙/紅）
- 折線疊加：計畫外佔比趨勢線
- 來源圓餅圖：計畫外工作按類別分佈

**資料來源**：
```
TimeEntry (category in PLANNED_TASK vs INCIDENT/SUPPORT/ADMIN/ADDED_TASK)
→ monthly aggregation
```

**Cockpit 連結**：Cockpit 的「計畫內投入率 78%」→ 點擊進入此報表

---

#### R-ORG-03: 人員工作量分佈

**管理者問題**：「誰過勞了？誰的任務太少？分配合理嗎？」

| 欄位 | 說明 |
|------|------|
| 期間 | 月 / 季 |
| 每人指派任務數 | count(Task where assignee = userId, status != DONE) |
| 每人已完成任務數 | count(Task where assignee = userId, status = DONE) in period |
| 每人登錄工時 | sum(TimeEntry.hours) in period |
| 負荷指標 | 工時 / 可用工時，超過 100% 為過勞 |
| 任務類別分佈 | 每人的工時在各類別的佔比 |

**視覺化**：
- 氣泡圖：X=任務數, Y=工時, 氣泡大小=逾期任務數, 色=部門
- 或水平長條：每人一行，分段顯示各類別工時
- 警告標記：超過 110% 利用率的人員紅色標記

**資料來源**：
```
Task (assigneeId, status, category)
TimeEntry (userId, hours, category)
```

**Cockpit 連結**：新增 — Cockpit 的 overview section 可顯示「過勞人數」badge

---

### 3.2 項目管理報表（Project Management）

#### R-PM-01: 年度計畫 Earned Value Analysis

**管理者問題**：「年度計畫還有救嗎？照這個進度年底能完成嗎？」

| 指標 | 公式 | 說明 |
|------|------|------|
| 時間消耗率 | (已過月份 / 12) x 100% | 時間維度 |
| 計畫進度（PV） | 預期此時應完成的任務比例 | 基於月度目標分佈 |
| 實際進度（EV） | 已完成任務數 / 總任務數 x 100% | 基於 Task status=DONE |
| 工時投入（AC） | 已登錄工時 / 預估總工時 x 100% | 基於 TimeEntry |
| 進度績效指數 SPI | EV / PV | >1 超前, <1 落後 |
| 成本績效指數 CPI | EV / AC | >1 高效, <1 低效（工時超支） |
| 預測完成月份 | 基於 SPI 推算 | 線性外推 |

**視覺化**：
- S-curve 圖：PV（灰虛線）、EV（藍實線）、AC（橙實線）三線並行
- SPI / CPI 儀表盤：指針式或數字+色彩
- 12 個月 milestone 標記在 S-curve 上

**資料來源**：
```
AnnualPlan → MonthlyGoals[] → Tasks[]
Task (status, completedAt)
TimeEntry (hours)
```

**Cockpit 連結**：Cockpit 的「整體進度 65%」→ 點擊進入此報表，看 S-curve 和 SPI

---

#### R-PM-02: 任務完成速率（Velocity / Throughput）

**管理者問題**：「團隊每個月能消化多少任務？速度有在進步嗎？」

| 欄位 | 說明 |
|------|------|
| 月度完成數 | count(Task where status=DONE, completedAt in month) |
| 月度新增數 | count(Task where createdAt in month) |
| 累積流量 | created vs resolved cumulative chart |
| 平均 cycle time | avg(completedAt - createdAt) per month |
| Scope creep | 月度新增任務數 vs 月初計畫任務數 |

**視覺化**：
- 長條圖：每月完成數（藍）vs 新增數（橙），顯示「追趕」或「落後」
- 累積折線：Created Cumulative vs Resolved Cumulative（交叉點=完成所有現有任務的時間點）
- Cycle Time 箱形圖：每月的任務完成週期分佈

**Cockpit 連結**：Cockpit 的「任務完成 85/120」→ 點擊進入

---

#### R-PM-03: 逾期任務分析

**管理者問題**：「哪些任務逾期了？為什麼？是誰的？逾期多久了？」

| 欄位 | 說明 |
|------|------|
| 逾期任務清單 | Task where dueDate < now AND status != DONE |
| 逾期天數 | now - dueDate |
| 負責人 | primaryAssignee |
| 所屬月度目標 | monthlyGoal.title |
| 延期歷史 | taskChanges where type=DELAY |
| 嚴重度分級 | <7天=黃, 7-14天=橙, >14天=紅 |

**視覺化**：
- 表格：依逾期天數降序排列，色彩標記嚴重度
- 歸因分析圓餅圖：逾期原因（scope change / resource shortage / dependency / underestimate）
- 趨勢：每月逾期任務數變化

**Cockpit 連結**：Cockpit 的「逾期任務 5」→ 點擊進入

---

#### R-PM-04: 里程碑達成率

**管理者問題**：「重要節點有按時完成嗎？哪些延後了？」

| 欄位 | 說明 |
|------|------|
| 里程碑清單 | Milestone with plannedEnd, actualEnd, status |
| 達成率 | completed on time / total milestones |
| 延遲天數 | actualEnd - plannedEnd（或 now - plannedEnd if not done） |
| 依賴影響 | 此里程碑延遲會影響哪些下游任務 |

**視覺化**：
- 時間軸：里程碑標記在月份軸上，完成=綠點、延遲=紅點、進行中=藍點
- 達成率甜甜圈圖
- 延遲排行：最嚴重的 Top 5 延遲里程碑

**資料來源**：
```
Milestone (title, plannedEnd, actualEnd, status, annualPlanId)
```

**Cockpit 連結**：Cockpit 的「里程碑時間軸」→ 點擊進入

---

### 3.3 KPI 報表（Performance Metrics）

#### R-KPI-01: KPI 達成率趨勢

**管理者問題**：「KPI 每個月的趨勢如何？年底能達標嗎？」

| 欄位 | 說明 |
|------|------|
| KPI 選擇器 | 可選單一 KPI 或「全部」 |
| 月度達成值 | KPIAchievement.value per month |
| 月度達成率 | actual / target per month |
| 趨勢線 | 12 月折線圖 |
| 預測線 | 基於前 N 月趨勢線性外推至年底 |
| 目標線 | 水平虛線=年度目標值 |

**視覺化**：
- 折線圖：每個 KPI 一條線，X=月份，Y=達成率
- 目標門檻：水平虛線
- 預測延伸：虛線延伸至 12 月（灰色區間=信賴區間）
- 紅黃綠區域：背景色標示達標/風險/落後區域

**資料來源**：
```
KPI (code, title, target)
KPIAchievement (kpiId, period, value)
KPIHistory (kpiId, month, value)
```

---

#### R-KPI-02: KPI 與任務投入相關性

**管理者問題**：「我們投入這麼多工時在某個 KPI 上，為什麼沒有進展？」

| 欄位 | 說明 |
|------|------|
| KPI 達成率 | achievementRate |
| 關聯任務工時 | sum(TimeEntry.hours) for tasks linked to KPI |
| 關聯任務完成率 | DONE tasks / total linked tasks |
| 效率指標 | KPI 達成增量 / 投入工時（每工時帶來多少達成率提升） |

**視覺化**：
- 散布圖：X=投入工時，Y=KPI 達成率，每個點=一個 KPI
- 理想線：斜率=「投入與成果等比」
- 偏離分析：高工時低達成（紅區）vs 低工時高達成（綠區）

**Cockpit 連結**：Cockpit KPI 健康看板中的「落後」KPI → 點擊進入此分析

---

#### R-KPI-03: 跨 KPI 綜合評分

**管理者問題**：「整體 KPI 表現如何？用一個數字告訴我。」

| 欄位 | 說明 |
|------|------|
| 加權平均達成率 | sum(achievementRate x weight) / sum(weight) |
| 各 KPI 貢獻度 | 權重 x 達成率 → 對總分的貢獻 |
| 月度綜合分趨勢 | 12 個月的加權分數折線 |
| 達標 KPI 數 | achievementRate >= 100% |
| 風險 KPI 數 | achievementRate < target 的 80% |

**視覺化**：
- 大數字卡片：「年度 KPI 綜合評分 78 分」
- 雷達圖：各 KPI 達成率分佈
- 貢獻度堆疊長條：每個 KPI 對總分的貢獻

---

### 3.4 工時報表（Time & Attendance）

#### R-TIME-01: 個人/團隊月工時摘要

**管理者問題**：「這個月大家的工時紀錄齊全嗎？總量合理嗎？」

| 欄位 | 說明 |
|------|------|
| 月份選擇 | 月曆選擇器 |
| 人員列表 | 每人 logged hours / available hours |
| 類別分佈 | PLANNED / INCIDENT / SUPPORT / ADMIN / LEARNING |
| 填報完整度 | 有填報的工作日 / 總工作日 x 100% |
| 異常標記 | 單日 > 12h、連續 3 天 > 10h、整週未填 |

**視覺化**：
- 表格：人員 x 日期 矩陣，格子顯示工時數+色彩（空=灰, 正常=綠, 過長=紅）
- 底部彙總：每人月總計 + 團隊月總計
- 填報率進度條

---

#### R-TIME-02: 加班分析

**管理者問題**：「誰在加班？哪個月最嚴重？加班的原因是什麼？」

| 欄位 | 說明 |
|------|------|
| 加班定義 | 每日 > 8h 的部分（可配置門檻） |
| 月度加班工時 | 每人月加班時數 |
| 加班類別 | 加班時段登錄的任務類別（計畫任務 vs 事件處理） |
| 趨勢 | 12 個月加班工時折線 |
| Top 加班人員 | 月/季加班最多的前 5 人 |

**視覺化**：
- 長條圖：月度加班工時（紅色），疊加正常工時（藍色）
- 人員排名：水平長條，依加班時數降序
- 原因分析：加班類別堆疊圖

---

#### R-TIME-03: 工時 vs 任務效率

**管理者問題**：「花了這麼多工時，產出合理嗎？」

| 欄位 | 說明 |
|------|------|
| 每任務平均工時 | total hours / completed tasks |
| 效率趨勢 | 月度每任務平均工時折線 |
| 按優先級分析 | HIGH / MEDIUM / LOW 任務的平均工時 |
| 按類別分析 | 不同類別任務的效率差異 |
| 估時準確度 | 實際工時 / 預估工時（若有 estimatedHours） |

**視覺化**：
- 折線圖：月度效率趨勢
- 箱形圖：每月任務工時分佈（看離群值）
- 散布圖：估時 vs 實際時間

---

### 3.5 稽核報表（Compliance）

#### R-AUD-01: 變更管理紀錄摘要

**管理者問題**：「稽核要看變更管理紀錄，我們有齊全的記錄嗎？」

| 欄位 | 說明 |
|------|------|
| 期間 | 可選日期範圍 |
| 變更類型 | DELAY（延期）、SCOPE_CHANGE（範疇變更）、PRIORITY_CHANGE |
| 變更次數 | 按月統計 |
| 變更審批 | 是否有記錄變更原因和核准者 |
| 影響評估 | 變更對里程碑/KPI 的影響 |

**資料來源**：
```
TaskChange (taskId, type, reason, changedBy, createdAt)
```

**匯出**：Excel 格式，含原始紀錄表 + 摘要表

---

#### R-AUD-02: 事件處理時效

**管理者問題**：「事件處理有在 SLA 內嗎？平均解決時間多長？」

| 欄位 | 說明 |
|------|------|
| 事件清單 | Task where category=INCIDENT |
| 回應時間 | createdAt → first status change |
| 解決時間 | createdAt → status=DONE |
| SLA 達標率 | 在 SLA 內解決的比例 |
| 按嚴重度分析 | HIGH / MEDIUM / LOW 事件的解決時間 |

**視覺化**：
- 表格：事件清單含回應/解決時間
- SLA 達標率甜甜圈圖
- 月度趨勢：平均解決時間折線

---

#### R-AUD-03: 權限異動紀錄

**管理者問題**：「誰的權限被改了？什麼時候？誰改的？」

| 欄位 | 說明 |
|------|------|
| 異動紀錄 | role change events from audit log |
| 異動人 | who made the change |
| 異動內容 | old role → new role |
| 時間戳 | when |

**備註**：此報表依賴 audit log 機制。如尚未實作 audit log，Phase 1 可先顯示「即將推出」。

---

## 四、報表中心 UI 設計

### 4.1 資訊架構

```
/reports
├── 側邊分類導航（左）
│   ├── [組織績效]
│   │   ├── 團隊產能利用率
│   │   ├── 計畫外趨勢
│   │   └── 工作量分佈
│   ├── [項目管理]
│   │   ├── Earned Value
│   │   ├── 完成速率
│   │   ├── 逾期分析
│   │   └── 里程碑達成
│   ├── [KPI]
│   │   ├── 達成率趨勢
│   │   ├── 投入相關性
│   │   └── 綜合評分
│   ├── [工時]
│   │   ├── 月工時摘要
│   │   ├── 加班分析
│   │   └── 工時效率
│   └── [稽核]
│       ├── 變更管理
│       ├── 事件時效
│       └── 權限異動
│
└── 報表內容區（右）
    ├── 報表標題 + 期間選擇器 + 匯出按鈕
    ├── 摘要卡片區（3-4 個大數字）
    ├── 圖表區
    └── 明細表格（可展開）
```

### 4.2 共用元件

| 元件 | 說明 |
|------|------|
| `ReportShell` | 報表外殼：標題、期間選擇、匯出按鈕、列印 |
| `MetricCard` | 大數字摘要卡片（數值、標籤、趨勢箭頭） |
| `PeriodPicker` | 月/季/年/自訂日期範圍選擇器 |
| `ExportMenu` | 匯出選單：PDF / Excel / CSV |
| `ReportChart` | ECharts 圖表包裝元件（lazy-load） |
| `DataTable` | 可排序、可篩選的明細表格 |
| `DrilldownLink` | 連結到其他報表或 Cockpit 的鑽取連結 |
| `TrendIndicator` | 上升/下降/持平趨勢指示器 |

### 4.3 匯出設計

所有報表支援三種匯出格式：

| 格式 | 內容 | 用途 |
|------|------|------|
| **PDF** | 圖表截圖 + 摘要表格 + 頁首(報表名稱/期間/產出時間) | 會議呈報、存檔 |
| **Excel** | 摘要工作表 + 明細工作表 + 圖表工作表 | 二次分析 |
| **CSV** | 原始明細資料 | 匯入其他系統 |

**匯出 API 設計**：
```
GET /api/reports/export?type={reportId}&format={pdf|xlsx|csv}&params=...
```

### 4.4 與 Cockpit 的雙向連結

| Cockpit 指標 | → 連結到 Report |
|-------------|----------------|
| 整體進度 65% | → R-PM-01 Earned Value |
| KPI 落後 2/12 | → R-KPI-01 達成率趨勢 |
| 逾期任務 5 | → R-PM-03 逾期分析 |
| 計畫內投入率 78% | → R-ORG-02 計畫外趨勢 |
| 里程碑 ◆ | → R-PM-04 里程碑達成率 |
| 月度目標 AT_RISK | → R-PM-01 + R-KPI-02 |

| Report 回鏈 | → 連結到 |
|-------------|---------|
| 報表頂部 breadcrumb | → Cockpit 對應 section |
| 逾期任務名稱 | → Task detail modal |
| KPI code | → KPI detail page |
| 人員名稱 | → 該人員的工時明細 |

---

## 五、API 設計

### 5.1 新增 API Endpoints

```
# 組織績效
GET /api/reports/v2/org/utilization?period={month|quarter|year}&date=2026-03
GET /api/reports/v2/org/unplanned-trend?year=2026
GET /api/reports/v2/org/workload-distribution?period=2026-03

# 項目管理
GET /api/reports/v2/project/earned-value?year=2026
GET /api/reports/v2/project/velocity?year=2026
GET /api/reports/v2/project/overdue-analysis
GET /api/reports/v2/project/milestone-achievement?year=2026

# KPI
GET /api/reports/v2/kpi/trend?year=2026&kpiId=all
GET /api/reports/v2/kpi/correlation?year=2026
GET /api/reports/v2/kpi/composite-score?year=2026

# 工時
GET /api/reports/v2/time/monthly-summary?month=2026-03
GET /api/reports/v2/time/overtime-analysis?year=2026
GET /api/reports/v2/time/efficiency?year=2026

# 稽核
GET /api/reports/v2/audit/change-management?from=2026-01-01&to=2026-03-31
GET /api/reports/v2/audit/incident-sla?from=2026-01-01&to=2026-03-31
GET /api/reports/v2/audit/permission-changes?from=2026-01-01&to=2026-03-31

# 匯出（統一入口）
GET /api/reports/v2/export?report={reportId}&format={pdf|xlsx|csv}&...params
```

### 5.2 Response 格式規範

所有 report API 回傳統一結構：

```typescript
interface ReportResponse<T> {
  ok: boolean;
  data: {
    reportId: string;           // e.g. "R-ORG-01"
    title: string;              // e.g. "團隊產能利用率"
    period: {
      type: "month" | "quarter" | "year" | "custom";
      start: string;            // ISO date
      end: string;              // ISO date
    };
    generatedAt: string;        // ISO datetime
    summary: Record<string, number | string>;  // 摘要指標
    data: T;                    // 報表特定資料
  };
  error?: string;
}
```

### 5.3 Earned Value API 詳細設計

```typescript
// GET /api/reports/v2/project/earned-value?year=2026

interface EarnedValueResponse {
  year: number;
  planTitle: string;

  // 整體指標
  spi: number;                  // Schedule Performance Index
  cpi: number;                  // Cost (hours) Performance Index
  estimatedCompletionMonth: number;  // 預估完成月份

  // 月度資料（S-curve 用）
  monthly: Array<{
    month: number;              // 1-12
    pv: number;                 // Planned Value (%)：此月應完成比例
    ev: number;                 // Earned Value (%)：此月實際完成比例
    ac: number;                 // Actual Cost (%)：此月工時消耗比例
    cumulativePV: number;
    cumulativeEV: number;
    cumulativeAC: number;
  }>;

  // 月度目標明細
  goals: Array<{
    month: number;
    title: string;
    plannedTasks: number;
    completedTasks: number;
    hoursSpent: number;
    healthStatus: "HEALTHY" | "AT_RISK" | "CRITICAL";
  }>;
}
```

---

## 六、6-Panel Expert Review（10 輪辯論，繁體中文）

### 議題 1：報表 v2 的範疇是否太大？

**Round 1 — PM（產品經理）**
15 個報表確實很多，但它們分成 5 個分類，每個分類 3 個報表。MVP 不需要全部做完。建議優先級：
- P0（必做）：R-PM-01 Earned Value、R-ORG-01 利用率、R-KPI-01 趨勢、R-PM-03 逾期分析
- P1（次要）：R-ORG-02 計畫外趨勢、R-TIME-01 月工時、R-AUD-01 變更管理
- P2（可延後）：其餘

**Round 2 — 前端工程師**
同意分 P0/P1/P2。關鍵是共用元件（ReportShell, MetricCard, PeriodPicker）要先做好。一旦共用元件完成，每個報表只是「資料+圖表」的組合，開發速度會很快。建議先花 2 天做共用元件。

**Round 3 — 後端工程師**
後端比較擔心 Earned Value 的計算。PV（計畫值）需要定義「每月應完成多少」——目前 MonthlyGoal 有 month 欄位但沒有「預計完成比例」。需要假設每個月度目標的任務應在該月底全部完成。

**Round 4 — UX 設計師**
建議報表中心用兩欄佈局（左導航+右內容），不要用現在的 tab 切換。Tab 在 8 個選項時已經很擁擠，15 個報表會完全崩潰。左側分類導航更易擴展。

**Round 5 — 資安顧問**
注意報表 API 的權限控制。並非所有報表都應讓所有人存取：
- R-TIME-02 加班分析：只有 MANAGER/ADMIN
- R-AUD-03 權限異動：只有 ADMIN
- R-KPI 系列：visibility=MANAGER 的 KPI 要過濾

**Round 6 — 維運工程師**
15 個 API endpoint 不是問題，但 Earned Value 的計算可能很重（需要撈所有 Task + TimeEntry 做聚合）。建議用 materialized view 或 nightly batch 預先計算月度摘要。

**共識：範疇合理但分階段實作。P0 = 4 個核心報表 + 共用元件框架。UI 改為左側分類導航。重計算報表加快取層。**

---

### 議題 2：Earned Value 在 TITAN 場景下是否可行？

**Round 1 — PM**
Earned Value 的前提是有「基線計畫」——即計畫初始時就定義了每月應完成的工作量。TITAN 的 MonthlyGoal 架構已經具備這個條件：每個月度目標有 tasks，我們可以用「task 的 dueDate 分佈」來計算 PV。

**Round 2 — 後端工程師**
具體計算方式：
- PV(月M)：dueDate <= M 月底的任務數 / 總任務數
- EV(月M)：月M底前 status=DONE 的任務數 / 總任務數
- AC(月M)：月M底前的累積工時 / 預估總工時

問題是「預估總工時」——如果任務沒有 estimatedHours，AC 就沒有意義。

**Round 3 — PM**
可以簡化：如果沒有 estimatedHours，CPI 指標就不顯示，只顯示 SPI。SPI 不需要工時資料，只需要「任務完成進度 vs 時間進度」。這對管理者已經足夠回答「計畫有沒有落後」。

**Round 4 — 前端工程師**
S-curve 用 ECharts 的 line chart 就能實現。需要注意的是月份軸要標示「過去」和「未來」的區別——過去的月份有實際資料，未來的月份只有 PV（計畫值）。

**Round 5 — UX 設計師**
建議用顏色區域：
- PV 和 EV 之間的區域：綠色（EV > PV，超前）或紅色（EV < PV，落後）
- 這種視覺化讓管理者一眼看出「從幾月開始落後的」

**Round 6 — 維運工程師**
月度 EV/PV 的計算只需要在月初跑一次就好，可以用 cron job 寫入 summary table。不需要每次 request 都即時計算。

**共識：Earned Value 可行。簡化版只用 SPI（進度指數），不強制要求 estimatedHours。PV 基於 dueDate 分佈，EV 基於完成狀態。月度預算計算用 batch job。**

---

### 議題 3：現有 v1 報表如何遷移？

**Round 1 — 前端工程師**
現有 8 個 tab 的內容可以映射到 v2：
- 週報 → 移除（改由 Cockpit 的 snapshot 取代）
- 月報 → R-PM-02 Velocity 的子集
- 工時分佈 → R-ORG-03 工作量分佈
- 完成率 → R-PM-02 Velocity
- KPI → R-KPI-01 趨勢
- 計畫外負荷 → R-ORG-02 計畫外趨勢
- 趨勢 → 分散到各報表的趨勢圖
- 稽核 → R-AUD-01 + R-AUD-02

**Round 2 — PM**
不建議直接刪掉 v1。保留 v1 的 URL（`/reports`）作為 redirect 到 `/reports/v2`，給用戶過渡期。

**Round 3 — 後端工程師**
現有 API（`/api/reports/weekly` 等）不需要立即刪除。v2 的 API 路徑是 `/api/reports/v2/...`，兩組可以並存。

**Round 4 — UX 設計師**
遷移期間在 v1 報表頁面頂部加一個 banner：「報表中心已升級 → 前往新版」。兩週後 auto-redirect。

**Round 5 — 資安顧問**
兩組 API 並存期間，新舊 API 都要有相同的權限控制。不要因為「舊 API 反正要淘汰」就放鬆。

**Round 6 — 維運工程師**
建議在 v1 API 加 deprecation header（`Deprecation: true`），讓前端可以偵測並顯示警告。

**共識：v1 → v2 漸進遷移。v2 API 用新路徑，v1 保留 2-4 週後 redirect。遷移期間雙 API 並存，權限一致。**

---

### 議題 4：圖表庫選擇

**Round 1 — 前端工程師**
目前 reports v1 已經在用 ECharts（lazy-load）。v2 有更複雜的圖表需求：
- S-curve（Earned Value）→ ECharts line chart
- 熱力圖（utilization）→ ECharts heatmap
- 箱形圖（cycle time）→ ECharts boxplot
- 雷達圖（KPI 綜合）→ ECharts radar
- 散布圖（correlation）→ ECharts scatter

ECharts 全部支援，不需要換庫。

**Round 2 — PM**
ECharts 的匯出圖片功能對 PDF 匯出很重要。ECharts 內建 `getDataURL()` 可以拿到 chart image。

**Round 3 — UX 設計師**
ECharts 的互動性夠用：tooltip、zoom、legend toggle。但建議統一圖表風格：
- 色彩：用 TITAN 的 design token（primary, success, warning, danger）
- 字型：tabular-nums 確保數字對齊
- 暗色模式：ECharts 支援 dark theme

**Round 4 — 後端工程師**
PDF 匯出如果要在後端做（server-side rendering），ECharts 不好用。建議 PDF 匯出走前端路線：前端用 html2canvas + jsPDF 或 puppeteer。

**Round 5 — 維運工程師**
ECharts 的 bundle size 是個問題。目前已經用 lazy-load 緩解了。建議 v2 用 tree-shaking 只載入需要的圖表類型。

**Round 6 — 資安顧問**
圖表資料不應包含敏感欄位。API 回傳給前端的資料已經是聚合後的，不含 PII。但 PDF 匯出時要注意：如果 PDF 含有「人員加班排行」，要確保只有 MANAGER 能產出。

**共識：繼續用 ECharts，不換庫。統一圖表 theme 對齊 design token。PDF 匯出走前端 html2canvas + jsPDF。注意 tree-shaking 和權限。**

---

### 議題 5：定期排程報表（Scheduled Reports）是否納入 MVP？

**Round 1 — PM**
Scheduled Reports 指的是：每週一早上自動寄送上週報表 PDF 到主管信箱。這對忙碌的銀行主管非常有價值，但不是 MVP 必要。

**Round 2 — 後端工程師**
實作需要：
- PDF server-side generation（puppeteer headless）
- 排程系統（cron job 或 Vercel cron）
- Email/Discord/Telegram 發送機制
- 用戶訂閱設定 UI

這是一個完整的子系統，不適合塞進 MVP。

**Round 3 — 前端工程師**
同意不進 MVP。但可以在 v2 的匯出選單旁邊放一個「訂閱」按鈕（disabled），hover 顯示「即將推出」，為 Phase 2 預留入口。

**Round 4 — UX 設計師**
Scheduled Reports 的最大價值是「被動接收」——主管不需要登入系統。如果不做排程，至少做一個「快速分享」功能：生成報表的 snapshot URL，可以貼到 Line/Telegram/Email。

**Round 5 — 維運工程師**
Puppeteer headless 在 Vercel serverless 上有 RAM 限制。如果要做 server-side PDF，可能需要獨立的 worker process。

**Round 6 — 資安顧問**
自動寄送報表到外部信箱要小心。報表可能含有敏感的績效資料。建議：
1. 只寄到組織域名（@bank.com）
2. 或者只寄「連結」不寄「附件」，連結需要登入才能看

**共識：Scheduled Reports 不進 MVP，排入 Phase 2。MVP 做好匯出功能（PDF/Excel/CSV）即可。Phase 2 可先做「快速分享 URL」再做完整排程。**

---

### 議題 6：報表效能與快取策略

**Round 1 — 後端工程師**
報表的資料量比 Cockpit 大得多。以 Earned Value 為例：
- 需要撈整年的 Task（可能 120-200 筆）
- 每筆 Task 的 TimeEntry（可能 600-1000 筆）
- 每筆 Task 的 KPITaskLink
- 然後做聚合計算

無快取的情況下，response time 估計 2-5 秒。

**Round 2 — 前端工程師**
2-5 秒對報表是可以接受的（不像 Cockpit 要求 < 1 秒）。使用者的心理預期是「報表需要一點時間產生」。加上 skeleton loading 就行。

**Round 3 — 後端工程師**
建議三層快取：
1. **月度摘要表（Materialized）**：每日凌晨跑 batch job，計算每月每人的工時摘要、任務完成摘要。寫入 `ReportMonthlySummary` table。
2. **API 層 cache**：HTTP Cache-Control: stale-while-revalidate 300s（5 分鐘）。
3. **CDN 層**：如果用 Vercel，Edge Cache 自動處理。

**Round 4 — PM**
月度摘要表的想法很好。銀行 IT 的資料不會每分鐘都在變，日結就夠了。但要提供「手動重新計算」按鈕給管理者。

**Round 5 — 維運工程師**
Batch job 用 Vercel Cron（`vercel.json` 裡設定）即可。每日 00:30 跑。如果失敗要有 alert 通知。

**Round 6 — 資安顧問**
月度摘要表是預聚合的資料，權限模型要在此時就考慮。不要聚合出「包含 MANAGER_ONLY KPI」的摘要，然後前端忘記過濾。建議摘要表不含敏感 KPI，敏感部分即時查詢。

**共識：三層快取策略——月度摘要表（batch job）+ API 層 stale-while-revalidate + CDN。報表 2-5 秒載入可接受。敏感資料不進預聚合表。**

---

### 議題 7：v1 的 8 個 Tab 太多 → v2 的 15 個報表更多，怎麼辦？

**Round 1 — UX 設計師**
這是核心 UX 問題。解法：分類導航 + 情境入口。

**分類導航**：左側 5 個分類展開 15 個報表，但用戶不需要逐一瀏覽。大部分時候他們是從 Cockpit drill-down 進來的，直接到達目標報表。

**情境入口**：報表中心首頁不是空的，而是一個「推薦報表」面板：
- 「你關注的」：最近看過的 3 個報表
- 「需要注意」：有異常指標的報表（自動推薦）
- 「本月必看」：根據日期自動推薦（月初→上月摘要、月底→進度檢視）

**Round 2 — PM**
好主意。報表中心首頁 = 智慧推薦 + 分類入口。不是「列出所有報表讓你選」，而是「告訴你現在該看什麼」。

**Round 3 — 前端工程師**
實作上，報表中心首頁需要一個 `/api/reports/v2/recommendations` API，回傳推薦的 report IDs + 推薦原因。

**Round 4 — 後端工程師**
推薦邏輯可以很簡單：
1. 最近 7 天有逾期任務增加 → 推薦 R-PM-03
2. 當月 KPI 達成率下降 → 推薦 R-KPI-01
3. 計畫外比例 > 30% → 推薦 R-ORG-02
4. 加班工時異常 → 推薦 R-TIME-02
5. 沒有明顯異常 → 推薦 R-PM-01 + R-KPI-03

**Round 5 — 維運工程師**
推薦邏輯要可測試和可調整。建議用 config 而非寫死在 code 裡。

**Round 6 — 資安顧問**
推薦引擎不應推薦用戶無權限存取的報表。先過濾權限再排序。

**共識：報表中心首頁 = 智慧推薦面板 + 分類導航。推薦邏輯基於異常指標自動判斷。權限先行過濾。**

---

### 議題 8：PDF 匯出的品質和格式

**Round 1 — PM**
銀行主管會把 PDF 列印出來帶去開會。品質要求：
- A4 landscape
- 頁首：TITAN logo + 報表名稱 + 期間 + 產出時間
- 頁尾：頁碼
- 圖表要清晰（不能模糊）
- 表格不能截斷（分頁處理）

**Round 2 — 前端工程師**
用 `@media print` CSS 搭配 html2canvas 可以做到。但 html2canvas 在複雜圖表上可能有問題。替代方案：
- 方案 A：前端 html2canvas + jsPDF（簡單但品質一般）
- 方案 B：前端用 ECharts `getDataURL()` 取圖片，組合進 jsPDF（較好控制）
- 方案 C：Server-side Puppeteer render（品質最好但成本高）

**Round 3 — UX 設計師**
建議方案 B + 自訂 PDF template。每份報表有專用的 PDF 佈局，不是直接截圖網頁。

**Round 4 — 後端工程師**
方案 B 最合理。流程：
1. 前端請求 report data
2. ECharts render → `getDataURL()` → base64 image
3. jsPDF 建立 PDF，嵌入圖片 + 表格
4. 下載

不需要後端參與。

**Round 5 — 維運工程師**
同意前端方案。避免 Puppeteer 在 serverless 上的坑。

**Round 6 — 資安顧問**
PDF 檔案名稱不要包含敏感資訊。例如「TITAN-KPI-報表-2026-03.pdf」可以，但「張三-加班分析-2026-03.pdf」不行。用報表名+期間就好。

**共識：PDF 匯出用前端方案（ECharts getDataURL + jsPDF）。自訂 PDF template，A4 landscape，含頁首頁尾。檔名不含人名等敏感資訊。**

---

### 議題 9：報表權限模型

**Round 1 — 資安顧問**
報表包含大量組織敏感資料。權限設計：

| 角色 | 可存取報表 |
|------|-----------|
| ADMIN | 全部 15 個報表 |
| MANAGER | 全部，但受 KPI visibility 過濾 |
| TEAM_LEAD | 組織績效（本團隊）、項目管理、工時（本團隊） |
| MEMBER | 僅個人工時摘要 |

**Round 2 — PM**
MEMBER 看到的不是「報表」——他們看到的是「我的工時紀錄」，這在別的頁面就有了。報表中心本質上是 MANAGER+ 的功能。

**Round 3 — 前端工程師**
同意。導航列中「報表」只對 MANAGER+ 顯示。MEMBER 的側邊欄不出現這個入口。

**Round 4 — 後端工程師**
API 層的權限檢查：
```typescript
if (role === "MEMBER") return Response.json({ error: "Unauthorized" }, { status: 403 });
if (role === "TEAM_LEAD") filterByTeam(data, userTeamId);
// MANAGER/ADMIN: full access (with KPI visibility filter for MANAGER)
```

**Round 5 — 維運工程師**
加 audit log：誰在什麼時間存取了什麼報表。稽核報表本身的存取也需要被記錄。

**Round 6 — UX 設計師**
如果某個報表因權限被隱藏，左側導航裡不要顯示一個 disabled 的項目——直接不顯示。避免「看得到但點不了」的挫折感。

**共識：報表中心 = MANAGER+ 功能。MEMBER 不看到入口。TEAM_LEAD 限本團隊資料。所有存取記錄 audit log。**

---

### 議題 10：MVP 實作排程和工時估算

**Round 1 — PM**
MVP（Phase 1）scope：
- 共用元件框架（ReportShell, MetricCard, PeriodPicker, ExportMenu）
- P0 報表 x 4（R-PM-01, R-ORG-01, R-KPI-01, R-PM-03）
- 新 UI（左導航 + 報表內容區）
- PDF + Excel 匯出
- Cockpit 雙向連結
- 權限控制

**Round 2 — 前端工程師**
工時估算：
| 項目 | 估算 |
|------|------|
| 共用元件（ReportShell, MetricCard, PeriodPicker, ExportMenu, DataTable） | 12h |
| 左導航 + 報表首頁（推薦面板） | 6h |
| R-PM-01 Earned Value（含 S-curve chart） | 10h |
| R-ORG-01 利用率（含 heatmap） | 8h |
| R-KPI-01 趨勢（含 line chart + projection） | 8h |
| R-PM-03 逾期分析（表格 + 歸因圖） | 6h |
| PDF 匯出框架 | 8h |
| Excel 匯出框架 | 4h |
| 合計 | **62h** |

**Round 3 — 後端工程師**
後端估算：
| 項目 | 估算 |
|------|------|
| /api/reports/v2/project/earned-value | 8h |
| /api/reports/v2/org/utilization | 6h |
| /api/reports/v2/kpi/trend | 6h |
| /api/reports/v2/project/overdue-analysis | 4h |
| /api/reports/v2/recommendations | 4h |
| /api/reports/v2/export（統一匯出入口） | 4h |
| 月度摘要 batch job | 6h |
| 權限 middleware | 4h |
| 合計 | **42h** |

**Round 4 — UX 設計師**
建議工時再多估 20% buffer。報表的細節調整（圖表樣式、數字格式、responsive）比預期花更多時間。

**Round 5 — 維運工程師**
加上 monitoring：
| 項目 | 估算 |
|------|------|
| Batch job monitoring + alert | 4h |
| API response time tracking | 2h |
| 合計 | **6h** |

**Round 6 — 資安顧問**
加上安全測試：
| 項目 | 估算 |
|------|------|
| 權限 bypass 測試 | 4h |
| Audit log 驗證 | 2h |
| 合計 | **6h** |

**共識：**

**Phase 1 (MVP) 總估算：~116h（含 20% buffer ≈ ~140h）**

| Phase | 內容 | 估算 |
|-------|------|------|
| Phase 1 (MVP) | 4 個 P0 報表 + 共用框架 + 匯出 + 權限 | ~140h |
| Phase 2 | 7 個 P1 報表 + Scheduled Reports + 快速分享 | ~120h |
| Phase 3 | 4 個 P2 報表 + Pivot 自助分析 + AI 異常偵測 | ~100h |

---

## 七、技術決策記錄

| 決策 | 選擇 | 理由 | 替代方案 |
|------|------|------|---------|
| UI 佈局 | 左側分類導航 + 右側內容 | Tab 不適合 15+ 個報表 | Tab（v1 已證明不行） |
| 圖表庫 | ECharts（延續 v1） | 功能完整、已有經驗、支援匯出圖片 | Chart.js（功能不足）、D3（學習曲線） |
| PDF 匯出 | 前端 jsPDF + ECharts getDataURL | 不需要 Puppeteer，前端可控 | Puppeteer（serverless 限制） |
| Excel 匯出 | 前端 xlsx-js-style（延續 v1） | 已有 excel-export.ts 基礎 | Server-side ExcelJS |
| API 版本 | `/api/reports/v2/...` | 與 v1 並存、漸進遷移 | 直接覆蓋 v1（風險高） |
| 快取 | 月度摘要表 + HTTP stale-while-revalidate | 報表資料不需要即時 | Redis（目前不需要） |
| 權限 | API middleware role check | 簡單有效 | Row-level security（過度工程） |
| Cockpit 連結 | URL query params drill-down | 簡單可靠 | 共享 state（複雜度高） |

---

## 八、v1 → v2 遷移對照

| v1 Tab | v2 報表 | 遷移方式 |
|--------|---------|---------|
| 週報 | 移除（Cockpit 取代） | Cockpit 的即時快照 |
| 月報 | R-PM-02 Velocity | 月度任務統計 → Velocity |
| 工時分佈 | R-ORG-03 工作量分佈 | 增加利用率維度 |
| 完成率 | R-PM-02 Velocity | 合併 |
| KPI 報表 | R-KPI-01 趨勢 + R-KPI-03 綜合 | 大幅增強 |
| 計畫外負荷 | R-ORG-02 計畫外趨勢 | 增加年度對比 |
| 趨勢分析 | 分散到各報表 | 每個報表自帶趨勢圖 |
| 稽核報表 | R-AUD-01 + R-AUD-02 | 拆分+強化 |

---

## 九、前端元件結構

```
app/(app)/reports/
├── page.tsx                     # 報表中心首頁（推薦面板）
├── layout.tsx                   # 左側導航 + 右側內容 layout
├── org/
│   ├── utilization/page.tsx     # R-ORG-01
│   ├── unplanned-trend/page.tsx # R-ORG-02
│   └── workload/page.tsx        # R-ORG-03
├── project/
│   ├── earned-value/page.tsx    # R-PM-01
│   ├── velocity/page.tsx        # R-PM-02
│   ├── overdue/page.tsx         # R-PM-03
│   └── milestones/page.tsx      # R-PM-04
├── kpi/
│   ├── trend/page.tsx           # R-KPI-01
│   ├── correlation/page.tsx     # R-KPI-02
│   └── composite/page.tsx       # R-KPI-03
├── time/
│   ├── monthly/page.tsx         # R-TIME-01
│   ├── overtime/page.tsx        # R-TIME-02
│   └── efficiency/page.tsx      # R-TIME-03
└── audit/
    ├── changes/page.tsx         # R-AUD-01
    ├── incident-sla/page.tsx    # R-AUD-02
    └── permissions/page.tsx     # R-AUD-03

app/components/reports/
├── report-shell.tsx             # 報表外殼
├── report-nav.tsx               # 左側分類導航
├── metric-card.tsx              # 摘要數字卡
├── period-picker.tsx            # 期間選擇器
├── export-menu.tsx              # 匯出選單
├── report-chart.tsx             # ECharts 包裝
├── data-table.tsx               # 明細表格
├── trend-indicator.tsx          # 趨勢指示器
├── drilldown-link.tsx           # 鑽取連結
└── report-recommendations.tsx   # 首頁推薦面板

app/api/reports/v2/
├── org/
│   ├── utilization/route.ts
│   ├── unplanned-trend/route.ts
│   └── workload-distribution/route.ts
├── project/
│   ├── earned-value/route.ts
│   ├── velocity/route.ts
│   ├── overdue-analysis/route.ts
│   └── milestone-achievement/route.ts
├── kpi/
│   ├── trend/route.ts
│   ├── correlation/route.ts
│   └── composite-score/route.ts
├── time/
│   ├── monthly-summary/route.ts
│   ├── overtime-analysis/route.ts
│   └── efficiency/route.ts
├── audit/
│   ├── change-management/route.ts
│   ├── incident-sla/route.ts
│   └── permission-changes/route.ts
├── recommendations/route.ts
└── export/route.ts
```

---

## 十、Phase 1 MVP 實作優先序

```
Week 1: 基礎建設
├── 共用元件（ReportShell, MetricCard, PeriodPicker, ExportMenu）
├── 左導航 Layout
├── 報表首頁（推薦面板 — 可用 static 版先上）
└── 權限 middleware

Week 2: P0 報表後端
├── /api/reports/v2/project/earned-value
├── /api/reports/v2/org/utilization
├── /api/reports/v2/kpi/trend
├── /api/reports/v2/project/overdue-analysis
└── 月度摘要 batch job

Week 3: P0 報表前端
├── R-PM-01 Earned Value page（S-curve）
├── R-ORG-01 Utilization page（heatmap）
├── R-KPI-01 Trend page（line chart）
├── R-PM-03 Overdue page（table + charts）
└── DataTable 共用元件

Week 4: 匯出 + 整合
├── PDF 匯出框架（jsPDF + ECharts getDataURL）
├── Excel 匯出（xlsx-js-style）
├── Cockpit → Reports 連結
├── Reports → Cockpit 回鏈
├── v1 deprecation banner
└── 權限測試 + E2E

Week 5: Buffer + QA
├── 響應式調整
├── 圖表細節（tooltip, legend, color）
├── 效能優化（API response time < 3s）
└── 安全測試
```

---

## 附錄 A：報表 ID 對照表

| ID | 分類 | 名稱 | Priority |
|----|------|------|----------|
| R-ORG-01 | 組織績效 | 團隊產能利用率 | P0 |
| R-ORG-02 | 組織績效 | 計畫外工作佔比趨勢 | P1 |
| R-ORG-03 | 組織績效 | 人員工作量分佈 | P1 |
| R-PM-01 | 項目管理 | 年度計畫 Earned Value | P0 |
| R-PM-02 | 項目管理 | 任務完成速率 | P1 |
| R-PM-03 | 項目管理 | 逾期任務分析 | P0 |
| R-PM-04 | 項目管理 | 里程碑達成率 | P1 |
| R-KPI-01 | KPI | 達成率趨勢 | P0 |
| R-KPI-02 | KPI | 任務投入相關性 | P1 |
| R-KPI-03 | KPI | 跨 KPI 綜合評分 | P2 |
| R-TIME-01 | 工時 | 月工時摘要 | P1 |
| R-TIME-02 | 工時 | 加班分析 | P2 |
| R-TIME-03 | 工時 | 工時效率 | P2 |
| R-AUD-01 | 稽核 | 變更管理紀錄 | P1 |
| R-AUD-02 | 稽核 | 事件處理時效 | P2 |
| R-AUD-03 | 稽核 | 權限異動紀錄 | P2 |

---

## 附錄 B：名詞對照

| 英文 | 中文 | TITAN 對應 |
|------|------|-----------|
| Earned Value | 實獲值分析 | R-PM-01 |
| SPI | 進度績效指數 | EV / PV |
| CPI | 成本績效指數 | EV / AC（工時制） |
| Utilization Rate | 產能利用率 | logged hours / available hours |
| Velocity | 完成速率 | tasks completed per period |
| Throughput | 產出量 | 同 velocity |
| Cycle Time | 週期時間 | task create → complete |
| Scope Creep | 範疇蔓延 | 新增任務 vs 原計畫 |
| Heatmap | 熱力圖 | 人員 x 月份利用率 |
| S-curve | S 曲線 | PV / EV / AC 累積曲線 |
| Drill-down | 鑽取 | 從摘要到明細 |
| Scheduled Report | 排程報表 | 定期自動寄送 |
