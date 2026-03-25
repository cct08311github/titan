# TITAN 密鑰輪換政策

> Issue #269 — Key Rotation Policy

## 密鑰清單

| 密鑰 | 環境變數 | 用途 | 影響服務 |
|------|---------|------|---------|
| NextAuth Secret | NEXTAUTH_SECRET | JWT/session 加密 | titan-app |
| DB 密碼 | POSTGRES_PASSWORD | 資料庫認證 | postgres, titan-app, outline |
| Redis 密碼 | REDIS_PASSWORD | 快取認證 | redis, titan-app, outline |
| MinIO 密碼 | MINIO_ROOT_PASSWORD | 物件儲存認證 | minio, outline |
| Outline Secret | OUTLINE_SECRET_KEY | session 加密 | outline |
| Outline Utils | OUTLINE_UTILS_SECRET | 工具加密 | outline |

## 輪換週期

- **P0（立即）**：發現洩漏時
- **定期（90 天）**：所有主要密鑰
- **依需求**：OIDC_CLIENT_SECRET, SMTP_PASSWORD

## 輪換前準備

1. 預排維護視窗（非工作時間）
2. 全量備份：`./scripts/backup/backup-all.sh`
3. 備份 .env：`cp .env .env.backup.$(date +%Y%m%d)`

## 輪換指令

```bash
./scripts/rotate-secrets.sh --target nextauth-secret   # session 失效
./scripts/rotate-secrets.sh --target db-password        # DB 短暫中斷
./scripts/rotate-secrets.sh --target redis-password     # 快取清空
./scripts/rotate-secrets.sh --target minio-password     # 附件短暫不可用
./scripts/rotate-secrets.sh --target outline-secrets    # Outline session 失效
./scripts/rotate-secrets.sh --target <name> --dry-run   # 模擬執行
```

## 驗證

```bash
docker compose ps && ./scripts/health-check.sh
```

## 回滾

```bash
cp .env.backup.YYYYMMDD .env && docker compose down && docker compose up -d
```

## 稽核

- 輪換紀錄保存於 `.env-backups/`
- 記錄日期、執行者、影響範圍
