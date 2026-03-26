# TITAN v2.0 精煉實施藍圖 — 六人專家小組 10 輪深度細化

> **版本**: 1.0
> **日期**: 2026-03-27
> **定位**: THE definitive implementation blueprint — 從願景到元件層級的完整交付規格
> **輸入文件**: titan-product-vision-v2.md, timesheet-v3-design.md, management-cockpit-design.md, knowledge-v2-design.md, reports-v2-design.md, design-thinking-report.md, product-requirements.md
> **產出方式**: 6 位專家 × 10 輪辯論 = 60 個具體決策

---

## 專家小組

| # | 角色 | 姓名 | 職責 |
|---|------|------|------|
| 1 | 管理學教授 | 王教授 | 驗證 MBO/OKR/BSC 應用正確性 |
| 2 | UX 設計總監 | 張總監 | 驗證互動流程、點擊數、視覺層級 |
| 3 | 銀行 IT 主管（真實使用者） | 陳經理 | 驗證日常實務可用性 |
| 4 | 資深全端工程師 | 林工程師 | 驗證技術可行性與 codebase 相容 |
| 5 | 行為心理學家 | 黃博士 | 驗證採用策略與習慣養成 |
| 6 | 產品策略顧問 | 李顧問 | 驗證產品一致性與競爭定位 |

---

# Round 1：My Day 體驗細化

## 1.1 1920×1080 首屏精確佈局

**張總監（UX）**：首屏（above the fold = 垂直 900px 可視區域，扣除瀏覽器 UI 約 80px + TITAN topbar 56px = 可用高度 764px）必須包含使用者最需要的資訊。

### 工程師視角（林志偉 08:35 打開 TITAN）

```
┌─────────────────────────────────────────────────────────────────┐
│ [Topbar 56px]  TITAN logo  🔍Ctrl+K   🔔3   ⏱ 未計時   👤志偉  │
├─────────────────────────────────────────────────────────────────┤
│ [全局警示條 48px — 有事才顯示，無事隱藏]                          │
│  🔴 資安事件 SEC-001 通報期限倒數 1h 42m  [查看]                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [左欄 — 今日待辦 width:65%]     [右欄 — 側邊資訊 width:35%]     │
│                                                                 │
│  ┌─ 🔴 緊急任務 ────────────┐   ┌─ 今日工時摘要 ──────────┐     │
│  │ 🔥 核心系統 Patch        │   │ 已記錄：0.0h / 8.0h    │     │
│  │    陳經理：「金管會下週」  │   │ ░░░░░░░░░░░░░ 0%      │     │
│  │    [▶開始] [✓完成]       │   │ ⚠ 尚未記錄任何工時      │     │
│  └──────────────────────────┘   └─────────────────────────┘     │
│                                                                 │
│  ┌─ 🟡 今日到期 ────────────┐   ┌─ 快速行動 ──────────────┐     │
│  │ LDAP 整合測試            │   │ [+ 新任務] [🚨回報事件] │     │
│  │   到期：今天 18:00       │   │ [⏱ 開始計時] [📝筆記]  │     │
│  │   [▶開始] [✓完成]       │   └─────────────────────────┘     │
│  └──────────────────────────┘                                   │
│                                                                 │
│  ┌─ ⚪ 進行中 ──────────────┐   ┌─ 本月目標進度 ──────────┐     │
│  │ 前端 LCP 優化  ⏱ 01:23  │   │ Oracle 19c 升級 ████░ 70%│    │
│  │ Docker 設定              │   │ 資安稽核準備   ██░░░ 30% │    │
│  │ 監控系統升級評估          │   └─────────────────────────┘     │
│  └──────────────────────────┘                                   │
│                                                                 │
│  [Below fold: 明日預覽、本週完成摘要、通知列表]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 資料載入順序（感知效能最佳化）

**林工程師（技術）**：採用 Streaming SSR + 分層載入。

| 順序 | 資料 | API | 目標時間 | 呈現方式 |
|------|------|-----|---------|---------|
| 1 | 全局警示 | `GET /api/alerts/active` | < 100ms | Server-side render，HTML 直出 |
| 2 | 今日待辦列表 | `GET /api/tasks/my-day` | < 200ms | Suspense boundary，skeleton → 實體 |
| 3 | 今日工時摘要 | `GET /api/time-entries/daily-summary?date=today` | < 200ms | 右欄 skeleton → 數字 |
| 4 | 本月目標進度 | `GET /api/cockpit/my-goals` | < 500ms | 右欄下方，lazy load |
| 5 | 明日預覽 | `GET /api/tasks/my-day?date=tomorrow` | < 500ms | Below fold，不阻塞首屏 |

**黃博士（行為心理學）**：首屏必須在 1 秒內出現有意義的內容。第一個有意義的內容 = 「今天最重要的那件事」。因此緊急任務區塊必須是第一個渲染的元素。

### 林志偉 08:35 具體看到什麼

**陳經理（銀行 IT 主管）**：以場景還原。

1. **08:35 開啟 TITAN**（瀏覽器書籤 → `https://titan.internal/`）
2. **0.5 秒**：topbar + skeleton 出現
3. **1.0 秒**：左欄今日待辦載入完成
   - 🔴 緊急區：空（今天沒有管理者 flag 的任務）
   - 🟡 到期區：「LDAP 整合測試」（今天到期）
   - ⚪ 進行中區：「前端 LCP 優化」（昨天開始，計時器暫停中）、「監控系統升級評估」（昨天從 TODO 拖到 IN_PROGRESS）
4. **1.2 秒**：右欄載入
   - 工時摘要：已記錄 0.0h / 8.0h（黃色提醒條 ⚠「尚未記錄」）
   - 快速行動：四個按鈕
5. **1.5 秒**：本月目標進度載入（兩個月度目標進度條）
6. **志偉的動作**：看一眼左欄 → 知道今天要做什麼 → 點「前端 LCP 優化」的「▶繼續」按鈕 → 計時器自動恢復 → 開始工作

**操作時間**：3 秒（瀏覽 + 一次點擊）

### 管理者視角（陳經理 08:30 打開 TITAN）

**張總監（UX）**：MANAGER 首頁是雙 Tab 佈局，預設顯示「團隊全局」。

