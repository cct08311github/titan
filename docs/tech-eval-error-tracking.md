# Tech Evaluation: Error Tracking Solutions

> Issues: #403, #410
> Date: 2026-03-25
> Status: Evaluation

## 1. 現況分析

TITAN 目前的錯誤追蹤機制：

### 1.1 前端 Error Boundary（Issue #196）
- `app/(app)/error.tsx` — 捕獲 App route group 內的 React 錯誤
- `app/global-error.tsx` — 捕獲全域未處理錯誤
- 錯誤自動 POST 到 `/api/error-report`

### 1.2 Error Report API
- `POST /api/error-report` — 接收前端錯誤，寫入 `AuditLog` 表
- 記錄: message, digest, source, url, userAgent, ipAddress
- 使用 Pino logger 寫入結構化日誌

### 1.3 AuditLog
- Prisma model，同時記錄 auth 事件、CRUD 操作、前端錯誤
- 透過 `GET /api/audit` 可查詢
- Admin 頁面可瀏覽

### 1.4 現況限制
| 限制 | 影響 |
|------|------|
| 無錯誤聚合/去重 | 同一錯誤可能產生數百筆 AuditLog |
| 無 stack trace 關聯 | 前端 digest 與 server error 無法關聯 |
| 無告警通知 | 錯誤必須手動查 AuditLog 才會發現 |
| 無趨勢分析 | 無法看到錯誤頻率變化 |
| 無 release 關聯 | 無法判斷哪個部署引入了新錯誤 |
| AuditLog 混雜 | 安全事件與應用程式錯誤混在同一張表 |

## 2. 候選方案

### 2.1 GlitchTip（自建）

[GlitchTip](https://glitchtip.com/) 是開源的 Sentry 相容替代品。

| 面向 | 說明 |
|------|------|
| 授權 | MIT License |
| 部署 | Docker Compose（Django + PostgreSQL + Redis） |
| Sentry SDK 相容 | 完整支援 `@sentry/nextjs` SDK |
| 功能 | 錯誤聚合、堆疊追蹤、release 追蹤、效能監控（基本）、告警（email/webhook） |
| 資源需求 | 2 CPU / 2 GB RAM / 10 GB disk（小型部署） |
| 優點 | 資料完全自建、Sentry SDK 生態系、免費 |
| 缺點 | 需自行維護、功能比 Sentry 少（無 session replay、無 profiling）、社群較小 |

### 2.2 Self-hosted Sentry

| 面向 | 說明 |
|------|------|
| 授權 | BSL (Business Source License) — 自建免費，限制衍生 SaaS |
| 部署 | Docker Compose（20+ 容器：Kafka, ClickHouse, Redis, PostgreSQL...） |
| 功能 | 完整：錯誤聚合、performance、profiling、session replay、cron monitoring |
| 資源需求 | 8 CPU / 16 GB RAM / 100 GB disk（官方最低建議） |
| 優點 | 功能最完整、SDK 最成熟、大量文件與社群支援 |
| 缺點 | 資源需求極高、維護複雜度高（20+ 容器）、BSL 授權限制 |

### 2.3 維持 AuditLog + 增強（最小變更）

| 面向 | 說明 |
|------|------|
| 方案 | 在現有 AuditLog 基礎上增加錯誤聚合視圖 + 告警 |
| 實作 | 1. 新增 `ErrorDigest` 表做去重統計 2. Cron job 檢查錯誤頻率 3. 觸發 webhook 告警 |
| 優點 | 零新依賴、零新基礎設施、與現有 Admin 頁面整合 |
| 缺點 | 無 source map 解析、無 performance 監控、自行開發成本高 |

## 3. 決策矩陣

| 面向 | AuditLog 增強 | GlitchTip | Self-hosted Sentry |
|------|-------------|-----------|-------------------|
| 部署複雜度 | 低 | 中 | 高 |
| 維護成本 | 低 | 中 | 高 |
| 資源需求 | 無新增 | 2 CPU / 2 GB | 8 CPU / 16 GB |
| 錯誤聚合 | 需自建 | 內建 | 內建 |
| Stack trace 解析 | 無 | 支援 | 支援 |
| Source map | 無 | 支援 | 支援 |
| 告警通知 | 需自建 | Email + Webhook | 完整（Slack/Email/PagerDuty） |
| Release 追蹤 | 無 | 支援 | 支援 |
| Performance 監控 | 無 | 基本 | 完整 |
| 銀行合規（資料自建） | 符合 | 符合 | 符合 |
| SDK 生態系 | 自訂 | @sentry/nextjs | @sentry/nextjs |

## 4. 建議

**推薦：GlitchTip（自建）**

理由：
1. **功能覆蓋 TITAN 需求** — 錯誤聚合、去重、stack trace、告警是核心需求；GlitchTip 全部內建
2. **資源合理** — 2 CPU / 2 GB 可加入現有 Docker Compose，不需額外 server
3. **Sentry SDK 相容** — 使用 `@sentry/nextjs`，如未來需要升級至 self-hosted Sentry，SDK 層不需更改
4. **資料自建** — 銀行合規要求資料不出內網，GlitchTip 完全符合
5. **與現有 Error Boundary 整合** — 用 `@sentry/nextjs` 替換手動 `fetch("/api/error-report")`，自動捕獲更多資訊
6. **MIT License** — 無授權風險

不推薦 Self-hosted Sentry，因為資源需求（16 GB）對 TITAN 規模過大。
不推薦僅增強 AuditLog，因為自建錯誤聚合/source map 解析的開發成本不值得。

## 5. 實施計畫

### Phase 1 — GlitchTip 部署（1 天）
1. 在 `docker-compose.yml` 中加入 GlitchTip 服務（web + worker + PostgreSQL）
2. 設定環境變數（`GLITCHTIP_DSN`, admin 帳號）
3. 透過 nginx reverse proxy 提供 `/glitchtip` 存取

### Phase 2 — SDK 整合（0.5 天）
1. `npm install @sentry/nextjs`
2. 建立 `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`
3. 設定 DSN 指向內網 GlitchTip 實例
4. 在 `next.config.ts` 加入 `withSentryConfig` wrapper

### Phase 3 — Error Boundary 整合（0.5 天）
1. 更新 `app/(app)/error.tsx` — 改用 `Sentry.captureException(error)` 取代手動 fetch
2. 更新 `app/global-error.tsx` — 同上
3. 可選：保留 `/api/error-report` 作為 fallback（Sentry SDK 載入失敗時）

### Phase 4 — 告警設定（0.5 天）
1. 在 GlitchTip 設定 project + alert rules
2. 新錯誤 → 發送 webhook 通知（可整合 Discord/Telegram）
3. 錯誤頻率突增 → 發送告警

### Phase 5 — AuditLog 分離（視需求）
1. 將 `FRONTEND_ERROR` 類型從 AuditLog 移除（錯誤已由 GlitchTip 管理）
2. AuditLog 專注於安全稽核事件（login, permission change, data access）

## 6. 關於 Issue #410

Issue #410（評估 GlitchTip）與本文件（#403）範圍完全重疊。GlitchTip 的評估已包含在上述第 2.1 節和第 4-5 節。建議關閉 #410 作為 #403 的 duplicate。
