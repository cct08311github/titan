# Tech Evaluation: Playwright Component Testing

> Issue: #409
> Date: 2026-03-25
> Status: Evaluation
> **Decision: DEFERRED** — Jest + RTL 已覆蓋元件測試需求，Playwright CT 待 Phase 2 評估。

## 1. 現況

### 1.1 測試架構
TITAN 目前有三層測試：

| 層級 | 工具 | 範圍 | 檔案數量 |
|------|------|------|---------|
| Unit / Integration | Jest + @testing-library/react | 單元邏輯、API 整合 | `__tests__/`, `validators/__tests__/` |
| E2E | Playwright | 全端流程、跨頁面 journey | `e2e/` (25+ spec 檔案) |
| 缺口 | — | **元件層級互動測試** | — |

### 1.2 測試缺口
- **Jest + JSDOM 限制**: 無真實瀏覽器 → 無法測試 CSS 計算、視覺回歸、intersection observer、複雜 DOM 互動
- **E2E 測試成本高**: 每個測試需要啟動 server + DB seed → 反饋慢、flaky
- **元件互動測試空白**: Dashboard 的圖表互動、Kanban 拖拉、表單元件的 keyboard navigation 等場景，用 JSDOM mock 不可靠，用 E2E 又太重

## 2. Playwright Component Testing (CT)

### 2.1 概念
Playwright CT 允許在真實瀏覽器中掛載單個 React 元件，無需啟動完整應用。

```tsx
// 範例: 測試 StatCard 元件
import { test, expect } from '@playwright/experimental-ct-react';
import { StatCard } from './StatCard';

test('renders value and label', async ({ mount }) => {
  const component = await mount(
    <StatCard label="本週完成任務" value={42} />
  );
  await expect(component).toContainText('本週完成任務');
  await expect(component).toContainText('42');
});

test('accent style when danger', async ({ mount }) => {
  const component = await mount(
    <StatCard label="逾期任務" value={5} accent />
  );
  // 真實瀏覽器 → 可檢查計算後的 CSS
  const value = component.locator('p').nth(1);
  await expect(value).toHaveCSS('color', 'rgb(239, 68, 68)');
});
```

### 2.2 運作原理
1. Playwright 啟動 Vite dev server（內建，無需自行設定）
2. 將測試檔案中的 `mount()` 呼叫編譯為真實的 React render
3. 在 Chromium/Firefox/WebKit 中執行
4. 測試完畢後銷毀元件

### 2.3 與現有 E2E 差異

| 面向 | E2E (`e2e/`) | Component Testing |
|------|-------------|-------------------|
| 啟動 | 需要 `next dev` + DB | 僅需 Vite bundler |
| 執行速度 | 慢（5-30s/test） | 快（0.5-2s/test） |
| 測試範圍 | 完整用戶流程 | 單一元件 + props |
| 網路請求 | 打真實 API | 可 mock（無 server） |
| CSS/視覺 | 完整 | 完整（真實瀏覽器） |
| 適用場景 | 跨頁面 journey、auth 流程 | 元件互動、視覺回歸、表單 |

## 3. TITAN 適用場景

### 3.1 高價值場景（建議優先測試）

| 元件 | 測試重點 | 為何 Jest 不夠 |
|------|---------|---------------|
| `TodayTasksCard` | 截止日倒數顯示、顏色變化 | CSS 計算需真實瀏覽器 |
| `KPIAchievementSection` | 進度條寬度、顏色閾值 | `style.width` 在 JSDOM 中不計算 |
| `ProgressBar` | 百分比 → 視覺寬度 | 同上 |
| `StatCard` | accent 顏色、responsive 佈局 | CSS class 計算 |
| Kanban Board（未來） | 拖拉互動 | 需要真實的 drag event |
| 表單元件 | keyboard navigation、focus 管理 | JSDOM focus 行為不完整 |

### 3.2 不適合 CT 的場景（保持 E2E）

| 場景 | 理由 |
|------|------|
| 登入流程 | 需要真實 auth server |
| 跨頁面導航 | 需要 Next.js router |
| API 整合 | 需要真實 DB 回應 |
| 權限控制 | 需要 session + RBAC |

## 4. 技術限制與注意事項

### 4.1 實驗性 API
Playwright CT 目前仍是 `@playwright/experimental-ct-react`，API 可能變更。但 Playwright 團隊表示計畫在穩定後移入核心。

### 4.2 Next.js 特殊性
- CT 使用 Vite 而非 Next.js bundler → `next/image`, `next/link` 等元件需要 mock 或 wrapper
- `@/` 路徑別名需要在 `ct.vite.config.ts` 中設定
- Server Components 無法直接 mount（需轉為 Client Component wrapper）

### 4.3 Tailwind CSS
需要在 CT 的 Vite config 中引入 Tailwind CSS，否則樣式不會生效。

## 5. 建議

**推薦：引入 Playwright Component Testing 作為中間層**

理由：
1. **填補測試缺口** — 在 Jest (JSDOM) 和 E2E 之間建立元件層級的真實瀏覽器測試
2. **共用 Playwright 基礎設施** — TITAN 已安裝 `@playwright/test`，學習成本低
3. **測試速度快** — 不需要啟動 Next.js server，適合 CI 快速反饋
4. **視覺回歸** — 可搭配 `toHaveScreenshot()` 做元件級 visual regression

風險可接受：
- 實驗性 API → 但 TITAN 測試檔案數量可控，遷移成本低
- Vite 設定 → 一次性投入，之後共用

## 6. 實施計畫

### Phase 1 — 基礎建設（0.5 天）
```bash
npm install -D @playwright/experimental-ct-react
```
1. 建立 `playwright-ct.config.ts`
2. 建立 `playwright/index.tsx`（CT 入口，引入 Tailwind + 全域 CSS）
3. 設定 Vite alias（`@/` → `./`）

### Phase 2 — 試點測試（1 天）
測試 3-5 個純 UI 元件：
1. `StatCard` — props → render
2. `ProgressBar` — pct → width
3. `PageLoading` / `PageError` / `PageEmpty` — 狀態顯示
4. `TodayTasksCard`（mock fetch）— 倒數文字 + 顏色

### Phase 3 — CI 整合（0.5 天）
1. 在 CI pipeline 加入 `npx playwright test -c playwright-ct.config.ts`
2. 與 E2E 測試分開執行（CT 不需要 server）

### Phase 4 — 擴展（持續）
新元件開發時同步撰寫 CT 測試，逐步覆蓋既有元件。

## 7. 風險

| 風險 | 緩解 |
|------|------|
| 實驗性 API 變更 | 鎖定版本，追蹤 Playwright changelog |
| Vite + Next.js 元件不相容 | 建立 wrapper/mock 層隔離 Next.js 特殊元件 |
| 團隊需要學習 CT 概念 | CT API 與 E2E 一致（同為 Playwright），學習曲線極低 |
| 與 Jest 測試重疊 | 明確分工：Jest 測邏輯，CT 測視覺/互動，E2E 測流程 |
