# TITAN 測試指南

## 測試架構

### Layer 0: Safe Utilities
- `lib/safe-number.ts` — 所有前端數值格式化必須使用
- 禁止在 JSX 中直接呼叫 `.toFixed()`, `.toLocaleString()`

### Layer 1: 前端單元測試 (Jest + RTL)
- 目錄：`__tests__/pages/`
- 環境：jsdom
- Mock 策略：4 級（happy/empty/partial/malformed）

### Layer 1.5: Integration 測試
- 目錄：`__tests__/integration/`
- 環境：node
- Mock：Prisma + next-auth session

### Layer 2: E2E (Playwright)
- 目錄：`e2e/`
- 環境：Docker (titan-app + titan-db)
- Auth：globalSetup storageState

### Server Component 測試策略（ADR）
**決策：不直接用 RTL render Server Components。**
原因：Next.js 15 的 async Server Components 無法在 jsdom 中 render。
替代方案：
- UI 互動 → Layer 1 測 Client Components
- 資料載入/權限 → Layer 1.5 測 API routes + services
- 完整流程 → Layer 2 E2E

### Coverage Threshold
- 後端：80%
- 前端：70%
- 整體：75%

## 執行指令

```bash
# 全部單元 + Integration
npx jest --forceExit

# 只跑前端頁面測試
npx jest __tests__/pages/ --forceExit

# E2E（需要 Docker 環境）
npx playwright test

# E2E 更新 visual regression 基準
npx playwright test --update-snapshots
```

## Mock 範例

```typescript
// ── 4 級 Mock 策略 ────────────────────────────────────────────────

// Level 1 — happy: 完整有效資料
const DATA_HAPPY = {
  items: [{ id: 't1', title: '任務 A', status: 'IN_PROGRESS' }],
  totalHours: 40,
};

// Level 2 — empty: 空陣列 / null
const DATA_EMPTY = {
  items: [],
  totalHours: 0,
};

// Level 3 — partial: 遺漏欄位（模擬 schema 漂移）
const DATA_PARTIAL = {
  items: [{ id: 't2' /* title / status missing */ }],
  // totalHours missing
};

// Level 4 — malformed: 型別錯誤
const DATA_MALFORMED = {
  items: null as unknown as [],
  totalHours: 'forty' as unknown as number,
};

// 在測試中切換 mock 層級
mockFetch.mockResolvedValue({
  ok: true,
  json: async () => DATA_EMPTY,
} as Response);
```

## Empty State 規範

每個業務頁面必須在空資料時：
1. 顯示具說明性的中文標題（如「尚無任務」）
2. 顯示操作引導文字（如「請點擊「新增任務」開始」）
3. 不白屏、不 crash

測試位置：
- 單元測試：`__tests__/pages/<page>.test.tsx` 中的 "shows empty state guidance" 案例
- E2E 整合：`e2e/empty-state.spec.ts`（需要 Docker + 乾淨 DB）
