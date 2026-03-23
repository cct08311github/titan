# Outline 知識庫部署指南

> 適用於銀行 IT 部門封閉網路（Air-Gapped）環境

---

## 前置條件

Outline 依賴以下服務，均已定義於專案的 `docker-compose.yml` 中：

| 服務 | 用途 | 預設連接埠 |
|------|------|-----------|
| PostgreSQL | 主要關聯式資料庫 | 5432 |
| Redis | Session 快取、佇列 | 6379 |
| MinIO | S3 相容物件儲存（文件附件） | 9000 / 9001 |

啟動前請確認：

- Docker Engine 版本 ≥ 24.0
- Docker Compose Plugin 版本 ≥ 2.20
- 各服務的資料目錄與 Volume 掛載路徑已建立且具備寫入權限
- `.env` 中已填妥所有必填環境變數（參考 `config/outline.env.example`）

---

## 首次設定步驟

### 1. 啟動相依服務

```bash
docker compose up -d postgres redis minio
```

等待所有服務健康檢查通過（約 30 秒）：

```bash
docker compose ps
```

### 2. 建立 MinIO Bucket（詳見下節）

執行初始化腳本：

```bash
bash scripts/outline-init.sh
```

### 3. 啟動 Outline

```bash
docker compose up -d outline
```

### 4. 執行資料庫 Migration

```bash
docker compose exec outline yarn db:migrate
```

### 5. 建立管理員帳號

Outline 首次啟動時，透過瀏覽器訪問 `http://<主機IP>:3000`，系統會引導建立第一個管理員帳號。

若使用 OIDC/SSO（見下節），管理員帳號將由 AD 授權自動建立；請確認 AD 群組中已有指定的管理員使用者。

### 6. 確認儲存設定

登入後進入 **設定 → 附件儲存**，確認顯示 MinIO（S3）連線正常，可上傳測試檔案。

---

## S3 / MinIO Bucket 建立步驟

### 前置：安裝 MinIO Client（mc）

```bash
# 若已在 docker-compose 中使用 mc 容器，可直接使用別名
docker compose exec minio mc --help
```

或於主機安裝：

```bash
curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
chmod +x /usr/local/bin/mc
```

### 建立 Bucket

```bash
# 設定 mc alias（對應 docker-compose 中的 MinIO 設定）
mc alias set local http://localhost:9000 <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD>

# 建立 Outline 專用 Bucket
mc mb local/outline-attachments

# 設定 Bucket 存取策略（僅允許內部存取）
mc anonymous set none local/outline-attachments
```

### 驗證

```bash
mc ls local/
# 應顯示 outline-attachments bucket
```

---

## OIDC / SSO 設定說明（銀行 AD 整合）

### 概述

銀行 IT 部門使用 Active Directory（AD）進行身份驗證。Outline 支援 OIDC（OpenID Connect）協議，可透過 AD FS（Active Directory Federation Services）或 Keycloak 橋接 AD。

### 環境變數設定

在 `config/outline.env` 中設定以下變數：

```env
# OIDC 設定
OIDC_CLIENT_ID=outline-client
OIDC_CLIENT_SECRET=<從 AD FS / Keycloak 取得>
OIDC_AUTH_URI=https://auth.bank.internal/realms/bank/protocol/openid-connect/auth
OIDC_TOKEN_URI=https://auth.bank.internal/realms/bank/protocol/openid-connect/token
OIDC_USERINFO_URI=https://auth.bank.internal/realms/bank/protocol/openid-connect/userinfo
OIDC_LOGOUT_URI=https://auth.bank.internal/realms/bank/protocol/openid-connect/logout
OIDC_DISPLAY_NAME=銀行 AD 帳號登入
OIDC_USERNAME_CLAIM=preferred_username
OIDC_SCOPES=openid email profile
```

### AD FS / Keycloak 端設定重點

1. **Redirect URI**：`http://<Outline主機>/auth/oidc.callback`
2. **Client Authentication**：使用 `client_secret_post` 或 `client_secret_basic`
3. **Claim 映射**：
   - `email` → 使用者電子郵件（必填）
   - `preferred_username` → Outline 使用者名稱
   - `name` → 顯示名稱
4. **群組 Claim**（可選）：若需依 AD 群組自動分配 Outline 團隊，請在 Keycloak 設定群組 Claim 映射

### 注意事項

- 封閉網路環境中，Outline 容器必須能連線至 AD FS / Keycloak 的內網位址
- TLS 憑證若為內部 CA 簽發，需掛載至容器並設定 `NODE_EXTRA_CA_CERTS` 環境變數
- SSO 設定完成後，建議停用 Email/密碼登入（`ENABLE_UPDATES=false`）

---

## 常見問題排查

| 症狀 | 可能原因 | 解法 |
|------|---------|------|
| 無法上傳附件 | MinIO Bucket 不存在或權限不足 | 重新執行 `outline-init.sh` |
| SSO 登入失敗 | OIDC Redirect URI 不符 | 確認 AD FS / Keycloak 端 Redirect URI 設定 |
| 資料庫連線錯誤 | PostgreSQL 尚未就緒 | 確認 `docker compose ps` 中 postgres 狀態為 healthy |
| 頁面空白 | Redis 連線失敗 | 確認 Redis 正常運行並檢查 `REDIS_URL` 環境變數 |
