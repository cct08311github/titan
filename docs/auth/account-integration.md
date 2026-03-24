# T10 帳號整合方案設計

## 概述

本文件描述 TITAN 專案中 Plane 專案管理系統和 Outline Wiki 的帳號整合方案，採用 LDAP/AD 作為主要認證來源，並提供 Local Auth 作為備援方案。

---

## 1. LDAP/AD 整合架構

### 1.1 整合架構圖

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Bank AD    │────▶│   Keycloak IdP   │────▶│   Plane     │
│  (LDAP/AD)   │     │ (OIDC Provider)  │     │   (Enterprise)│
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Outline   │
                    │   (OIDC)    │
                    └─────────────┘
```

### 1.2 方案說明

由於 Plane 和 Outline 皆不直接支援 LDAP 原生整合，採用以下方案：

- **主要方案**：透過 Keycloak 作為 Identity Provider (IdP)，連接銀行 AD/LDAP，提供 OIDC/SAML 給 Plane 和 Outline
- **備援方案**：當銀行 AD 不可用時，使用 Keycloak 內建的資料庫進行 Local Auth

---

## 2. Plane LDAP/AD 整合

### 2.1 版本需求

- **Plane Enterprise Edition**：支援 SAML 2.0 和 OIDC SSO
- 官方文件：https://developers.plane.so/self-hosting/govern/saml-sso

### 2.2 OIDC 配置 (推薦)

Plane 支援 OIDC 認證，可透過 Keycloak 提供。主要環境變數：

```bash
# Plane OIDC 認證配置 (Enterprise Edition)
OIDC_CLIENT_ID=plane
OIDC_CLIENT_SECRET=<your-client-secret>
OIDC_ISSUER_URL=https://keycloak.your-domain.com/realms/titan
```

### 2.3 SAML 配置 (替代方案)

```xml
<!-- Plane SAML 配置 -->
<SAML>
  <EntityId>plane.your-domain.com</EntityId>
  <SSOUrl>https://keycloak.your-domain.com/realms/titan/protocol/saml</SSOUrl>
  <Certificate>/path/to/keycloak.crt</Certificate>
