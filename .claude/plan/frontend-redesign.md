# TITAN Frontend Redesign — Minimal Modern UI

> **規劃日期：** 2026-03-24
> **設計風格：** 極簡現代（Minimal Modern）
> **主色調：** Indigo #6366F1 accent + 中性色系
> **字體：** Inter（取代 Geist）— 或保留 Geist Sans（兩者風格接近）
> **圓角：** 10px 基準（卡片 12px、按鈕 8px、badge 6px）
> **陰影策略：** 用 shadow 取代 border 建立層次

---

## 0. 設計語言定義

### 0.1 色彩系統（CSS Variables）

```css
:root {
  /* ── 基底 ── */
  --background: 0 0% 98.5%;        /* #FBFBFB 微暖灰白，非純白 */
  --foreground: 240 6% 10%;         /* #18181B 近黑 */

  /* ── 卡片 ── */
  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 240 6% 10%;

  /* ── 主色 Indigo ── */
  --primary: 239 84% 67%;           /* #6366F1 */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 239 84% 60%;     /* 稍深 */
  --primary-soft: 239 84% 67% / 0.08; /* 底色用 */

  /* ── 中性 ── */
  --muted: 240 5% 96%;              /* #F4F4F5 */
  --muted-foreground: 240 4% 46%;   /* #737380 */
  --accent: 240 5% 93%;             /* #EDEDEF */
  --accent-foreground: 240 6% 10%;

  /* ── 邊框 ── */
  --border: 240 6% 90%;             /* #E4E4E7 */
  --input: 240 6% 90%;
  --ring: 239 84% 67%;              /* focus ring = primary */

  /* ── 語意色 ── */
  --success: 142 71% 45%;           /* #22C55E */
  --warning: 38 92% 50%;            /* #F59E0B */
  --danger: 0 84% 60%;              /* #EF4444 */
  --info: 217 91% 60%;              /* #3B82F6 */

  /* ── Sidebar ── */
  --sidebar-bg: 0 0% 100%;
  --sidebar-border: 240 6% 93%;
  --sidebar-active-bg: 239 84% 67% / 0.08;
  --sidebar-active-text: 239 84% 55%;

  /* ── 圓角 ── */
  --radius: 0.625rem;               /* 10px 基準 */
  --radius-lg: 0.75rem;             /* 12px 卡片 */
  --radius-sm: 0.5rem;              /* 8px 按鈕 */
  --radius-xs: 0.375rem;            /* 6px badge */

  /* ── 陰影 ── */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.03);
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.03);
  --shadow-focus: 0 0 0 3px hsl(239 84% 67% / 0.15);
}

.dark {
  --background: 240 6% 7%;          /* #111113 */
  --foreground: 0 0% 93%;           /* #EDEDED */
  --card: 240 5% 10%;               /* #19191C */
  --card-foreground: 0 0% 93%;
  --primary: 239 84% 67%;           /* same indigo */
  --muted: 240 4% 14%;
  --muted-foreground: 240 4% 55%;
  --accent: 240 4% 16%;
  --border: 240 4% 18%;
  --sidebar-bg: 240 5% 8.5%;
  --sidebar-border: 240 4% 14%;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.2);
}
```

### 0.2 字體決策

保留 **Geist Sans / Geist Mono**（已在專案中使用，風格與 Inter 幾乎相同，且不需額外載入字體——封閉內網環境優勢）。

字級系統：
- Page title: `text-xl font-semibold tracking-tight` (20px)
- Section title: `text-sm font-medium text-muted-foreground uppercase tracking-wide` (14px)
- Body: `text-sm` (14px)
- Caption/Label: `text-xs text-muted-foreground` (12px)
- Data number: `font-mono text-2xl font-semibold tabular-nums` (24px)
- Badge: `text-[11px] font-medium` (11px)

### 0.3 間距規範

- 頁面 padding: `p-6` (24px)
- 卡片內 padding: `p-5` (20px)
- 元素間距: `gap-4` (16px) 或 `gap-6` (24px)
- Section 間距: `space-y-6` (24px)
- 緊湊列表: `space-y-1` (4px)

