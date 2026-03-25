# LDAP/AD 整合策略決定文件

> Issue #367 — LDAP/AD 整合無明確上線替代方案

**版本**: v1.0
**決定日期**: 2026-03-25
**狀態**: 已決定
**決策者**: TITAN 開發團隊

---

## 1. 決定摘要

**v1.0 使用 bcrypt 本地認證，LDAP/AD 整合延至 v2.0。**

---

## 2. 背景

TITAN 為銀行內部專案管理系統，部署於封閉內網環境。初期使用者約 5 人，
均為同一部門成員。R4 審查指出系統缺乏 LDAP/AD 整合的明確替代方案。

---

## 3. 方案評估

| 方案 | 優點 | 缺點 | 適用階段 |
|------|------|------|----------|
| **bcrypt 本地認證** | 零外部依賴、部署簡單、開發成本低 | 密碼管理由系統自行負責 | v1.0 |
| **LDAP/AD 直連** | 統一身份管理、密碼政策集中 | 需 AD 管理員配合、開發週期 2-3 週 | v2.0+ |
| **Keycloak SSO** | 支援 LDAP/SAML/OIDC 多協議、可作為統一認證閘道 | 需額外部署 Keycloak、維運成本增加 | v2.0+ |

---

## 4. 決定理由

1. **團隊規模小**：5 人團隊，本地帳號管理成本極低
2. **封閉內網**：無外部攻擊面，bcrypt + 密碼到期政策（90 天）已達合理安全水準
3. **現有安全機制完備**：
   - bcrypt 雜湊（已實作）
   - 密碼到期追蹤（Issue #182，已實作）
   - 密碼歷史防重用（Issue #201，已實作）
   - 帳號鎖定機制（已實作）
   - CSRF 保護 + CSP 安全標頭（已實作）
4. **Keycloak 設計文件已備妥**：Phase 2 可直接接軌，不影響時程
5. **降低 v1.0 上線風險**：減少外部依賴，專注核心功能穩定

---

## 5. v2.0 LDAP 整合路線圖

```
Phase 2 計畫：
├── 部署 Keycloak 容器（docker-compose 整合）
├── 設定 LDAP Federation（連接行內 AD）
├── TITAN 整合 OIDC（NextAuth Keycloak Provider）
├── 遷移現有 bcrypt 帳號至 Keycloak
└── 保留 bcrypt 作為 fallback（Keycloak 不可用時）
```

**預估工時**：2-3 週（含測試）
**前置條件**：AD 管理員提供 LDAP bind 帳號與 Base DN

---

## 6. 風險與緩解

| 風險 | 緩解措施 |
|------|----------|
| v1.0 密碼外洩 | bcrypt cost=12 + 密碼政策 + 帳號鎖定 |
| v2.0 LDAP 遷移困難 | User model 已預留 externalId 欄位空間 |
| Keycloak 維運負擔 | Docker Compose 統一管理，監控整合於現有 Prometheus stack |
