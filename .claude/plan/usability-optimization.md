# TITAN 系統易用性優化計畫

## 分析方法

基於完整程式碼審查：69 個元件、115+ API routes、12 個頁面路由，從以下維度評估：
- 操作回饋 (Feedback)
- 導航效率 (Navigation)
- 錯誤處理 (Error Handling)
- 一致性 (Consistency)
- 可發現性 (Discoverability)
- 資訊密度 (Information Density)

---

## 問題分類與優化建議

### P0 — 嚴重影響日常使用（應優先處理）

#### 1. `alert()` / `confirm()` 濫用 — 破壞沉浸感

**現狀**: 全系統使用 24+ 處原生 `alert()`、4 處 `confirm()`，分佈在：
- `comment-list.tsx` (4 處)
- `task-detail-modal.tsx` (1 處)
- `kanban/page.tsx` (1 處)
- `knowledge/page.tsx` (3 處)
- `admin/page.tsx` (2 處)
- `gantt/page.tsx` (1 處)
- `settings/page.tsx` (1 處)
- 其餘散布在 task-detail 子元件

**問題**: 原生 alert/confirm 無法自訂樣式、阻斷 UI 線程、在 dark mode 下突兀、無法 undo。

**建議**:
- 引入 Toast 通知系統（已有 `sonner` 在 3 個檔案使用，但未統一）
- 成功/失敗操作 → Toast（自動消失 3-5 秒）
- 破壞性操作（刪除、停用）→ 自訂 AlertDialog 元件（含明確的「取消/確認」按鈕）
- 刪除操作提供 Undo Toast（5 秒內可撤銷），取代 confirm 對話框

**影響範圍**: 8+ 個元件檔案
**預估工作量**: 2-3 天

---

#### 2. 缺乏操作成功回饋

**現狀**: 多數 mutation 操作（儲存、更新狀態、拖放）只在失敗時 alert，成功時靜默。

**受影響場景**:
- 任務狀態拖放更新 → 無成功提示
- 工時填寫儲存 → 無確認
- 設定頁儲存 → 只有失敗 alert
- 評論發送 → 列表刷新但無提示
- 甘特圖時程更新 → 靜默

**建議**:
- 所有寫入操作添加 Toast 回饋：「任務已移至進行中」「工時已儲存」「設定已更新」
- 拖放操作添加微動畫（scale + opacity transition）確認狀態改變
- 儲存按鈕增加 loading → checkmark 動畫過渡

**影響範圍**: 全域（配合 Toast 系統統一處理）
**預估工作量**: 1-2 天（在 Toast 系統建立後）

---

### P1 — 明顯影響效率

#### 3. 缺乏 Breadcrumb 導航

**現狀**: 僅 `plans/page.tsx` 有 breadcrumb，其餘頁面只靠 Topbar 顯示頁面標題。

**問題**: 進入二級頁面（如任務詳情、KPI 子項）後無法判斷層級位置，只能靠 sidebar 或瀏覽器返回。

**建議**:
- 建立 `<Breadcrumb>` 共用元件
- 所有有層級的頁面自動產生：`首頁 / 任務看板 / T-042 修復登入流程`
- 點選 breadcrumb 可快速返回上層

**影響範圍**: layout 層 + 各子頁面
**預估工作量**: 1 天

---

#### 4. 兩套搜尋系統造成混淆

**現狀**:
- `CommandPalette`（392 行）：支援路由導航 + G+字母快捷鍵 + 多類型搜尋
- `GlobalSearchModal`（214 行）：Topbar 搜尋按鈕觸發，只搜文件/任務/評論
- 兩者都用 `Cmd+K` 觸發，但來源不同（CommandPalette 在 layout，GlobalSearchModal 在 Topbar）

**問題**: 使用者按 Cmd+K 可能觸發不同搜尋體驗，功能重疊但能力不同。

**建議**:
- 合併為單一 CommandPalette，作為唯一的全域搜尋入口
- 結構：「最近搜尋 → 快速導航 → 搜尋結果（任務/文件/KPI/人員）」
- Topbar 搜尋按鈕也觸發同一個 CommandPalette
- 移除 GlobalSearchModal，避免維護兩套邏輯

**影響範圍**: `command-palette.tsx`, `global-search-modal.tsx`, `topbar.tsx`
**預估工作量**: 1-2 天

---

#### 5. Mobile Nav 與 Sidebar Nav 不同步

**現狀**:
- Sidebar (`sidebar.tsx`): 5 組分類 + 角色判斷（Manager 看到駕駛艙/系統管理）
- Mobile Nav (`topbar.tsx` MOBILE_NAV): 扁平列表，10 項，**沒有角色判斷**

**問題**: Manager 在手機上看不到「駕駛艙」和「系統管理」入口。

**建議**:
- Mobile Nav 應從 Sidebar 的 `navGroups` 共用資料源
- 加入角色判斷邏輯
- 保持分組結構（或至少加入分隔線）

**影響範圍**: `topbar.tsx`, 可抽出 `nav-config.ts`
**預估工作量**: 0.5 天

---

#### 6. Tooltip 使用率極低

**現狀**: 全元件目錄僅 8 處使用 Tooltip（都在圖表元件），主要互動元件幾乎沒有 tooltip。

**受影響區域**:
- Sidebar 收合模式：icon-only 但只靠 `title` 屬性（瀏覽器原生 tooltip，延遲 1-2 秒）
- 任務卡片上的 priority/category badge 無解釋
- Topbar 的 icon buttons 靠 `title`，不夠即時
- 甘特圖的條狀圖無懸停資訊