</SAML>
```

### 2.4 群組同步

Plane Enterprise 支援從 IdP 同步群組：

```bash
# 啟用群組同步
OIDC_GROUPS_SYNC=true
OIDC_GROUPS_CLAIM=groups
```

---

## 3. Outline LDAP/AD 整合

### 3.1 認證方式

Outline 不支援原生 LDAP，但支援 OIDC。主要環境變數：

```bash
# Outline OIDC 認證配置
OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=<your-client-secret>
OIDC_AUTH_URI=https://keycloak.your-domain.com/realms/titan/protocol/openid-connect/auth
OIDC_TOKEN_URI=https://keycloak.your-domain.com/realms/titan/protocol/openid-connect/token
OIDC_USERINFO_URI=https://keycloak.your-domain.com/realms/titan/protocol/openid-connect/userinfo
OIDC_ISSUER_URL=https://keycloak.your-domain.com/realms/titan
OIDC_LOGOUT_URI=https://keycloak.your-domain.com/realms/titan/protocol/openid-connect/logout
OIDC_USERNAME_CLAIM=preferred_username
OIDC_DISPLAY_NAME=銀行 AD 帳號
OIDC_SCOPES=openid profile email
```

### 3.2 自動發現

若 Keycloak 支援 .well-known 可簡化配置：

```bash
# 僅需 issuer URL
OIDC_ISSUER_URL=https://keycloak.your-domain.com/realms/titan
```

---

## 4. Keycloak 配置範本

### 4.1 Realm 配置

```json
{
  "realm": "titan",
  "enabled": true,
  "displayName": "TITAN System",
  "accessTokenLifespan": 300,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 86400
}
```

### 4.2 LDAP  Federation 配置

```json
{
  "name": "Bank LDAP",
  "provider": "ldap",
  "priority": 0,
  "config": {
    "vendor": "ad",
    "connectionUrl": "ldap://ldap.bank.internal:389",
    "bindDn": "cn=admin,dc=bank,dc=local",
    "bindCredential": "<encrypted-password>",
    "baseDn": "dc=bank,dc=local",
    "userDnShips": [
      {
        "baseDn": "ou=Users,dc=bank,dc=local",
        "objectClass": "person"
      }
    ],
    "groupDnShips": [
      {
        "baseDn": "ou=Groups,dc=bank,dc=local",
        "objectClass": "groupOfNames"
      }
    ],
    "userObjectClasses": ["person", "organizationalPerson", "user"],
    "groupObjectClasses": ["group", "groupOfNames"],
    "searchScope": "1"
  },
  "mapper": {
    "username": {
      "ldapAttribute": "sAMAccountName",
      "userModelAttribute": "username"
    },
    "email": {
      "ldapAttribute": "mail",
      "userModelAttribute": "email"
    },
    "firstName": {
      "ldapAttribute": "givenName",
      "userModelAttribute": "firstName"
    },
    "lastName": {
      "ldapAttribute": "sn",
      "userModelAttribute": "lastName"
    },
    "groups": {
      "ldapAttribute": "member",
      "groupIdAttribute": "cn"
    }
  }
}
```

### 4.3 Client 配置 (Plane & Outline)

#### 4.3.1 Plane Client

```json
{
  "clientId": "plane",
  "name": "Plane Project Management",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "secret": "<generate-random-secret>",
  "protocol": "openid-connect",
  "redirectUris": ["https://plane.your-domain.com/*"],
  "webOrigins": ["https://plane.your-domain.com"],
  "defaultRoles": ["user"],
  "optionalClaims": "id_token token",
  "consentRequired": false,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false
}
```

#### 4.3.2 Outline Client

```json
{
  "clientId": "outline",
  "name": "Outline Wiki",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "secret": "<generate-random-secret>",
  "protocol": "openid-connect",
  "redirectUris": ["https://outline.your-domain.com/auth/oidc.callback"],
  "webOrigins": ["https://outline.your-domain.com"],
  "defaultRoles": ["user"],
  "consentRequired": false,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false
}
```

---

## 5. Local Auth 備援方案

### 5.1 啟用條件

當銀行 AD/LDAP 服務不可用時，系統自動切換至 Local Auth 模式：

1. LDAP 伺服器連線逾時
2. LDAP 伺服器回應錯誤
3. 網路連線中斷

### 5.2 Keycloak 內建資料庫認證

Keycloak 預設啟用密碼認證，可作為備援：

```json
{
  "realm": "titan",
  "resetPasswordAllowed": false,
  "editUsernameAllowed": false,
  "bruteForceProtected": true,
  "permanentLockout": false,
  "maxFailureWaitSeconds": 900,
  "minimumQuickLoginWaitSeconds": 60,
  "waitIncrementSeconds": 60,
  "quickLoginCheckMilliSeconds": 1000,
  "maxDeltaTimeSeconds": 43200,
  "deltaTimeAtLeast": 43200,
  "failureFactor": 30
}
```

### 5.3 使用者遷移腳本

當從 AD 遷移至 Local 時使用：

```bash
#!/bin/bash
# migrate_ad_users.sh - 將 AD 使用者遷移至 Keycloak 內部資料庫

KEYCLOAK_URL="https://keycloak.your-domain.com"
REALM="titan"
ADMIN_USER="admin"
ADMIN_PASSWORD="<admin-password>"

# 取得 token
TOKEN=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASSWORD}&grant_type=password&client_id=admin-cli" | \
  jq -r '.access_token')