---

## 1. 全域佈局改造

### 1.1 Root Layout (`app/layout.tsx`)

**改動：**
- 加入 dark mode class toggle 支援
- body 加入 `transition-colors duration-200`

### 1.2 App Layout (`app/(app)/layout.tsx`)

**現狀：** `flex h-screen bg-background`
**改造：**
```
┌─ Sidebar (固定左側) ─────────────────────────────┐
│  240px 展開 / 64px 收合                          │
│  背景：純白 (light) / 深色 (dark)                 │
│  右邊界：1px solid border，無陰影                 │
└──────────────────────────────────────────────────┘
┌─ Main Area ──────────────────────────────────────┐
│  ┌─ Topbar (sticky top) ──────────────────────┐  │
│  │  高度 56px，背景透明，底部 1px border        │  │
│  │  左：Breadcrumb / 頁面標題                  │  │
│  │  右：🔔 通知 + 👤 用戶 + ⚙️ 主題切換       │  │
│  └────────────────────────────────────────────┘  │
│  ┌─ Content ──────────────────────────────────┐  │
│  │  max-w-6xl mx-auto p-6                     │  │
│  │  overflow-y-auto                            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 2. Sidebar 重設計

### 2.1 結構

```
┌─────────────────────────┐
│  TITAN                  │  ← Logo 區（h-14）
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                         │
│  概覽                    │  ← 分組標題（大寫灰字）
│  ┃ 儀表板               │  ← Active: 左邊 3px indigo 色條
│    看板                  │     + 淡紫背景 + indigo 文字
│    甘特圖               │
│                         │
│  管理                    │
│    年度計畫              │
│    KPI                  │
│    知識庫               │
│                         │
│  紀錄                    │
│    工時                  │
│    報表                  │
│                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  v1.0                   │  ← 底部 footer
└─────────────────────────┘
```

### 2.2 導航項分組

```typescript
const navGroups = [
  {
    label: "概覽",
    items: [
      { href: "/dashboard", label: "儀表板", icon: LayoutDashboard },
      { href: "/kanban", label: "看板", icon: KanbanSquare },
      { href: "/gantt", label: "甘特圖", icon: GanttChartSquare },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/plans", label: "年度計畫", icon: Target },
      { href: "/kpi", label: "KPI", icon: Crosshair },
      { href: "/knowledge", label: "知識庫", icon: BookOpen },
    ],
  },
  {
    label: "紀錄",
    items: [
      { href: "/timesheet", label: "工時紀錄", icon: Clock },
      { href: "/reports", label: "報表", icon: BarChart2 },
    ],
  },
];
```

### 2.3 互動狀態

| 狀態 | 樣式 |
|------|------|
| **Default** | `text-muted-foreground` 灰色圖標+文字 |
| **Hover** | `bg-accent/50 text-foreground` 微亮背景 + 文字變深，transition 150ms |
| **Active** | 左邊 `border-l-[3px] border-primary` indigo 色條 + `bg-primary/[0.06]` 淡紫背景 + `text-primary font-medium` |
| **Focus** | `outline-none ring-2 ring-ring/20 ring-offset-2` |
| **Collapsed** | 寬度 64px，只顯示圖標，hover 顯示 tooltip（title 屬性） |

### 2.4 Logo 區

- 展開：`TITAN` 文字，`text-lg font-semibold tracking-tight`
- 收合：`T` 單字，16x16 方形 indigo 背景白字

---

## 3. Topbar 改造

### 3.1 結構

```
┌───────────────────────────────────────────────────┐
│  儀表板                         🔔(3) 👤王主管 🌙 │
│                                                    │
└───────────────────────────────────────────────────┘
```

**改動：**
- 左側：顯示當前頁面標題（從 pathname 推導）
- 右側增加：Theme toggle button（🌙/☀️）
- User avatar 改為帶文字首字母的圓形，hover 顯示 dropdown（帳號資訊 + 登出）
- 通知 bell 有 unread count badge（indigo 圓點）

### 3.2 通知 Badge

```
紅點改為 indigo 圓點：
- 有未讀：bell 右上角 6x6 圓點，bg-primary，animate-pulse（3 秒後停止）
- 無未讀：無圓點
```

---

## 4. 卡片系統（Card Component）

### 4.1 基礎卡片

**現狀：** `bg-card border border-border rounded-lg p-5`
**改造：** 用 shadow 取代 border，更乾淨

```typescript
// 基礎卡片
"bg-card rounded-xl shadow-card p-5"

