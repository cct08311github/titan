# Redis 持久化策略

## 背景

TITAN 平台使用 Redis 7 作為快取與非同步任務佇列。原始配置未啟用持久化，Redis 重啟後所有資料會遺失，構成單點故障風險。

## 啟用的持久化機制

### AOF (Append Only File)

- `appendonly yes` — 啟用 AOF 持久化
- `appendfsync everysec` — 每秒同步一次至磁碟（兼顧效能與安全，最多遺失 1 秒資料）

### RDB 快照（輔助）

RDB 提供定時全量快照，作為 AOF 的補充：

| 規則 | 說明 |
|------|------|
| `save 900 1` | 900 秒內至少 1 次寫入則快照 |
| `save 300 10` | 300 秒內至少 10 次寫入則快照 |
| `save 60 10000` | 60 秒內至少 10000 次寫入則快照 |

### 為什麼同時使用 AOF + RDB

- **AOF** 提供細粒度的資料保護（最多遺失 1 秒）
- **RDB** 提供快速的災難復原（檔案較小，載入更快）
- Redis 重啟時優先載入 AOF（資料更完整），RDB 作為備用

## 資料儲存位置

持久化檔案儲存於 Docker named volume `titan-redis-data`（掛載至容器 `/data`）：

- `/data/appendonlydir/` — AOF 檔案目錄
- `/data/dump.rdb` — RDB 快照檔案

## 效能影響

- `appendfsync everysec` 對效能影響極低（<5% throughput 降低）
- RDB 快照在背景執行（fork），不阻塞主執行緒
- 已設定 `maxmemory 256mb` 確保記憶體使用可控

## 備份建議

定期備份 Redis 資料：

```bash
# 透過 backup.sh 自動備份（已包含 Redis BGSAVE + 複製 RDB）
./scripts/backup.sh
```

## 回滾方式

如需停用持久化（不建議），修改 `docker-compose.yml` 中 Redis command：

```yaml
command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
```

然後重建容器：`docker compose up -d redis`