```
┌─────────────────────────────────────────────────────────────────┐
│ [Topbar 56px]  TITAN logo  🔍Ctrl+K   🔔5   ⏱ 未計時   👤陳經理│
├─────────────────────────────────────────────────────────────────┤
│ [全局警示條 48px]                                                │
│  🔴 3月目標「資安稽核準備」進度 30%，月份已過 87%  [展開]          │
│  🟡 KPI-03 系統可用性連續 2 月未達標  [查看]                      │
├─────────────────────────────────────────────────────────────────┤
│  [📊 團隊全局]  [📋 我的工作]                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 年度計畫摘要 ───────────────────────────────────────┐       │
│  │ 2026 年度計畫   進度 █████████░░░ 65%                │       │
│  │ ✅ 任務完成 85/120  ⏰ 逾期 5   🔴 KPI落後 2/12     │       │
│  │ ⏱ 累計工時 1,250h   📈 計畫內投入率 78%              │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─ 待處理事項（紅色徽章） ─────────────────────────────┐       │
│  │ 🔴 待驗收 3 項   🟡 待核准 1 項   ⏰ 逾期 5 項       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─ 月度目標追蹤 ──────────────────────────────────────┐       │
│  │ 1月 ██████████ 100%  2月 ████████░░ 80%             │       │
│  │ 3月 ████░░░░░░ 30% ⚠   4月~ 灰色未開始              │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**陳經理 08:30 的操作路徑**：
1. 看全局警示條 → 知道 3 月目標危險 + KPI-03 有問題（0 秒，自動出現）
2. 看年度摘要 → 65% 進度，5 個逾期任務（0 秒，首屏已有）
3. 看待處理事項 → 3 個待驗收（1 click 展開清單）
4. 點 3 月目標進度條 → 展開月度目標詳情（1 click）
5. 看到逾期的 2 項任務 → 點任務名稱開啟詳情 Modal（1 click）
6. 總操作：3 clicks，約 15 秒，完成全局狀況掌握

**王教授（管理學）**：這完美符合 Drucker 的「管理者的時間」原則——管理者不應花時間在資訊蒐集上，應花在決策上。Cockpit 首屏把資訊蒐集壓縮到 0 秒。

### 共識

| 決策 | 具體規格 |
|------|---------|
| My Day 首屏高度 | 764px 可用（56px topbar + 48px 警示條 + 660px 內容） |
| 首次有意義內容 | < 1 秒（緊急任務區塊） |
| 完整首屏載入 | < 2 秒 |
| 左右欄比例 | 65% : 35% |
| 任務排序邏輯 | managerFlagged > P0 > dueDate=today > IN_PROGRESS > TODO（按 dueDate ASC） |
| 右欄內容 | 工時摘要 + 快速行動 + 本月目標（固定順序） |
| MANAGER 預設 Tab | 「團隊全局」 |
| ENGINEER Tab | 只有「我的工作」（無 Tab header） |
| 全局警示條 | 跨角色顯示，P0/P1 事件 + SLA 倒數 + 月度目標 CRITICAL |

---

# Round 2：Big Picture（管理駕駛艙）體驗細化

## 2.1 Cockpit 完整 wireframe 描述

**張總監（UX）**：Cockpit 佈局基於 BSC 四象限概念，但 UI 語言用使用者熟悉的中文詞彙，不出現任何管理框架術語。

### Desktop 1920×1080 完整佈局

```
┌─────────────────────────────────────────────────────────────────┐
│ [全局警示條 — 自動產生，CRITICAL 紅底/WARNING 黃底]                │
├─────────────────────────────────────────────────────────────────┤
│ [📊 團隊全局]  [📋 我的工作]       [切換年度 ◄ 2026 ►] [列印]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Section A：年度計畫摘要（高 120px）──────────────────────────┐│
│ │ 年度方針：「確保核心系統穩定，完成三大升級專案」                  ││
│ │ ██████████████░░░░░░ 65%   任務 85/120   逾期 5   KPI落後 2  ││
│ │ 累計工時 1,250h   計畫內投入率 78%   團隊 5 人                  ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Section B：待處理事項（高 80px，可收合）─────────────────────┐│
│ │ 🔴 待驗收 3   🟡 待核准 1   ⏰ 逾期任務 5   [全部展開]        ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Section C：月度目標追蹤（高 240px）─────────────────────────┐│
│ │ [1月 ██ 100% 🟢] [2月 ██ 80% 🟢] [3月 ██ 30% 🔴]           ││
│ │ [4月 ░░ 0%]      [5月 ░░ 0%]     [6月 ░░ 0%] ...           ││
│ │                                                               ││
│ │ ▼ 3月 展開 — 資安稽核準備                                     ││
│ │ ┌──────────────────────────────────────────────────────────┐ ││
│ │ │ 任務進度 ████░░ 4/12     KPI關聯 KPI-03: 92%/99.9% 🔴  │ ││
│ │ │ 工時投入 45h/120h        逾期 2 項 [查看]                 │ ││
│ │ │ ─── 迷你甘特 ────────────────────────────────────────── │ ││
│ │ │ [Task A ████████░░] [Task B ░░████░░] [Task C ████ 🔴]  │ ││
│ │ └──────────────────────────────────────────────────────────┘ ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Section D：KPI 健康看板（高 160px）─────────────────────────┐│
│ │ KPI-01 服務可用性  ██████████ 99.5%  🟢   [趨勢]             ││
│ │ KPI-02 客訴件數    ████░░░░░░  4/10  🟡   [趨勢]             ││
│ │ KPI-03 系統可用性  ██░░░░░░░░  92%   🔴   [趨勢]             ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─ Section E：里程碑時間軸（高 80px）──────────────────────────┐│
│ │ Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec   ││
│ │       ◆        ◆                   ◆                   ◆     ││
│ │     v1.0    稽核日              上線日              年度結算   ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2.2 計畫健康燈號精確計算公式

**王教授（管理學）**：健康燈號必須同時考慮「時間消耗」和「進度達成」的比值，這是 Earned Value 管理的核心思想。

**林工程師（技術）**：以下為實作公式，已包含所有邊界條件。

```typescript
type HealthStatus = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

interface GoalHealthInput {
  goalMonth: number;        // 月度目標所屬月份（1-12）
  progressPct: number;      // 月度目標進度百分比（0-100）
  taskStats: {
    total: number;          // 總任務數
    done: number;           // 已完成任務數
    overdue: number;        // 逾期任務數（dueDate < now AND status != DONE）
  };
  kpiStats: {
    linkedCount: number;    // 關聯 KPI 數量
    avgAchievement: number; // 平均達成率（0-100）
    behindCount: number;    // 落後（achievementRate < target*80%）的 KPI 數
  };
  currentDate: Date;
}

function calculateGoalHealth(input: GoalHealthInput): HealthStatus {
  const { goalMonth, progressPct, taskStats, kpiStats, currentDate } = input;

  // 計算時間消耗率：該月度目標已消耗的時間比例
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentDay = currentDate.getDate();
  const daysInGoalMonth = new Date(currentDate.getFullYear(), goalMonth, 0).getDate();

  let timeElapsedPct: number;
  if (currentMonth > goalMonth) {
    timeElapsedPct = 100; // 月份已過
  } else if (currentMonth === goalMonth) {
    timeElapsedPct = (currentDay / daysInGoalMonth) * 100;
  } else {
    timeElapsedPct = 0; // 尚未到達
  }

  // 未來月份一律 HEALTHY（尚無數據）
  if (timeElapsedPct === 0) return 'HEALTHY';

  // === CRITICAL 條件（任一觸發即為紅燈） ===

  // C1: 逾期任務超過總任務的 30%
  if (taskStats.total > 0 && taskStats.overdue > taskStats.total * 0.3) {
    return 'CRITICAL';
  }

  // C2: 有 KPI 落後且時間已過 75%
  if (kpiStats.behindCount > 0 && timeElapsedPct > 75) {
    return 'CRITICAL';
  }

  // C3: 進度不到時間消耗的 50%（嚴重落後）
  if (progressPct < timeElapsedPct * 0.5) {
    return 'CRITICAL';
  }

  // === AT_RISK 條件（任一觸發即為黃燈） ===

  // R1: 有任何逾期任務
  if (taskStats.overdue > 0) {
    return 'AT_RISK';
  }

  // R2: KPI 平均達成率低於時間消耗的 80%
  if (kpiStats.linkedCount > 0 && kpiStats.avgAchievement < timeElapsedPct * 0.8) {
    return 'AT_RISK';
  }

  // R3: 進度低於時間消耗的 80%
  if (progressPct < timeElapsedPct * 0.8) {
    return 'AT_RISK';
  }

  return 'HEALTHY';
}
```

**陳經理（銀行 IT 主管）**：公式中的閾值（30%、75%、50%、80%）需要可配置。我可能想把 C1 的「30%」調成「20%」，因為 5 人團隊每個任務的影響都很大。

**林工程師（技術）**：閾值存在 `SystemConfig` 表或 `.env` 中。預設值如上，管理者可在 Admin > 系統設定頁調整。

## 2.3 從「紅燈」drill-down 到根因的操作路徑

**張總監（UX）**：最多 3 clicks 到根因。

| 步驟 | 操作 | 看到什麼 | 系統回應 |
|------|------|---------|---------|
| 0 | 打開 Cockpit | 3 月目標 🔴 CRITICAL | 首屏自動載入，alert 橫幅已標紅 |
| 1 | 點擊 3 月進度條 | 月度目標展開面板 | lazy load `GET /api/cockpit/goal/:id`，顯示：任務 4/12 完成、KPI-03 92%/99.9%、逾期 2 項 |
| 2 | 點擊「逾期 2 項」連結 | 逾期任務清單（inline 展開） | 顯示任務名稱、逾期天數、負責人、延期原因 |
| 3 | 點擊任務名稱 | TaskDetailModal 開啟 | 完整任務詳情：描述、子任務、評論、工時、變更歷史 |

**總點擊數**：3 clicks
**總時間**：< 10 秒（含 API 載入）

### 共識

| 決策 | 規格 |
|------|------|
| Cockpit Section 數量 | 5 個（年度摘要 + 待處理 + 月度追蹤 + KPI 看板 + 里程碑） |
| 首屏載入目標 | Section A+B < 1 秒，其餘 progressive load < 2 秒 |
| 健康燈號 | 三色（🟢 HEALTHY / 🟡 AT_RISK / 🔴 CRITICAL）|
| 閾值可配置 | 是，存 SystemConfig |
| 最大 drill-down 深度 | 3 clicks 到任務詳情 |
| 月度目標展開 | Lazy load，含迷你甘特圖 |
| KPI 看板 | 所有 KPI 一次顯示，每行含小趨勢 sparkline |

