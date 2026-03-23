# TITAN 監控與告警計劃

> 任務：T18 — Logging and Monitoring Setup
> 版本：1.0.0
> 最後更新：2026-03-23

---

## 一、監控目標概覽

TITAN 平台由多個容器化服務組成，監控策略需涵蓋：

| 層級 | 監控對象 | 工具 |
|------|----------|------|
| 系統資源 | CPU、RAM、磁碟、網路 | `scripts/health-check.sh` + Uptime Kuma |
| 服務健康 | HTTP 端點、容器狀態 | `scripts/health-check.sh` + Uptime Kuma |
| 資料庫 | PostgreSQL 連線、查詢延遲 | `scripts/health-check.sh` |
| 快取 | Redis 記憶體、命中率 | `scripts/health-check.sh` |
| 日誌聚合 | Docker logs → 集中化 | Docker logging driver |

---

## 二、監控項目清單

### 2.1 系統資源

| 指標 | 警告閾值 | 嚴重閾值 | 說明 |
|------|----------|----------|------|
| CPU 使用率 | ≥ 75% | ≥ 90% | 持續 5 分鐘以上才觸發 |
| 記憶體使用率 | ≥ 80% | ≥ 95% | 含 buffer/cache |
| 磁碟使用率 | ≥ 75% | ≥ 90% | 根目錄 `/` |
| 磁碟 inode 使用率 | ≥ 80% | ≥ 95% | 避免 inode 耗盡 |
| 網路丟包率 | ≥ 1% | ≥ 5% | 5 分鐘平均 |
| 系統負載 (Load Average) | > CPU 核心數 × 1.5 | > CPU 核心數 × 3 | 1 分鐘均值 |

### 2.2 HTTP 服務端點

| 服務 | 健康端點 | 預期回應碼 | 超時門檻 |
|------|----------|------------|----------|
| Homepage | `http://localhost:3000/` | 200 | 5s |
| Outline | `http://localhost:3001/_health` | 200 | 5s |
| MinIO API | `http://localhost:9000/minio/health/live` | 200 | 5s |
| MinIO Console | `http://localhost:9001/` | 200 | 5s |
| Plane (Proxy) | `http://localhost:8082/` | 200 | 5s |
| Uptime Kuma | `http://localhost:3002/` | 200 | 5s |

### 2.3 容器狀態

監控以下容器是否處於 `healthy` 或 `running` 狀態：

- `titan-postgres`
- `titan-redis`
- `titan-minio`
- `titan-outline`
- `titan-homepage`
- `titan-uptime-kuma`
- Plane 相關容器（`plane-proxy`、`plane-web`、`plane-api`、`plane-worker`、`plane-beat`）

### 2.4 PostgreSQL 資料庫

| 指標 | 警告閾值 | 嚴重閾值 |
|------|----------|----------|
| 連線數使用率 | ≥ 70% | ≥ 90% |
| 資料庫回應時間 | ≥ 500ms | ≥ 2000ms |
| 長時間運行查詢 | ≥ 30s | ≥ 120s |
| 複製延遲（若有）| ≥ 100MB | ≥ 500MB |

### 2.5 Redis 快取

| 指標 | 警告閾值 | 嚴重閾值 |
|------|----------|----------|
| 記憶體使用率 | ≥ 75% | ≥ 90% |
| 連線數 | ≥ 80% of maxclients | ≥ 95% |
| 命中率 | < 80% | < 60% |
| 被驅逐鍵數量 | > 0（需調查）| > 100/min |

---

## 三、告警門檻與升級策略

### 3.1 嚴重等級定義

```
P0 — 緊急（Critical）
  服務完全中斷，生產資料有風險
  → 立即通知，15 分鐘內響應

P1 — 高（Warning）
  服務效能嚴重下降，但仍可部分運作
  → 30 分鐘內響應

P2 — 中（Degraded）
  非核心元件異常，核心服務正常
  → 2 小時內響應

P3 — 低（Info）
  資訊性告警，無立即影響
  → 下一個工作日處理
```

### 3.2 告警升級流程

```
偵測異常
    │
    ▼
寫入 alert.log（scripts/monitor-cron.sh）
    │
    ▼
寫入告警檔案 /var/log/titan/alerts/YYYYMMDD-HHMMSS-<level>.alert
    │
    ├── P0/P1 → 立即通知值班人員（email / Slack webhook / 電話）
    │
    ├── P2 → 寫入每日告警摘要，次日晨報發送
    │
    └── P3 → 寫入日誌，週報統計
```

### 3.3 告警靜默規則

- 計劃性維護期間：在 `config/monitoring/maintenance-windows.yaml` 中定義
- 相同告警在 15 分鐘內不重複通知（防止告警風暴）
- 服務重啟後 5 分鐘內的告警自動抑制（啟動緩衝期）

---

## 四、儀表板設計

### 4.1 Uptime Kuma 儀表板佈局

**頁面 1：服務狀態總覽（Status Page）**
```
┌─────────────────────────────────────────────────────────┐
│  TITAN Platform — 服務狀態                               │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Homepage    │  Outline     │  MinIO       │  Plane     │
│  ● 正常      │  ● 正常      │  ● 正常      │  ● 正常    │
│  回應: 45ms  │  回應: 120ms │  回應: 38ms  │  回應: 89ms│
├──────────────┴──────────────┴──────────────┴────────────┤
│  基礎設施                                                │
├──────────────┬──────────────┬─────────────────────────  │
│  PostgreSQL  │  Redis       │  Uptime Kuma              │
│  ● 正常      │  ● 正常      │  ● 正常                   │
│  連線: 3/100 │  記憶體: 45% │  監控中                   │
└──────────────┴──────────────┴───────────────────────────┘
```

