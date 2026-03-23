#!/bin/bash
# ============================================
# 銀行 IT 團隊 - 每日備份腳本
# 建議透過 crontab 每日執行
# 例：0 2 * * * /path/to/backup.sh
# ============================================

set -e

BACKUP_ROOT="/backup"
DATE=$(date +%Y%m%d)
BACKUP_DIR="$BACKUP_ROOT/$DATE"
KEEP_DAYS=30

echo "📦 開始備份 - $(date)"

# 建立備份目錄
mkdir -p $BACKUP_DIR

# 資料庫備份
echo "💾 備份 PostgreSQL 資料庫..."
docker exec bank-postgres pg_dump -U bankuser bankdb > $BACKUP_DIR/db_all.sql 2>/dev/null || true
docker exec bank-postgres pg_dump -U bankuser bankplane > $BACKUP_DIR/db_plane.sql 2>/dev/null || true
docker exec bank-postgres pgump -U bankuser bankoutline > $BACKUP_DIR/db_outline.sql 2>/dev/null || true
docker exec bank-postgres pg_dump -U bankuser bankgitea > $BACKUP_DIR/db_gitea.sql 2>/dev/null || true

# Gitea 資料備份
echo "📂 備份 Gitea 資料..."
tar -czf $BACKUP_DIR/gitea.tar.gz ./gitea/data ./gitea/repos 2>/dev/null || true

# 濃縮打包
echo "📦 打包備份檔案..."
tar -czf "$BACKUP_DIR.tar.gz" $BACKUP_DIR

# 刪除未濃縮目錄
rm -rf $BACKUP_DIR

# 清理舊備份
echo "🧹 清理 30 天前備份..."
find $BACKUP_ROOT -name "*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "✅ 備份完成 - $(date)"
echo "📁 備份位置：$BACKUP_ROOT/$(date +%Y%m%d).tar.gz"