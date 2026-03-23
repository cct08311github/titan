# TITAN 帳號整合方案設計 (T10)

> **版本**: v1.0  
> **日期**: 2026 年 3 月 23 日  
> **狀態**: 草稿

---

## 目錄

1. [概述](#1-概述)
2. [LDAP/AD 整合架構](#2-ldapad-整合架構)
3. [Plane 帳號整合](#3-plane-帳號整合)
4. [Outline 帳號整合](#4-outline-帳號整合)
5. [Local Auth 備援方案](#5-local-auth-備援方案)
6. [帳號權限矩陣](#6-帳號權限矩陣)
7. [實作時程](#7-實作時程)

---

## 1. 概述

### 1.1 目標

建立統一的帳號管理機制，讓 TITAN 專案中的各服務（Plane、Outline、未來的服務）能够透過 LDAP/AD 進行集中式帳號管理，並提供 Local Auth 作為備援方案。

### 1.2 範圍

- **Plane**: 專案管理系統
- **Outline**: Wiki 文檔系統
- **Future**: 其他需要帳號整合的服務

### 1.3 假設

- 組織已有 AD/LDAP 伺服器 (e.g., Windows Server AD 或 OpenLDAP)
- 使用者透過 AD 帳號登入組織內部系統
- 需要保留 Local Auth 作為離線/備援方案

---

## 2. LDAP/AD 整合架構

### 2.1 架構圖

```
┌─────────────┐     ┌─────────────┐
│   Plane     │     │  Outline    │
│  (SSO/OIDC) │     │ (SSO/OIDC)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────┐
│       OIDC Provider (Dex)        │
│   LDAP/AD → OpenID Connect       │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│        AD/LDAP Server            │
│   (Windows Server / OpenLDAP)    │
└──────────────────────────────────┘
```

### 2.2 技術選型

| 元件 | 用途 | 說明 |
|------|------|------|
| **Dex** | LDAP → OIDC 橋接器 | 將 LDAP/AD 帳號轉為 OIDC 標準，讓不原生支援 LDAP 的服務也能登入 |
| **LDAP** | 目錄服務 | 儲存使用者帳號、組織架構、群組資訊 |
| **OIDC** | 授權標準 | 各服務採用的統一登入協定 |

### 2.3 Dex 配置重點

```yaml
# dex config 示例
connectors:
  - type: ldap
    config:
      host: ldap.example.com:636
      bindDN: cn=admin,dc=example,dc=com
      userSearch:
        baseDN: ou=users,dc=example,dc=com
        filter: "(objectClass=user)"
        username: uid
        idAttr: uid
        emailAttr: mail
        nameAttr: cn
      groupSearch:
        baseDN: ou=groups,dc=example,dc=com
        filter: "(objectClass=groupOfNames)"
        nameAttr: cn
```

---

## 3. Plane 帳號整合

### 3.1 原生支援

Plane 支援以下認證方式：

| 認證方式 | 支援狀態 | 備註 |
|----------|----------|------|
| Email + Password | ✅ 原生 | 最簡單，但不符合企業需求 |
| Google Workspace | ✅ 原生 | 需綁定 Google 帳號 |
| GitHub | ✅ 原生 | 適合開發團隊 |
| GitLab | ✅ 原生 | 適合開發團隊 |
| OIDC/SAML | ✅ 付費版 | 企業版支援 |
| LDAP/AD | ❌ 不支援 | 無原生 LDAP 整合 |

### 3.2 整合方案

**方案 A: 透過 Dex + OIDC (推薦)**

```
AD/LDAP → Dex (OIDC) → Plane (SSO 登入)
```

優點：
- 不需修改 Plane 程式碼
- 統一登入入口
- 可複用於多個服務

缺點：
- 需要額外維運 Dex 服務

**方案 B: 直接使用 SSO (如組織已有)**

若組織已部署 Keycloak、Okta、Auth0 等 IdP，可直接對接 Plane 的 OIDC 功能。

### 3.3 實作步驟

1. 部署 Dex 服務
2. 設定 LDAP/AD 連線
3. 設定 Plane 的 OIDC Provider 資訊
4. 測試使用者登入流程
5. 匯入既有使用者資料

---

## 4. Outline 帳號整合

### 4.1 原生支援

Outline 官方文件明確表示：

> **Outline does not support email + password authentication natively.**

| 認證方式 | 支援狀態 | 備註 |
|----------|----------|------|
| Email + Password | ❌ 不支援 | 必須透過 SSO |
| Google Workspace | ✅ 原生 | 需綁定 Google 帳號 |
| Slack | ✅ 原生 | 需 Slack workspace |
| OIDC/SAML | ✅ 支援 | 企業版功能 |
| LDAP/AD | ❌ 不原生 | 需透過 Dex 橋接 |

### 4.2 整合方案

**方案: Dex + OIDC (推薦)**

```
AD/LDAP → Dex (OIDC) → Outline (SSO 登入)
```

Outline 支援透過 OIDC 提供者進行認證，可使用 Dex 作為橋接層。

### 4.3 實作步驟

1. 部署 Dex 服務（可與 Plane 共用）
2. 設定 LDAP/AD 連線
3. 設定 Outline 環境變數：

```bash
# Outline OIDC 設定
OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=http://dex.example.com:5556
OIDC_SECRET=your-oidc-secret
```

4. 測試使用者登入流程

### 4.4 注意事項

- Outline 沒有「邀請碼」功能，所有使用者必須透過 SSO 建立
- 建議先在測試環境驗證 SSO 流程，再部署到正式環境

---

## 5. Local Auth 備援方案

### 5.1 需求場景

- LDAP/AD 服務暫時不可用
- 外部網路中斷無法連線 IdP
- 緊急維運需要直接登入

### 5.2 實作方案

#### 5.2.1 統一閘道 (Gateway) 方案

建立一個統一的認證閘道，具備以下功能：

```
┌─────────────────────────────────────┐
│         Auth Gateway                │
│  ┌─────────────────────────────┐   │
│  │  1. SSO 優先                │   │
│  │     (Dex/OIDC)              │   │
│  │                             │   │
│  │  2. Fallback: Local Auth    │   │
│  │     (Email + Password)      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**推薦工具**: OAuth2-Proxy

```yaml
# oauth2-proxy config
provider: oidc
issuer_url: http://dex.example.com:5556
email_domains:
  - example.com
cookie_secure: false
cookie_same_site: lax
upstream: http://localhost:3000
```

**Fallback 設定**:

```yaml
# 当 OIDC 不可用时使用
provider: "google"  # 或其他可用的 provider
skip_provider_button: true
```

#### 5.2.2 各服務獨立 Local Auth

| 服務 | Local Auth 支援 | 備註 |
|------|----------------|------|
| Plane | ✅ 原生 | 支援 Email + Password，可作為備援 |
| Outline | ❌ 不支援 | 必須透過 SSO，無備援方案 |
| 未來服務 | 視情況 | 優先選擇支援 Local Auth 的開源方案 |

### 5.3 推薦架構

```
┌──────────────────────────────────────────────────┐
│                   Load Balancer                  │
└─────────────────────┬────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                         ▼
   ┌──────────────┐        ┌──────────────┐
   │ Plane        │        │ Outline      │
   │ (Port 3000)  │        │ (Port 3000)  │
   └──────┬───────┘        └──────┬───────┘
          │                        │
          └────────┬───────────────┘
                   │
                   ▼
          ┌──────────────────┐
          │  OAuth2-Proxy    │
          │  (Auth Gateway)  │
          └────────┬─────────┘
                   │
         ┌────────┴────────┐
         ▼                 ▼
    ┌─────────┐      ┌─────────┐
    │  Dex    │      │ Local   │
    │(LDAP)  │      │  Auth   │
    └─────────┘      └─────────┘
```

### 5.4 緊急存取流程

1. **LDAP/AD 正常時**: 使用者透過 Dex (LDAP) 登入
2. **LDAP/AD 異常時**: 啟用 OAuth2-Proxy 的 fallback 模式，使用預設 Local 帳號
3. **維運帳號**: 保留一組 admin/root 帳號，密碼妥善保管於密碼管理器

---

## 6. 帳號權限矩陣

### 6.1 組織角色

| 角色 | 說明 | 適用系統 |
|------|------|----------|
| **Admin** | 系統管理員，可管理所有設定 | Plane, Outline |
| **Manager** | 專案/部門主管，可管理所屬資源 | Plane, Outline |
| **Member** | 一般成員，可存取被授權的資源 | Plane, Outline |
| **Viewer** | 檢視者，僅讀取權限 | Plane, Outline |

### 6.2 Plane 權限

| 動作 | Admin | Manager | Member | Viewer |
|------|:-----:|:-------:|:------:|:------:|
| 建立Workspace | ✅ | ❌ | ❌ | ❌ |
| 刪除Workspace | ✅ | ❌ | ❌ | ❌ |
| 管理成員 | ✅ | ✅ | ❌ | ❌ |
| 建立專案 | ✅ | ✅ | ✅ | ❌ |
| 刪除專案 | ✅ | ✅ | ❌ | ❌ |
| 建立任務 | ✅ | ✅ | ✅ | ❌ |
| 指派任務 | ✅ | ✅ | ✅ | ❌ |
| 檢視任務 | ✅ | ✅ | ✅ | ✅ |
| 評論任務 | ✅ | ✅ | ✅ | ❌ |
| 管理標籤 | ✅ | ✅ | ❌ | ❌ |
| API存取 | ✅ | ✅ | ✅ | ❌ |

### 6.3 Outline 權限

| 動作 | Admin | Manager | Member | Viewer |
|------|:-----:|:-------:|:------:|:------:|
| 建立Collection | ✅ | ✅ | ❌ | ❌ |
| 刪除Collection | ✅ | ❌ | ❌ | ❌ |
| 管理Collection權限 | ✅ | ✅ | ❌ | ❌ |
| 建立文件 | ✅ | ✅ | ✅ | ❌ |
| 編輯文件 | ✅ | ✅ | ✅ | ❌ |
| 刪除文件 | ✅ | ✅ | ❌ | ❌ |
| 檢視文件 | ✅ | ✅ | ✅ | ✅ |
| 管理共用連結 | ✅ | ✅ | ✅ | ❌ |
| 管理群組 | ✅ | ❌ | ❌ | ❌ |
| 邀請成員 | ✅ | ✅ | ❌ | ❌ |

### 6.4 AD 群組對應

建議在 AD 中建立以下群組，自動對應到各系統：

| AD 群組 | 對應角色 | Plane 角色 | Outline 角色 |
|---------|----------|------------|---------------|
| TITAN-Admins | 系統管理員 | Admin | Admin |
| TITAN-Managers | 部門主管 | Manager | Manager |
| TITAN-Members | 一般成員 | Member | Member |
| TITAN-Viewers | 檢視者 | Viewer | Viewer |

### 6.5 權限繼承流程

```
AD 群組資訊
     │
     ▼
  Dex (LDAP 認證 + 群組映射)
     │
     ▼
  OIDC Token (含 groups claim)
     │
     ▼
各服務 (解析 claim → 對應權限)
```

---

## 7. 實作時程

| 階段 | 工作項目 | 預估天數 | 負責人 |
|------|----------|:--------:|--------|
| **Phase 1** | 環境建置 | 3 | DevOps |
| 1.1 | 部署 Dex 服務 | 1 | |
| 1.2 | 設定 LDAP/AD 連線 | 1 | |
| 1.3 | 測試 LDAP 認證 | 1 | |
| **Phase 2** | Plane 整合 | 2 | Backend |
| 2.1 | 設定 Plane OIDC | 1 | |
| 2.2 | 測試 SSO 登入 | 0.5 | |
| 2.3 | 匯入既有使用者 | 0.5 | |
| **Phase 3** | Outline 整合 | 2 | Backend |
| 3.1 | 設定 Outline OIDC | 1 | |
| 3.2 | 測試 SSO 登入 | 0.5 | |
| 3.3 | 設定權限對應 | 0.5 | |
| **Phase 4** | 閘道與備援 | 2 | DevOps |
| 4.1 | 部署 OAuth2-Proxy | 1 | |
| 4.2 | 設定 fallback 機制 | 0.5 | |
| 4.3 | 文件與訓練 | 0.5 | |
| **合計** | | **9** | |

---

## 8. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| Dex 服務單點故障 | 影響所有 SSO 登入 | 部署叢集，保持高可用 |
| LDAP/AD 中斷 | 無法登入 | 啟用 Local Auth fallback |
| Outline 無法離線登入 | 緊急狀況無法存取 | 透過 OAuth2-Proxy 提供備援閘道 |
| 權限對應錯誤 | 使用者無法存取資源 | 正式上線前 thorough testing |

---

## 9. 參考資料

- [Outline Authentication Documentation](https://docs.getoutline.com/s/hosting/doc/authentication-7ViKRmRY5o)
- [Dex LDAP Connector](https://dexidp.io/docs/connectors/ldap/)
- [Plane SSO Configuration](https://docs.plane.so)
- [OAuth2-Proxy Documentation](https://oauthproxy.github.io/oauth2-proxy/)

---

*文件建立者: TITAN 專案團隊*  
*最後更新: 2026-03-23*