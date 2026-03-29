# Auth.js (next-auth) 升級 SOP

> **目的**：確保 Auth.js 版本升級不會破壞 mobile app 的 JWE token 相容性。
> **適用範圍**：TITAN 專案中 `next-auth` 套件的任何版本變更。
> **建立日期**：2026-03-29
> **關聯 Issue**：#1088

---

## 背景

TITAN Mobile 使用 Auth.js `encode()` 產生 JWE token，與 web 端 cookie 格式完全相同。Edge middleware `checkEdgeJwt()`（`lib/auth-depth.ts`）使用 HKDF 衍生金鑰解密 JWE。

**關鍵風險**：HKDF 參數（salt = cookie name, info = `Auth.js Generated Encryption Key ({salt})`）是 Auth.js v5 的**內部實作細節**，非 public API guarantee。Minor version bump 若改變 key derivation 邏輯，mobile token 和 Edge middleware 會同時失效。

---

## 版本鎖定策略

- `package.json` 中 `next-auth` 必須使用 **exact version**（不使用 `^` 或 `~`）
- 當前版本：`"next-auth": "5.0.0-beta.30"`
- 升級只能透過本 SOP 流程進行

---

## 升級步驟

### 1. 準備階段

```bash
# 1.1 建立升級分支
git checkout -b chore/authjs-upgrade-to-{version}

# 1.2 閱讀 changelog
# https://github.com/nextauthjs/next-auth/releases
# 重點關注：JWT/JWE 相關變更、encryption 相關變更、cookie 格式變更

# 1.3 搜尋 breaking changes
# 關鍵字：HKDF, JWE, encrypt, cookie, session, encode, decode
```

### 2. 升級執行

```bash
# 2.1 更新版本（exact pin, 不加 caret）
npm install next-auth@{exact-version} --save-exact

# 2.2 驗證 package.json 無 caret/tilde
grep '"next-auth"' package.json
# 預期：  "next-auth": "{exact-version}",
```

### 3. Mobile Token 相容性驗證（必做）

```bash
# 3.1 啟動 dev server
npm run dev

# 3.2 執行 mobile auth 整合測試
npm run test -- --testPathPattern='mobile-auth'

# 3.3 手動驗證流程（如 CI 測試尚未建立）
```

**手動驗證步驟**：

1. **Login**：`POST /api/auth/mobile/login` → 取得 JWE token
2. **Edge Middleware**：用 token 呼叫任何 `/api/*` endpoint → 應回 200
3. **Refresh**：`POST /api/auth/mobile/refresh` → 取得新 token
4. **New Token Works**：用新 token 呼叫 API → 應回 200
5. **Logout**：`POST /api/auth/mobile/logout` → 舊 token 應回 401
6. **Web 不受影響**：web 端正常登入/操作

### 4. 回歸測試

```bash
# 4.1 完整測試套件
npm run test

# 4.2 E2E 測試（含 auth 相關）
npx playwright test --grep='auth|login|session'

# 4.3 確認 Edge middleware 無報錯
npm run build
```

### 5. 部署

- PR 標題：`chore(auth): upgrade next-auth to {version}`
- PR body 必須包含 mobile token 驗證結果截圖或測試輸出
- 部署後監控 `logs/gateway.err.log` 15 分鐘

---

## 回滾計劃

```bash
# 如果升級後 mobile 或 web auth 異常
npm install next-auth@5.0.0-beta.30 --save-exact
git commit -am "revert(auth): rollback next-auth to 5.0.0-beta.30"
git push
```

---

## CI 自動化（建議）

在 CI pipeline 加入以下檢查：

```yaml
# .github/workflows/authjs-version-check.yml
# 偵測 next-auth 版本變更時，自動觸發 mobile auth integration test
# 並在 PR comment 中標記 ⚠️ AUTH VERSION CHANGE
```

---

## 版本變更紀錄

| 日期 | 版本 | 變更者 | 驗證結果 |
|------|------|--------|----------|
| 2026-03-29 | 5.0.0-beta.30 | (初始 pin) | N/A (baseline) |
