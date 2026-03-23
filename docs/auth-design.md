# TITAN 認證與帳號整合設計

**文件版本：** v1.0
**建立日期：** 2026-03-23
**適用對象：** 銀行 IT 團隊（TITAN 平台管理員、資安人員）
**相關 Issue：** #12

---

## 目錄

1. [整體策略](#整體策略)
2. [Phase 1：本地認證（MVP）](#phase-1本地認證mvp)
3. [Phase 2：OIDC/SSO 整合（後 MVP）](#phase-2oidcsso-整合後-mvp)
4. [RBAC 角色模型](#rbac-角色模型)
5. [銀行環境安全考量](#銀行環境安全考量)
6. [實作時程建議](#實作時程建議)

---

## 整體策略

TITAN 平台採用**兩階段認證演進策略**：

- **Phase 1（MVP）**：各服務使用內建本地帳號體系，快速上線，無 AD 依賴。
- **Phase 2（後 MVP）**：引入 Keycloak 作為身份代理（Identity Broker），銜接銀行現有 AD/LDAP，統一 OIDC/SSO 登入。

此設計原則：**先讓服務跑起來，再做身份整合；不因 SSO 延誤 MVP 上線。**

---

## Phase 1：本地認證（MVP）

### 1.1 設計決策：共用帳號資料庫 vs 各服務獨立帳號

| 面向 | 共用帳號資料庫 | 各服務獨立帳號（建議採用） |
|------|--------------|--------------------------|
| 複雜度 | 需額外中介層或自建 IdP | 直接使用各服務內建機制，複雜度低 |
| MVP 速度 | 較慢，需額外開發 | **快速上線** |
| 帳號同步 | 自動同步 | 需手動或腳本管理多份帳號 |
| Phase 2 相容性 | 需整合遷移 | 直接切換至 Keycloak OIDC，舊帳號停用 |
| 風險 | 單點故障風險較高 | 各服務獨立，故障隔離較佳 |

**MVP 建議：各服務使用內建帳號體系，Phase 2 統一切換至 OIDC，Phase 1 帳號屆時停用。**

### 1.2 各服務本地認證方式

#### Outline（知識庫）

- 內建支援 Email + 密碼登入
- 初始化時建立管理員帳號（見 `scripts/auth-init.sh`）
- 設定檔關鍵環境變數：

```env
# .env
SECRET_KEY=<隨機產生，至少 32 字元>
UTILS_SECRET=<隨機產生，至少 32 字元>
# 允許本地 email 認證（Phase 1）
ALLOWED_DOMAINS=
# 停用 Google/Slack 等 OAuth（Phase 1 不需要）
GOOGLE_CLIENT_ID=
SLACK_KEY=
```

- 預設啟用電子郵件邀請：管理員在後台建立使用者 → 系統發送邀請信 → 使用者設定密碼

#### Plane（專案管理）

- 內建帳號系統，支援 Email + 密碼
- 管理員透過後台 `/settings/members/` 邀請成員
- 初始 superuser 由環境變數或 `manage.py createsuperuser` 建立

```env
# plane/.env
SECRET_KEY=<隨機產生>
WEB_URL=https://plane.internal.bank.com
# Phase 1：停用外部 OAuth
ENABLE_SIGNUP=0    # 停用公開自行註冊，改由管理員邀請
```

### 1.3 初始管理員建立流程

詳見 `scripts/auth-init.sh`，流程摘要如下：

1. **部署服務**：執行 `docker compose up -d`，等待健康檢查通過
2. **Outline 管理員**：
   - 呼叫 Outline API 建立第一位管理員
   - 管理員收到邀請信，完成首次登入並設定密碼
3. **Plane 管理員**：
   - 進入 Plane 容器執行 `python manage.py createsuperuser`
   - 或透過 Plane 設定頁面完成初始設定
4. **記錄帳號**：將管理員清單記錄於內部 ITSM 系統（非 Git）

---

## Phase 2：OIDC/SSO 整合（後 MVP）

### 2.1 架構概覽

```
使用者瀏覽器
     │
     ▼
┌─────────────────────────────────────────┐
│  Outline / Plane（OIDC Client）          │
│  發起 Authorization Code Flow            │
└────────────────┬────────────────────────┘
                 │ OIDC redirect
                 ▼
┌─────────────────────────────────────────┐
│  Keycloak（Identity Broker，自架）       │
│  Realm: titan                            │
│  - 管理 TITAN 應用程式客戶端設定         │
│  - 連接銀行 AD/LDAP                     │
│  - 群組對映（AD Group → App Role）       │
└────────────────┬────────────────────────┘
                 │ LDAP/Kerberos
                 ▼
┌─────────────────────────────────────────┐
│  銀行 Active Directory / LDAP           │
│  - 員工帳號主目錄                        │
│  - 部門群組（IT、IM、Security…）         │
└─────────────────────────────────────────┘
```

### 2.2 Keycloak 作為 Identity Broker

**部署建議：**
- 自架於銀行內網，不對外開放
- 建議與 TITAN 服務同網段，透過 Docker Compose 或獨立 VM 部署
- 版本：Keycloak 24.x（LTS）

**Realm 設定：**
- Realm 名稱：`titan`
- 設定請參考 `config/auth/keycloak-realm-export.json`

**LDAP User Federation 設定：**

```
Provider：Active Directory
Connection URL：ldaps://ad.internal.bank.com:636
Users DN：OU=Users,DC=bank,DC=com
Bind DN：CN=keycloak-svc,OU=ServiceAccounts,DC=bank,DC=com
Bind Credential：<服務帳號密碼，存放於 Vault>
User Object Classes：person, organizationalPerson, user
```

### 2.3 Outline OIDC 設定

```env
# Outline OIDC（Phase 2）
OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=<Keycloak 產生>
OIDC_AUTH_URI=https://keycloak.internal.bank.com/realms/titan/protocol/openid-connect/auth
OIDC_TOKEN_URI=https://keycloak.internal.bank.com/realms/titan/protocol/openid-connect/token
OIDC_USERINFO_URI=https://keycloak.internal.bank.com/realms/titan/protocol/openid-connect/userinfo
OIDC_USERNAME_CLAIM=preferred_username
OIDC_DISPLAY_NAME=銀行 SSO 登入
OIDC_SCOPES=openid profile email
```

### 2.4 Plane OIDC 設定

Plane 透過 `OIDC_PROVIDERS` 設定或 Django Allauth OIDC 後端對接 Keycloak：

```env
# Plane OIDC（Phase 2）
OIDC_PROVIDER_NAME=銀行SSO
OIDC_CLIENT_ID=plane
OIDC_CLIENT_SECRET=<Keycloak 產生>
OIDC_ISSUER=https://keycloak.internal.bank.com/realms/titan
OIDC_CALLBACK_URL=https://plane.internal.bank.com/auth/oidc/callback/
```

### 2.5 群組對映（AD Groups → App Roles）

| AD 群組 | Keycloak 角色 | Outline 角色 | Plane 角色 |
|---------|--------------|-------------|-----------|
| `IT-TITAN-Admin` | `titan-admin` | admin | owner |
| `IT-TITAN-Manager` | `titan-manager` | member（可建立 Collection） | admin（Project 管理） |
| `IT-Developers` | `titan-engineer` | member | member |
| `IT-All` | `titan-readonly` | viewer | viewer |

**Keycloak Mapper 設定方式：**

1. 進入 Realm → `titan` → Clients → `outline`（或 `plane`）
2. 新增 Mapper：Type = `Group Membership`
3. Token Claim Name = `groups`
4. 各應用程式讀取 `groups` claim，依群組名稱設定角色

---

## RBAC 角色模型

### 4.1 角色定義

詳見 `config/auth/roles.yaml`。

| 角色 | 說明 | 適用人員 |
|------|------|---------|
| `admin` | 平台管理員，全部權限 | TITAN 維運人員（1-2 人） |
| `manager` | 專案/文件管理者，可建立/刪除資源 | 部門主管、Tech Lead |
| `engineer` | 工程師，可讀寫自身工作範圍 | 開發人員、SA、DBA |
| `readonly` | 唯讀，僅瀏覽 | 審計人員、其他部門觀察者 |

### 4.2 各服務權限矩陣

#### Outline（知識庫）

| 操作 | admin | manager | engineer | readonly |
|------|:-----:|:-------:|:--------:|:--------:|
| 建立 Collection | ✅ | ✅ | ❌ | ❌ |
| 建立/編輯 Document | ✅ | ✅ | ✅ | ❌ |
| 刪除 Document | ✅ | ✅ | ❌（僅自己） | ❌ |
| 管理成員權限 | ✅ | ❌ | ❌ | ❌ |
| 瀏覽文件 | ✅ | ✅ | ✅ | ✅ |
| 匯出文件 | ✅ | ✅ | ✅ | ✅ |
| 系統設定 | ✅ | ❌ | ❌ | ❌ |

#### Plane（專案管理）

| 操作 | admin | manager | engineer | readonly |
|------|:-----:|:-------:|:--------:|:--------:|
| 建立 Project | ✅ | ✅ | ❌ | ❌ |
| 建立/編輯 Issue | ✅ | ✅ | ✅ | ❌ |
| 關閉/刪除 Issue | ✅ | ✅ | ❌（僅自己） | ❌ |
| 管理 Sprint/Cycle | ✅ | ✅ | ❌ | ❌ |
| 管理成員 | ✅ | ✅（Project 內） | ❌ | ❌ |
| 瀏覽 Issue | ✅ | ✅ | ✅ | ✅ |
| 系統設定 | ✅ | ❌ | ❌ | ❌ |

---

## 銀行環境安全考量

### 5.1 密碼政策

- Phase 1 本地帳號：
  - 最小長度：12 字元
  - 須包含大小寫英文、數字、特殊符號
  - 密碼有效期：90 天（參照銀行資安規範）
  - 連續失敗 5 次鎖定帳號

- Phase 2 SSO：
  - 密碼政策由 AD 統一管理，Keycloak 繼承
  - 建議啟用 MFA（銀行 OTP Token 或 TOTP App）

### 5.2 Session 管理

- Outline/Plane Session 逾時：**8 小時**（符合銀行上班時段）
- 閒置逾時：**30 分鐘**
- 強制登出：管理員可在後台 revoke session
- Phase 2：Keycloak 統一管理 SSO session，支援單一登出（Single Logout）

### 5.3 傳輸安全

- 所有服務必須透過 **HTTPS**（TLS 1.2+）存取
- Keycloak ↔ AD/LDAP：使用 **LDAPS**（port 636）或 STARTTLS
- 內部服務間通訊（Docker 網路）可使用 HTTP，但邊界必須有反向代理（nginx/traefik）做 TLS 終止

### 5.4 服務帳號管理

- Keycloak 連接 AD 使用的服務帳號（bind account）：
  - 最小化權限：僅 Read 目錄，禁止寫入
  - 放置於 `OU=ServiceAccounts`，獨立管理
  - 密碼存放於 HashiCorp Vault 或銀行 PAM 系統，**禁止明文寫入設定檔**
- OIDC Client Secret 同樣存放於 Vault，透過 Docker Secret 或 Env 注入

### 5.5 稽核日誌

| 事件類型 | 記錄位置 | 保存期限 |
|---------|---------|---------|
| 登入成功/失敗 | Keycloak Events + SIEM | 1 年 |
| 帳號建立/停用 | Keycloak Admin Events | 2 年 |
| 角色/權限變更 | Keycloak Admin Events | 2 年 |
| 文件存取 | Outline Audit Log | 6 個月 |
| Issue 操作 | Plane Activity Log | 6 個月 |

- 稽核日誌**不可刪除、不可被應用程式管理員修改**
- 建議串接至銀行既有 SIEM（如 Splunk/QRadar）

### 5.6 網路隔離

```
[使用者端點]
     │ HTTPS:443
     ▼
[DMZ 反向代理：nginx]
     │ HTTP（內網）
     ▼
[TITAN 應用服務群（內網 VLAN）]
     │ LDAPS:636
     ▼
[AD/LDAP 伺服器（AD VLAN）]
```

- TITAN 服務不直接對外；反向代理為唯一入口
- Keycloak 僅對內網 TITAN VLAN 開放

---

## 實作時程建議

| 階段 | 項目 | 預計工時 | 前置條件 |
|------|------|---------|---------|
| Phase 1 | 本地帳號初始化腳本 | 0.5 天 | 服務部署完成 |
| Phase 1 | 建立初始帳號、驗證 RBAC | 0.5 天 | 腳本完成 |
| Phase 2 | Keycloak 部署與 Realm 設定 | 1 天 | 銀行 AD 服務帳號申請核准 |
| Phase 2 | LDAP Federation 設定與測試 | 1 天 | Keycloak 部署完成、AD 連線允許 |
| Phase 2 | Outline/Plane OIDC 對接 | 1 天 | Keycloak Realm 設定完成 |
| Phase 2 | 群組對映測試與上線 | 0.5 天 | 各服務 OIDC 設定完成 |

**總估計：Phase 1 約 1 天；Phase 2 約 4 天**（不含 AD 服務帳號申請等行政流程）

---

*本文件由 TITAN 平台設計團隊維護，修改請開 GitHub Issue。*
