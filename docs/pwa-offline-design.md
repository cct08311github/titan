# PWA 離線支援設計文件

> Issue #425 — 封閉內網網路不穩可離線填工時

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 設計階段
**前置文件**: `next.config.ts`, `public/manifest.json`

---

## 1. 背景

TITAN 部署於銀行封閉內網，網路品質不穩定。使用者需要在網路中斷時
仍能填寫工時、瀏覽已載入的任務清單，待網路恢復後自動同步。

---

## 2. PWA 架構

### 2.1 核心元件

```
public/
├── manifest.json          ← Web App Manifest（已建立）
├── icons/
│   ├── icon-192x192.png   ← PWA 圖示
│   └── icon-512x512.png   ← PWA 圖示
└── sw.js                  ← Service Worker（Phase 2）
```

### 2.2 Service Worker 策略

| 資源類型 | 策略 | 說明 |
|----------|------|------|
| HTML 頁面 | Network First | 優先取得最新版本，離線時使用快取 |
| JS/CSS 靜態資源 | Cache First | Next.js hashed assets 不會變更 |
| API GET 請求 | Stale While Revalidate | 顯示快取資料，背景更新 |
| API POST/PATCH | Queue + Retry | 離線時排入 IndexedDB 佇列，上線後重送 |
| 圖片/字型 | Cache First | 靜態資源快取 |

### 2.3 離線工時填寫流程

```
1. 使用者開啟工時頁面（已快取的 HTML + JS）
2. 填寫工時表單 → POST /api/time-entries
3. 網路中斷 → Service Worker 攔截，存入 IndexedDB 佇列
4. 顯示 "已暫存，待網路恢復後同步" 提示
5. 網路恢復 → Background Sync 觸發佇列重送
6. 同步完成 → 更新 UI 狀態
```

---

## 3. v1.0 最小可行範圍

### 3.1 已完成

- [x] `public/manifest.json` — Web App Manifest
- [x] `next.config.ts` — 基礎安全標頭（CSP 允許 Service Worker）

### 3.2 待實作（Phase 2）

- [ ] Service Worker 註冊（`app/layout.tsx`）
- [ ] 靜態資源預快取清單
- [ ] 離線 fallback 頁面（`/offline`）
- [ ] IndexedDB 佇列（工時、任務更新）
- [ ] Background Sync API 整合
- [ ] 離線狀態 UI 指示器（toast / banner）

---

## 4. 技術選型

| 選項 | 說明 | 決定 |
|------|------|------|
| **next-pwa** (serwist) | Next.js PWA 外掛，自動產生 SW | 推薦（Phase 2） |
| **Workbox** | Google 維護的 SW 工具箱 | 備選 |
| **手寫 SW** | 完全自控 | 不建議（維護成本高） |

推薦使用 `@serwist/next`（next-pwa 的繼任），支援 Next.js App Router。

---

## 5. 安全考量

| 考量 | 處理方式 |
|------|----------|
| Service Worker 作用域 | 限制在 `/` scope，CSP 允許 `worker-src 'self' blob:` |
| 離線快取敏感資料 | 僅快取非機密頁面和公開 API 回應 |
| 佇列資料加密 | IndexedDB 資料不含密碼或 token |
| SW 更新策略 | 新版本發布時強制 skipWaiting + clients.claim |

---

## 6. 實作優先順序

| 步驟 | 說明 | 預估時間 |
|------|------|----------|
| 1 | manifest.json + 圖示 | 0.5 天（已完成） |
| 2 | 安裝 @serwist/next + 基礎 SW | 0.5 天 |
| 3 | 靜態資源預快取 | 0.5 天 |
| 4 | 離線 fallback 頁面 | 0.5 天 |
| 5 | 工時 POST 離線佇列 | 1 天 |
| 6 | Background Sync + UI 指示器 | 1 天 |
| 7 | 測試 + 邊界情況 | 0.5 天 |

**總預估**：4.5 天
