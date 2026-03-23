# 🚀 部署說明

## 前置需求

- Linux 伺服器（Ubuntu 22.04 推奨）
- Docker 24+
- 4核心 CPU / 8GB RAM / 500GB SSD
- 內網 IP

## 部署步驟

### 1. 建立目錄

```bash
mkdir -p /opt/it-portal
cd /opt/it-portal
```

### 2. 下載配置

```bash
git clone <此專案> .
```

或手動建立以下檔案：
- `docker-compose.yml`（主要配置）
- `README.md`（提案文件）

### 3. 啟動服務

```bash
# 啟動所有服務
docker compose up -d

# 檢查狀態
docker compose ps

# 查看日誌
docker compose logs -f
```

### 4. 訪問入口

| 服務 | URL | 預設帳號 |
|------|-----|---------|
| Homepage | http://内网IP:3000 | - |
| Plane | http://内网IP:8000 | 首次登入建立 |
| Outline | http://内网IP:3001 | 首次登入建立 |
| Gitea | http://内网IP:3002 | 首次登入建立 |
| Mattermost | http://内网IP:3003 | 首次登入建立 |

### 5. 建議更新密碼

- 修改 `docker-compose.yml` 中的預設密碼
- 重新部署：`docker compose down && docker compose up -d`

## 備份與維護

### 備份

```bash
# 備份所有資料
docker compose stop
tar -czvf it-portal-backup-$(date +%Y%m%d).tar.gz ./
docker compose start
```

### 更新

```bash
# 更新 Image
docker compose pull
docker compose up -d
```

### 監控

```bash
# 檢查容器健康
docker compose ps

# 查看資源使用
docker stats
```

## 網路設定建議

- 只開放 80/443 給內網用戶
- SSH 只允許特定 IP
- 建議搭配 Nginx reverse proxy 使用 HTTPS