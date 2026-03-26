# TITAN 系統完善規劃

> **規劃日期：** 2026-03-24
> **系統定位：** 銀行 IT 團隊（5人）工作管理平台，封閉內網部署
> **當前狀態：** MVP 核心功能已完成，進入品質強化與生產上線準備階段

---

## 1. 系統定位與目標重新確認

### 1.1 核心定位

TITAN 的定位是 **「5 人 IT 團隊的一體化工作管理系統」**，取代 Excel + Email + 紙本：

| 維度 | 核心價值 | 量化目標 |
|------|----------|----------|
| **任務追蹤** | KPI → 年計畫 → 月目標 → 任務 → 子任務，雙向追溯 | 100% 任務可追溯 |
| **工時透明** | 6 類工時分類，計畫外負荷可視化 | 每週節省 16.5h 行政作業 |
| **知識累積** | Markdown 知識庫 + 版本歷史 | 交接零知識流失 |
| **合規稽核** | 全操作 AuditLog + 變更追蹤 | ISO 27001 / 金管會合規 |
| **向上呈報** | 週報/月報/KPI/負荷報表自動生成 | 報告產出時間 < 5 分鐘 |

### 1.2 使用者角色

| 角色 | 人數 | 核心場景 |
|------|------|----------|
| Manager（主管） | 1 | 團隊全局、KPI 設定、任務分派、報表呈報 |
| Engineer（工程師） | 4 | 個人任務、工時填報、知識文件、進度更新 |

---

## 2. 現狀評估（完成度分析）

### 2.1 功能完成度

```
█████████████████████████████████████████████░░░░░ 90%
```

| 模組 | 完成度 | 說明 |
|------|--------|------|
| 認證與權限 | ██████████ 100% | JWT/JWE + RBAC + 密碼政策 + 帳號鎖定 |
| 任務管理 | ██████████ 100% | CRUD + 看板 + 篩選 + A/B角 + 6分類 |
| 年度計畫 | ██████████ 100% | 計畫樹 + 月目標 + 里程碑 + 範本複製 |
| KPI | ██████████ 100% | 設定 + 連結任務 + 達成率計算 |
| 工時紀錄 | ██████████ 100% | 6類工時 + 週表 + 統計 |
| 知識庫 | ██████████ 100% | Markdown + 版本 + 搜尋 + 樹狀目錄 |
| 報表 | █████████░ 90% | 週/月/KPI/負荷/延期報表，Excel 匯出 |
| Dashboard | ██████████ 100% | 主管/工程師雙視角 |
| 通知 | ██████████ 100% | 站內通知鈴 |
| 甘特圖 | ██████████ 100% | 時程 + 里程碑 + 任務條 |

### 2.2 安全完成度

```
█████████████████████████████████████████████░░░░░ 90%
```

| 安全控制 | 完成度 | 缺口 |
|----------|--------|------|
| JWT/JWE 認證 | ✅ 完成 | — |
| CSRF 防護 | ✅ 完成 | — |
| Rate Limiting | ✅ 完成 | — |
| Account Lock | ✅ 完成 | — |
| Audit Log | ✅ 完成 | — |
| RBAC | ✅ 完成 | — |
| Session 管理 | ✅ 完成 | — |
| CSP Header | ⚠️ 部分 | #190: 仍使用 unsafe-inline |
| 密碼歷史 | ❌ 未做 | #201: Phase 2 項目 |

### 2.3 品質完成度

