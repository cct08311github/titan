# TITAN Mobile — iOS App 實施計劃

> **技術選型**：React Native + Expo
> **目標**：將 TITAN 協作平台核心功能帶到 iOS
> **預估時程**：15-16 週（Phase 0-6）
> **建立日期**：2026-03-29
> **最後審查**：2026-03-29（v3 — 納入 SA review conditions）
> **SA 判定**：APPROVE WITH CONDITIONS（5 項 conditions 已整合至各 Phase）

---

## 目錄

- [技術選型決策](#技術選型決策)
- [專案結構](#專案結構)
- [Phase 0：後端 API 改造 + 環境準備](#phase-0後端-api-改造--環境準備week-0-2)
- [Phase 1：專案骨架 + 認證 + 安全基線](#phase-1專案骨架--認證--安全基線week-3-4)
- [Phase 2：任務管理](#phase-2任務管理week-5-7)
- [Phase 3：工時記錄](#phase-3工時記錄week-7-9)
- [Phase 4：通知 + Dashboard](#phase-4通知--dashboardweek-9-11)
- [Phase 5：知識庫 + 設定](#phase-5知識庫--設定week-11-13)
- [Phase 6：打磨 + 測試 + 發布](#phase-6打磨--測試--發布week-13-16)
- [共用型別定義](#共用型別定義)
- [風險與緩解](#風險與緩解)
- [GitHub Issues 拆分](#github-issues-拆分)
- [Appendix: 審查紀錄](#appendix-審查紀錄)

---

## 技術選型決策

### React Native + Expo vs 其他方案

| 考量 | SwiftUI 原生 | React Native + Expo | Flutter |
|------|-------------|---------------------|---------|
| **團隊技能** | 需學 Swift | 已有 TS/React 經驗 ✅ | 需學 Dart |
| **型別共用** | 無法 | 可共用 Prisma 型別 ✅ | 無法 |
| **離線/Air-gapped** | 原生支援 | Expo 支援離線 bundle | 同等支援 |
| **未來 Android** | 不可 | 直接跨平台 ✅ | 直接跨平台 |
| **開發速度** | 慢 | 快 ✅ | 中（需學習） |
| **維護成本** | 需 Swift 技能 | 複用現有技能 ✅ | 需維持 Dart |

**結論**：團隊已有 TypeScript/React 深厚經驗 + 可共用後端型別，React Native + Expo 是最務實的選擇。

### PWA 作為快速 MVP（可選策略）

如果時程壓力大，可先用 2-3 週出 PWA 版本（零後端改造，直接用現有 cookie auth），讓使用者立即有行動端可用，同時平行開發 native app。PWA 缺點：無 Face ID、無 Keychain、無背景任務、iOS PWA 仍有限制。

---

## 專案結構

```
titan-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/                   # 未登入畫面
│   │   ├── login.tsx
│   │   └── change-password.tsx
│   ├── (tabs)/                   # 主要 Tab 導航
│   │   ├── index.tsx             # Dashboard
│   │   ├── tasks.tsx             # 任務列表
│   │   ├── timesheet.tsx         # 工時
│   │   └── notifications.tsx     # 通知
│   ├── tasks/[id].tsx            # 任務詳情
│   ├── tasks/create.tsx          # 新增任務
│   └── _layout.tsx               # Root layout
├── components/
│   ├── ui/                       # 基礎元件 (Button, Card, Input...)
│   ├── tasks/                    # 任務相關元件
│   ├── timesheet/                # 工時相關元件
│   └── dashboard/                # Dashboard 卡片
├── lib/
│   ├── api-client.ts             # Axios instance + auth interceptor + cert pinning
│   ├── auth.ts                   # Token 管理 (secure-store)
│   ├── query-client.ts           # TanStack Query 設定 + MMKV persistence
│   ├── storage.ts                # MMKV 離線快取
│   ├── app-state.ts              # App lifecycle 管理 (foreground/background)
│   └── error-reporter.ts         # Crash reporting (本地 log → batch upload)
├── hooks/
│   ├── use-auth.ts               # 登入/登出/session
│   ├── use-tasks.ts              # 任務 CRUD hooks
│   ├── use-time-entries.ts       # 工時 hooks
│   ├── use-notifications.ts      # 通知 hooks
│   └── use-network.ts            # 網路狀態 + 品質偵測
├── types/
│   └── api.ts                    # 自動產出（scripts/generate-mobile-types.ts）
├── constants/
│   └── enums.ts                  # TaskStatus, Priority, Role 等
└── app.config.ts                 # Expo 設定
```

---

## Phase 0：後端 API 改造 + 環境準備（Week 0-2）

> **必須先完成**，否則行動端無法認證。此 Phase 從原計劃 1 週擴展至 2 週，納入審查發現的 session limiter 衝突和安全需求。

### 0-1. Token-Based 認證端點

現有 NextAuth 使用 JWT strategy 但透過 HTTP-only cookie 傳送。行動端需要直接取得 JWT。

**關鍵設計決策**：使用 Auth.js 內建 `encode()` 產生相同格式的 JWE token（而非自建 JWT），這樣 Edge middleware `checkEdgeJwt()` 零修改。

**新增端點**：`/api/auth/mobile/login`

```
POST /api/auth/mobile/login
Body: { username: string, password: string, deviceId: string }
Response: {
  ok: true,
  data: {
    token: string,          // JWE (用 Auth.js encode() 產生，與 web cookie 同格式)
    refreshToken: string,   // 長效刷新 token (綁定 deviceId)
    expiresAt: number,      // Unix timestamp
    user: { id, name, email, role, mustChangePassword }
  }
}
```

```
POST /api/auth/mobile/refresh
Headers: Authorization: Bearer <refreshToken>
Body: { deviceId: string }
Response: {
  ok: true,
  data: {
    token: string,
    refreshToken: string,   // Refresh token rotation — 每次刷新簽發新 token
    expiresAt: number
  }
}
```

```
POST /api/auth/mobile/logout
Headers: Authorization: Bearer <token>
Body: { deviceId: string }
Response: { ok: true }
// 撤銷 refresh token + 清理 session + 寫入 AuditLog
```

**實作要點**：
- 用 Auth.js `encode()` 產生 JWE → Edge middleware 零修改
- ⚠️ **[SA C-1] Auth.js 版本鎖定**：`package.json` 必須 pin exact version（不用 `^`），因為 JWE 格式（HKDF salt = cookie name, info = `Auth.js Generated Encryption Key`）是 v5 內部實作，非 public API。升級 SOP 必須包含 mobile token 相容性驗證
- `encode()` 必須傳入 `maxAge: 15 * 60`（與 `auth.ts` L179 一致），否則 Edge middleware `jwtDecrypt` 會因 exp claim 不符拒絕
- 複用現有 `bcryptjs` 密碼驗證 + rate limiting + lockout 邏輯
- JWT payload 與 NextAuth 一致：`{ id, role, mustChangePassword, sessionId }`
- Token 壽命：15 min access + 7 day refresh
- **Refresh token rotation**：每次 refresh 簽發新 refresh token，舊的立刻失效。現有 `rotateRefreshToken()` 已有 replay detection（偵測已撤銷 token 重用時撤銷全部 token）
- **Device binding**：refresh token 綁定 deviceId。需擴展 `rotateRefreshToken()` 加入 `deviceId` 參數比對
- Refresh token 存 DB（可稽核），Redis 用於 blacklist cache
- Mobile login/logout/refresh 事件寫入 AuditLog（與 web 端一致）
- **Key rotation 注意**：AUTH_SECRET 變更時所有 mobile JWE 立即失效，但 refresh endpoint 不依賴 JWE（純 DB hash 比對），使用者可透過 refresh 自動恢復

### 0-2. Session Limiter 調整

**問題**：現有 `MAX_CONCURRENT_SESSIONS = 2`，mobile login 會產生第 3 個 session，踢掉 web session。

**方案**：分平台計數 — Redis key 加 `platform:` prefix

```typescript
// lib/session-limiter.ts 修改
const WEB_MAX = 2;
const MOBILE_MAX = 2;
// key pattern: session:{userId}:{platform}:{sessionId}
```

⚠️ **[SA C-2] 原子性修正**：現有 ZADD → ZCARD → ZRANGE → ZREM 非原子操作，兩個 mobile login 同時發生可能多踢 session。且 mobile refresh 每 15min 觸發 `registerSession`（透過 JWT callback），可能產生 burst。**必須用 Redis Lua script 保證 register + evict 的原子性**：

```lua
-- session_register.lua
local key = KEYS[1]
local sessionId = ARGV[1]
local now = ARGV[2]
local maxSessions = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

redis.call('ZADD', key, now, sessionId)
redis.call('EXPIRE', key, ttl)
local count = redis.call('ZCARD', key)
if count > maxSessions then
  local toRemove = redis.call('ZRANGE', key, 0, count - maxSessions - 1)
  for _, sid in ipairs(toRemove) do
    redis.call('ZREM', key, sid)
  end
  return toRemove
end
return {}
```

**Session TTL 注意**：Session entry TTL = 8h 但 JWT maxAge = 15min。Mobile refresh 時必須 `clearSession(old) + registerSession(new)`，否則 15min 一個新 entry 會在 8h 內佔滿 2 slot。

### 0-3. Auth Middleware 相容層

修改 `requireAuth()`（在 `lib/rbac.ts`）同時支援 cookie 和 Bearer token：

```typescript
async function requireAuth(): Promise<Session> {
  // 先檢查 Bearer header（避免 mobile request 每次跑注定失敗的 auth()）
  const authHeader = headers().get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    return verifyMobileToken(token); // 用 Auth.js decode()
  }

  // 再嘗試 NextAuth session (web)
  const session = await auth();
  if (session) return session;

  throw new UnauthorizedError();
}

async function verifyMobileToken(jwe: string): Promise<Session> {
  const payload = await decode({ token: jwe, secret: AUTH_SECRET });
  if (!payload) throw new UnauthorizedError();

  // [SA C-4] 必須檢查 blacklist — 否則已撤銷 session 在 15min 內仍可存取
  if (await JwtBlacklist.has(`session:${payload.sessionId}`)) {
    throw new UnauthorizedError('Session revoked');
  }

  return {
    user: { id: payload.id, role: payload.role, ... },
    expires: new Date(payload.exp * 1000).toISOString(),
  };
}
```

⚠️ **[SA C-4] Blacklist 檢查**：現有 `JwtBlacklist`（`lib/jwt-blacklist.ts`）是 in-memory Set。`verifyMobileToken()` 必須整合此檢查，否則 mobile logout 後 15min 內舊 token 仍有效。若部署多 instance，需改為 Redis-backed blacklist。

**影響範圍**：僅修改 `requireAuth()` 一處，所有 115+ API routes 自動相容。

### 0-4. 推播 Token 註冊

```
POST /api/push/register
Body: { token: string, platform: 'ios' | 'android', deviceId: string }

DELETE /api/push/unregister
Body: { deviceId: string }
```

新增 Prisma model：

```prisma
model PushToken {
  id        String   @id @default(cuid())
  userId    String
  token     String
  platform  String   // ios | android
  deviceId  String   @unique
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}

model MobileRefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  deviceId  String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([token])
}
```

### 0-5. 型別自動產出腳本

手動同步 36 models + 25 enums 不可維護。建立自動化：

```bash
# scripts/generate-mobile-types.ts
# 從 prisma/schema.prisma 解析 enum + 關鍵 model → 產出 titan-mobile/types/api.ts
# 納入 CI：schema 變更時自動重新產出
```

### 0-6. Air-Gapped 開發環境建立

> ⚠️ **[SA C-5] 此項為 P0（非 P1）**：沒有 npm mirror 連 `npx create-expo-app` 都跑不了，是所有 mobile Phase 的 blocker。

- 內網 npm mirror（Verdaccio）
- CocoaPods local spec repo（pre-cached）
- Xcode + iOS SDK 固定版本
- 所有 native dependencies 的離線 cache
- `eas build --local` 取代雲端 EAS Build
- Pin Expo SDK version 並建立升級 runbook（升級時需重新 cache 所有 native dependencies）

### 0-7. 提前啟動 Apple Enterprise Program 申請

- 需要 DUNS number，審核期 2-4 週
- 初期用 TestFlight Ad Hoc 分發
- 同步準備 MDM 分發方案
- **[SA A-7]**：Apple 已大幅收緊 Enterprise Program 審核（需說明為何不用 App Store），審核可能超過 4 週。**Plan B**：Managed Distribution via Apple Business Manager（MDM），不依賴 Enterprise Program

### 0-8. Mobile Minimum Version Check Middleware

**[SA A-4]** 安全 patch 部署後，過舊的 mobile app 可能繞過修正。Phase 0 即加入：

```typescript
// middleware 或 API interceptor
const MIN_MOBILE_VERSION = '1.0.0';
// 讀取 X-App-Version header，低於 MIN_MOBILE_VERSION 回 426 Upgrade Required
```

---

## Phase 1：專案骨架 + 認證 + 安全基線（Week 3-4）

> Certificate pinning 從原 Phase 6 前移至此，作為銀行環境安全基線。

### 1-1. 專案初始化

```bash
npx create-expo-app titan-mobile -t expo-template-blank-typescript
```

**核心依賴**：

```bash
npx expo install expo-router expo-secure-store expo-dev-client expo-local-authentication
npm install @tanstack/react-query axios react-native-mmkv
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-safe-area-context react-native-screens
npm install react-native-reanimated react-native-gesture-handler
npm install react-native-ssl-pinning   # Certificate pinning
```

### 1-2. API Client + Certificate Pinning

```typescript
// lib/api-client.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: Config.API_URL,
  timeout: 15000,
});

// Certificate pinning（銀行環境安全基線）
// ⚠️ [SA A-6] react-native-ssl-pinning 有自己的 fetch 實作，不自動套用到 axios
// 方案 A：用 TrustKit（iOS native, 全域 pinning，自動覆蓋所有 HTTP client）← 建議
// 方案 B：用 react-native-ssl-pinning 的 fetch 替代 axios
// 方案 C：寫 axios adapter 橋接 react-native-ssl-pinning
// → Phase 1 Issue #7 必須做技術 spike 驗證

// 自動附加 token（先檢查 Bearer 避免無效 auth() 開銷）
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 自動刷新 token（含 refresh token rotation）
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshed = await refreshToken();
      if (refreshed) return api.request(error.config);
      navigateToLogin();
    }
    return Promise.reject(error);
  }
);
```

### 1-3. 認證流程

- 登入畫面：email 輸入（自動補 `@titan.local`）+ 密碼
- 登入成功後檢查 `mustChangePassword` → 強制導向改密碼頁
- Token 儲存：`expo-secure-store`（iOS Keychain backed）
- Face ID / Touch ID 快速解鎖（`expo-local-authentication`）
- **登出端點**：呼叫 `/api/auth/mobile/logout` 撤銷 refresh token

### 1-4. App Lifecycle 管理

```typescript
// lib/app-state.ts
import { AppState } from 'react-native';

// 前景恢復時：檢查 token 是否過期（不等 401）
// 背景時：暫停 polling
// 閒置 5 分鐘：自動鎖定 → 要求 Face ID
// Memory warning：釋放 MMKV cache 中低優先度資料
```

### 1-5. Error Reporter（替代 Sentry）

Air-gapped 環境無法用 Sentry/Crashlytics：

```typescript
// lib/error-reporter.ts
// catch unhandled errors → 寫入本地 MMKV log
// 下次啟動時 batch upload 到 POST /api/error-report
// 與 web 端 global-error.tsx 的 error-report 端點共用
```

### 1-6. 導航結構

```
(auth) ← 未登入
  ├── login
  └── change-password

(tabs) ← 已登入
  ├── Dashboard (首頁)
  ├── Tasks (任務)
  ├── Timesheet (工時)
  └── Notifications (通知)
```

### 1-7. 角色權限 UI 控制

```typescript
// hooks/use-auth.ts
export function useAuth() {
  const isManager = session.user.role !== 'ENGINEER';
  const isAdmin = session.user.role === 'ADMIN';
  // UI 根據角色顯示/隱藏功能
}
```

### 1-8. Accessibility 基線

- 所有互動元素設定 `accessibilityLabel`
- 最小觸控區域 44x44pt
- 支援 Dynamic Type（系統字體大小）
- 色彩對比度符合 WCAG AA

**Phase 1 交付物**：可登入、Tab 導航骨架、API client with cert pinning + auth、crash reporter。

---

## Phase 2：任務管理（Week 5-7）

> 離線策略調整：此階段只做 read cache，write queue 留到 Phase 4 後期。通知 badge polling 提前至此階段。

### 2-1. 任務列表

- API：`GET /api/tasks?assignee=me&status=TODO,IN_PROGRESS`
- FlatList + pull-to-refresh
- 篩選 bottom sheet：狀態（多選）、優先度、分類
- 排序：截止日、優先度、最近更新
- TanStack Query 快取（staleTime: 5min）+ MMKV persistQueryClient

### 2-2. 任務詳情頁

- 上方：狀態 badge + 優先度 + 分類 + 指派人
- 中間：描述（Markdown 渲染）、日期、預估/實際工時
- 下方 Tabs：
  - 子任務（勾選完成）
  - 留言（`GET /api/tasks/[id]/comments`）
  - 變更紀錄
  - 附件
- 快速動作按鈕：改狀態、改優先度

### 2-3. 任務操作

- 新增任務表單（Zod 驗證，複用 web 端 schema 規則）：
  - title: 1-200 字元（必填）
  - description: max 10,000 字元
  - status: 預設 BACKLOG
  - priority: 預設 P2
  - category: 預設 PLANNED
  - dueDate, estimatedHours, tags (max 20)
- 狀態快速變更：swipe action 或 bottom sheet
- 新增留言：`POST /api/tasks/[id]/comments`

### 2-4. Read-Only 離線快取

- TanStack Query `persistQueryClient` + MMKV adapter
- 離線時顯示快取資料（帶「離線資料」提示 banner）
- 寫入操作在離線時顯示「需要網路連線」提示
- **[SA A-2] Cache versioning**：MMKV 存 `CACHE_SCHEMA_VERSION` key，app 啟動時比對，不符則 `clearAll()`
- **[SA A-1] Cache size cap**：MMKV 無內建 size eviction，設定 entry 上限或 LRU 策略。在 `app-state.ts` memory warning handler 中主動釋放低優先度快取
- **[SA A-3] 銀行資料保護**：MMKV 中 cached 的業務資料（任務、工時）預設明文。評估是否啟用 `MMKV.encryptionKey`，或確認 iOS Data Protection class 設為 `completeUntilFirstUserAuthentication`

### 2-5. 通知 Badge Polling（提前）

- Tab bar 上的 Notifications icon 顯示未讀數字 badge
- 每 60 秒 `GET /api/notifications?unreadOnly=true&limit=1`（只取 count）
- 讓使用者在 Phase 2 就能感知新任務指派

### 2-6. 網路狀態管理

```typescript
// hooks/use-network.ts
// 偵測：WiFi 連線但 VPN tunnel 中斷（銀行內網常見）
// 策略：ping API health endpoint，而非只看 NetInfo 狀態
// Request retry：exponential backoff (1s, 2s, 4s, max 30s)
```

**Phase 2 交付物**：完整任務 CRUD + read-only 離線快取 + 通知 badge。

---

## Phase 3：工時記錄（Week 7-9）

### 3-1. Server-Side 計時器

> 審查建議：放棄客戶端背景計時（iOS 限制 background fetch 最短 15 分鐘且不保證觸發），改為 server-side timer。

- 開始：`POST /api/time-entries/start` → 後端記錄 `startedAt` timestamp
- 停止：`POST /api/time-entries/stop` → 後端用 `now - startedAt` 計算時數
- App 只顯示 elapsed time：`Date.now() - startedAt`（純前端計算，不需 background task）
- App 從背景恢復時：重新計算 elapsed time（因為是 server timestamp，不會漂移）

### 3-2. 週工時表

- 橫向日期切換（按週）
- 每日工時條目列表
- 每日小計 + 週合計
- 加班類型標示（平日 / 休息日 / 假日）
- 24 小時每日上限前端驗證
- 審核狀態顯示：PENDING / APPROVED / REJECTED

### 3-3. 工時操作

- 手動新增：選任務 → 輸入時數 → 選分類 → 選加班類型
- 套用範本：`GET /api/time-entries/templates`
- 複製上週：`POST /api/time-entries/copy-week`
- 送審 / 查看審核狀態

### 3-4. 資料驗證

- SubTask 必須屬於所選 Task（前端 + 後端雙重驗證）
- 每日總時數 ≤ 24 小時
- Manager 工時自動 APPROVED（無需審核流程）

**Phase 3 交付物**：server-side 計時器 + 週工時表 + 範本 + 複製上週。

---

## Phase 4：通知 + Dashboard（Week 9-11）

### 4-1. 推播通知

**Air-gapped 環境（主方案）**：Polling
- 每 60 秒 `GET /api/notifications?unreadOnly=true`
- App 在前景時 polling，背景時暫停
- Badge count 同步

**有外網環境（可選）**：APNs
- `expo-notifications` + APNs 設定
- 後端 `POST /api/push/register` 註冊裝置 token
- 收到推播 → deep link 到對應頁面

### 4-2. 通知列表

- 未讀 / 全部 切換
- 下拉刷新
- 左滑標記已讀：`PATCH /api/notifications/[id]/read`
- 點擊導向對應頁面

### 4-3. Deep Link 映射

| NotificationType | 導向頁面 |
|-----------------|----------|
| `TASK_ASSIGNED` | `/tasks/[relatedId]` |
| `TASK_COMMENTED` | `/tasks/[relatedId]` (留言 tab) |
| `TASK_DUE_SOON` / `TASK_OVERDUE` | `/tasks/[relatedId]` |
| `TIMESHEET_REMINDER` | `/timesheet` |
| `TIMESHEET_REJECTED` | `/timesheet` |
| `SLA_EXPIRING` | `/tasks/[relatedId]` |
| `MILESTONE_DUE` | Dashboard |

### 4-4. Dashboard 卡片

1. **今日待辦**：`GET /api/tasks?assignee=me&status=TODO,IN_PROGRESS&dueDate=today`
2. **工時摘要**：`GET /api/time-entries/stats`（本週已記 / 目標時數）
3. **KPI 快覽**：`GET /api/kpi?assignee=me`（本月達成率）
4. **最近活動**：`GET /api/activity?limit=10`

### 4-5. Write Queue（離線寫入，延後實作）

> ⚠️ **[SA C-3] 衝突處理規格**：以下為 SA review 要求的完整規格。

- Optimistic update（改狀態先更新 UI，API 失敗則回滾）
- 離線操作佇列（MMKV 儲存，網路恢復時 FIFO 順序 sync）
- **Optimistic concurrency control**：`PUT /api/tasks/:id` 帶 `If-Match: {updatedAt}` header，server 端比對不符回 409 Conflict
- **Conflict dialog**：顯示 server 端 vs 本地端的欄位差異（不能只說「有衝突」）
- **Idempotency**：每個 write queue entry 帶 UUID idempotency key，避免 retry 造成重複操作。Server 端 `X-Idempotency-Key` header 支援
- **已知限制**：`updatedAt` 是 row-level 粒度（User A 改 title + User B 改 priority 會誤報衝突）。MVP 階段接受此限制，未來可升級為欄位級 diff
- **Queue ordering**：嚴格 FIFO（先改狀態再加 comment 的順序不能亂）。每個 entry 帶 monotonic sequence number

**Phase 4 交付物**：完整通知列表 + Dashboard 4 張卡片 + 離線 write queue。

---

## Phase 5：知識庫 + 設定（Week 11-13）

### 5-1. 文件瀏覽

- 空間列表：`GET /api/spaces`
- 文件列表：`GET /api/documents?spaceId=xxx`
- 文件閱讀：Markdown 渲染（`react-native-markdown-display`）
- 搜尋：`GET /api/documents/search?q=keyword`
- 文件留言：`GET/POST /api/documents/[id]/comments`

### 5-2. 使用者設定

- 個人資訊編輯（頭像、顯示名稱）
- 通知偏好設定（各類型開/關）
- 暗色 / 亮色模式切換
- App 版本資訊
- 登出 + 清除本地快取

**Phase 5 交付物**：文件閱讀器 + 搜尋 + 設定頁。

---

## Phase 6：打磨 + 測試 + 發布（Week 13-16）

> 時程從 2 週擴展至 3-4 週，涵蓋 Enterprise signing + 安全測試 + 銀行合規審查。

### 6-1. 安全強化

- Jailbreak 偵測（警告模式，不阻擋）
- 閒置 5 分鐘自動鎖定 → 要求 Face ID
- 安全日誌本地記錄（異常操作追蹤）

### 6-2. UX 打磨

- App icon + Splash screen（TITAN 品牌）
- 暗色模式全面支援
- Haptic feedback（狀態切換、計時器操作）
- Skeleton loading screens
- 空狀態插圖 + 錯誤狀態設計
- 網路斷線提示 banner

### 6-3. 測試

- Jest 單元測試（hooks, utils, API client）
- Detox E2E 測試：
  - 登入流程（含 token refresh、Face ID）
  - 建立/編輯任務
  - 記錄工時（server-side timer）
  - 通知已讀
  - 離線 → 恢復同步
- Accessibility audit（VoiceOver 測試）

### 6-4. 分發

- **TestFlight**：內部測試（5-10 人，2 週 beta 期）
- **正式分發**：Apple Enterprise Distribution（銀行內部署）
  - 需 Apple Developer Enterprise Program 帳號（Phase 0 已提前申請）
  - 或透過 MDM（Mobile Device Management）分發
- 放棄 OTA update（air-gapped 不穩定），走 Enterprise re-sign + MDM 推送

**Phase 6 交付物**：安全強化 + 2 週 TestFlight beta + Enterprise 分發。

---

## 共用型別定義

> 以下型別由 `scripts/generate-mobile-types.ts` 從 Prisma schema 自動產出。

```typescript
// === Enums ===

export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ENGINEER = 'ENGINEER',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
}

export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum TaskCategory {
  PLANNED = 'PLANNED',
  ADDED = 'ADDED',
  INCIDENT = 'INCIDENT',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
  LEARNING = 'LEARNING',
}

export enum TimeCategory {
  PLANNED_TASK = 'PLANNED_TASK',
  ADDED_TASK = 'ADDED_TASK',
  INCIDENT = 'INCIDENT',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
  LEARNING = 'LEARNING',
}

export enum OvertimeType {
  NONE = 'NONE',
  WEEKDAY = 'WEEKDAY',
  REST_DAY = 'REST_DAY',
  HOLIDAY = 'HOLIDAY',
}

export enum TimesheetApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_COMMENTED = 'TASK_COMMENTED',
  MILESTONE_DUE = 'MILESTONE_DUE',
  BACKUP_ACTIVATED = 'BACKUP_ACTIVATED',
  TASK_CHANGED = 'TASK_CHANGED',
  TIMESHEET_REMINDER = 'TIMESHEET_REMINDER',
  TIMESHEET_REJECTED = 'TIMESHEET_REJECTED',
  SLA_EXPIRING = 'SLA_EXPIRING',
  VERIFICATION_DUE = 'VERIFICATION_DUE',
  MANAGER_FLAG = 'MANAGER_FLAG',
}

// === API Response Types ===

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// === Domain Types ===

export interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  avatar: string | null;
  isActive: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  category: TaskCategory;
  primaryAssigneeId: string | null;
  backupAssigneeId: string | null;
  creatorId: string;
  dueDate: string | null;
  startDate: string | null;
  estimatedHours: number | null;
  actualHours: number;
  progressPct: number;
  tags: string[];
  monthlyGoalId: string | null;
  annualPlanId: string | null;
  slaDeadline: string | null;
  managerFlagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  taskId: string | null;
  userId: string;
  date: string;
  hours: number;
  category: TimeCategory;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  overtimeType: OvertimeType;
  approvalStatus: TimesheetApprovalStatus;
  isRunning: boolean;
  locked: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedId: string | null;
  relatedType: string | null;
  isRead: boolean;
  createdAt: string;
}

// === Request Types ===

export interface CreateTaskRequest {
  title: string;                    // 1-200 chars, required
  description?: string;             // max 10,000 chars
  annualPlanId?: string | null;
  monthlyGoalId?: string;
  primaryAssigneeId?: string;
  backupAssigneeId?: string;
  status?: TaskStatus;              // default: BACKLOG
  priority?: Priority;              // default: P2
  category?: TaskCategory;          // default: PLANNED
  dueDate?: string;                 // ISO 8601
  startDate?: string;               // ISO 8601
  estimatedHours?: number;          // non-negative
  tags?: string[];                  // max 20 items, each max 50 chars
}

export interface CreateTimeEntryRequest {
  taskId?: string;
  subTaskId?: string;
  date: string;                     // ISO 8601 date
  hours: number;                    // required, daily limit 24h
  category?: TimeCategory;          // default: PLANNED_TASK
  description?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: User & { mustChangePassword: boolean };
}
```

---

## 風險與緩解

| 風險 | 等級 | 緩解方案 | SA ref |
|------|------|----------|--------|
| Auth.js 版本鎖定（JWE 格式依賴內部 API） | **HIGH** | Pin exact version + 升級 SOP 含 mobile token 驗證 | C-1 |
| Session register race condition | **HIGH** | Redis Lua script 保證原子性 + mobile refresh 時 clear old + register new | C-2 |
| Write queue 衝突規格不足 | **HIGH** | 409 + diff UI + idempotency key + FIFO ordering | C-3 |
| `verifyMobileToken()` 缺 blacklist check | **HIGH** | 加 `JwtBlacklist.has(session:${sessionId})` | C-4 |
| Air-gapped 環境是所有 Phase blocker | **HIGH** | 升為 P0，Phase 0 第一個完成 | C-5 |
| Edge Middleware JWT 相容性 | **HIGH** | 用 Auth.js `encode()` 產生 JWE，Edge middleware 零修改 | — |
| Session Limiter 衝突（MAX=2） | **HIGH** | 分平台計數（web/mobile 各自上限） | — |
| Refresh Token 安全 | **HIGH** | Rotation + device binding + DB 存儲 + replay detection | — |
| Air-gapped 推播不可用 | **HIGH** | Polling fallback（60 秒），Phase 2 即加入 badge polling | — |
| 背景計時器 iOS 限制 | **HIGH** | 改 server-side timer，app 只顯示 elapsed time | — |
| Certificate Pinning | **HIGH** | Phase 1 即內建（銀行安全基線） | — |
| SSL pinning + Axios 相容性 | **MEDIUM** | Phase 1 技術 spike：TrustKit vs react-native-ssl-pinning | A-6 |
| MMKV 快取無 size cap | **MEDIUM** | LRU eviction + memory warning handler | A-1 |
| MMKV 明文儲存業務資料 | **MEDIUM** | 評估啟用 MMKV encryption 或確認 Data Protection class | A-3 |
| Apple Enterprise 審核已收緊 | **MEDIUM** | Plan B：MDM via Apple Business Manager | A-7 |
| 離線寫入衝突 | **MEDIUM** | Phase 2 read-only；Phase 4 write queue + optimistic concurrency | — |
| API 破壞性變更 | **MEDIUM** | `X-App-Version` header + 426 Upgrade Required middleware | A-4 |
| 型別同步失控（36 models） | **MEDIUM** | `scripts/generate-mobile-types.ts` 自動產出，CI 納管 | — |
| Cache schema versioning | **LOW** | MMKV `CACHE_SCHEMA_VERSION` key，啟動時比對 | A-2 |
| Crash reporting 無 Sentry | **LOW** | 本地 log → batch upload 到 `/api/error-report` | — |

---

## 依賴清單

### 行動端

| 套件 | 用途 |
|------|------|
| `expo` (SDK 53+) | 基礎框架 |
| `expo-router` | File-based routing |
| `expo-secure-store` | iOS Keychain token 儲存 |
| `expo-local-authentication` | Face ID / Touch ID |
| `expo-notifications` | 推播通知（可選，有外網時） |
| `expo-dev-client` | Custom dev build（air-gapped 必要） |
| `@tanstack/react-query` | API 狀態管理 + 快取 |
| `axios` | HTTP client |
| `react-native-mmkv` | 高效離線儲存 |
| `react-native-reanimated` | 動畫 |
| `react-native-gesture-handler` | 手勢操作 (swipe) |
| `react-native-markdown-display` | 文件 Markdown 渲染 |
| `react-native-ssl-pinning` | Certificate pinning（Phase 1） |
| `zod` | 表單驗證（共用 schema） |

### 後端新增

| 套件 | 用途 |
|------|------|
| (無新增) | 使用 Auth.js 內建 `encode()`/`decode()` 簽發 JWE，無需額外套件 |

---

## GitHub Issues 拆分

| Issue # | 標題 | Phase | 優先度 | SA ref |
|---------|------|-------|--------|--------|
| 1 | `feat(mobile): air-gapped dev environment (npm mirror + CocoaPods cache)` | 0 | **P0** | C-5 |
| 2 | `feat(mobile): token-based auth API with JWE + refresh rotation + device binding` | 0 | P0 | C-1 |
| 3 | `feat(mobile): session limiter platform separation + Lua atomicity` | 0 | P0 | C-2 |
| 4 | `feat(mobile): mobile logout endpoint + audit logging + blacklist integration` | 0 | P0 | C-4 |
| 5 | `feat(mobile): Auth.js version pin + upgrade SOP` | 0 | P0 | C-1 |
| 6 | `feat(mobile): type generation script from Prisma schema` | 0 | P1 | — |
| 7 | `feat(mobile): mobile minimum version check middleware (426 Upgrade Required)` | 0 | P1 | A-4 |
| 8 | `feat(mobile): init Expo project + auth flow + cert pinning spike` | 1 | P0 | A-6 |
| 9 | `feat(mobile): API client + auth interceptor + error reporter` | 1 | P0 | — |
| 10 | `feat(mobile): app lifecycle + MMKV encryption eval + accessibility baseline` | 1 | P1 | A-1, A-3 |
| 11 | `feat(mobile): task list + filters + read-only cache + cache versioning + notification badge` | 2 | P0 | A-2 |
| 12 | `feat(mobile): task detail + comments + status change` | 2 | P0 | — |
| 13 | `feat(mobile): create/edit task form + network state handler` | 2 | P1 | — |
| 14 | `feat(mobile): server-side timer + weekly timesheet view` | 3 | P0 | — |
| 15 | `feat(mobile): time entry templates + copy week` | 3 | P1 | — |
| 16 | `feat(mobile): notification list + polling + deep links` | 4 | P0 | — |
| 17 | `feat(mobile): dashboard overview cards` | 4 | P1 | — |
| 18 | `feat(mobile): push token registration endpoint` | 4 | P1 | A-5 |
| 19 | `feat(mobile): offline write queue + optimistic concurrency + idempotency` | 4 | P1 | C-3 |
| 20 | `feat(mobile): document browser + markdown reader` | 5 | P1 | — |
| 21 | `feat(mobile): user settings + dark mode` | 5 | P2 | — |
| 22 | `feat(mobile): UX polish + skeleton states + haptics` | 6 | P2 | — |
| 23 | `feat(mobile): testing (Jest + Detox + accessibility audit)` | 6 | P1 | — |
| 24 | `feat(mobile): TestFlight beta + enterprise/MDM distribution` | 6 | P1 | A-7 |

---

## Appendix: 審查紀錄

### v2 審查（2026-03-29）— 架構審查修正

以下為 v1 → v2 的重要變更，基於架構審查發現的問題：

| 變更 | 原因 |
|------|------|
| Auth 改用 Auth.js `encode()` 產生 JWE | Edge middleware `checkEdgeJwt()` 從未測試過 HS256 Bearer path，用相同 JWE 格式最安全 |
| 新增 Session Limiter 修改 | MAX_CONCURRENT_SESSIONS=2 會導致 mobile login 踢掉 web session |
| 新增 Refresh Token rotation + device binding | 銀行安全合規要求 |
| 新增 Mobile logout 端點 | 原計劃完全遺漏 |
| Certificate Pinning 從 Phase 6 → Phase 1 | 銀行環境安全基線，非打磨項目 |
| 計時器從客戶端 → server-side | iOS background fetch 最短 15 分鐘且不保證觸發 |
| 離線策略分層：Phase 2 read-only，Phase 4 write queue | 降低 Phase 2 複雜度，避免過早投入 conflict resolution |
| 通知 badge polling 提前至 Phase 2 | 讓使用者更早感知任務指派 |

### v3 審查（2026-03-29）— SA Review Conditions 整合

**SA 判定**：APPROVE WITH CONDITIONS

v2 → v3 整合 5 項 SA Conditions 和 7 項 Advisories：

| 變更 | SA ref | 說明 |
|------|--------|------|
| Auth.js 版本鎖定策略 | C-1 | Pin exact version，HKDF 參數是內部 API 非 public guarantee |
| Session register Lua script 原子化 | C-2 | ZADD→ZCARD→ZREM race condition + mobile refresh burst 問題 |
| Write queue 完整衝突規格 | C-3 | 409 + diff UI + idempotency key + FIFO + monotonic seq |
| `verifyMobileToken()` 加 JwtBlacklist check | C-4 | 防止已撤銷 session 在 15min window 內存取 API |
| Air-gapped 環境升為 P0 | C-5 | 沒 npm mirror 連 create-expo-app 都跑不了 |
| MMKV cache size cap + LRU eviction | A-1 | MMKV 無內建 size eviction |
| Cache schema versioning | A-2 | 啟動時比對 `CACHE_SCHEMA_VERSION` key |
| MMKV encryption 評估 | A-3 | 銀行業務資料明文儲存風險 |
| Mobile minimum version middleware | A-4 | 安全 patch 後強制舊版升級 |
| Push Token 移至 Phase 4 | A-5 | Phase 0 不需要，減輕最密集的 Phase |
| SSL pinning 技術 spike | A-6 | react-native-ssl-pinning 與 Axios 不直接相容 |
| Apple Enterprise Plan B（MDM via ABM） | A-7 | Enterprise Program 審核已收緊 |
| Issues 從 22 → 24 個 | — | 新增 Auth.js version pin + minimum version middleware |
| Session TTL 不一致修正 | C-2 | Mobile refresh 必須 clearSession(old) + registerSession(new) |
| Key rotation 安全分析 | C-1 | AUTH_SECRET 變更時 refresh 不受影響（純 DB hash 比對） |
| 新增 App Lifecycle 管理 | 原計劃完全遺漏（前景/背景切換行為） |
| 新增 Accessibility 需求 | 銀行 app 可能有合規要求（VoiceOver、Dynamic Type） |
| 新增 Error Reporter | Air-gapped 無法用 Sentry，需自建 |
| 新增型別自動產出腳本 | 手動同步 36 models 不可維護 |
| 新增 Air-gapped 開發環境建立步驟 | Expo/CocoaPods 需離線 cache |
| 時程從 12 週 → 15-16 週 | Phase 0 從 1→2 週，Phase 6 從 2→3-4 週 |
| GitHub Issues 從 15 → 22 個 | 納入新增的安全/基礎設施項目 |
| `requireAuth()` 檢查順序反轉 | 先查 Bearer header 再查 cookie，避免 mobile request 跑注定失敗的 `auth()` |
| 後端不需新增 `jsonwebtoken` 套件 | 用 Auth.js 內建 encode/decode 即可 |
