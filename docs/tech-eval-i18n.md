# Tech Evaluation: i18n Architecture

> Issue: #408
> Date: 2026-03-25
> Status: Evaluation + Foundation Implementation

## 1. 背景

TITAN 目前所有 UI 文字直接寫在 JSX 中（繁體中文硬編碼）。未來可能需要支援：
- 英文介面（國際團隊 / 外部稽核）
- 簡體中文（跨區行處）
- 語系切換不重載頁面

## 2. 候選方案

### 2.1 next-intl

| 面向 | 說明 |
|------|------|
| 專為 Next.js 設計 | 完整支援 App Router、Server Components、Client Components |
| 路由策略 | 支援 prefix (`/en/dashboard`)、domain、cookie-based |
| Server Component 支援 | `getTranslations()` — 翻譯在 Server 執行，不送到 client bundle |
| Client Component 支援 | `useTranslations()` hook |
| 訊息格式 | JSON 檔案，支援 ICU Message Format（複數、日期、數字） |
| 型別安全 | 支援（搭配 TypeScript namespace） |
| Bundle 大小 | ~3.5 KB gzip |
| 維護者 | Jan Amann（活躍維護，Next.js 社群推薦） |

### 2.2 react-i18next

| 面向 | 說明 |
|------|------|
| 通用性 | 框架無關（React、React Native、Node.js） |
| Next.js 整合 | 需要 `next-i18next` adapter（Next.js App Router 支援仍在演進中） |
| Server Component 支援 | 有限（需額外 wrapper） |
| Client Component 支援 | `useTranslation()` hook |
| 訊息格式 | JSON，支援 ICU + namespace 分割 |
| Bundle 大小 | ~8 KB gzip（i18next + react-i18next） |
| 生態系 | 最大（i18next 有豐富 plugin 生態） |

### 2.3 比較

| 面向 | next-intl | react-i18next |
|------|-----------|---------------|
| App Router 支援 | 原生、完整 | 需要 adapter |
| Server Components | 一等公民 | 需額外配置 |
| Bundle 大小 | 3.5 KB | 8 KB |
| 學習曲線 | 低（API 簡潔） | 中（i18next 概念多） |
| 遷移到其他框架 | 限 Next.js | 可攜帶 |
| 社群 / 文件 | 良好 | 優秀（歷史悠久） |

## 3. 建議

**推薦：next-intl**

理由：
1. **與 Next.js App Router 深度整合** — Server Component 翻譯不增加 client bundle
2. **API 簡潔** — `useTranslations('Dashboard')` 即可使用
3. **路由策略靈活** — TITAN 初期可用 cookie-based（不改 URL 結構），之後可切換至 prefix
4. **Bundle 更小** — 銀行環境每一 KB 都重要
5. **型別安全** — 可配合 TypeScript 檢查翻譯 key 是否存在

## 4. 基礎架構（已實作）

### 目錄結構
```
lib/i18n/
  config.ts        — 語系設定（支援語系列表、預設語系）
  request.ts       — Server-side: getRequestConfig for next-intl
messages/
  zh-TW.json       — 繁體中文翻譯（預設）
```

### 翻譯 key 命名規範
```json
{
  "Common": {
    "loading": "載入中...",
    "error": "發生錯誤",
    "retry": "重試",
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除",
    "confirm": "確認"
  },
  "Dashboard": {
    "title": "儀表板",
    "managerView": "主管視角 — 團隊整體狀況",
    "engineerView": "工程師視角 — 我的工作狀況"
  }
}
```

命名規則：
- 頂層 key = 頁面/功能模組（PascalCase）
- 子 key = 具體文字（camelCase）
- 共用文字放在 `Common` namespace

## 5. 遷移計畫

### Phase 1 — 基礎建設（本 Issue，已完成）
- 建立 `lib/i18n/` 設定檔
- 建立 `messages/zh-TW.json` 初始翻譯
- 評估文件

### Phase 2 — 安裝 next-intl + 路由設定（1 天）
```bash
npm install next-intl
```
1. 在 `next.config.ts` 加入 `createNextIntlPlugin`
2. 設定 middleware 語系偵測（cookie-based）
3. 在 `app/(app)/layout.tsx` 加入 `NextIntlClientProvider`

### Phase 3 — 逐步遷移硬編碼文字（持續）
優先順序：
1. 共用元件（PageLoading, PageError, PageEmpty）
2. Dashboard 頁面
3. 其餘頁面按使用頻率遷移

### Phase 4 — 新增英文翻譯（視需求）
1. 建立 `messages/en.json`
2. 加入語系切換 UI（header dropdown）

## 6. 風險

| 風險 | 緩解 |
|------|------|
| 大量硬編碼文字需遷移 | 漸進遷移，不需一次全改 |
| next-intl 版本更新可能有 breaking change | 鎖定版本，定期升級 |
| 翻譯 key 不一致 | 建立命名規範文件 + TypeScript 型別檢查 |