// Hover 變化（可點擊的卡片）
"bg-card rounded-xl shadow-card p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer"

// 選中/Active 卡片
"bg-card rounded-xl shadow-card p-5 ring-2 ring-primary/20"

// 強調卡片（如逾期警告）
"bg-card rounded-xl shadow-card p-5 border-l-3 border-l-danger"
```

### 4.2 StatCard 改造

**現狀：** 灰框 + 文字，無層次
**改造：**

```
┌──────────────────────┐
│  本週完成任務          │  ← text-xs text-muted-foreground
│                       │
│  23                   │  ← font-mono text-3xl font-bold
│  ↑ 4 vs 上週          │  ← text-xs text-success（有趨勢指標）
└──────────────────────┘
```

- 用 `shadow-card` 取代 border
- 數字用 `text-3xl font-mono font-bold tabular-nums`（大而醒目）
- 加入趨勢指標（↑↓ 與上期比較）
- 危險指標（逾期 > 0）：數字顏色 `text-danger`，左邊界 `border-l-3 border-l-danger`

### 4.3 尺寸變體

| 變體 | 用途 | padding |
|------|------|---------|
| `compact` | Sidebar 內、列表項 | `p-3` |
| `default` | 標準卡片 | `p-5` |
| `spacious` | Dashboard 主卡片 | `p-6` |

---

## 5. TaskCard 重設計

### 5.1 佈局

```
┌─ shadow-card rounded-xl ──────────────────┐
│                                            │
│  規劃  ·  P2                               │  ← category pill + priority pill
│                                            │
│  設計知識庫全文搜尋功能                      │  ← title, text-sm font-medium
│                                            │
│  ┌─────┐                                   │
│  │ ██░░ │  2/4 子任務                       │  ← 進度條 + 子任務計數
│  └─────┘                                   │
│                                            │
│  👤王  👤(李)     ⏱ 8h     📅 3/28         │  ← assignees + hours + due
│                                            │
└────────────────────────────────────────────┘
```

### 5.2 Priority 視覺

| 優先級 | 視覺表現 |
|--------|---------|
| P0 | 左邊界 `border-l-3 border-l-danger` + 紅色 pill |
| P1 | 橙色 pill `bg-warning/10 text-warning` |
| P2 | 淡灰 pill `bg-muted text-muted-foreground` |
| P3 | 無 pill，僅文字 |

### 5.3 Category Pill

用圓角 pill（`rounded-full px-2 py-0.5`），各類別有專屬柔和色：
- PLANNED: `bg-primary/10 text-primary` (indigo)
- ADDED: `bg-purple-500/10 text-purple-600`
- INCIDENT: `bg-danger/10 text-danger`
- SUPPORT: `bg-success/10 text-success`
- ADMIN: `bg-muted text-muted-foreground`
- LEARNING: `bg-teal-500/10 text-teal-600`

### 5.4 互動狀態

| 狀態 | 樣式 |
|------|------|
| **Default** | `shadow-card` |
| **Hover** | `shadow-md` + `translateY(-1px)` + 微亮背景 |
| **Dragging** | `shadow-lg opacity-90 rotate-[2deg] scale-[1.02]` |
| **Drop target active** | Column 背景 `bg-primary/[0.04]` + 虛線框 |

---

## 6. Dashboard 改造

### 6.1 Manager Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  早安，王主管                               2026/03/24  │
│  今天有 3 件事需要關注                                   │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│  │  23  │ │ 48.5 │ │  3⚠️ │ │ 18%  │                   │
│  │完成   │ │總工時 │ │逾期   │ │計畫外│                   │
│  │↑4    │ │      │ │      │ │↓2%  │                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                   │
│                                                          │
│  ┌─ KPI 達成 ──────────────────────────────────────┐    │
│  │  KPI-01 伺服器可用性    ████████████░░  92%      │    │
│  │  KPI-02 專案完成率      ██████████░░░░  78%      │    │
│  │  KPI-03 資安事件回應    ████████████████ 100%    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 團隊工時 ──────────┐  ┌─ 投入率 ──────────────┐    │
│  │  王小明  ▓▓▓▓▓░ 32h │  │  計畫內  ████████ 82% │    │
│  │  李小華  ▓▓▓▓░░ 24h │  │  計畫外  ██░░░░░░ 18% │    │
│  └──────────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**改造重點：**
- 頂部增加**問候語 + 日期 + 關注事項摘要**
- StatCard 數字放大至 `text-3xl`，加入趨勢箭頭
- KPI 進度條加入**漸層色**（紅→黃→綠，依達成率）
- 團隊工時和投入率改為**並排雙欄**佈局
- 所有卡片使用 `shadow-card` 無邊框設計

### 6.2 Engineer Dashboard

同樣結構，但：
- 問候語：「早安，{name}。你今天有 {N} 項待辦任務。」
- StatCard：進行中 / 逾期 / 本週工時
- 任務列表改為更緊湊的**行式設計**（非卡片堆疊）

---

## 7. 看板改造

### 7.1 Column Header

```
┌─────────────────────┐
│  ● 進行中       5   │  ← 色點 + 標題 + 計數
└─────────────────────┘
```

- 移除 `bg-*` 色塊背景，改用 **6px 圓點** 標示狀態色
- 計數 badge：`bg-muted rounded-full px-2 text-xs`

### 7.2 Column 容器

```
背景：transparent（不是 border 圍起來的框）
分隔：columns 之間用 gap-4 留白
空列：虛線框 border-dashed，文字居中
```

### 7.3 新增任務按鈕

```
現狀：bg-card hover:bg-accent 的 ghost 按鈕
改造：bg-primary text-white rounded-lg shadow-sm hover:shadow-md
      + hover:bg-primary-hover transition-all
      圖標 + 文字
