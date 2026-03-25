# 技術評估：Mutation Testing

> Issue #377 — 缺少 mutation testing，不知測試是否真驗邏輯

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 評估完成
**Decision**: **DEFERRED** — Phase 2 導入 Stryker，v1.0 專注提升測試覆蓋率
**結論**: 建議 Phase 2 導入 Stryker，v1.0 專注提升測試覆蓋率

---

## 1. 什麼是 Mutation Testing

Mutation testing 透過在程式碼中注入小型變異（mutants）來驗證測試套件的有效性。
如果測試未偵測到變異（mutant 存活），表示該程式碼路徑的測試不夠強。

**核心指標**：Mutation Score = 被殺死的 mutants / 總 mutants × 100%

---

## 2. Stryker-JS 評估

### 2.1 概述

[Stryker Mutator](https://stryker-mutator.io/) 是 JavaScript/TypeScript 生態系
最成熟的 mutation testing 框架。

| 特性 | 支援情況 |
|------|----------|
| TypeScript | 原生支援 |
| Jest | 完整支援（TITAN 使用 Jest） |
| Next.js | 支援（需排除 .next 目錄） |
| 增量模式 | 支援（僅測試變更的檔案） |
| 報告格式 | HTML, JSON, Dashboard |
| CI 整合 | GitHub Actions 支援 |

### 2.2 安裝方式

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/typescript-checker
npx stryker init
```

### 2.3 建議設定（stryker.config.mjs）

```javascript
export default {
  testRunner: "jest",
  jest: { configFile: "jest.config.ts" },
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: [
    "lib/**/*.ts",
    "services/**/*.ts",
    "validators/**/*.ts",
    "!**/__tests__/**",
    "!**/test-utils.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  incremental: true,
  concurrency: 2,  // 5 人團隊開發機性能考量
};
```

---

## 3. 成本效益分析

### 3.1 成本

| 項目 | 估計 |
|------|------|
| 初始設定 | 0.5 天 |
| 首次全量執行 | 30-60 分鐘（依 codebase 大小） |
| CI 增量執行 | 5-10 分鐘（僅變更檔案） |
| 學習曲線 | 0.5 天（團隊 5 人） |
| 修復存活 mutants | 每個 sprint 1-2 小時 |

### 3.2 效益

| 效益 | 說明 |
|------|------|
| 提升測試品質 | 發現「假覆蓋」— 覆蓋率高但未驗證邏輯 |
| 早期發現缺陷 | 業務邏輯變異未被測試捕獲 = 潛在 bug |
| 團隊信心 | mutation score 比 line coverage 更可靠 |
| 合規加分 | 銀行稽核可引用 mutation testing 報告 |

### 3.3 風險

| 風險 | 緩解措施 |
|------|----------|
| 執行時間過長 | 使用增量模式 + 限制 mutate 範圍 |
| 等價 mutants 誤報 | Stryker 已有啟發式過濾，可手動標記 |
| 團隊抗拒 | 從關鍵模組開始，不強制 100% mutation score |

---

## 4. 建議

### v1.0（現階段）

- **不導入** mutation testing
- 專注提升 Jest 測試覆蓋率至 80%+（目前基礎已建立）
- 確保關鍵模組（auth, rbac, kpi-calculator）有充足的邊界測試

### Phase 2（v2.0）

- 導入 Stryker-JS
- 初始目標 mutation score: 60%（lib/ + services/）
- 整合 CI pipeline（PR checks）
- 每月產出 mutation testing 報告

---

## 5. 適用 TITAN 的優先 mutate 範圍

以下模組的業務邏輯最關鍵，建議優先進行 mutation testing：

1. `lib/kpi-calculator.ts` — KPI 計算邏輯
2. `lib/rbac.ts` — 權限控制
3. `lib/password-policy.ts` — 密碼安全策略
4. `services/import-service.ts` — 資料匯入驗證
5. `validators/` — 輸入驗證邏輯