| 面向 | 現狀 | 目標 |
|------|------|------|
| Jest 測試 | ~930 tests | Services 層需達 80%+ (#193) |
| E2E 測試 | ~40 tests | 需補 Reports empty state (#177) |
| A11y | 基本合規 | 需修 A11y violations (#177) |
| 文件 | 30+ docs | CEO/CIO 文件已就位 |

---

## 3. 分階段完善規劃

### Phase 0：完成進行中修復（本週）

**目標：** 關閉所有 in-progress 的 bug fix

| 優先序 | Issue | 內容 | 估時 |
|--------|-------|------|------|
| 1 | #217 | restore.sh 認證變數修復 | 2h |
| 2 | #214 | infra 腳本 TDD 覆蓋 | 4h |

**交付標準：** 兩個 PR merged，CI green

---

### Phase 1：生產品質門檻（1-2 週）

**目標：** 達到 Go-Live 最低品質標準

#### Step 1.1 — CSP 強化（#190）
- **動作：** 移除 next.config.ts 中的 `unsafe-inline` / `unsafe-eval`
- **方案：** 使用 nonce-based CSP（Next.js 內建支援）
- **風險：** shadcn/ui 的 inline style 可能需要調整
- **估時：** 6h
- **交付：** CSP header 驗證通過，無 console 違規

#### Step 1.2 — Services 測試覆蓋率 80%+（#193）
- **動作：** 補充 services/ 目錄下的單元測試
- **現狀：** 部分 service 覆蓋率不足
- **優先補充對象（按業務重要性排序）：**
  1. `task-service.ts` — 核心業務
  2. `time-entry-service.ts` — 工時計算準確性
  3. `plan-service.ts` — 進度彙整邏輯
  4. `kpi-service.ts` — 達成率計算
  5. `permission-service.ts` — RBAC 邏輯
- **估時：** 16h
- **交付：** `npx jest --coverage` 顯示 services/ ≥ 80%

#### Step 1.3 — 測試跟進（#177）
- **動作：**
  - Reports 頁面 empty state 測試
  - A11y violations 修復（axe-core 報告的問題）
  - Visual regression：Engineer 視角基準截圖
- **估時：** 8h
- **交付：** E2E 全部 green，A11y zero violations

**Phase 1 總估時：30h**

---

### Phase 2：可靠性與可觀測性（2-4 週）

**目標：** 生產環境可維運、可診斷

#### Step 2.1 — Request Correlation ID（#199）
- **動作：** 在 middleware 產生 `X-Request-ID`，貫穿 API → Service → Audit Log
- **價值：** 出問題時可依 ID 串連完整請求鏈路
- **實作要點：**
  - `middleware.ts` 產生 UUID v4
  - 注入 `request.headers`，API handler 讀取並傳遞
  - `logger.ts` (pino) 自動附加 requestId
  - AuditLog 新增 `requestId` 欄位
- **估時：** 4h

#### Step 2.2 — 前端錯誤追蹤（#196）
- **動作：**
  - 全域 Error Boundary 元件（app/(app)/layout.tsx）
  - 錯誤回報 API（POST /api/errors）寫入結構化 log
  - 使用者友善的錯誤頁面（重試/回首頁）
- **估時：** 6h

#### Step 2.3 — Prometheus + Grafana 應用層監控（#195）
- **動作：**
  - Next.js 自訂 metrics endpoint (`/api/metrics`)
  - 核心指標：request latency (p50/p95/p99)、active sessions、error rate
  - Grafana dashboard 範本
  - Alerting rules（CPU > 80%, P95 > 5s, error rate > 2%）
- **估時：** 12h
- **注意：** 利用現有 docker-compose.monitoring.yml 基礎

#### Step 2.4 — 密碼歷史紀錄（#201）
- **動作：**
  - 新增 Prisma model `PasswordHistory`（userId, hash, createdAt）
  - 變更密碼時檢查最近 N 組（建議 N=5）
  - 在 `change-password` API 加入驗證
- **估時：** 4h

#### Step 2.5 — Load Test 基準（#202）
- **動作：**
  - 使用 `k6` 或 `autocannon` 建立基準測試腳本
  - 場景：5 concurrent users（實際規模）
  - 測量：login、dashboard load、task CRUD、report generation
  - 建立 baseline 文件
- **估時：** 6h

**Phase 2 總估時：32h**

---

### Phase 3：使用者體驗優化（4-6 週）

**目標：** 提升日常使用效率和舒適度

#### Step 3.1 — 鍵盤快捷鍵（#203）
- **動作：**
  - `Ctrl+K` / `⌘+K`：全域搜尋（Command Palette）
  - `N`：新增任務
  - `T`：切換 timesheet
  - `?`：快捷鍵說明
- **實作方式：** 使用 `cmdk` 套件（shadcn/ui 已有範例）
- **估時：** 8h

#### Step 3.2 — 投影機 Viewport 優化（#197）
- **動作：**
  - 1024px / 1280px 常見投影機解析度適配
  - 報表頁面的「投影模式」（加大字體、簡化佈局）
  - Dashboard 關鍵數字卡片放大
- **估時：** 6h

#### Step 3.3 — Dark Mode 支援（#204）
- **動作：**
  - 架構文件已定義暗色主題色彩系統（zinc-950 為底）
  - 目前實作可能是明亮主題（README 提到 "明亮主題"）
  - 加入 theme toggle（sidebar 底部）
  - 使用 Tailwind `dark:` class 做雙主題
  - 預設 dark mode（銀行 IT 偏好）
- **估時：** 10h
- **注意：** 架構文件 7.1 節已定義完整暗色色彩系統

**Phase 3 總估時：24h**

---

### Phase 4：架構演進（6-10 週）

**目標：** 為未來擴展和長期維護打基礎

#### Step 4.1 — next-auth v4 → v5 遷移（#200）
- **動作：**
  - 遷移到 Auth.js v5（Next.js 15 官方推薦）
  - 從 `pages/api/auth` 模式改為 App Router 原生 `auth()` 函式
  - 簡化 middleware 認證邏輯
- **風險：** 高，涉及認證核心，需完整回歸測試
- **估時：** 16h
- **前置條件：** Phase 1 測試覆蓋率達標

#### Step 4.2 — PostgreSQL Replication（#198）
- **動作：**
  - Primary-Replica 架構（1 primary + 1 replica）
  - 讀寫分離：報表查詢走 replica
  - docker-compose 新增 replica 服務
  - Prisma 設定 `readReplicas` datasource
- **估時：** 10h
- **價值：** 報表查詢不影響主庫效能 + 備援

#### Step 4.3 — LDAP/AD 整合（架構文件 P0）
- **動作：**
  - 新增 LDAP 認證 provider
  - 保留本地帳號作為 fallback
  - 對接銀行 Active Directory
  - 帳號同步機制（定期 sync 或 JIT provisioning）
- **估時：** 20h
- **注意：** 此為生產環境必要項目，已在架構文件列為 P0

**Phase 4 總估時：46h**

---

### Phase 5：進階功能（10+ 週，視需求排程）

**目標：** 增值功能，非上線必要

| 優先序 | 功能 | 說明 | 估時 |
|--------|------|------|------|
| P1 | 行信 API 通知 | 推播 P0 任務指派 + 每日摘要至行動裝置 | 12h |
| P1 | 審批機制 | Manager 啟用多層審批流程 | 16h |
| P2 | PDF 報表匯出 | `@react-pdf/renderer` 產生正式報表 | 8h |
| P2 | 行動端 RWD | 手機上快速填報工時 | 12h |
| P3 | BI 分析 | 跨年度趨勢、KPI 歷史對比 | 16h |
| P3 | 甘特圖拖曳調整 | 拖曳調整截止日 + 自動記錄 TaskChange | 8h |

---

## 4. 上線路徑建議

### 4.1 上線條件矩陣

| 條件 | 現狀 | Phase 0 後 | Phase 1 後 | 判定 |
|------|------|-----------|-----------|------|
| 核心功能 | ✅ 全部就位 | ✅ | ✅ | PASS |
| 安全控制 | ⚠️ CSP 待強化 | ⚠️ | ✅ | Phase 1 後 PASS |
| 測試覆蓋 | ⚠️ Services < 80% | ⚠️ | ✅ | Phase 1 後 PASS |
| A11y | ⚠️ 有 violations | ⚠️ | ✅ | Phase 1 後 PASS |
| 備份還原 | ⚠️ 認證變數 bug | ✅ | ✅ | Phase 0 後 PASS |
| 文件 | ✅ 完整 | ✅ | ✅ | PASS |
| UAT | ❌ 待執行 | ❌ | ✅ 可執行 | Phase 1 後 |

### 4.2 建議上線時程

```
         Phase 0      Phase 1         UAT        Go-Live
           ↓             ↓              ↓            ↓
Week 0 ──────── Week 1-2 ──────── Week 3 ──────── Week 4
 修復 bugs     品質門檻         使用者驗收      正式上線
                                                    │
                                              Phase 2-5
                                              持續改善 →
```

**建議：Phase 0 + Phase 1 完成後即可啟動 UAT → Go-Live。**
Phase 2-5 在上線後持續迭代。

---

## 5. 風險與緩解

| 風險 | 影響 | 緩解策略 |
|------|------|----------|
| next-auth v4 → v5 遷移導致認證中斷 | 高 | 先上線 v4 穩定版，v5 遷移作為 Phase 4 |
| CSP 強化後 shadcn/ui 元件失效 | 中 | 用 staging 環境充分測試，準備 rollback |
| LDAP 整合延遲（需行方 IT 協作） | 中 | 先以本地帳號上線，LDAP 作為並行 provider |
| 5 人團隊只有 1 位開發者 | 中 | 嚴格按優先級排序，Phase 0→1 優先保證上線品質 |
| 生產環境硬體限制（封閉內網） | 低 | Docker 所有映像已固定版本，不需外部網路 |

---

## 6. 技術決策記錄

### 為什麼不立即升級 Next.js 16？

- 目前使用 Next.js 15，功能完整且穩定
- 升級 16 涉及 middleware → proxy.ts 重命名、全面 async API 等
- 建議在 Phase 4 的 next-auth 遷移時一併評估
- 銀行環境穩定性優先於技術新穎性

### 為什麼先上線再做監控？

- 5 人團隊 = 極低負載，初期手動巡檢即可
- Prometheus/Grafana 在 docker-compose.monitoring.yml 已就位
- Phase 2 補充應用層 metrics 是增量工作，不阻塞上線

### 為什麼 Dark Mode 排在 Phase 3？

- 架構文件設計的是暗色主題，但目前實作為明亮主題
- 不影響功能，屬 UX 改善
- 建議在 UAT 後收集使用者偏好再決定預設主題

---

## 7. 各 Phase 與 GitHub Issue 對應

| Phase | Issues | 估時合計 |
|-------|--------|----------|
| Phase 0 | #217, #214 | 6h |
| Phase 1 | #190, #193, #177 | 30h |
| Phase 2 | #199, #196, #195, #201, #202 | 32h |
| Phase 3 | #203, #197, #204 | 24h |
| Phase 4 | #200, #198, #220 | 46h |
| Phase 5 | #221, #222, #223, #224, #225, #226 | 72h+ |

**Phase 0→1 合計：36h（約 1-2 週全職開發）→ 可上線**
**Phase 0→4 合計：138h（約 3.5 週全職開發）→ 完整生產環境**

---

## SESSION_ID

此規劃由 Claude 單模型完成（外部模型工具不可用）。

- CODEX_SESSION: N/A
- GEMINI_SESSION: N/A
