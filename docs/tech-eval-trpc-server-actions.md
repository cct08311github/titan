# Tech Evaluation: tRPC vs Server Actions vs REST API

> Issue: #400
> Date: 2026-03-25
> Status: Evaluation
> **Decision: REJECTED** — 維持 REST API Routes，已有完整 56 個 route handlers + Zod 驗證。tRPC 遷移成本過高，Server Actions 適用於簡單表單但不適合取代 REST。

## 1. 背景

TITAN 目前有 56 個 REST API route handlers（`app/api/**/route.ts`），涵蓋：
- CRUD: tasks, plans, goals, KPI, time-entries, users, documents, deliverables, subtasks, milestones
- Reports: weekly, workload, monthly, trends, delay-change, kpi, export
- Auth: login, change-password, reset-password
- Admin: backup-status, generate-reset-token
- System: health, metrics, notifications, search, permissions, audit, error-report

Client-side 透過 `fetch()` / `useApi` hook 與 REST API 互動。所有路由使用 `withAuth` / `withManager` middleware wrapper 做驗證。

## 2. 候選方案

### 2.1 tRPC

| 面向 | 說明 |
|------|------|
| 原理 | 端對端型別安全 RPC。Server 定義 procedure，Client 透過 proxy 呼叫，完全不寫 fetch |
| 優點 | 零 API schema drift、自動推斷輸入/輸出型別、內建 Zod 驗證 |
| 缺點 | 需要 tRPC server adapter + client wrapper；不適合外部 API 消費者；學習曲線 |
| Bundle | ~15 KB gzip (client + react-query adapter) |
| 與 Next.js 整合 | `@trpc/next` 支援 App Router，但需額外設定 |

### 2.2 React Server Actions (Next.js 15)

| 面向 | 說明 |
|------|------|
| 原理 | `'use server'` 函式直接在 Server 執行，Client 呼叫如同一般函式 |
| 優點 | 零額外依賴、與 Next.js 深度整合、支援 progressive enhancement（form action） |
| 缺點 | 限 mutation（POST）；不適合 GET 查詢；錯誤處理需自行封裝；不可被外部系統呼叫 |
| Bundle | 0 KB（內建） |
| 與 Next.js 整合 | 原生支援 |

### 2.3 REST API（現況）

| 面向 | 說明 |
|------|------|
| 原理 | `app/api/**/route.ts`，標準 HTTP method routing |
| 優點 | 通用、可被外部系統呼叫（Outline webhook、future mobile app）、團隊已熟悉 |
| 缺點 | 手動維護 fetch URL 字串、型別不自動同步（需手動定義 response type） |

## 3. TITAN 路由分類分析

### 3.1 適合 Server Actions 的路由（mutation-heavy、僅前端使用）

| 路由 | 理由 |
|------|------|
| `POST /api/tasks` | 建立任務 — 表單提交 |
| `PATCH /api/tasks/[id]` | 更新任務（含狀態拖拉） |
| `POST /api/time-entries` | 記錄工時 — 表單提交 |
| `POST /api/plans` | 建立年度計畫 |
| `POST /api/goals` | 建立月度目標 |
| `POST /api/kpi` | 建立 KPI |
| `PATCH /api/kpi/[id]` | 更新 KPI 實際值 |
| `POST /api/notifications/read-all` | 全部已讀 |
| `POST /api/auth/change-password` | 密碼變更 |

### 3.2 必須保持 REST 的路由（外部存取 / GET 查詢 / 系統整合）

| 路由 | 理由 |
|------|------|
| `GET /api/tasks` | Dashboard / Kanban / Gantt 多處查詢 |
| `GET /api/reports/*` | 報表查詢（可能被外部 BI 工具存取） |
| `GET /api/health` | 健康檢查（nginx / Docker / 監控系統） |
| `GET /api/metrics` | Prometheus 格式指標 |
| `*/api/auth/[...nextauth]` | NextAuth.js 回調路由 |
| `POST /api/tasks/import` | CSV 匯入（檔案上傳） |
| `GET /api/reports/export` | Excel 匯出（binary response） |
| `GET /api/audit` | 稽核紀錄（合規要求需保持可追蹤的 HTTP endpoint） |
| `POST /api/error-report` | Error boundary 自動回報 |

