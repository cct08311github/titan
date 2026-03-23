#!/bin/bash
# ═══════════════════════════════════════════════════════════
# MinIO 初始化腳本
# 任務: T09 — 資料庫與儲存規劃
# 用途：建立 S3 bucket、設置生命週期策略、存取權限
# ═══════════════════════════════════════════════════════════

set -e

# MinIO 配置
MINIO_ENDPOINT="minio:9000"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD}"
MC="/usr/bin/mc"

# 等待 MinIO 啟動
echo "Waiting for MinIO to be ready..."
until ${MC} alias list minio &>/dev/null; do
    sleep 2
done

echo "MinIO is ready!"

# 設定 MinIO CLI alias
${MC} alias set minio http://${MINIO_ENDPOINT} ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# ═══════════════════════════════════════════════════════════
# 建立 Bucket（依賴環境變數）
# ═══════════════════════════════════════════════════════════

# Outline bucket（如果未指定，預設為 outline）
OUTLINE_BUCKET="${OUTLINE_S3_BUCKET:-outline}"
if [ ! -z "${OUTLINE_BUCKET}" ]; then
    echo "Creating bucket: ${OUTLINE_BUCKET}"
    ${MC} mb minio/${OUTLINE_BUCKET} --ignore-existing
    
    # 設定 bucket 為 private（預設）
    ${MC} anonymous set private minio/${OUTLINE_BUCKET}
    
    # 設定生命週期（可選）- 30 天後刪除未使用的物件
    # ${MC} lifecycle add minio/${OUTLINE_BUCKET} /config/lifecycle.json
    
    echo "Bucket ${OUTLINE_BUCKET} ready!"
fi

# 預留 bucket（未來服務使用）
# BACKUP_BUCKET="titan-backup"
# ${MC} mb minio/${BACKUP_BUCKET} --ignore-existing

# ═══════════════════════════════════════════════════════════
# 設定 CORS（允許瀏覽器存取）
# ═══════════════════════════════════════════════════════════
# 注意：生產環境請設定正確的 CORS 規則
# ${MC} cors apply minio/${OUTLINE_BUCKET} /config/cors.json

# ═══════════════════════════════════════════════════════════
# 設定存取策略（預設為 restricted）
# ═══════════════════════════════════════════════════════════
# 允許特定使用者存取（透過 policy）

# 驗證 bucket 列表
echo "Current buckets:"
${MC} ls minio/

# 測試上傳
echo "Testing write access..."
echo "test" | ${MC} pipe minio/${OUTLINE_BUCKET}/.healthcheck
${MC} rm minio/${OUTLINE_BUCKET}/.healthcheck

echo "MinIO initialization completed successfully!"
echo "$(date -Iseconds) - MinIO init done" >> /tmp/minio-init.log