---

# Round 3：Get It Done（看板+駕駛艙+甘特）體驗細化

## 3.1 同一資料、不同 View

**李顧問（產品策略）**：看板、甘特、列表、日曆不再是獨立模組，而是 `/work` 頁面的四個 Tab。它們共享同一組篩選器、同一個資料來源。

### Work 頁面結構

```
/work
├── [看板]  [列表]  [甘特圖]  [日曆]          ← 四個 view tab
├── [篩選器] 計畫:[全部v] 目標:[全部v] 指派:[全部v] 狀態:[全部v] 標籤:[全部v]
└── [Group by] 無 | 計畫 | 目標 | 指派人 | 優先級
```

### 資料同步機制

**林工程師（技術）**：四個 view 共用同一個 React Context（`WorkspaceContext`）。

```typescript
interface WorkspaceState {
  tasks: Task[];              // 篩選後的任務列表
  filters: TaskFilters;        // 當前篩選條件
  groupBy: GroupBy | null;     // 分組方式
  view: 'kanban' | 'table' | 'gantt' | 'calendar';
}

// 任何 view 中的操作（拖拉、編輯）都透過同一個 mutation：
async function updateTask(taskId: string, patch: Partial<Task>) {
  // 1. Optimistic update → 所有 view 即時反映
  // 2. API call: PATCH /api/tasks/:id
  // 3. 觸發 auto-rollup: Task → MonthlyGoal → AnnualPlan → KPI
  // 4. Invalidate cockpit cache
}
```

## 3.2 任務完成 Happy Path（經辦）

**張總監（UX）**：經辦完成一項任務的最短路徑。

### 路徑 A：從 My Day 直接完成（推薦，1 click）

| 步驟 | 經辦操作 | 系統回應 | 管理者看到什麼 |
|------|---------|---------|--------------|
| 1 | 在 My Day 任務列上點「✓完成」按鈕 | 確認 dialog：「確定完成？工時將記錄 N 小時」| — |
| 2 | 點「確定」 | (a) Task.status → DONE, (b) 計時器停止，工時自動記錄, (c) MonthlyGoal.progressPct 重算, (d) KPI.actual 重算, (e) 通知 MANAGER | Cockpit 待驗收 +1，月度目標進度條更新 |
| — | — | 若有 SubTask 未完成，提示「尚有 2 個子任務未完成，仍要完成主任務嗎？」 | — |

### 路徑 B：從看板拖拉完成（2 interactions）

| 步驟 | 經辦操作 | 系統回應 |
|------|---------|---------|
| 1 | 將任務卡片拖到「完成」欄 | 彈出確認面板 |
| 2 | 面板：確認工時 + 可選填備註 → 點「完成」 | 同路徑 A 步驟 2 |

### 路徑 C：從任務詳情 Modal 完成（3 clicks）

| 步驟 | 操作 |
|------|------|
| 1 | 點擊任務名稱 → 開啟 Modal |
| 2 | Modal 右上角「狀態」下拉 → 選 DONE |
| 3 | 確認 dialog → 確定 |

## 3.3 管理者標記緊急 → 經辦處理 → 回報 的完整流程

**陳經理（銀行 IT 主管）**：以實際場景走一遍。

```
時間軸：

14:00 陳經理在 Cockpit 看到 KPI-03 系統可用性落後
      ↓ 1 click
14:01 點開關聯任務「核心系統 Patch」
      ↓ 1 click
14:02 點「🔥」按鈕 → 彈出面板：
      ┌─────────────────────────┐
      │ 標記為管理者關注          │
      │ 原因：[金管會下週檢查___] │
      │ 優先級：[P0 緊急      v] │
      │        [取消]  [確認]    │
      └─────────────────────────┘
      ↓ 點確認
14:02 系統自動：
      (a) Task.managerFlagged = true
      (b) Task.priority = P0
      (c) Task.flagReason = "金管會下週檢查"
      (d) 發送即時通知給 primaryAssignee（志偉）
      (e) Email 通知（如有設定）
      (f) AuditLog 記錄

─── 志偉端 ───

14:03 志偉的 My Day 頂部出現紅色新區塊：
      🔥 核心系統 Patch
         陳經理：「金管會下週檢查」
         [▶開始]
      ↓ 點「開始」
14:03 系統自動：
      (a) Task.status → IN_PROGRESS
      (b) 計時器開始計時
      (c) 通知陳經理「志偉已開始處理」

14:03-16:30 志偉處理任務（期間計時器持續運行）

16:30 志偉在 My Day 點「✓完成」
      ↓ 確認 dialog
      系統自動：
      (a) Task.status → DONE（或 REVIEW 如需驗收）
      (b) 計時器停止，記錄 2.5h
      (c) 通知陳經理「志偉完成了核心系統 Patch」
      (d) MonthlyGoal 進度更新
      (e) KPI 重算

─── 陳經理端 ───

16:31 陳經理的 Cockpit：
      - 待處理事項：待驗收 +1
      - 3 月目標進度條微幅上升
      - KPI-03 數值更新
```

### 共識

| 決策 | 規格 |
|------|------|
| Work 頁面 view 數 | 4 個（看板/列表/甘特/日曆），同一 Context |
| 任務完成最少操作 | 1 click（My Day 直接完成）+ 1 click 確認 = 2 clicks |
| 完成時自動記錄工時 | 有計時器 → 記錄精確值；無計時器 → 建議預估值（可修改）|
| 管理者 flag 操作 | 1 click 🔥 + 填原因 + 確認 = 3 interactions |
| flag 通知機制 | in-app 即時通知 + Email（可配置）|
| 任務完成後 auto-rollup | Task→MonthlyGoal→AnnualPlan→KPI，全部自動 |

---

# Round 4：Track Time（工時追蹤）體驗細化

## 4.1 自動工時的具體機制

**黃博士（行為心理學）**：自動工時的目標是「80% 自動 + 20% 手動確認」，讓工程師的日常記錄時間壓縮到 30 秒以內。

### 機制一：計時器自動記錄

```
觸發條件：
- 使用者在 My Day 點「▶開始」→ Timer 開始
- 使用者在看板將任務拖到 IN_PROGRESS → 提示「是否開始計時？」
- 使用者在任務詳情點「開始工作」→ Timer 開始

停止條件：
- 使用者手動點「⏹停止」
- 使用者將任務拖到 DONE/REVIEW → Timer 自動停止
- 使用者開始另一個任務的 Timer → 前一個自動停止（單一 active timer）
- 超過 12 小時未操作 → 自動暫停 + 提醒

記錄產生：
- Timer 停止時，自動建立 TimeEntry：
  {
    taskId: activeTimer.taskId,
    date: today,
    startTime: timer.startTime,      // 精確到秒
    endTime: now,                     // 精確到秒
    hours: round((endTime - startTime) / 3600, 2),  // 四捨五入到 0.25h
    category: task.category 對應分類,
    source: 'TIMER',                  // 標記來源
    confirmed: false                  // 未確認（虛線框顯示）
  }
```

### 機制二：任務狀態變更推算

```
觸發條件：
- Task.status 從 IN_PROGRESS 變為 DONE/REVIEW
- 且該 Task 今日沒有 Timer 紀錄
- 且該 Task 今日有狀態變更紀錄（TaskActivity）

推算邏輯：
1. 查 TaskActivity：今天最早的 IN_PROGRESS 變更時間 → 估算開始
2. 查 TaskActivity：DONE/REVIEW 變更時間 → 估算結束
3. 取差值，四捨五入到 0.25h
4. 建立 TimeEntry：source = 'INFERRED', confirmed = false

限制：
- 推算值上限 4h（超過不自動建議，要求手動填）
- 僅在同一天內的狀態變更才推算
```

### 機制三：Smart Time Suggest（每日建議）

```
觸發時機：每天 17:00 或使用者打開 Daily Digest

建議來源：
1. 今日已有的 Timer/Inferred 記錄（source=TIMER/INFERRED）
2. 今日有 TaskActivity 但無工時記錄的任務
3. 上週同日的工時模式（pattern matching）
4. 週期性任務的歷史平均工時

呈現方式（Daily Digest Banner）：
┌────────────────────────────────────────────┐
│  📋 今日工時小結                             │
│                                            │
│  ✅ 核心系統 Patch    2.5h  [✓已確認]       │  ← Timer 自動記錄
│  ✅ 前端 LCP 優化     3.0h  [✓確認]         │  ← Timer 自動記錄
│  💡 LDAP 整合測試     1.5h  [✓確認] [✏修改] │  ← 推算建議
│  ─────────────────────────────────         │
│  已記錄：7.0h  │  目標：8.0h               │
│                                            │
│  ⚠ 缺少 1.0h，快速補充：                    │
│  [會議 0.5h] [行政 0.5h] [+自訂]           │
│                                            │
│           [全部確認並送出]                   │
└────────────────────────────────────────────┘

「全部確認並送出」= 1 click 完成一天的工時記錄
```

