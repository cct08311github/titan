# Docker 映像版本清單 (Version Manifest)

> **任務**: T03 — 應用程式版本清單
> **Issue**: #4
> **版本**: v1.0
> **日期**: 2026 年 3 月 23 日
> **適用環境**: 封閉內網（Air-Gapped）部署

---

## 重要說明

- 本清單記錄 TITAN 平台所有 Docker 映像的固定版本、SHA256 摘要與下載來源
- **禁止** 使用 `latest` tag，所有映像必須以明確版本號固定
- 更新版本時，須同步更新本文件、`docker-compose.yml` 及 `.env.example`
- SHA256 摘要為驗證映像完整性的唯一依據，傳輸後必須驗證

---

## 1. 映像版本清單

### 1.1 應用服務層

| 映像名稱 | 版本 Tag | SHA256 摘要 | 壓縮大小 | 用途 |
|---------|---------|------------|---------|------|
| `outlinewiki/outline` | `1.6.1` | `sha256:（需從 Docker Hub 取得）` | ~350 MB | 知識管理 Wiki |
| `gethomepage/homepage` | `v0.9.13` | `sha256:（需從 Docker Hub 取得）` | ~120 MB | 統一入口儀表板 |
| `louislam/uptime-kuma` | `1.23.13` | `sha256:（需從 Docker Hub 取得）` | ~180 MB | 服務監控告警 |

### 1.2 基礎設施層

| 映像名稱 | 版本 Tag | SHA256 摘要 | 壓縮大小 | 用途 |
|---------|---------|------------|---------|------|
| `postgres` | `16-alpine` | `sha256:（需從 Docker Hub 取得）` | ~80 MB | 關聯式資料庫 |
| `redis` | `7-alpine` | `sha256:（需從 Docker Hub 取得）` | ~15 MB | 快取與任務佇列 |
| `minio/minio` | `RELEASE.2024-01-01T00-00-00Z` | `sha256:（需從 Docker Hub 取得）` | ~100 MB | S3 相容物件儲存 |
| `nginx` | `1.25-alpine` | `sha256:（需從 Docker Hub 取得）` | ~20 MB | 反向代理 / TLS 終止 |

### 1.3 應用程式依賴版本

| 套件 | 版本 | 用途 |
|------|------|------|
| `next` | `15.5.14` | App Router 全端框架 |
| `react` / `react-dom` | `19.0.0` | UI 函式庫 |
| `next-auth` | `5.0.0-beta.30` | Auth.js v5 認證 |
| `@prisma/client` | `5.22.0` | ORM |
| `zod` | `4.3.6` | Schema 驗證 |
| `ioredis` | `5.10.1` | Redis client |
| `pino` | `10.3.1` | Structured logging |
| `tailwindcss` | `3.4.19` | CSS 框架 |
| `typescript` | `5.x` | 型別系統 |
| `jest` | `30.3.0` | 單元/整合測試 |
| `@playwright/test` | `1.58.2` | E2E 測試 |

### 1.4 Phase C 預備（待納入）

| 映像名稱 | 計畫版本 | 用途 |
|---------|---------|------|
| `gitea/gitea` | `1.21.x` | 程式碼版控 |
| `grafana/grafana` | `10.x` | 指標視覺化 |
| `n8nio/n8n` | `1.x` | 工作流自動化 |
| `prom/prometheus` | `2.x` | 指標收集 |

---

## 2. 下載來源

### 2.1 官方下載 URL

```bash
# Outline
docker pull outlinewiki/outline:1.6.1
# Docker Hub: https://hub.docker.com/r/outlinewiki/outline/tags

# Homepage
docker pull gethomepage/homepage:v0.9.13
# Docker Hub: https://hub.docker.com/r/gethomepage/homepage/tags

# Uptime Kuma
docker pull louislam/uptime-kuma:1.23.13
# Docker Hub: https://hub.docker.com/r/louislam/uptime-kuma/tags

# PostgreSQL
docker pull postgres:16-alpine
# Docker Hub: https://hub.docker.com/_/postgres/tags

# Redis
docker pull redis:7-alpine
# Docker Hub: https://hub.docker.com/_/redis/tags

# MinIO
docker pull minio/minio:RELEASE.2024-01-01T00-00-00Z
# 官網: https://min.io/download / Docker Hub: https://hub.docker.com/r/minio/minio/tags

# Nginx
docker pull nginx:1.25-alpine
# Docker Hub: https://hub.docker.com/_/nginx/tags
```

---

## 3. SHA256 摘要取得方法

在有網路的環境執行以下指令取得摘要，並填入上方清單：

```bash
# 拉取映像後取得摘要
docker pull outlinewiki/outline:1.6.1
docker inspect --format='{{index .RepoDigests 0}}' outlinewiki/outline:1.6.1

# 或使用 skopeo（推薦，不需拉取完整映像）
skopeo inspect docker://outlinewiki/outline:1.6.1 | jq '.Digest'

# 批次取得所有映像摘要
for image in \
  "outlinewiki/outline:1.6.1" \
  "gethomepage/homepage:v0.9.13" \
  "louislam/uptime-kuma:1.23.13" \
  "postgres:16-alpine" \
  "redis:7-alpine" \
  "minio/minio:RELEASE.2024-01-01T00-00-00Z" \
  "nginx:1.25-alpine"; do
  echo "=== $image ==="
  docker inspect --format='{{index .RepoDigests 0}}' $image 2>/dev/null || echo "需先 docker pull"
done
```