```

---

## 8. 登入頁重設計

### 8.1 佈局

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│              ┌─ shadow-lg rounded-2xl ─────┐         │
│              │                              │         │
│              │     ╔═══╗                    │         │
│              │     ║ T ║   TITAN           │         │
│              │     ╚═══╝                    │         │
│              │     銀行 IT 工作管理系統       │         │
│              │                              │         │
│              │  ┌──────────────────────┐    │         │
│              │  │  帳號                 │    │         │
│              │  └──────────────────────┘    │         │
│              │  ┌──────────────────────┐    │         │
│              │  │  密碼                 │    │         │
│              │  └──────────────────────┘    │         │
│              │                              │         │
│              │  ┌────────────────────┐      │         │
│              │  │      登入          │      │         │
│              │  └────────────────────┘      │         │
│              │                              │         │
│              └──────────────────────────────┘         │
│                                                      │
│              © 2026 TITAN v1.0                       │
└─────────────────────────────────────────────────────┘
```

**改造重點：**
- Logo 區：`T` 字母在 40x40 圓角方塊中（`bg-primary text-white rounded-xl`），旁邊 TITAN 文字
- 表單卡片：`shadow-lg rounded-2xl p-8`（比一般卡片更大圓角+陰影）
- 輸入框：`h-11`（44px 高度，符合觸控標準），`rounded-lg`
- 登入按鈕：`bg-primary text-white h-11 rounded-lg font-medium shadow-sm`
- 背景：`bg-background`（微灰白，不是純白）
- 底部版權文字

### 8.2 登入按鈕狀態

| 狀態 | 樣式 |
|------|------|
| **Default** | `bg-primary shadow-sm` |
| **Hover** | `bg-primary-hover shadow-md` |
| **Focus** | `ring-2 ring-primary/30 ring-offset-2` |
| **Loading** | 文字換成 `Loader2 animate-spin`，按鈕 `opacity-80 cursor-not-allowed` |
| **Disabled** | `opacity-50 cursor-not-allowed` |