**建議**:
- 引入統一的 `<Tooltip>` 元件（基於 Radix UI，即時顯示）
- 收合 sidebar 的 icon 使用 Tooltip 取代 title
- 任務卡片 badges 加 Tooltip（「P0 = 最高優先級」）
- 所有 icon-only button 加 Tooltip

**影響範圍**: 全域元件
**預估工作量**: 1-2 天

---

### P2 — 體驗優化

#### 7. Guided Tour 僅 3 步，覆蓋不足

**現狀**: `guided-tour.tsx` 提供 3 步引導（今日總覽 → 建任務 → 記工時），純文字說明，無高亮指向。

**建議**:
- 增加指向性高亮（spotlight mask 指向實際 DOM 元素）
- 增加更多步驟：Command Palette 快捷鍵、甘特圖、報表匯出
- 支援「稍後再看」+ 在設定頁重新觸發

**預估工作量**: 2 天

---

#### 8. 表單缺乏即時驗證

**現狀**: 大部分表單在提交時才驗證，錯誤以 `alert()` 顯示（如 `task-incident-section.tsx:121`）。

**建議**:
- 必填欄位在 blur 時驗證，即時顯示 inline error
- 儲存按鈕在表單無效時 disabled + tooltip 說明原因
- 移除所有 alert-based 驗證提示

**預估工作量**: 2 天

---

#### 9. 缺乏批次操作

**現狀**: Kanban 看板一次只能操作一張卡片；工時一次填一格。

**建議**:
- Kanban 增加多選模式（checkbox）→ 批次移動狀態、批次指派
- 工時增加「複製上週」功能
- 知識庫增加批次標籤/歸檔

**預估工作量**: 3-4 天

---

#### 10. 缺乏鍵盤快捷鍵說明

**現狀**: 有豐富的快捷鍵（G+字母、Cmd+K、Ctrl+Enter、Tab 跳格）但無集中說明。

**建議**:
- 新增 `?` 鍵觸發快捷鍵說明 overlay
- 或在 Command Palette 底部顯示常用快捷鍵提示
- 首次使用時在 Guided Tour 提及

**預估工作量**: 0.5 天

---

## 實施步驟（建議順序）

### Step 1: Toast + AlertDialog 基礎設施（P0-1, P0-2）
- 安裝 sonner 或統一使用已有的 toast
- 建立 `<AlertDialog>` 確認元件
- 全域替換 alert() / confirm()
- 所有 mutation 加成功 Toast
- **Key files**: 新建 `app/components/ui/alert-dialog.tsx`, 修改 8+ 元件

### Step 2: 搜尋系統統一（P1-4）
- 合併 CommandPalette + GlobalSearchModal
- Topbar 搜尋按鈕指向 CommandPalette
- **Key files**: `command-palette.tsx`, `global-search-modal.tsx`, `topbar.tsx`

### Step 3: 導航一致性（P1-3, P1-5）
- 抽出 `nav-config.ts` 共用 sidebar/mobile 導航資料
- 建立 `<Breadcrumb>` 元件
- **Key files**: `sidebar.tsx`, `topbar.tsx`, 新建 `nav-config.ts`, `breadcrumb.tsx`

### Step 4: Tooltip 系統（P1-6）
- 引入 Radix Tooltip
- 全域 icon button + sidebar collapsed 使用
- **Key files**: 新建 `app/components/ui/tooltip.tsx`, 修改 sidebar/topbar/task-card

### Step 5: 表單驗證強化（P2-8）
- blur 即時驗證 + inline error
- 移除 alert-based 驗證
- **Key files**: `task-detail/` 子元件, `task-incident-section.tsx`, `task-change-management-section.tsx`

### Step 6: 快捷鍵說明 + Tour 強化（P2-7, P2-10）
- `?` 鍵觸發快捷鍵 overlay
- Guided Tour 增加 spotlight 高亮
- **Key files**: `guided-tour.tsx`, 新建 `keyboard-shortcuts-dialog.tsx`

### Step 7: 批次操作（P2-9）
- Kanban 多選 + 批次狀態轉移
- 工時「複製上週」
- **Key files**: `kanban/page.tsx`, `timesheet/` 元件

---

## 風險與緩解

| 風險 | 緩解措施 |
|------|----------|
| Toast 替換影響測試（24+ 處 alert mock） | 分批替換，每批跑完 Jest + E2E |
| CommandPalette 合併可能丟失 GlobalSearch 功能 | 先列出功能矩陣，確認無遺漏再移除 |
| Tooltip 大量引入可能影響渲染效能 | 使用 Radix Tooltip（懶渲染），不預掛 DOM |
| 批次操作涉及 API 併發 | 使用 Promise.allSettled + 部分成功 Toast |

---

## 技術方案

- **Toast**: `sonner`（已部分使用，統一即可）
- **AlertDialog**: 基於 Radix UI `@radix-ui/react-alert-dialog`
- **Tooltip**: `@radix-ui/react-tooltip`
- **Breadcrumb**: 自建（讀取 pathname 產生層級）
- **Spotlight Tour**: `driver.js` 或自建（CSS mask approach）

---

## 量化預期

| 指標 | 現狀 | 優化後預期 |
|------|------|-----------|
| 原生 alert/confirm 使用 | 28 處 | 0 處 |
| 操作無回饋的 mutation | ~15 處 | 0 處 |
| 搜尋入口 | 2 套重疊 | 1 套統一 |
| Mobile nav 缺失項目 | 2 項（駕駛艙、系統管理） | 0 項 |
| Tooltip 覆蓋率 | ~3% icon buttons | 100% icon-only buttons |
| 即時表單驗證 | 0 個表單 | 全部關鍵表單 |

## 總預估工作量

7 個 Step，約 **12-16 人天**，建議分 3-4 個 Sprint 逐步交付。