# 匯入使用者 (需先從 AD 匯出)
curl -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/users" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @users.json
```

### 5.4 密碼原則

```json
{
  "id": "password-policy",
  "description": "TITAN Password Policy",
  "digits": 1,
  "specialChars": 1,
  "upperCase": 1,
  "lowerCase": 1,
  "length": 8,
  "hashIterations": 27500,
  "salt": true
}
```

---

## 6. 帳號權限矩陣

### 6.1 角色定義

| 角色 | 說明 | Plane 權限 | Outline 權限 |
|------|------|------------|-------------|
| **Admin** | 系統管理員 | 完全控制 | 完全控制 |
| **Manager** | 部門經理 | 專案管理、檢視所有專案 | 建立/編輯文件 |
| **Member** | 一般成員 | 加入專案、建立議題 | 檢視/編輯文件 |
| **Viewer** | 檢視者 | 唯讀 | 唯讀 |
| **Guest** | 外部人員 | 有限檢視 | 特定文件檢視 |

### 6.2 AD 群組對應

| AD 群組 | 對應角色 | Plane 角色 | Outline 角色 |
|---------|---------|------------|-------------|
| `TITAN-Admins` | Admin | Admin | Admin |
| `TITAN-Managers` | Manager | Admin/Member | Editor |
| `TITAN-Members` | Member | Member | Member |
| `TITAN-Viewers` | Viewer | Viewer | Viewer |
| `TITAN-Guests` | Guest | Guest | Viewer |

### 6.3 Keycloak 角色映射

```json
{
  "roleMappings": {
    "TITAN-Admins": ["plane-admin", "outline-admin"],
    "TITAN-Managers": ["plane-admin", "outline-editor"],
    "TITAN-Members": ["plane-member", "outline-member"],
    "TITAN-Viewers": ["plane-viewer", "outline-viewer"],
    "TITAN-Guests": ["outline-viewer"]
  }
}
```

### 6.4 詳細權限矩陣

#### Plane 權限

| 功能 | Admin | Manager | Member | Viewer | Guest |
|------|-------|---------|--------|--------|-------|
| 建立專案 | ✓ | ✓ | - | - | - |
| 刪除專案 | ✓ | - | - | - | - |
| 管理成員 | ✓ | ✓ | - | - | - |
| 建立議題 | ✓ | ✓ | ✓ | - | - |
| 指派議題 | ✓ | ✓ | ✓ | - | - |
| 檢視所有專案 | ✓ | ✓ | - | - | - |
| 檢視指派專案 | ✓ | ✓ | ✓ | ✓ | - |
| 建立里程碑 | ✓ | ✓ | - | - | - |
| 建立標籤 | ✓ | ✓ | - | - | - |
| API 存取 | ✓ | ✓ | - | - | - |

#### Outline 權限

| 功能 | Admin | Manager | Member | Viewer | Guest |
|------|-------|---------|--------|--------|-------|
| 建立文件集 | ✓ | ✓ | - | - | - |
| 刪除文件集 | ✓ | - | - | - | - |
| 建立文件 | ✓ | ✓ | ✓ | - | - |
| 編輯文件 | ✓ | ✓ | ✓ | - | - |
| 刪除文件 | ✓ | ✓ | - | - | - |
| 管理權限 | ✓ | - | - | - | - |
| 檢視文件 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 歷史版本 | ✓ | ✓ | ✓ | ✓ | - |
| 匯出文件 | ✓ | ✓ | ✓ | ✓ | - |
| API 存取 | ✓ | - | - | - | - |

---

## 7. 部署檢查清單

### 7.1 前置條件

- [ ] Keycloak 部署完成並運行
- [ ] 銀行 AD/LDAP 連線資訊取得
- [ ] SSL 憑證準備完成
- [ ] 網域 DNS 設定完成

### 7.2 Keycloak 設定

- [ ] 建立 Titan Realm
- [ ] 設定 LDAP Federation
- [ ] 建立 Plane Client
- [ ] 建立 Outline Client
- [ ] 設定群組映射
- [ ] 測試 LDAP 連線
- [ ] 測試 OIDC 流程

### 7.3 Plane 設定

- [ ] 安裝 Enterprise Edition
- [ ] 配置 OIDC 環境變數
- [ ] 啟用群組同步
- [ ] 驗證使用者登入
- [ ] 設定角色權限

### 7.4 Outline 設定

- [ ] 安裝 Outline
- [ ] 配置 OIDC 環境變數
- [ ] 驗證使用者登入
- [ ] 設定文件權限

---

## 8. 風險與緩解

### 8.1 風險清單

| 風險 | 嚴重程度 | 緩解措施 |
|------|----------|----------|
| AD 服務中斷 | 高 | Keycloak Local Auth 自動切換 |
| 密碼外洩 | 高 | 強制密碼策略、登入失敗鎖定 |
| 未授權存取 | 高 | IP 白名單、MFA 強制 |
| 群組同步失敗 | 中 | 手動同步腳本、通知機制 |

### 8.2 監控指標

- LDAP 連線狀態
- 認證失敗次數
- Token 過期時間
- 群組同步狀態

---

## 9. 參考資源

- [Plane Enterprise SSO](https://developers.plane.so/self-hosting/govern/saml-sso)
- [Plane OIDC SSO](https://developers.plane.so/self-hosting/govern/oidc-sso)
- [Outline Authentication](https://docs.getoutline.com/s/hosting/doc/authentication-7ViKRmRY5o)
- [Outline OIDC](https://docs.getoutline.com/s/hosting/doc/oidc-8CPBm6uC0I)
- [Keycloak LDAP Federation](https://www.keycloak.org/docs/latest/server_admin/#_ldap)

---

**版本**: 1.0  
**更新日期**: 2026-03-23  
**作者**: TITAN Backend Team