## 4.2 經辦確認/修改建議的 UI

**張總監（UX）**：未確認的工時記錄用「虛線框 + 淺色背景 + 『系統建議』標籤」呈現，與已確認的「實線框」視覺區分。

### 在日曆視圖中

```
日曆時間軸：
| 09:00 |  ╔═══════════════════╗  ← 已確認：實線框、深色
|       |  ║ 核心系統 Patch     ║
|       |  ║ 09:00-11:30 2.5h  ║
| 11:00 |  ╚═══════════════════╝
|       |
| 13:00 |  ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐  ← 未確認：虛線框、淺色、半透明
|       |  ┊ 💡 LDAP 整合測試   ┊
|       |  ┊ 13:00-14:30 1.5h  ┊
| 14:30 |  ┊ [確認] [修改] [刪除]┊
|       |  └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
```

### 修改流程

```
點「修改」→ 區塊變為可編輯狀態：
- 拖拉上下邊緣調整起訖時間
- 點擊任務名稱更換任務
- 點擊分類標籤更換分類
- 修改後 → 點「確認」→ confirmed = true, source = 'MANUAL_OVERRIDE'
- AuditLog 記錄 { before: { hours: 1.5, task: 'LDAP' }, after: { hours: 2.0, task: 'LDAP' } }
```

## 4.3 月底工時審批（管理者操作流程）

**陳經理（銀行 IT 主管）**：月底審批是我的法定義務（勞基法要求加班記錄有主管簽核）。

### 操作流程

```
每月最後一個工作日（或下月 5 日前）：

1. 陳經理打開 /timesheet → 切到「團隊月報」view
2. 看到團隊月報表：

   ┌──────────┬──────┬──────┬──────┬──────┬──────┬────────┐
   │ 成員     │ 正常  │ 平日OT│ 假日OT│ 總計  │ 填報率 │ 狀態    │
   ├──────────┼──────┼──────┼──────┼──────┼──────┼────────┤
   │ 林志偉   │ 160h │  8h  │  4h  │ 172h │ 95%  │ ○ 待審 │
   │ 王小明   │ 168h │  0h  │  0h  │ 168h │ 100% │ ○ 待審 │
   │ 李大華   │ 152h │ 12h  │  0h  │ 164h │ 88%  │ ⚠ 不足 │
   │ 張美玲   │ 160h │  4h  │  8h  │ 172h │ 92%  │ ○ 待審 │
   └──────────┴──────┴──────┴──────┴──────┴──────┴────────┘

3. 點擊「林志偉」→ 展開月曆熱力圖
   - 每日格子顯示工時數（綠/黃/紅色彩）
   - 異常日期標記（單日 >10h = 橘色，未填 = 灰色）

4. 確認無異常 → 點「✓ 核准」
   - 批次核准：勾選多人 → 「批次核准」按鈕

5. 發現異常（李大華填報率 88%）→ 點擊名字 → 查看缺填日期
   → 點「退回補填」→ 系統發通知給李大華

6. 核准完成後：
   - 該月工時紀錄鎖定（7 天後不可修改，除非 Admin 解鎖）
   - 月報自動產生（含核准時間戳）
```

### 共識

| 決策 | 規格 |
|------|------|
| 工時來源優先級 | Timer（最精確）> 狀態推算 > Smart Suggest > 手動 |
| 未確認記錄呈現 | 虛線框 + 淺色 + 「系統建議」標籤 |
| 最小顯示/記錄單位 | 0.25h（15 分鐘） |
| 每日記錄目標 | 差距 < 2h 不強制提醒 |
| 提醒方式 | Dashboard Banner（非 Modal），最多 1 次/天，週末不提醒 |
| 月底審批 | 管理者在團隊月報頁核准/退回，核准後鎖定 |
| Audit trail | 所有修改記錄 before/after + source + modifiedBy |
| 主管可見範圍 | 聚合工時（小時數），不可見精確起訖秒數 |

---

# Round 5：Know More（知識庫）體驗細化

## 5.1 知識與任務的上下文關聯機制

**王教授（管理學）**：知識管理的核心是「可發現性」——在需要的時候找到需要的知識。關聯機制讓知識從「被動查找」變為「主動推送」。

### 關聯機制設計

```
任務側 → 知識庫：
┌─ TaskDetailModal ──────────────────────────┐
│ [基本資訊] [子任務] [工時] [文件] [評論]     │
│                                            │
│ ── 📄 相關文件 ────────────────────         │
│ ┌──────────────────────────────────┐       │
│ │ 📄 核心系統部署 SOP (v3)          │       │  ← 手動關聯
│ │ 📄 DR 演練 SOP                    │       │  ← 手動關聯
│ │ 💡 建議文件：                      │       │  ← 自動推薦
│ │    Oracle 19c Patch Notes          │       │
│ │ [+ 關聯文件] [+ 新建文件]          │       │
│ └──────────────────────────────────┘       │
└────────────────────────────────────────────┘

自動推薦邏輯（Phase C）：
- 比對 Task.title + Task.description 的關鍵詞
- 搜尋 Document.title + Document.tags
- 取 relevance score top 3 推薦
```

### 知識庫側 → 任務

```
Document 頁面側邊欄：
┌─ 相關任務 ────────────────────────┐
│ 📋 核心系統 Oracle 19.22 Patch    │  ← 透過 DocumentLink
│    IN_PROGRESS | 指派：志偉        │
│ 📋 DR 演練 2026-Q1               │
│    DONE | 2026-01-15 完成          │
└───────────────────────────────────┘
```

### 資料模型

```
已有：TaskDocument（task_id, document_id）
已有：DocumentLink（sourceId, targetId — 文件間雙向連結）

新增：Document.tags String[]（已在 schema 中定義）
     → 啟用 tag-based 搜尋和推薦
```

## 5.2 SOP 驗證到期流程

**張總監（UX）**：借鑑 Guru 的知識驗證系統，適配銀行 SOP 場景。

### 完整流程

```
流程起點：Document 建立/發布時設定 verifierId + verifyIntervalDays

1. 系統每日 cron job（00:30 執行）：
   SELECT * FROM documents
   WHERE status = 'PUBLISHED'
   AND verifyByDate <= CURRENT_DATE + INTERVAL '7 days'
   AND verifyByDate IS NOT NULL;

2. 距到期 7 天：
   → 發送通知給 verifier（驗證人）
   「SOP-001 核心系統部署 SOP 將於 7 天後到期，請安排驗證。」
   → 文件列表頁顯示黃色「即將到期」標記

3. 到期當天：
   → 發送緊急通知給 verifier + Space Admin
   → 文件標記顯示紅色「已過期」
   → 搜尋結果中標注「⚠ 此文件可能已過時」

4. 驗證人操作（verifier 開啟文件）：
   ┌─ 驗證面板 ────────────────────────────────┐
   │ 📋 SOP-001 核心系統部署 SOP                 │
   │ 上次驗證：2025-12-15（王大明）               │
   │ 驗證週期：90 天                              │
   │ 到期日：2026-03-15 🔴 已過期 12 天           │
   │                                             │
   │ 驗證結果：                                   │
   │ ○ 內容正確，無需修改 → 更新 verifiedAt       │
   │ ○ 需要小幅修改 → 進入編輯模式               │
   │ ○ 需要大幅改寫 → 狀態回 DRAFT               │
   │ ○ 此文件已不適用 → 狀態改 RETIRED           │
   │                                             │
   │ 驗證備註：[____________________________]     │
   │                 [確認驗證]                    │
   └──────────────────────────────────────────────┘

5. 驗證完成：
   → verifiedAt = now
   → verifyByDate = now + verifyIntervalDays
   → 通知 Space Admin「SOP-001 已完成驗證」
   → AuditLog 記錄

6. 審核（如驗證人選擇修改）：
   → 修改後 submit review → Space Admin/MANAGER 審核 → 核准發布
```

## 5.3 新人 onboarding 必讀清單流程

