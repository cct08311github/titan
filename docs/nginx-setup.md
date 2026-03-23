# TITAN 平台 — Nginx 反向代理設定說明

> 任務：T08 — Nginx Reverse Proxy and TLS
> 對應 Issue：[#10](https://github.com/cct08311github/titan/issues/10)

---

## 目錄

1. [架構概覽](#架構概覽)
2. [URL 路由對應表](#url-路由對應表)
3. [SSL/TLS 設定](#ssltls-設定)
4. [安全標頭說明](#安全標頭說明)
5. [速率限制設定](#速率限制設定)
6. [如何替換為銀行內部 CA 憑證](#如何替換為銀行內部-ca-憑證)
7. [常見問題排查](#常見問題排查)

---

## 架構概覽

```
外部用戶端
    │
    ▼
Nginx (titan-nginx)
    ├── :80  → 301 重導向至 HTTPS
    └── :443 → 反向代理路由
              │
              ├── /          → Homepage     (titan-homepage:3000)
              ├── /outline/  → Outline      (titan-outline:3000)
              ├── /plane/    → Plane        (plane-proxy:80)
              ├── /minio/    → MinIO 控制台  (titan-minio:9001)
              └── /uptime/   → Uptime Kuma  (titan-uptime-kuma:3001)
```

所有應用服務僅透過 `titan-internal` Docker 網路互通，不直接對外開放端口。Nginx 作為唯一對外入口，所有 HTTPS 流量集中在此終止並轉發。

---

## URL 路由對應表

| 對外 URL 路徑 | 後端容器 | 內部端口 | 用途說明 |
|---|---|---|---|
| `https://titan.bank.local/` | `titan-homepage` | 3000 | 統一儀表板，集中呈現所有服務入口 |
| `https://titan.bank.local/outline/` | `titan-outline` | 3000 | Outline 知識庫，團隊文件協作平台 |
| `https://titan.bank.local/plane/` | `plane-proxy` | 80 | Plane 專案管理（占位，待部署啟用） |
| `https://titan.bank.local/minio/` | `titan-minio` | 9001 | MinIO 管理控制台，物件儲存管理介面 |
| `https://titan.bank.local/uptime/` | `titan-uptime-kuma` | 3001 | Uptime Kuma，服務可用性監控儀表板 |
| `https://titan.bank.local/minio-api/` | `titan-minio` | 9000 | MinIO S3 API（服務間內部使用） |
| `https://titan.bank.local/nginx-status` | 本機 | — | Nginx 狀態資訊（僅限內網 IP 存取） |
| `https://titan.bank.local/health` | 本機 | — | 健康檢查端點（監控系統使用） |

### 備注

- **Outline 路由**：Outline 內部服務從根路徑運行（`/`），Nginx 透過 `proxy_pass http://outline_backend/` 去除 `/outline` 前綴後轉發。需確保 Outline 的 `URL` 環境變數設定為 `https://titan.bank.local/outline`。
- **Plane 占位路由**：Plane 採用獨立 docker-compose 部署，請參閱 `docs/plane-setup.md`。部署完成後需將 `plane-proxy` 容器加入 `titan-external` 網路。
- **MinIO S3 API**：`/minio-api/` 為後端服務互通使用，前端使用者無需直接訪問。

---

## SSL/TLS 設定

### MVP 自簽憑證（初始佈署）

執行以下指令產生自簽憑證：

```bash
bash scripts/generate-ssl-cert.sh
```

憑證輸出路徑：

```
config/nginx/certs/
├── server.crt   ← 憑證（PEM 格式）
└── server.key   ← 私鑰（PEM 格式，限制 600 權限）
```

**憑證規格：**

| 項目 | 規格 |
|---|---|
| 金鑰算法 | RSA 2048 bit |
| 簽章算法 | SHA-256 |
| 有效期限 | 10 年（MVP 測試用） |
| 主網域 | `titan.bank.local` |
| SAN | `titan.bank.local`、`titan.local`、`localhost`、`127.0.0.1` |

### 測試環境信任自簽憑證

**macOS：**

```bash
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    config/nginx/certs/server.crt
```

**Ubuntu / Debian：**

```bash
sudo cp config/nginx/certs/server.crt /usr/local/share/ca-certificates/titan.crt
sudo update-ca-certificates
```

**Windows（PowerShell，以管理員身份執行）：**

```powershell
Import-Certificate -FilePath ".\config\nginx\certs\server.crt" `
    -CertStoreLocation Cert:\LocalMachine\Root
```

---

## 如何替換為銀行內部 CA 憑證

正式上線前，需以銀行資安部門核發的憑證取代自簽憑證。

### 步驟一：取得銀行內部 CA 憑證

向銀行資安部門申請，說明用途為：

- **服務名稱**：TITAN 平台
- **網域名稱**：`titan.bank.local`（主網域），加上所需 SAN
- **憑證格式**：PEM（.crt）
- **金鑰長度**：最低 2048 bit RSA 或 256 bit ECDSA

### 步驟二：產生 CSR（Certificate Signing Request）

```bash
# 產生私鑰
openssl genrsa -out config/nginx/certs/server.key 2048

# 產生 CSR（送交 CA 簽發）
openssl req -new \
    -key  config/nginx/certs/server.key \
    -out  config/nginx/certs/server.csr \
    -subj "/C=TW/ST=Taipei/L=Taipei/O=TITAN Bank Internal/CN=titan.bank.local"

# 顯示 CSR 內容（送交資安部門）
openssl req -text -noout -in config/nginx/certs/server.csr
```

### 步驟三：部署 CA 核發的憑證

收到 CA 核發的憑證後（格式：`.crt` PEM）：

```bash
# 備份自簽憑證
cp config/nginx/certs/server.crt config/nginx/certs/server.crt.selfsigned.bak

# 放置新憑證
cp /path/to/issued.crt config/nginx/certs/server.crt

# 若有中介 CA 憑證，合併成憑證鏈
cat /path/to/issued.crt /path/to/intermediate.crt > config/nginx/certs/server.crt

# 設定正確權限
chmod 644 config/nginx/certs/server.crt
chmod 600 config/nginx/certs/server.key

# 重新啟動 Nginx
docker compose restart nginx
```

### 步驟四：驗證憑證置換結果

```bash
# 確認憑證簽發者
openssl x509 -noout -issuer -subject -dates -in config/nginx/certs/server.crt

# 測試 HTTPS 連線
curl -v --cacert /path/to/bank-ca.crt https://titan.bank.local/health
```

---

## 安全標頭說明

以下為 Nginx 設定的 HTTP 安全回應標頭及其目的說明：

### Strict-Transport-Security (HSTS)

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**作用**：告知瀏覽器在未來 365 天內，對此網域（含子網域）的所有請求均使用 HTTPS，即使用戶手動輸入 `http://`。

**風險**：啟用後若 HTTPS 無法訪問，使用者將完全無法進入網站。確認 HTTPS 穩定後再啟用。

---

### X-Frame-Options

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
```

**作用**：防範點擊劫持（Clickjacking）攻擊。`SAMEORIGIN` 允許同源 iframe，禁止外部網站嵌入。

---

### X-Content-Type-Options

```nginx
add_header X-Content-Type-Options "nosniff" always;
```

**作用**：禁止瀏覽器猜測（MIME sniffing）回應的內容類型，防止將腳本偽裝成其他格式上傳後執行。

---

### X-XSS-Protection

```nginx
add_header X-XSS-Protection "1; mode=block" always;
```

**作用**：啟用瀏覽器內建 XSS 過濾器（主要針對 IE/舊版 Chrome）。現代瀏覽器已透過 CSP 處理，此標頭作為舊版相容保護。

---

### Referrer-Policy

```nginx
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

**作用**：跨域請求時只傳送 Origin（不含路徑及查詢字串），防止內部 URL 結構洩漏給外部服務。

---

### Permissions-Policy

```nginx
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

**作用**：禁止網頁使用相機、麥克風、地理位置等敏感 API，減少意外授權風險。

---

### Content-Security-Policy (CSP)

```nginx
add_header Content-Security-Policy "default-src 'self'; ..." always;
```

**作用**：定義資源載入白名單，防止 XSS 攻擊載入外部惡意腳本。

**注意**：TITAN 各服務可能需要不同的 CSP 設定。若某服務出現資源載入錯誤，需於對應 `location` 區塊覆寫 CSP。

---

## 速率限制設定

| 限制區域 | 適用端點 | 速率限制 | 允許突發 | 說明 |
|---|---|---|---|---|
| `general` | 一般頁面 | 20 req/s/IP | 50 | 適用大多數頁面請求 |
| `api` | MinIO API / Console | 10 req/s/IP | 20 | API 端點較嚴格 |
| `static` | 靜態資源 | 50 req/s/IP | 100 | CSS/JS/圖片（目前未單獨套用） |

超過速率限制時，Nginx 回傳 `429 Too Many Requests`。

---

## 常見問題排查

### 問題：瀏覽器顯示憑證不受信任

**原因**：使用自簽憑證，瀏覽器無法驗證信任鏈。

**解決**：
1. 將 `config/nginx/certs/server.crt` 加入作業系統受信任根憑證（參閱上方說明）
2. 或換用銀行內部 CA 核發的憑證

---

### 問題：/outline/ 路由 404 或樣式錯誤

**原因**：Outline 的 `URL` 環境變數未設定為含路徑前綴的完整 URL。

**解決**：在 `.env` 中設定：

```bash
OUTLINE_URL=https://titan.bank.local/outline
```

---

### 問題：/plane/ 返回 502 Bad Gateway

**原因**：Plane 尚未啟動，或 `plane-proxy` 容器未加入 `titan-external` 網路。

**解決**：

```bash
# 確認 Plane 已啟動
docker compose -f /opt/titan/plane-docker-compose.yml ps

# 將 plane-proxy 加入 titan-external 網路
docker network connect titan-external plane-proxy
```

---

### 問題：MinIO Console /minio/ 登入後頁面空白

**原因**：MinIO Console 的 WebSocket 連線路徑需匹配前綴。

**解決**：確認 MinIO 環境變數：

```bash
MINIO_BROWSER_REDIRECT_URL=https://titan.bank.local/minio
```

---

### 問題：Nginx 無法啟動，憑證路徑錯誤

**解決**：

```bash
# 確認憑證存在
ls -la config/nginx/certs/

# 若不存在，重新產生
bash scripts/generate-ssl-cert.sh

# 重新啟動
docker compose up -d nginx
```

---

*最後更新：2026-03-23 | 任務 T08 | 負責人：IT Operations Team*