**頁面 2：系統資源監控**
```
┌──────────────────────────────────────────────────────────┐
│  系統資源 — 即時狀態                                      │
├─────────────────────────────────────────────────────────┤
│  CPU 使用率   [████████░░░░░░░░░░░░]  42%               │
│  記憶體使用   [████████████░░░░░░░░]  61%               │
│  磁碟使用     [██████░░░░░░░░░░░░░░]  31%               │
├─────────────────────────────────────────────────────────┤
│  24小時可用性趨勢                                         │
│  ████████████████████████████████████████  99.8%        │
└─────────────────────────────────────────────────────────┘
```

### 4.2 監控腳本輸出格式

`scripts/health-check.sh` 輸出範例：

```
╔══════════════════════════════════════════════════════════╗
║          TITAN 健康狀態報告 — 2026-03-23 14:30:00       ║
╠══════════════════════════════════════════════════════════╣
║  系統資源                                                ║
║    CPU 使用率     [  42%]  ✓ 正常                       ║
║    記憶體使用     [  61%]  ✓ 正常                       ║
║    磁碟使用       [  31%]  ✓ 正常                       ║
╠══════════════════════════════════════════════════════════╣
║  服務健康                                                ║
║    Homepage       ✓ 正常  (45ms)                        ║
║    Outline        ✓ 正常  (120ms)                       ║
║    MinIO          ✓ 正常  (38ms)                        ║
║    Plane          ✓ 正常  (89ms)                        ║
╠══════════════════════════════════════════════════════════╣
║  整體狀態：✓ 全部健康                                    ║
╚══════════════════════════════════════════════════════════╝
```

---

## 五、日誌聚合策略

### 5.1 日誌來源

| 來源 | 日誌類型 | 輸出位置 |
|------|----------|----------|
| Docker 容器 | 應用程式日誌 | Docker logging driver |
| `health-check.sh` | 健康狀態 | `/var/log/titan/health/` |
| `monitor-cron.sh` | 監控日誌 | `/var/log/titan/monitor.log` |
| 告警事件 | 告警記錄 | `/var/log/titan/alerts/` |

### 5.2 Docker 日誌收集

**方式 A：本機集中化（推薦，適合隔離網路）**

在 `docker-compose.yml` 中為每個服務設定 logging driver：
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
    labels: "service,env"
    tag: "{{.Name}}/{{.ID}}"
```

日誌檔案位置：`/var/lib/docker/containers/<container-id>/<container-id>-json.log`

**方式 B：統一收集腳本**

使用 `scripts/collect-logs.sh`（未來擴充）將 Docker logs 導向：
```
/var/log/titan/services/<service-name>/YYYY-MM-DD.log
```

**方式 C：ELK Stack（未來規劃，需額外資源）**

- Elasticsearch → 日誌儲存與搜尋
- Logstash / Filebeat → 日誌收集與轉換
- Kibana → 視覺化分析

### 5.3 日誌保留策略

| 日誌類型 | 保留期間 | 壓縮 | 備份 |
|----------|----------|------|------|
| 應用程式日誌 | 30 天 | 7 天後 gzip | 週備份 |
| 健康檢查日誌 | 14 天 | 3 天後 gzip | 否 |
| 告警日誌 | 90 天 | 7 天後 gzip | 月備份 |
| 稽核日誌 | 365 天 | 30 天後 gzip | 季備份 |

### 5.4 日誌輪替設定

建議 `/etc/logrotate.d/titan` 設定：
```
/var/log/titan/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        # 重新載入相關服務日誌（如需要）
    endscript
}
```

---

## 六、Uptime Kuma 整合

### 6.1 服務設定

Uptime Kuma 已整合至 `docker-compose.yml`，存取位址：`http://localhost:3002`

### 6.2 監控項目設定指引

首次登入後，建議新增以下監控項目：

1. **HTTP(s) 監控**：逐一加入各服務端點（見第 2.2 節）
2. **TCP 連線監控**：PostgreSQL (5432)、Redis (6379)
3. **Docker 容器狀態**：透過 Uptime Kuma 的 Docker 整合

### 6.3 通知設定

在 Uptime Kuma Settings → Notifications 中設定：
- Email（需 SMTP 設定）
- Slack Webhook（若有）
- Telegram Bot（若有）

---

## 七、健康檢查腳本使用說明

### 基本使用

```bash
# 一般彩色輸出
./scripts/health-check.sh

# JSON 格式輸出（供自動化使用）
./scripts/health-check.sh --json

# 靜默模式（只看結束碼）
./scripts/health-check.sh --quiet
```

### 結束碼說明

| 結束碼 | 狀態 | 說明 |
|--------|------|------|
| `0` | 全部健康 | 所有服務正常運作 |
| `1` | 降級 (Degraded) | 部分非關鍵服務異常 |
| `2` | 嚴重 (Critical) | 關鍵服務中斷 |

### Cron 整合

```bash
# 每 5 分鐘執行監控
*/5 * * * * /opt/titan/scripts/monitor-cron.sh >> /dev/null 2>&1
```

---

## 八、維護與更新

- 每季審查一次告警閾值，依實際使用狀況調整
- 每次新服務上線時更新本文件及 `config/monitoring/alerts.yaml`
- 每月測試告警通知流程（模擬測試）
- 每年進行完整監控策略審查