**陳經理（銀行 IT 主管）**：新人報到時需要讀的 SOP 至少 30 份。目前沒有追蹤機制。

### 設計方案

```prisma
model ReadingList {
  id          String   @id @default(cuid())
  name        String   // e.g. "新人必讀 - 維運工程師"
  description String?
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       ReadingListItem[]
  assignments ReadingListAssignment[]

  @@map("reading_lists")
}

model ReadingListItem {
  id            String  @id @default(cuid())
  readingListId String
  documentId    String
  sortOrder     Int     @default(0)
  required      Boolean @default(true)  // 必讀 vs 選讀

  readingList   ReadingList @relation(...)
  document      Document   @relation(...)

  @@map("reading_list_items")
}

model ReadingListAssignment {
  id            String    @id @default(cuid())
  readingListId String
  userId        String
  assignedBy    String
  assignedAt    DateTime  @default(now())
  dueDate       DateTime?
  completedAt   DateTime?

  readingList   ReadingList @relation(...)
  user          User       @relation(...)

  @@map("reading_list_assignments")
}
```

### UI 流程

```
管理者建立必讀清單 → 指派給新人 → 新人的 My Day 出現：
┌─ 📚 必讀文件（3/15 完成）────────────┐
│ ✅ SOP-001 核心系統部署 SOP           │  ← 已讀（有 DocumentReadLog）
│ ✅ SOP-002 DR 演練手冊               │  ← 已讀
│ ✅ SOP-003 監控告警處理流程           │  ← 已讀
│ ○  SOP-004 變更管理流程               │  ← 未讀，點擊開啟
│ ○  SOP-005 資安事件通報               │  ← 未讀
│ ...                                   │
│                     進度 ████░░ 20%   │
└───────────────────────────────────────┘
```

### 共識

| 決策 | 規格 |
|------|------|
| 任務-文件關聯 | 已有 TaskDocument model，UI 在 TaskDetailModal「文件」Tab |
| 自動推薦 | Phase C，基於 keyword matching |
| SOP 驗證系統 | Document model 已有 verifierId/verifyByDate，需實作 cron + UI |
| 驗證週期 | 預設 90 天，可按文件設定（30/60/90/180/365）|
| 過期文件標記 | 搜尋結果/文件列表中紅色「已過期」badge |
| 必讀清單 | 新增 ReadingList + ReadingListItem + ReadingListAssignment model |
| 閱讀追蹤 | DocumentReadLog（已有 model），My Day 顯示進度 |

---

# Round 6：跨體驗整合——端到端資料流

## 6.1 完整端到端場景

**李顧問（產品策略）**：以「管理者標記緊急 → 全系統回應」為例，走完所有系統的資料流。

### 場景：陳經理標記「核心系統 Patch」為緊急

```
時間線       操作者     系統事件

14:00       陳經理     在 Cockpit 點 🔥 標記緊急
                       │
                       ├─→ DB: Task.managerFlagged = true
                       ├─→ DB: Task.priority = P0
                       ├─→ DB: Task.flagReason = "金管會下週"
                       ├─→ DB: AuditLog.create({ action: 'FLAG_TASK', ... })
                       ├─→ DB: Notification.create({ type: 'TASK_FLAGGED', userId: 志偉 })
                       ├─→ Email: 發送到志偉（如有設定）
                       └─→ Cache: invalidate cockpit summary

14:00       志偉端     My Day 即時更新（SWR revalidate）
                       │
                       ├─→ 🔴 緊急區塊出現在待辦清單頂部
                       ├─→ 🔔 右上角通知數 +1
                       └─→ Topbar 短暫閃爍紅色

14:03       志偉       點「▶開始」
                       │
                       ├─→ DB: Task.status = IN_PROGRESS
                       ├─→ DB: TimeEntry.create({ isRunning: true, startTime: now })
                       ├─→ DB: TaskActivity.create({ action: 'STATUS_CHANGE' })
                       ├─→ DB: Notification.create({ type: 'TASK_STARTED', userId: 陳經理 })
                       ├─→ Topbar Timer: 顯示「⏱ 核心系統 Patch 00:00:01」
                       └─→ Cache: invalidate cockpit summary

14:03-16:30 志偉       處理任務（Timer 運行中）
                       │
                       └─→ 前端 Timer 每秒更新顯示（純前端，不打 API）

16:30       志偉       點「✓完成」→ 確認
                       │
                       ├─→ DB: Task.status = DONE
                       ├─→ DB: TimeEntry.update({ isRunning: false, endTime: now, hours: 2.5 })
                       ├─→ DB: TaskActivity.create({ action: 'STATUS_CHANGE', to: 'DONE' })
                       │
                       ├─→ Auto-rollup chain（後端同步計算）：
                       │   ├─→ MonthlyGoal: progressPct = (done+1)/total * 100
                       │   ├─→ AnnualPlan: progressPct = avg(all goals.progressPct)
                       │   └─→ KPI (via KPITaskLink): actual 重算
                       │
                       ├─→ DB: Notification.create({ type: 'TASK_COMPLETED', userId: 陳經理 })
                       ├─→ Cache: invalidate cockpit summary
                       └─→ My Day: 任務移至「已完成」區（灰色）

16:31       陳經理端   Cockpit 自動更新（polling 60s / SWR revalidate on focus）
                       │
                       ├─→ 待驗收區：顯示「核心系統 Patch — 志偉已完成」
                       ├─→ 月度目標進度條：微幅上升
                       ├─→ KPI-03 數值更新
                       └─→ Alert：如健康燈號改善，警示可能消失

16:35       陳經理     點待驗收 → 點「✓核准」
                       │
                       ├─→ DB: Task.status = DONE (confirmed)
                       ├─→ DB: ApprovalRequest.create({ type: 'TASK_ACCEPTANCE' })
                       └─→ DB: Notification.create({ type: 'TASK_ACCEPTED', userId: 志偉 })
```

### 工時記錄在此流程中的呈現

```
志偉的 /timesheet 日曆視圖（今天）：

| 14:00 |  ╔══════════════════════╗
|       |  ║ 🔥 核心系統 Patch     ║  ← 自動記錄（Timer）
|       |  ║ 14:03-16:33          ║
| 16:00 |  ║ 2.5h ● 原始規劃       ║
|       |  ╚══════════════════════╝
```

### Cockpit 駕駛艙的即時反映

```
變更前：
  3月目標 ████░░░░░░ 30% 🔴 CRITICAL

變更後（16:31 重算）：
  3月目標 █████░░░░░ 38% 🔴 CRITICAL  ← 進度上升但仍為紅燈
```

### 共識

| 決策 | 規格 |
|------|------|
| 資料流觸發 | 所有狀態變更經由統一的 `updateTask` mutation |
| Auto-rollup 時機 | Task 狀態變更時同步計算（不用 async queue） |
| Cache invalidation | Cockpit summary cache 在任何 Task/KPI 變更時清除 |
| 通知觸發 | 每個狀態變更事件自動產生對應 Notification |
| 前端更新 | SWR `revalidateOnFocus` + 手動 `mutate()` on local change |
| AuditLog | 每個操作都寫入，含 before/after metadata |

---

# Round 7：團隊互動與經驗累積

## 7.1 評論/協作怎麼串連到知識庫

**王教授（管理學）**：組織知識分兩種——顯性知識（文件）和隱性知識（經驗）。TITAN 的評論系統是隱性知識的主要載體，必須和知識庫打通。

### 設計方案

```
任務評論中的知識萃取：

1. 手動萃取：
   評論右上角 [...] 選單 → 「📝 轉為知識文件」
   → 預填 Document：title = Task.title + " - 處理筆記"
   → content = 所選評論內容（Markdown 格式）
   → 自動關聯 TaskDocument
   → 自動設定 tags 從 Task.tags 繼承

2. 自動提示（Phase C）：
   當 INCIDENT 類型任務標記為 DONE 時：
   「此事件有 5 則處理紀錄，是否整理為知識文件？」
   [建立根因分析文件] [略過]
```

## 7.2 任務完成後的「復盤」機制

**黃博士（行為心理學）**：復盤不能是強制的（會造成厭惡），應該是「剛好出現在流程中」的輕量提示。

### 設計方案