### 3.3 適合 tRPC 的路由（端對端型別安全價值高）

tRPC 對 TITAN 的價值主要在「CRUD + 複雜 filter」的場景：
- `GET /api/tasks?assignee=me&status=TODO,IN_PROGRESS` — 多參數查詢
- `GET /api/kpi?year=2026` — 年度查詢
- `GET /api/documents/search?q=...` — 全文搜尋

但這些路由用 REST + Zod 共用 schema（#396）已能達到型別安全。

## 4. 建議

**推薦：漸進式引入 Server Actions（mutation 路由）+ 保留 REST（查詢 + 外部整合）**

不推薦引入 tRPC，理由：
1. **ROI 不足** — TITAN 已有 56 個 REST route，全面遷移成本極高
2. **外部整合需求** — health、metrics、audit、export 等路由必須保持 REST
3. **Zod 共用 schema (#396) 已解決型別 drift** — tRPC 最大賣點被替代方案覆蓋
4. **額外依賴** — 銀行環境需審核新依賴，tRPC + react-query adapter 增加 supply chain 風險
5. **團隊學習成本** — 同時維護 tRPC + REST 增加認知負擔

推薦 Server Actions，理由：
1. **零額外依賴** — Next.js 15 內建
2. **表單提交最佳化** — progressive enhancement、自動序列化
3. **與 Zod 整合自然** — `'use server'` 函式直接呼叫 `validateBody(schema, formData)`
4. **漸進遷移** — 可逐步將 mutation route 改為 Server Action，不影響既有 GET 查詢

## 5. 遷移計畫

### Phase 1 — 基礎建設（0.5 天）
1. 建立 `lib/actions/` 目錄
2. 建立 `lib/actions/safe-action.ts` — 封裝 Zod 驗證 + 錯誤處理的 Server Action wrapper

```typescript
// lib/actions/safe-action.ts
'use server';

import { ZodSchema } from 'zod';
import { auth } from '@/auth';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string[]> };

export async function safeAction<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  input: unknown,
  handler: (data: TInput, userId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: '未登入' };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: '輸入驗證失敗', fields: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  try {
    const result = await handler(parsed.data, session.user.id);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '操作失敗' };
  }
}
```

### Phase 2 — 試點遷移（1 天）
選擇 2-3 個 mutation 路由作為試點：
1. `POST /api/tasks` → `lib/actions/task-actions.ts`
2. `POST /api/time-entries` → `lib/actions/time-entry-actions.ts`
3. `POST /api/notifications/read-all` → `lib/actions/notification-actions.ts`

### Phase 3 — 全面遷移 mutation 路由（2-3 天）
將所有 3.1 中列出的 mutation 路由改為 Server Actions。

### Phase 4 — 清理（0.5 天）
移除已被 Server Action 取代的 REST route handlers（保留 GET 路由）。

## 6. 決策矩陣

| 方案 | 遷移成本 | 維護性 | 型別安全 | 外部整合 | 建議 |
|------|---------|--------|---------|---------|------|
| 全面 tRPC | 高 | 中 | 優 | 差（需額外 REST） | 不推薦 |
| 全面 Server Actions | 中 | 中 | 良 | 差（GET 不適用） | 不推薦 |
| Server Actions (mutation) + REST (query) | 低 | 高 | 良 | 良 | **推薦** |
| 維持現況 REST only | 零 | 中 | 中 | 良 | 可接受 |

## 7. 風險

| 風險 | 緩解 |
|------|------|
| Server Actions 不支援 streaming binary response | Export/Import 保持 REST route handler |
| Server Actions 的錯誤邊界與 REST 不同 | `safeAction` wrapper 統一錯誤格式 |
| Server Actions POST-only 限制 | GET 查詢保持 REST，不受影響 |
| 並行兩種模式增加認知負擔 | 明確規則：mutation = Server Action, query = REST |