---

## 4. 封閉網路傳輸程序 (Air-Gapped Transfer Procedure)

### 4.1 前置作業（外部網路環境）

```bash
#!/bin/bash
# 步驟 1：在可連網的機器上拉取並儲存所有映像

IMAGES=(
  "outlinewiki/outline:1.6.1"
  "gethomepage/homepage:v0.9.13"
  "louislam/uptime-kuma:1.23.13"
  "postgres:16-alpine"
  "redis:7-alpine"
  "minio/minio:RELEASE.2024-01-01T00-00-00Z"
  "nginx:1.25-alpine"
)

# 拉取所有映像
for image in "${IMAGES[@]}"; do
  echo "[拉取] $image"
  docker pull "$image"
done

# 打包為 tar 檔
echo "[打包] 所有映像..."
docker save "${IMAGES[@]}" | gzip > titan-images-v1.0.tar.gz

# 計算校驗碼
sha256sum titan-images-v1.0.tar.gz > titan-images-v1.0.tar.gz.sha256
echo "[完成] 請將以下兩個檔案傳至內網："
echo "  - titan-images-v1.0.tar.gz"
echo "  - titan-images-v1.0.tar.gz.sha256"
```

### 4.2 傳輸方式

| 方式 | 適用情境 | 說明 |
|------|---------|------|
| 加密 USB 隨身碟 | 一次性傳輸 | 需符合行內資安政策，使用核准的加密隨身碟 |
| 光碟（DVD/BD） | 正式環境 | 寫入一次，不可竄改，適合稽核要求 |
| 內網檔案傳輸系統 | 有受管理的跨網段傳輸閘道 | 透過核准的傳輸閘道傳送，留有完整記錄 |

> **注意**：傳輸前須先取得資安人員的書面核准，並記錄傳輸時間、人員及校驗碼。

### 4.3 內網匯入程序

```bash
#!/bin/bash
# 步驟 2：在內網 TITAN VM 上執行

ARCHIVE="titan-images-v1.0.tar.gz"
CHECKSUM_FILE="titan-images-v1.0.tar.gz.sha256"

# 驗證校驗碼（必做）
echo "[驗證] 校驗碼..."
sha256sum -c "$CHECKSUM_FILE"
if [ $? -ne 0 ]; then
  echo "[錯誤] 校驗碼不符！請重新傳輸，勿繼續執行。"
  exit 1
fi
echo "[通過] 校驗碼驗證成功"

# 匯入映像
echo "[匯入] 載入 Docker 映像..."
gunzip -c "$ARCHIVE" | docker load

# 驗證映像已載入
echo "[確認] 已載入的映像："
docker images | grep -E "outline|homepage|uptime-kuma|postgres|redis|minio|nginx"
```

### 4.4 內網 Registry（可選方案）

若部署規模較大或需要多台 VM 共用映像，可在內網建立私有 Registry：

```bash
# 啟動私有 Registry
docker run -d -p 5000:5000 --restart=always \
  -v /data/registry:/var/lib/registry \
  --name titan-registry registry:2

# 推送映像至本地 Registry
docker tag outlinewiki/outline:1.6.1 localhost:5000/outline:1.6.1
docker push localhost:5000/outline:1.6.1

# 在 docker-compose.yml 中改用本地 Registry
# image: localhost:5000/outline:1.6.1
```

---

## 5. 版本更新管理

### 5.1 更新流程

```
1. 在外部網路評估新版本
   ├── 確認 Release Notes 無重大破壞性變更
   ├── 確認未有嚴重安全漏洞（CVE）
   └── 測試環境驗證通過

2. 更新本文件（version-manifest.md）
   ├── 更新版本 Tag
   └── 更新 SHA256 摘要

3. 同步更新 docker-compose.yml 及 .env.example

4. 建立 GitHub Issue 並提交 PR

5. 重新執行傳輸程序（Section 4）至內網
```

### 5.2 安全掃描（可選）

```bash
# 使用 Trivy 掃描已知 CVE（在有網路的環境執行）
trivy image outlinewiki/outline:1.6.1
trivy image postgres:16-alpine

# 儲存掃描報告
trivy image --format json --output outline-1.6.1-scan.json outlinewiki/outline:1.6.1
```

---

## 6. 變更記錄

| 版本 | 日期 | 變更內容 | 變更者 |
|------|------|---------|-------|
| v1.0 | 2026-03-23 | 初始版本建立，記錄 MVP 所有映像 | cct |
| v1.1 | 2026-03-25 | Outline 從 0.80.2 升級至 1.6.1 (Issue #255) | claude |
| v1.2 | 2026-03-25 | 新增應用程式依賴版本清單 (Issue #530) | claude |

---

*本文件依 TITAN 專案 GitHub Issue #4 建立。*