```
觸發條件：
- 月度目標下的所有任務完成 → 月度目標自動標記 DONE
- 系統彈出輕量復盤提示：

┌─ 本月目標完成！────────────────────────────┐
│                                            │
│ 📊 3月「Oracle 19c 升級」目標已完成          │
│                                            │
│ 統計：                                     │
│ - 任務 12/12 完成                          │
│ - 總投入 185h（原估 160h，超出 16%）        │
│ - 逾期任務 2 項（最長延遲 5 天）            │
│                                            │
│ 快速復盤（選填）：                          │
│ ○ 下次可改善的地方：[___________________]   │
│ ○ 做得好的地方：[___________________]       │
│                                            │
│        [略過]  [儲存復盤筆記]               │
└────────────────────────────────────────────┘

儲存位置：MonthlyGoal.retrospectiveNote (String?)
週報/月報自動引用此復盤內容
```

## 7.3 經驗如何變成組織知識

**李顧問（產品策略）**：知識積累的三個管道。

| 管道 | 觸發 | 產物 |
|------|------|------|
| 事件處理 → 根因分析文件 | INCIDENT 任務完成時提示 | Document（category: troubleshooting） |
| 月度復盤 → 復盤筆記 | 月度目標完成時提示 | MonthlyGoal.retrospectiveNote |
| 日常評論 → 知識萃取 | 使用者手動觸發 | Document（from comment content） |

### 共識

| 決策 | 規格 |
|------|------|
| 評論轉文件 | 評論 [...] 選單 → 「轉為知識文件」|
| 事件完成提示 | INCIDENT DONE → 「是否建立根因分析？」|
| 月度復盤 | 月度目標 DONE → 輕量復盤面板（選填）|
| 復盤存儲 | MonthlyGoal.retrospectiveNote (String?) |
| 全文搜尋範圍 | Document + Task.description + TaskComment.content |

---

# Round 8：報表與稽核整合

## 8.1 Cockpit drill-down 到 Reports 的銜接點

**張總監（UX）**：Cockpit 每個數字都是一個連結。

| Cockpit 指標 | 點擊連結到 | Report ID |
|-------------|-----------|-----------|
| 整體進度 65% | 年度計畫 Earned Value 報表 | R-PM-01 |
| KPI 落後 2/12 | KPI 達成率趨勢報表 | R-KPI-01 |
| 逾期任務 5 | 逾期任務分析報表 | R-PM-03 |
| 計畫內投入率 78% | 計畫外工作趨勢報表 | R-ORG-02 |
| 累計工時 1,250h | 團隊產能利用率報表 | R-ORG-01 |
| 里程碑 ◆ | 里程碑達成率報表 | R-PM-04 |
| 月度目標 AT_RISK | Earned Value + KPI 交叉分析 | R-PM-01 + R-KPI-02 |

**林工程師（技術）**：連結實作為 `<Link href="/reports/pm-01?year=2026&highlight=march">`，報表頁會根據 query params 自動定位到對應區段。

## 8.2 稽核報表自動產出的完整資料流

**陳經理（銀行 IT 主管）**：金管會稽核需要的三大報表。

### 報表 1：變更管理紀錄（R-AUD-01）

```
資料流：
ChangeRecord (changeNumber, type, riskLevel, impactedSystems,
             scheduledStart, scheduledEnd, actualStart, actualEnd,
             rollbackPlan, status)
  ↓ 聚合
GET /api/reports/v2/audit/change-management?from=2025-10-01&to=2026-03-31
  ↓ 回傳
{
  summary: { total: 23, normal: 15, standard: 6, emergency: 2 },
  byMonth: [...],
  records: [{ changeNumber, type, riskLevel, ... }],
  complianceRate: 95.7%  // 有完整記錄的比例
}
  ↓ 匯出
Excel 格式：
  Sheet 1: 摘要表（統計圖表）
  Sheet 2: 明細表（每筆變更紀錄）
  Sheet 3: 合規檢查表（缺失項標紅）
```

### 報表 2：事件處理時效（R-AUD-02）

```
資料流：
IncidentRecord (severity, startTime, endTime, mttrMinutes, rootCause)
  + Task (status, createdAt, completedAt)
  ↓ 聚合
GET /api/reports/v2/audit/incident-sla?from=2025-10-01&to=2026-03-31
  ↓ 回傳
{
  summary: { total: 18, p0: 2, p1: 5, p2: 11 },
  avgMTTR: 42,  // 分鐘
  slaCompliance: { within: 16, breached: 2, rate: 88.9% },
  records: [{ id, severity, startTime, endTime, mttrMinutes, rootCause, ... }]
}
  ↓ 匯出
Excel 格式：
  Sheet 1: SLA 達標率甜甜圈圖 + 月度趨勢
  Sheet 2: 事件明細（含 MTTR 計算）
  Sheet 3: 根因分析分類統計
```

### 報表 3：工時投入分析（R-TIME-01 + R-ORG-01）

```
資料流：
TimeEntry (userId, hours, category, date, taskId)
  + Task (category, annualPlanId)
  ↓ 聚合
GET /api/reports/v2/time/monthly-summary?from=2025-10&to=2026-03
  ↓ 匯出
Excel 格式：
  Sheet 1: 人員×月份 工時矩陣
  Sheet 2: 類別分佈趨勢圖
  Sheet 3: 計畫內/外投入率趨勢
```

## 8.3 自動推送報表排程

| 報表 | 頻率 | 產生時間 | 接收者 | 格式 |
|------|------|---------|--------|------|
| 週報 | Weekly | 每週五 17:00 | MANAGER | in-app 草稿，確認後 PDF |
| 月報 | Monthly | 每月最後工作日 | MANAGER | in-app 草稿 + Excel |
| KPI 報告 | Monthly | 每月 5 日 | MANAGER | in-app |
| 稽核報表 | On-demand | 管理者手動觸發 | MANAGER | Excel |
| 工時審批摘要 | Monthly | 月度核准完成後 | MANAGER | in-app + PDF |

**林工程師（技術）**：週報和月報由 cron job 在指定時間呼叫 `/api/reports/weekly-auto` 和 `/api/reports/monthly-auto`，產生草稿（Report record with status=DRAFT）。管理者在 Reports 頁面查看並確認。Phase B 可加 Email 推送 PDF 附件。

### 共識

| 決策 | 規格 |
|------|------|
| Cockpit → Report 連結 | 所有數字可點擊，帶 query params 定位 |
| 匯出格式 | PDF + Excel + CSV 三種 |
| Excel 產出 | 後端 `exceljs` + 預設模板 |
| PDF 產出 | 後端 Puppeteer 渲染 HTML → PDF |
| 自動週報 | 週五 17:00 cron → 草稿 → 管理者確認 |
| 稽核報表 | 一鍵產出，覆蓋變更/事件/工時三大類 |

---

# Round 9：技術實施風險與方案

## 9.1 高風險改動識別

**林工程師（技術）**：按風險等級排序。

| # | 改動 | 風險等級 | 風險描述 | 緩解方案 |
|---|------|---------|---------|---------|
| 1 | Dashboard 重構（Tab 化） | **高** | 現有 `DashboardPage` 分 `ManagerDashboard` / `EngineerDashboard`，重構為 Tab 元件涉及路由、狀態管理、權限邏輯大幅修改 | Feature flag 控制新舊版切換；先建新元件 `HomeDashboard`，不動舊元件；灰度發布 |
| 2 | Work 頁面整合（4 view 統一） | **高** | 現有 `/kanban`、`/gantt` 是獨立路由，整合到 `/work` 需要路由重構 + 共用 Context | 保留舊路由做 redirect；`/work?view=kanban` 作為新入口 |
| 3 | Auto-rollup 計算鏈 | **中** | Task→Goal→Plan→KPI 的鏈式計算有邊界案例（任務無 monthlyGoalId、KPI 無 taskLinks 等） | 完整單元測試覆蓋所有邊界；上線初期 auto-rollup 結果與手動計算並行對比 |
| 4 | Cockpit API 聚合查詢效能 | **中** | 120 tasks × 600 time entries × 120 KPI links = 大量 JOIN | 後端聚合 SQL（不用 Prisma include）；Redis cache TTL 60s；分層載入 |
| 5 | IncidentRecord / ChangeRecord 新 model | **低** | 純新增，不影響現有 | 標準 migration |
| 6 | 日曆工時視圖（Timesheet v3） | **中** | 新增完整的日曆 UI，拖拉互動複雜 | 使用成熟 library（FullCalendar 或自製 CSS Grid）；先做日/週檢視，月檢視延後 |

## 9.2 資料遷移策略

**林工程師（技術）**：v2 的資料遷移量極小，因為設計原則是「不改現有 schema，只新增」。

