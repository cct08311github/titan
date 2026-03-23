#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Redis 初始化腳本
# 任務: T09 — 資料庫與儲存規劃
# 用途：設定 Redis 監控鍵、健康檢查、效能調校
# ═══════════════════════════════════════════════════════════

set -e

# 等待 Redis 啟動
echo "Waiting for Redis to be ready..."
sleep 5

# Redis CLI 命令
REDIS-cli() {
    redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning "$@"
}

echo "Starting Redis initialization..."

# 設定 Redis 監控鍵（可用於 健康檢查）
REDIS-cli SET "titan:health:initialized" "true" EX 86400
REDIS-cli SET "titan:health:last_init" "$(date -Iseconds)" EX 86400

# 設定 keyspace 事件通知（用於監控 key 過期、刪除等）
# 注意：notify-keyspace-events 會消耗效能，生產環境請謹慎使用
# REDIS-cli CONFIG SET notify-keyspace-events "Ex"

# 設定記憶體策略（LRU - Least Recently Used）
REDIS-cli CONFIG SET maxmemory-policy allkeys-lru

# 設定 slow log（記錄超過 10ms 的命令）
REDIS-cli CONFIG SET slowlog-log-slower-than 10000
REDIS-cli CONFIG SET slowlog-max-len 128

# 設定 clients timeout（防止閒置連線）
REDIS-cli CONFIG SET timeout 300
REDIS-cli CONFIG SET tcp-keepalive 60

# 建立應用程式專用 key prefix（用於區分不同服務）
# Outline 使用: titan:outline:*
# 預留給 future: titan:app:*

# 驗證設定
echo "Redis configuration:"
REDIS-cli INFO server | grep redis_version
REDIS-cli INFO memory | grep used_memory_human

echo "Redis initialization completed successfully!"
echo "$(date -Iseconds) - Redis init done" >> /tmp/redis-init.log