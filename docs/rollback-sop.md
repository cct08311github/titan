# TITAN 版本回滾 SOP

**文件編號**: TITAN-OPS-001
**版本**: 1.0
**適用**: TITAN 平台所有容器服務

---

## 1. 回滾決策矩陣

| 嚴重度 | 症狀 | 動作 | 時限 |
|--------|------|------|------|
| P0 | 系統完全不可用 | 立即回滾 | 15 分鐘內 |
| P1 | 核心功能異常（登入、任務管理） | 評估後回滾 | 30 分鐘內 |
| P2 | 非核心功能異常（報表、知識庫） | 嘗試修復，修復失敗則回滾 | 2 小時內 |
| P3 | UI 問題、效能下降 | 記錄 Issue，下次部署修復 | 不回滾 |

## 2. 應用層回滾（TITAN Next.js App）

### 2.1 Docker Image 回滾

```bash
# 1. 查看可用的歷史 image
docker images titan-app --format "table {{.Tag}}\t{{.CreatedAt}}" | head -5

# 2. 修改 docker-compose 指定舊版 image tag
# 例：image: titan-app:v1.2.3

# 3. 重新部署
docker compose -f docker-compose.yml up -d titan-app

# 4. 驗證
curl -s http://localhost:3000/api/auth/csrf | jq .
docker logs titan-app --tail 20
```

### 2.2 Git 版本回滾

```bash
# 1. 查看最近部署的 commit
git log --oneline -10

# 2. 回滾到指定 commit
git checkout <commit-hash>

# 3. 重建 image 並部署
docker compose -f docker-compose.yml build titan-app
docker compose -f docker-compose.yml up -d titan-app

# 4. 驗證
./scripts/sit-titan-test.sh http://localhost:3000
```

## 3. 資料庫回滾

### 3.1 Prisma Schema 回滾

```bash
# ⚠️ 注意：schema 回滾可能造成資料遺失，必須先備份

# 1. 備份目前資料庫
docker exec titan-postgres pg_dump -U titan titan > /tmp/titan-backup-$(date +%Y%m%d_%H%M%S).sql

# 2. 回滾到上一版 schema
git checkout <previous-commit> -- prisma/schema.prisma

# 3. 推送 schema 變更
docker exec titan-app npx prisma db push --accept-data-loss

# 4. 驗證
docker exec titan-app npx prisma db pull
```

### 3.2 從備份還原

```bash
# 1. 停止應用
docker compose stop titan-app

# 2. 還原資料庫
docker exec -i titan-postgres psql -U titan titan < /path/to/backup.sql

# 3. 重啟應用
docker compose start titan-app

# 4. 驗證資料完整性
docker exec titan-app npx prisma db pull
```

## 4. 基礎設施回滾

### 4.1 docker-compose.yml 變更回滾

```bash
# 1. 回滾設定檔
git checkout <previous-commit> -- docker-compose.yml

# 2. 重新部署所有服務
docker compose down
docker compose up -d

# 3. 驗證所有服務
docker compose ps
./scripts/sit-smoke-test.sh
```

### 4.2 Nginx 設定回滾

```bash
# 1. 回滾 Nginx 設定
git checkout <previous-commit> -- config/nginx/nginx.conf

# 2. 重新載入（不中斷服務）
docker exec titan-nginx nginx -t && docker exec titan-nginx nginx -s reload

# 3. 驗證
curl -I https://titan.bank.local/health
```

## 5. 回滾後檢查清單

- [ ] 所有容器 running（`docker compose ps`）
- [ ] 健康檢查通過（`/health` 端點）
- [ ] 登入功能正常
- [ ] SIT smoke test 通過
- [ ] 稽核日誌記錄回滾事件
- [ ] 通知相關人員回滾完成
- [ ] 建立 Post-mortem Issue

## 6. 告警通知設定

### Uptime Kuma 告警通知

Uptime Kuma 支援以下通知管道（需在 Dashboard 設定）：

| 管道 | 適用場景 | 設定路徑 |
|------|----------|----------|
| Email (SMTP) | 正式告警 | Settings → Notifications → Email |
| Webhook | 自動化觸發 | Settings → Notifications → Webhook |
| LINE Notify | 行動通知 | Settings → Notifications → LINE |
| Telegram | 即時通知 | Settings → Notifications → Telegram |

### 建議告警規則

| 監控對象 | 檢查間隔 | 告警條件 | 通知管道 |
|----------|----------|----------|----------|
| TITAN App (/api/auth/csrf) | 60s | 連續 3 次失敗 | Email + LINE |
| PostgreSQL (TCP 5432) | 30s | 連續 2 次失敗 | Email + LINE |
| Redis (TCP 6379) | 30s | 連續 2 次失敗 | Email |
| Nginx (/health) | 30s | 連續 2 次失敗 | Email + LINE |
| SSL 憑證到期 | 每日 | < 30 天 | Email |

---

*回滾操作必須記錄於稽核日誌，並在 24 小時內完成 Post-mortem 報告。*
