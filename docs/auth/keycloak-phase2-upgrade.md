# Keycloak Phase 2 認證整合升級指引

> 從 Phase 1（本地帳號）升級至 Phase 2（Keycloak OIDC/SSO）

**版本**: v1.0
**最後更新**: 2026-03-25
**前置文件**: `docs/auth-design.md`（§2. Phase 2）
**相關 Issue**: #12, #220

---

## 1. 升級路徑概覽

```
Phase 1（目前）                    Phase 2（目標）
┌─────────────────┐              ┌─────────────────┐
│ TITAN Next.js   │              │ TITAN Next.js   │
│ NextAuth local  │──升級──→     │ NextAuth OIDC   │
│ bcrypt 密碼     │              │                 │
├─────────────────┤              ├─────────────────┤
│ Outline         │              │ Outline         │
│ Email/Password  │──升級──→     │ OIDC Client     │
├─────────────────┤              ├─────────────────┤
│ Plane           │              │ Plane           │
│ Local auth      │──升級──→     │ OIDC Client     │
└─────────────────┘              └────────┬────────┘
                                          │ OIDC
                                          ▼
                                 ┌─────────────────┐
                                 │ Keycloak        │
                                 │ (Identity Broker)│
                                 │      ↓ LDAP     │
                                 │ Bank AD/LDAP    │
                                 └─────────────────┘
```

## 2. 前置條件

- [ ] 行方 IT 部門提供 AD/LDAP 連線資訊（參考 `docs/auth-design.md` §2.2）
- [ ] Keycloak 部署主機已備妥（建議同 TITAN 網段）
- [ ] SSL 憑證已準備（Keycloak 需 HTTPS）
- [ ] 維護窗口已排定（建議週六 09:00-17:00）
- [ ] 完成 Phase 1 所有測試覆蓋率門檻

## 3. 升級步驟

### Step 1: 部署 Keycloak（1-2 小時）

```bash
# 加入 Keycloak 到 docker-compose
# 建議使用獨立的 docker-compose.keycloak.yml
docker compose -f docker-compose.yml -f docker-compose.keycloak.yml up -d keycloak

# 等待 Keycloak 啟動（首次啟動較慢，需初始化資料庫）
docker logs -f titan-keycloak
# 看到 "Keycloak ... started in XXXs" 即可
```

### Step 2: 設定 Keycloak Realm（30 分鐘）

1. 開啟 Keycloak Admin Console：`https://keycloak.internal.bank.com/admin`
2. 建立 Realm：`titan`
3. 匯入預設設定：`config/auth/keycloak-realm-export.json`
4. 設定 LDAP User Federation（參考 `docs/auth-design.md` §2.2）
5. 建立 Client：`titan-app`、`outline`、`plane`
6. 設定群組對映（參考 `docs/auth-design.md` §2.5）

### Step 3: 設定 TITAN Next.js OIDC（1 小時）

```bash
# 更新 .env
NEXTAUTH_PROVIDER=oidc
OIDC_CLIENT_ID=titan-app
OIDC_CLIENT_SECRET=<Keycloak 產生的 client secret>
OIDC_ISSUER=https://keycloak.internal.bank.com/realms/titan

# NextAuth 設定檔已支援 OIDC provider（見 app/api/auth/[...nextauth]/route.ts）
# AUTH_MODE 設為 hybrid 可同時保留本地帳號作為緊急 fallback
AUTH_MODE=hybrid
```

### Step 4: 設定 Outline OIDC（30 分鐘）

參考 `docs/auth-design.md` §2.3 設定 Outline 的 OIDC 環境變數。

### Step 5: 設定 Plane OIDC（30 分鐘）

參考 `docs/auth-design.md` §2.4 設定 Plane 的 OIDC 環境變數。

### Step 6: 帳號遷移（1-2 小時）

```bash
# 確保 AD 使用者同步至 Keycloak
# Keycloak Admin → User Federation → Synchronize all users

# 驗證 Keycloak 使用者列表
# Keycloak Admin → Users → 確認 AD 使用者已出現

# Phase 1 本地帳號停用排程：
# 1. 通知所有使用者改用 SSO 登入
# 2. 觀察期 2 週，確認所有人已切換
# 3. 停用 Phase 1 本地帳號（保留管理員緊急帳號）
```

### Step 7: 驗證（1 小時）

- [ ] 使用 AD 帳號登入 TITAN Next.js
- [ ] 使用 AD 帳號登入 Outline
- [ ] 使用 AD 帳號登入 Plane
- [ ] 確認角色對映正確（AD 群組 → 應用角色）
- [ ] 確認管理員本地帳號仍可登入（fallback）
- [ ] 確認 Session 正常過期與續期

## 4. 回滾方案

如升級過程發生問題：

```bash
# 還原 .env 為 Phase 1 設定
AUTH_MODE=local

# 重啟服務
docker compose restart app outline

# Phase 1 本地帳號立即可用
```

## 5. 參考

- `docs/auth-design.md` — 完整認證設計文件
- `docs/account-integration.md` — 帳號整合說明
- Issue #12 — 認證模組實作
- Issue #220 — LDAP/AD 整合規劃
