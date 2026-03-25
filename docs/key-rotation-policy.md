# TITAN 密鑰輪換政策

**版本：** 1.0
**建立日期：** 2026-03-25
**適用範圍：** 所有 TITAN 生產環境密鑰

---

## 密鑰清單

| 密鑰 | 位置 | 輪換週期 | 負責人 |
|------|------|----------|--------|
| `AUTH_SECRET` | .env | 90 天 | 系統管理員 |
| `POSTGRES_PASSWORD` | .env | 90 天 | DBA |
| `REDIS_PASSWORD` | .env | 90 天 | 系統管理員 |
| `BACKUP_ENCRYPTION_KEY` | .env | 180 天 | 系統管理員 |
| TLS 憑證 | nginx/certs/ | 365 天 | 系統管理員 |

## 輪換流程

### AUTH_SECRET

```bash
# 1. 生成新 secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. 更新 .env
sed -i "s/AUTH_SECRET=.*/AUTH_SECRET=$NEW_SECRET/" .env

# 3. 重啟應用（所有現有 session 會失效，使用者需重新登入）
docker compose restart titan-app

# 4. 記錄輪換日期
echo "$(date '+%Y-%m-%d') AUTH_SECRET rotated" >> /var/log/titan/key-rotation.log
```

### POSTGRES_PASSWORD

```bash
# 1. 生成新密碼
NEW_PW=$(openssl rand -base64 24)

# 2. 在 PostgreSQL 中更新
docker compose exec titan-db psql -U titan -c "ALTER USER titan PASSWORD '$NEW_PW';"

# 3. 更新 .env（同步更新 DATABASE_URL 中的密碼）
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PW/" .env

# 4. 重啟
docker compose restart titan-app
```

### REDIS_PASSWORD

```bash
# 1. 生成新密碼
NEW_PW=$(openssl rand -base64 24)

# 2. 更新 Redis
docker compose exec titan-redis redis-cli CONFIG SET requirepass "$NEW_PW"

# 3. 更新 .env
sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW_PW/" .env

# 4. 重啟
docker compose restart titan-app
```

## 緊急輪換觸發條件

以下情況必須**立即輪換**所有密鑰：

1. 密鑰疑似洩漏（出現在 log、commit、截圖中）
2. 有權限人員離職
3. 伺服器疑似被入侵
4. 備份檔案遺失或被未授權存取

## 稽核

- 每次輪換記錄於 `/var/log/titan/key-rotation.log`
- 季度審查：確認所有密鑰在最近 90 天內有輪換
- 年度審查：確認 TLS 憑證未過期