| 項目 | 遷移內容 | 風險 | 方案 |
|------|---------|------|------|
| AnnualPlan.vision | 新增 nullable String 欄位 | 零 | `ALTER TABLE annual_plans ADD COLUMN vision TEXT;` |
| Task.managerFlagged 等 | 新增 4 個 nullable 欄位 | 零 | `ALTER TABLE tasks ADD COLUMN ...` |
| MonthlyGoal.retrospectiveNote | 新增 nullable String 欄位 | 零 | 同上 |
| IncidentRecord | 新建 table | 零 | `CREATE TABLE incident_records ...` |
| ChangeRecord | 新建 table | 零 | `CREATE TABLE change_records ...` |
| KnowledgeSpace / KnowledgeCategory | 新建 tables | 零 | `CREATE TABLE ...` |
| Document 欄位擴充 | 新增 spaceId, categoryId, status 等 | **低** | nullable 欄位，舊資料不受影響；migration 腳本設定 default |
| ReadingList 系列 | 新建 tables | 零 | 新增 |
| 現有資料回填 | 需要將現有 Document 歸入預設 Space | **低** | Migration 腳本建立 "Default" Space，所有現有 Document.spaceId = default |

**關鍵原則**：所有新增欄位為 nullable 或有 default value。零停機遷移。

## 9.3 向下相容方案

| 面向 | 方案 |
|------|------|
| API | 所有新 API 使用 `/api/v2/` prefix 或 `/api/cockpit/`；現有 API 不動 |
| 路由 | `/kanban` redirect 到 `/work?view=kanban`；`/dashboard` redirect 到 `/` |
| 權限 | 新 API 加 RBAC guard；現有 API 不變 |
| 前端 | Feature flag `ENABLE_V2_DASHBOARD`；切換失敗自動 fallback 到 v1 |
| 資料 | 無破壞性 schema 變更；Prisma migration 全部為 additive |

### 共識

| 決策 | 規格 |
|------|------|
| 最高風險 | Dashboard 重構 + Work 頁面整合 |
| 緩解策略 | Feature flag + 灰度發布 + 新舊並行 |
| 資料遷移 | 零停機、全部 additive、nullable |
| API 相容 | 新增 endpoint，不修改現有 |
| 回滾方案 | Feature flag 關閉即回到 v1 |

---

# Round 10：最終共識 + 精確實施計畫

## 10.1 Phase A（5 週）— 核心體驗重塑 + Quick Win

### 交付清單（到 component 層級）

| 週 | 交付項 | 後端 component | 前端 component | 新增 API |
|----|--------|---------------|---------------|---------|
| W1 | AnnualPlan.vision 欄位 | Prisma migration, `annual-plan.service.ts` 修改 | `PlanEditForm` 加 vision 欄位 | `PATCH /api/plans/:id` 已有 |
| W1 | Auto-rollup 邏輯 | `rollup.service.ts`（新建）: `recalculateGoalProgress()`, `recalculatePlanProgress()`, `recalculateKPIActual()` | — | — |
| W1 | Auto-rollup 整合 | `task.service.ts` 的 `updateTask` 呼叫 rollup | — | — |
| W2 | Cockpit Summary API | `cockpit.controller.ts`, `cockpit.service.ts`（新建）| — | `GET /api/cockpit/summary` |
| W2 | Cockpit Goal Detail API | 同上 | — | `GET /api/cockpit/goal/:id` |
| W2 | Cockpit 前端 — 年度摘要 | — | `CockpitSummarySection`（新建）| — |
| W3 | Cockpit 前端 — 月度追蹤 | — | `CockpitGoalTracker`（新建）, `GoalHealthBadge`, `MiniGantt` | — |
| W3 | Cockpit 前端 — KPI 看板 | — | `CockpitKPIBoard`（新建）, `KPIHealthRow`, `KPISparkline` | — |
| W3 | My Day API | `my-day.controller.ts`（新建）| — | `GET /api/tasks/my-day` |
| W3 | My Day 前端 | — | `MyDayView`（新建）, `UrgentSection`, `TodayDueSection`, `InProgressSection`, `QuickActionBar` | — |
| W4 | Task inline actions | — | `TaskInlineActions`（加到 `MyDayTaskRow`）: ▶開始, ✓完成, ⏱計時 | `PATCH /api/tasks/:id/flag` |
| W4 | Dashboard Tab 整合 | — | `HomeDashboard`（新建）: Tab（團隊全局 / 我的工作）, role-based rendering | — |
| W4 | 全局警示條 | `alerts.service.ts`（新建）| `GlobalAlertBanner`（新建）| `GET /api/alerts/active` |
| W5 | 自動週報 API | `weekly-report.service.ts`（新建）| — | `GET /api/reports/weekly-auto` |
| W5 | 自動週報前端 | — | `WeeklyReportPreview`（新建）, `ReportConfirmButton` | — |
| W5 | 簡易 PDF 匯出 | `pdf-export.service.ts`（新建，Puppeteer）| `ExportPDFButton` | `GET /api/reports/export?format=pdf` |

### 驗收標準

| # | 測試項 | 驗收條件 | 測試方法 |
|---|--------|---------|---------|
| A1 | Cockpit 首屏載入 | < 2 秒（P95） | Lighthouse + 手動測試，5 次取 P95 |
| A2 | Cockpit API 回應 | < 500ms（P95） | API 測試腳本，100 次取 P95 |
| A3 | Auto-rollup 正確性 | 手動計算值與系統值誤差 < 1% | 單元測試 30 cases + 手動驗算 5 cases |
| A4 | My Day 排序正確 | managerFlagged > P0 > dueDate=today > IN_PROGRESS | E2E 測試 |
| A5 | 管理者 flag 流程 | 3 clicks 完成標記，經辦即時收到通知 | E2E 測試 |
| A6 | 任務完成 → rollup 鏈 | 完成任務後，Goal/Plan/KPI 進度在 3 秒內更新 | 整合測試 |
| A7 | 週報自動產生 | 週五 17:00 自動產生草稿，含任務統計和工時摘要 | 手動觸發 + 驗證內容 |
| A8 | RBAC | ENGINEER 存取 /cockpit → redirect 到 / | E2E 測試 |
| A9 | AuditLog 覆蓋 | flag/complete/rollup 操作全部有 AuditLog | DB 查詢驗證 |
| A10 | Feature flag | `ENABLE_V2_DASHBOARD=false` 時回到 v1 | 手動切換驗證 |

## 10.2 Phase B（4 週）— 效率革命

### 交付清單

| 週 | 交付項 | 元件 | API |
|----|--------|------|-----|
| W6 | Smart Time Suggest | `time-suggest.service.ts`, `SmartTimeSuggestBanner` | `GET /api/time-entries/suggest?date=today` |
| W6 | Daily Digest Banner | `DailyDigestBanner`（Dashboard 頂部）, `ConfirmAllButton` | `GET /api/time-entries/daily-summary` |
| W7 | Quick Log 功能 | `QuickLogModal`（Dashboard Quick Action 觸發）| `POST /api/time-entries/quick-log` |
| W7 | Quick Action 事件範本 | `IncidentQuickAction`（2 clicks 建立 INCIDENT 任務 + IncidentRecord）| `POST /api/tasks/incident-quick` |
| W8 | Work 頁面 Tab 化 | `WorkPage`（新建）, `ViewTabs`, `SharedFilters`, `WorkspaceContext` | — |
| W8 | 看板遷移到 Work | `KanbanView`（重構自 `/kanban`）| — |
| W9 | 甘特遷移到 Work | `GanttView`（重構自 `/gantt`）| — |
| W9 | 列表 + 日曆 view | `TableView`, `CalendarView`（新建）| — |

### 驗收標準

| # | 測試項 | 驗收條件 |
|---|--------|---------|
| B1 | Smart Suggest 準確度 | 建議的任務+工時與實際差異 < 30% |
| B2 | Daily Digest 一鍵確認 | 1 click 確認所有建議，工時記錄完成 |
| B3 | 事件快速回報 | 2 clicks 建立 INCIDENT 任務（含預設 P1 + INCIDENT category）|
| B4 | Work 頁面四 view 切換 | Tab 切換 < 300ms，篩選器跨 view 同步 |
| B5 | 舊路由 redirect | `/kanban` → `/work?view=kanban` 正常運作 |
| B6 | 行動端 My Day | 375px 寬度下 My Day 可正常操作（完成任務、確認工時）|

## 10.3 Phase C（3 週）— 精緻化

### 交付清單