---

## 9. 表單元素統一

### 9.1 Input

```
h-10 (40px) / h-11 (44px for login)
bg-background border border-border rounded-lg
px-3 text-sm
placeholder:text-muted-foreground/60

focus: border-primary ring-2 ring-primary/10 (shadow-focus)
hover: border-muted-foreground/30
disabled: opacity-50 cursor-not-allowed bg-muted
```

### 9.2 Select

同 Input 樣式 + `cursor-pointer` + 右側 chevron icon

### 9.3 Button 系統

| 變體 | 樣式 |
|------|------|
| **Primary** | `bg-primary text-white shadow-sm hover:bg-primary-hover hover:shadow-md` |
| **Secondary** | `bg-muted text-foreground hover:bg-accent` |
| **Ghost** | `text-muted-foreground hover:bg-accent hover:text-foreground` |
| **Danger** | `bg-danger text-white hover:bg-danger/90` |
| **Outline** | `border border-border bg-background text-foreground hover:bg-accent` |

所有按鈕：`rounded-lg h-9 px-4 text-sm font-medium transition-all duration-150`

---

## 10. 狀態系統

### 10.1 Loading

```
┌──────────────────────────────────┐
│                                   │
│         ◉ (indigo spinner)       │
│         載入中...                 │
│                                   │
└──────────────────────────────────┘
```

- Spinner 改為 indigo 色（`text-primary`）
- Skeleton loading：`bg-muted animate-pulse rounded-lg` 用於已知佈局的區域
- 按鈕 loading：圖標換 spinner + 文字不變 + `opacity-80`

### 10.2 Empty

```
┌──────────────────────────────────┐
│                                   │
│         📭 (淡化圖標)             │
│                                   │
│      尚無任務                      │
│      點擊「新增」建立第一項任務      │
│                                   │
│      [ + 新增任務 ]               │  ← Primary button CTA
│                                   │
└──────────────────────────────────┘
```

- 圖標用 `text-muted-foreground/30`（極淡）
- 主文字 `text-foreground/60 font-medium`
- 說明文字 `text-muted-foreground text-xs`
- **加入 CTA 按鈕**（現有設計缺少）

### 10.3 Error

```
┌──────────────────────────────────┐
│                                   │
│     ⚠️ (danger 色)               │
│                                   │
│   載入失敗                         │
│   無法連線到伺服器，請檢查網路      │
│                                   │
│   [ 🔄 重試 ]                     │  ← Outline button
│                                   │
└──────────────────────────────────┘
```

---

## 11. Dark Mode 實作

### 11.1 切換機制

- `html` 標籤加 `class="dark"` toggle
- 使用 `localStorage` 持久化偏好
- Topbar 右側加入 Sun/Moon toggle button
- 首次載入：偵測 `prefers-color-scheme`，無偏好預設 light

### 11.2 暗色調整原則

| Light | Dark | 原則 |
|-------|------|------|
| 白底 | zinc-950 底 | 背景反轉 |
| shadow-card | shadow 加深 | 暗色需更深陰影 |
| border 灰色 | border 更深灰 | 邊界稍微明顯 |
| text 黑色 | text 淡白 | 不用純白，用 93% |
| primary 不變 | primary 不變 | Indigo 在暗底依然鮮明 |
| 彩色 pill 背景 | 彩色 pill 用 /15 透明度 | 暗底上彩色需更透明 |

---

## 12. Responsive 策略

### 12.1 斷點

| 斷點 | 寬度 | 行為 |
|------|------|------|
| `< 640px` (mobile) | < 640px | Sidebar 隱藏，hamburger menu，單欄佈局 |
| `640-1024px` (tablet) | 640-1024px | Sidebar 收合 (64px)，2 欄 grid |
| `> 1024px` (desktop) | > 1024px | Sidebar 展開 (240px)，4 欄 grid |

### 12.2 Kanban Responsive

- Desktop: 5 欄水平排列
- Tablet: 3 欄 + 水平滾動
- Mobile: **列表模式**（非看板），任務卡片上下堆疊

