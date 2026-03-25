# TITAN LDAP/AD 整合設計文件

> Issue #220 — Next.js 認證對接銀行 Active Directory

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 設計階段（P4，待行方提供 AD 連線資訊）
**前置文件**: `docs/auth-design.md`、`docs/auth/keycloak-phase2-upgrade.md`

---

## 1. 概述

TITAN 目前使用本地帳號（bcrypt + NextAuth v4 CredentialsProvider）。生產環境需對接銀行現有 Active Directory，實現統一帳號管理。

本文件定義兩種整合路徑，供行方 IT 團隊選擇：

| 方案 | 複雜度 | 適用情境 |
|------|--------|---------|
| A. 直接 LDAP（ldapjs） | 低 | 僅 TITAN 需要 AD 認證 |
| B. Keycloak Broker | 中 | 多應用需要統一 SSO（含 Outline、Plane） |

---

## 2. 方案 A：直接 LDAP 整合

### 2.1 架構

```
使用者 → TITAN Login UI → NextAuth CredentialsProvider
                                    ↓
                           lib/ldap-auth.ts
                                    ↓ LDAP Bind
                           Bank Active Directory
```

### 2.2 認證流程

1. 使用者輸入 AD 帳號密碼
2. `lib/ldap-auth.ts` 以 service account 連線至 AD
3. 搜尋使用者 DN（以 sAMAccountName 或 email）
4. 以使用者 DN + 密碼執行 LDAP bind 驗證
5. 驗證成功 → JIT Provisioning（首次登入自動建立本地 User record）
6. 回傳 NextAuth session

### 2.3 設定項

```env
# .env — LDAP 設定
AUTH_MODE=hybrid                    # local | ldap | hybrid（預設 hybrid）
LDAP_URL=ldaps://ad.bank.local:636
LDAP_BIND_DN=CN=titan-svc,OU=ServiceAccounts,DC=bank,DC=local
LDAP_BIND_PASSWORD=<Service account password>
LDAP_SEARCH_BASE=OU=Users,DC=bank,DC=local
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_TLS_REJECT_UNAUTHORIZED=true   # 生產環境必須為 true
```

### 2.4 欄位映射

| AD 屬性 | TITAN 欄位 | 說明 |
|---------|-----------|------|
| `displayName` | `User.name` | 顯示名稱 |
| `mail` | `User.email` | Email |
| `memberOf` | `User.role` | 群組映射（見 2.5） |
| `sAMAccountName` | Session 識別 | 登入帳號 |

### 2.5 角色映射

```typescript
// lib/ldap-role-mapper.ts
const ROLE_MAP: Record<string, Role> = {
  'CN=TITAN-Managers,OU=Groups,DC=bank,DC=local': 'MANAGER',
  'CN=TITAN-Engineers,OU=Groups,DC=bank,DC=local': 'ENGINEER',
};

function mapAdGroupsToRole(memberOf: string[]): Role {
  for (const group of memberOf) {
    if (ROLE_MAP[group]) return ROLE_MAP[group];
  }
  return 'ENGINEER'; // 預設角色
}
```

### 2.6 JIT Provisioning

首次 LDAP 登入成功時，自動建立本地 User record：

```typescript
// lib/ldap-sync.ts
async function jitProvision(ldapUser: LdapUserAttributes): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { email: ldapUser.mail },
  });

  if (existing) {
    // 更新名稱與角色（若 AD 有變更）
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: ldapUser.displayName,
        role: mapAdGroupsToRole(ldapUser.memberOf),
      },
    });
  }

  // 建立新使用者（密碼欄位為空，標記為 LDAP 使用者）
  return prisma.user.create({
    data: {
      name: ldapUser.displayName,
      email: ldapUser.mail,
      password: '', // LDAP 使用者不存本地密碼
      role: mapAdGroupsToRole(ldapUser.memberOf),
      mustChangePassword: false,
    },
  });
}
```

---

## 3. 方案 B：Keycloak Identity Broker

詳見 `docs/auth/keycloak-phase2-upgrade.md`。

此方案適用於需要統一 SSO（TITAN + Outline + Plane 共用同一登入入口）的場景。

---

## 4. 安全考量

| 項目 | 處理方式 |
|------|---------|
| LDAP 密碼傳輸 | 必須使用 LDAPS（TLS）|
| Service account 密碼 | 存放於 .env，不進 Git |
| 連線失敗 fallback | `AUTH_MODE=hybrid` 允許本地帳號登入 |
| LDAP 注入 | 使用 ldapjs 的 `EscapedValue` 處理使用者輸入 |
| 密碼不儲存 | LDAP 使用者的密碼欄位為空，永遠透過 AD 驗證 |
| 審計日誌 | 所有 LDAP 登入/失敗事件記錄至 AuditLog |

---

## 5. 測試計畫

```bash
# 使用 ldapjs 內建的 mock server 進行單元測試
# __tests__/integration/ldap-auth.test.ts

import ldap from 'ldapjs';

// 建立 mock LDAP server
const server = ldap.createServer();
server.bind('cn=root', (req, res, next) => { ... });
server.search('ou=users', (req, res, next) => { ... });
```

---

## 6. 前置條件

- [ ] 行方 IT 部門提供 AD 連線資訊（URL、Service Account DN、Search Base）
- [ ] 確認 TITAN 主機可連線至 AD server（網路/防火牆）
- [ ] 確認 SSL 憑證（LDAPS 所需的 CA 憑證）
- [ ] Phase 1 測試覆蓋率達標

## 7. 預估工時

20 小時（含測試與文件更新）

---

*Fixes #220*