| 週 | 交付項 | 元件 | API |
|----|--------|------|-----|
| W10 | 知識庫上下文關聯 | TaskDetailModal「文件」Tab 改版, `RelatedDocsSidebar` | `GET /api/tasks/:id/related-docs` |
| W10 | SOP 驗證系統 | `VerificationPanel`（Document 頁面）, cron job `verify-reminder` | `POST /api/documents/:id/verify` |
| W11 | 月報自動化 | `monthly-report.service.ts`, `MonthlyReportPreview` | `GET /api/reports/monthly-auto` |
| W11 | Excel 匯出 | `excel-export.service.ts`（exceljs）| `GET /api/reports/export?format=xlsx` |
| W11 | 全局搜尋增強 | `GlobalSearch` 元件改版（跨 Document + Task + Comment）| `GET /api/search?q=&scope=all` |
| W12 | 使用率分析 | `UsageAnalytics` 頁面（Admin only）| `GET /api/admin/usage-stats` |
| W12 | Onboarding 導覽 | `OnboardingTour`（react-joyride）| — |

### 驗收標準

| # | 測試項 | 驗收條件 |
|---|--------|---------|
| C1 | 任務-文件關聯 | TaskDetailModal 顯示關聯文件，可新增/移除 |
| C2 | SOP 到期通知 | 距到期 7 天 + 到期當天各發一次通知 |
| C3 | 月報內容完整度 | 含任務統計、工時摘要、KPI 達成率、復盤筆記 |
| C4 | Excel 格式 | 多 sheet、有表頭/合計列、數字格式正確 |
| C5 | 全局搜尋 | 搜「ORA-01555」可找到 Task description 和 Comment 中的內容 |
| C6 | Onboarding | 新使用者首次登入 → 3 步導覽 → 可跳過 |

## 10.4 上線切換具體步驟

### 時程表

```
Week 13-14: Stabilization（穩定期）
├── W13: Bug fix + 效能調優 + 安全審查
├── W13: 準備 Rollback SOP
├── W14: 15 分鐘 demo 給全團隊
└── W14: Feature flag 打開（ENABLE_V2_DASHBOARD=true）

Week 14: Soft Launch
├── Day 1（週一）：v2 + Kimai 並行，全員使用 v2
├── Day 2-5：收集回饋（Cockpit 使用率、Bug 回報）
├── Day 5（週五）：Hotfix 部署

Week 15-16: 觀察期
├── W15：Kimai 設為唯讀（不可新增記錄）
├── W15：陳經理在早會使用 Cockpit（習慣養成）
├── W16：確認 v2 穩定

Week 17: Hard Switch
├── Day 1：Kimai 下線
├── Day 1：移除 Feature flag（v2 成為唯一版本）
├── Day 3：刪除舊 Dashboard 元件（ManagerDashboard, EngineerDashboard）

Week 19: 30 天效益檢視
├── 採用率統計（DAU、工時完整率）
├── 效率指標（管理者資訊獲取時間、工程師記錄時間）
├── 使用者滿意度問卷

Week 25: 90 天正式 ROI 分析
├── 對照 roi-analysis.md 的預估值
├── 決定 Phase D（v3）的方向
```

### Rollback SOP

```
若 v2 出現 P0 問題（資料遺失、權限洩漏、系統不可用）：

1. 設定 ENABLE_V2_DASHBOARD=false（< 1 分鐘）
   → 所有使用者自動回到 v1 Dashboard
2. 如有資料問題：從 PostgreSQL point-in-time recovery 還原
3. 通知團隊：「TITAN 暫時回到舊版，正在修復」
4. 修復後重新打開 Feature flag
```

---

## 最終成功指標

| 類別 | 指標 | Phase A 目標 | 90 天目標 |
|------|------|-------------|----------|
| 採用率 | DAU | 5/5（100%） | 維持 100% |
| 採用率 | 工時記錄完整率 | > 80% | > 90% |
| 效率 | 管理者資訊獲取時間 | < 60 秒 | < 30 秒 |
| 效率 | 工程師每日記錄時間 | < 120 秒 | < 60 秒 |
| 效率 | 週報產出時間 | < 10 分鐘 | < 5 分鐘 |
| 品質 | 使用者滿意度 | > 3.5/5 | > 4/5 |
| 品質 | 稽核資料完整性 | 100% audit trail | 一鍵匯出合規報表 |
| 技術 | Cockpit API P95 | < 500ms | < 300ms |
| 技術 | 頁面載入 | < 2 秒 | < 1.5 秒 |
| 技術 | 測試覆蓋率 | > 80% | > 85% |

---

## 附錄：Schema 變更總覽

### 修改現有 Model

```prisma
// AnnualPlan — 新增 1 欄位
model AnnualPlan {
  // ... 現有欄位
  vision  String?   // 年度方針/願景
}

// Task — 新增 4 欄位
model Task {
  // ... 現有欄位
  managerFlagged  Boolean   @default(false)
  flagReason      String?
  flaggedAt       DateTime?
  flaggedBy       String?
}

// MonthlyGoal — 新增 1 欄位
model MonthlyGoal {
  // ... 現有欄位
  retrospectiveNote  String?
}

// Document — 新增/修改欄位（見 knowledge-v2-design.md）
// SubTask — 新增 2 欄位
model SubTask {
  // ... 現有欄位
  notes   String?
  result  String?
}
```

### 新增 Model

```
IncidentRecord      — 事件管理結構化欄位（1:1 with Task）
ChangeRecord        — 變更管理結構化欄位（1:1 with Task）
KnowledgeSpace      — 知識空間
SpaceMember         — 空間成員
KnowledgeCategory   — 知識分類
DocumentAttachment  — 文件附件
DocumentComment     — 文件評論
DocumentReadLog     — 閱讀紀錄
DocumentLink        — 文件雙向連結
ReadingList         — 必讀清單
ReadingListItem     — 清單項目
ReadingListAssignment — 清單指派
```

### 新增 API 總覽

```
# Cockpit
GET  /api/cockpit/summary        — Cockpit 聚合（MANAGER/ADMIN）
GET  /api/cockpit/goal/:id       — 月度目標展開（MANAGER/ADMIN）
GET  /api/cockpit/my-goals       — 個人關聯目標（ALL）

# My Day
GET  /api/tasks/my-day            — 今日待辦排序列表（本人）
GET  /api/alerts/active           — 全局警示（ALL）

# Task 操作
PATCH /api/tasks/:id/flag         — 管理者標記（MANAGER）
POST  /api/tasks/incident-quick   — 快速建立事件（ALL）

# 工時
GET  /api/time-entries/suggest    — 工時建議（本人）
GET  /api/time-entries/daily-summary — 每日摘要（本人）
POST /api/time-entries/quick-log  — 快速記錄（ALL）

# 報表
GET  /api/reports/weekly-auto     — 自動週報（MANAGER/ADMIN）
GET  /api/reports/monthly-auto    — 自動月報（MANAGER/ADMIN）
GET  /api/reports/export          — 匯出（MANAGER/ADMIN）

# 報表 v2（15 個新 endpoint）
GET  /api/reports/v2/org/utilization
GET  /api/reports/v2/org/unplanned-trend
GET  /api/reports/v2/org/workload-distribution
GET  /api/reports/v2/project/earned-value
GET  /api/reports/v2/project/velocity
GET  /api/reports/v2/project/overdue-analysis
GET  /api/reports/v2/project/milestone-achievement
GET  /api/reports/v2/kpi/trend
GET  /api/reports/v2/kpi/correlation
GET  /api/reports/v2/kpi/composite-score
GET  /api/reports/v2/time/monthly-summary
GET  /api/reports/v2/time/overtime-analysis
GET  /api/reports/v2/time/efficiency
GET  /api/reports/v2/audit/change-management
GET  /api/reports/v2/audit/incident-sla
GET  /api/reports/v2/audit/permission-changes

# 知識庫
POST /api/documents/:id/verify    — 驗證確認
GET  /api/tasks/:id/related-docs  — 任務關聯文件
GET  /api/search?q=&scope=all     — 全局搜尋

# 管理
GET  /api/admin/usage-stats       — 使用率分析（ADMIN）
```

---

*本藍圖由 6 位專家經 10 輪深度辯論產出。每項決策均有具體的元件名稱、API 規格、驗收條件。作為 TITAN v2.0 的唯一實施權威文件。*

*產出時間：2026-03-27 | 專家小組：王教授、張總監、陳經理、林工程師、黃博士、李顧問*