### 12.3 Dashboard Responsive

- Desktop: 4-col stat grid
- Tablet: 2-col stat grid
- Mobile: 2-col stat grid（更窄），卡片 full width

---

## 13. 實作步驟（執行順序）

### Step 1 — 設計基礎層（~4h）
**檔案：** `globals.css`, `tailwind.config.ts`, `app/layout.tsx`
- 替換所有 CSS variables（§0.1 完整色彩系統）
- tailwind.config 加入 shadow 和 radius 自定義
- 加入 dark mode class 支援
- 加入全域 transition

### Step 2 — Sidebar 重建（~3h）
**檔案：** `app/components/sidebar.tsx`
- 導航分組（§2.2）
- Active indicator 改為左邊界色條
- Logo 區改造
- 收合/展開動畫優化

### Step 3 — Topbar 改造（~2h）
**檔案：** `app/components/topbar.tsx`
- 加入頁面標題（從 pathname 推導）
- 加入 theme toggle
- User dropdown 改造
- 通知 badge indigo 圓點

### Step 4 — 狀態元件升級（~2h）
**檔案：** `app/components/page-states.tsx`
- Loading: indigo spinner + skeleton variant
- Empty: 加入 CTA 按鈕
- Error: 改善視覺層次

### Step 5 — 登入頁重設計（~2h）
**檔案：** `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`
- Logo 方塊 + TITAN 文字
- 表單卡片加大陰影和圓角
- 輸入框 44px 高度

### Step 6 — Dashboard 改造（~4h）
**檔案：** `app/(app)/dashboard/page.tsx`
- StatCard 升級（大數字 + 趨勢）
- 問候語 + 日期
- KPI 進度條漸層色
- 雙欄佈局

### Step 7 — TaskCard + Kanban 改造（~4h）
**檔案：** `app/components/task-card.tsx`, `app/(app)/kanban/page.tsx`
- TaskCard shadow 設計 + hover 動畫
- Category/Priority pill 重設計
- Column header 簡化（色點取代色塊）
- 新增任務按鈕 primary 化

### Step 8 — 表單元素統一（~2h）
**檔案：** `app/components/task-detail-modal.tsx`, `app/components/task-filters.tsx`
- Input/Select/Button 統一樣式
- Modal 改用 `shadow-lg rounded-2xl`
- 篩選器改為 pill-style 選擇器

### Step 9 — 剩餘頁面適配（~4h）
**檔案：** 所有 `app/(app)/*/page.tsx`
- Plans, KPI, Knowledge, Timesheet, Reports, Gantt
- 統一卡片、標題、間距風格
- Tab 改為 underline-active 風格

### Step 10 — Dark Mode 完善（~3h）
- 所有元件暗色變體測試
- CSS variable `.dark` 區塊完善
- Theme toggle localStorage 持久化
- `prefers-color-scheme` 初始偵測

---

## 14. 預期效果對比

| 維度 | 現狀 | 改造後 |
|------|------|--------|
| 視覺層次 | 平坦（所有卡片同樣邊框） | 多層（shadow 梯度區分重要性） |
| 品牌感 | 無（通用藍灰） | 有（Indigo accent + TITAN logo block） |
| 資訊密度 | 鬆散 | 適中（大數字突出 + 緊湊列表） |
| 互動反饋 | 最小（hover 變色） | 豐富（shadow 提升 + translateY + transition） |
| 狀態覆蓋 | 基本 | 完整（loading/empty/error 含 CTA） |
| 暗色支援 | 無 | 完整 dark mode |
| 行動裝置 | 部分 | 完整 responsive |

---

## 15. 不在此次範圍

- 動畫庫引入（framer-motion 等）— 用 CSS transition 已足夠
- shadcn/ui 元件庫正式導入 — 維持手寫元件，避免大規模重構
- 圖表庫 — 維持現有 SVG/CSS 進度條
- 路由切換動畫

---

## SESSION_ID

- CODEX_SESSION: N/A
- GEMINI_SESSION: N/A（codeagent-wrapper 不可用）
