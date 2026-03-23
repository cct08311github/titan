# TITAN 資料庫與儲存規劃

> 任務：T09 — 資料庫與儲存規劃
> 對應 Issue：[#11](https://github.com/cct08311github/titan/issues/11)
> 適用環境：銀行 IT 部門封閉網路（Air-Gapped）5 人團隊
> 最後更新：2026-03

---

## 目錄

1. [PostgreSQL 架構策略](#1-postgresql-架構策略)
2. [資料庫命名規範](#2-資料庫命名規範)
3. [使用者與角色設定](#3-使用者與角色設定)
4. [連線池考量](#4-連線池考量)
5. [儲存容量估算](#5-儲存容量估算)
6. [Redis Keyspace 分區](#6-redis-keyspace-分區)
7. [MinIO Bucket 組織](#7-minio-bucket-組織)
8. [資料保留政策](#8-資料保留政策)

---

## 1. PostgreSQL 架構策略

### 決策：共用 PostgreSQL 實例，獨立資料庫

TITAN 採用**單一 PostgreSQL 容器 + 多個獨立資料庫**的架構，而非每個服務各自部署獨立 PostgreSQL 實例。

```
titan-postgres (PostgreSQL 16)
├── outline_db      ← Outline 知識庫
├── plane_db        ← Plane 專案管理
└── titan_admin_db  ← 未來管理功能預留
```

### 選擇理由

| 考量 | 共用實例 + 獨立 DB | 獨立實例（每服務） |
|------|-------------------|------------------|
| 資源消耗 | 低（共用記憶體/程序） | 高（各自佔用資源） |
| 維護複雜度 | 低（單一備份點） | 高（多份備份流程） |
| 服務隔離 | 資料庫層隔離（足夠） | 完全隔離 |
| 5 人團隊適用 | ✅ 適合 | ❌ 過度設計 |
| 硬體需求 | 低 | 高 |

### 各服務資料庫對應

| 服務 | 資料庫名稱 | 說明 |
|------|-----------|------|
| Outline | `outline_db` | 知識庫文件、使用者、權限 |
| Plane | `plane_db` | 專案、Issue、Sprint、成員 |
| 未來擴充 | `titan_admin_db` | 管理儀表板、審計日誌（預留） |

---

## 2. 資料庫命名規範

### 資料庫命名

格式：`{服務名稱}_db`（全小寫，底線分隔）

| 類型 | 範例 | 說明 |
|------|------|------|
| 服務資料庫 | `outline_db`、`plane_db` | 各服務主資料庫 |
| 管理資料庫 | `titan_admin_db` | 平台管理用途 |

### 使用者命名

格式：`{服務名稱}_user`（全小寫，底線分隔）

| 類型 | 範例 | 說明 |
|------|------|------|
| 服務帳號 | `outline_user`、`plane_user` | 各服務專用帳號 |
| 唯讀帳號 | `outline_readonly`、`plane_readonly` | 報表/稽核查詢用 |
| 管理帳號 | `titan_admin` | 超級管理員（限 DBA 使用） |

### Schema 命名

格式：`{模組名稱}` 或直接使用 `public`（視服務而定）

- Outline：使用 `public` schema（Outline 預設）
- Plane：使用 `public` schema（Plane 預設）
- 未來自開發：建議建立獨立 schema，例如 `analytics`、`audit`

---

## 3. 使用者與角色設定

### 最小權限原則

每個服務帳號僅擁有其對應資料庫的必要權限，**不跨資料庫授權**。

### 權限矩陣

| 使用者 | 資料庫 | SELECT | INSERT | UPDATE | DELETE | CREATE | SUPERUSER |
|--------|--------|--------|--------|--------|--------|--------|-----------|
| `outline_user` | `outline_db` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `outline_readonly` | `outline_db` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `plane_user` | `plane_db` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `plane_readonly` | `plane_db` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `titan` (root) | ALL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> ⚠️ **安全注意事項**：`titan` 超級管理員帳號僅供初始化及緊急維護使用。日常應用應使用各服務專用帳號。

### 帳號設定範本

```sql
-- Outline 服務帳號
CREATE USER outline_user WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    CONNECTION LIMIT 10
    PASSWORD '<強密碼>';

-- Plane 服務帳號
CREATE USER plane_user WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    CONNECTION LIMIT 10
    PASSWORD '<強密碼>';
```

---

## 4. 連線池考量

### 現況配置（5 人團隊）

```
PostgreSQL max_connections = 100（預設）
├── Outline: min=1, max=5（docker-compose.yml 已設定）
├── Plane API: min=2, max=10（建議值）
├── 管理工具連線: 5（DBA 手動連線）
└── 預留緩衝: 80（充足空間）
```

### 各服務連線設定建議

| 服務 | 最小連線 | 最大連線 | 說明 |
|------|---------|---------|------|
| Outline | 1 | 5 | 5 人團隊，低並發 |
| Plane API | 2 | 10 | API 服務，中度並發 |
| Plane Worker | 1 | 3 | 背景任務 |

### PgBouncer 評估

**目前規模（5 人）不需要 PgBouncer**。當符合以下任一條件時再考慮引入：

- 同時在線人數超過 20 人
- 連線數超過 PostgreSQL `max_connections` 的 60%
- 出現連線等待 timeout 錯誤

---

## 5. 儲存容量估算

### 假設條件

- 團隊規模：5 人
- 使用週期：1 年（約 250 個工作天）
- 使用強度：中等（每人每天活躍操作）

### PostgreSQL 資料量估算

| 資料庫 | 估算基礎 | 1 年估算容量 |
|--------|---------|------------|
| `outline_db` | 每人每週新增 5 頁文件，每頁約 10KB | ~13MB |
| `plane_db` | 每週建立 20 個 Issue，每筆 2KB | ~5MB |
| 索引與 WAL overhead | 資料量 × 3 | ~54MB |
| **小計** | | **~75MB** |

> 實際容量含備份 WAL 日誌，建議預留 **5GB** 給 PostgreSQL Volume。

### MinIO 物件儲存估算

| Bucket | 內容類型 | 估算基礎 | 1 年估算容量 |
|--------|---------|---------|------------|
| `outline-attachments` | 圖片、PDF、Office 文件 | 每人每週上傳 5 個附件，平均 500KB | ~3.25GB |
| `titan-backups` | PostgreSQL dump | 每日備份，約 100MB/份，保留 30 天 | ~3GB |
| `titan-exports` | 資料匯出檔 | 每週 1 份，約 50MB | ~2.5GB |
| **小計** | | | **~9GB** |

> 建議預留 **20GB** 給 MinIO Volume（含安全餘裕 2×）。

### Redis 記憶體估算

| 用途 | 估算 |
|------|------|
| Outline Session + Cache | ~50MB |
| Plane 任務佇列 + Cache | ~30MB |
| 系統 overhead | ~20MB |
| **建議 maxmemory** | **256MB** |

### 整體 Volume 建議配置

| Volume | 建議大小 | 說明 |
|--------|---------|------|
| `titan-postgres-data` | 5GB | 含 WAL 與備份空間 |
| `titan-redis-data` | 1GB | 含 AOF 持久化 |
| `titan-minio-data` | 20GB | 附件 + 備份 + 匯出 |
| `titan-outline-data` | 2GB | 本地快取與臨時檔 |
| **總計** | **28GB** | 建議主機留出 40GB 空間 |

---

## 6. Redis Keyspace 分區

### 資料庫編號分配

Redis 支援 16 個獨立邏輯資料庫（DB 0–15），TITAN 分配如下：

| DB 編號 | 用途 | 服務 | Keyspace 前綴 |
|---------|------|------|--------------|
| DB 0 | Session + Cache | Outline | `outline:session:*`、`outline:cache:*` |
| DB 1 | 任務佇列 + Cache | Plane | `plane:queue:*`、`plane:cache:*` |
| DB 2 | 健康監控 | 系統 | `titan:health:*` |
| DB 3–14 | 預留 | 未來服務 | — |
| DB 15 | 測試/暫存 | 開發用 | `test:*` |

### Keyspace 命名規範

格式：`{服務}:{功能}:{識別子}`

```
outline:session:user_abc123      ← 使用者 Session
outline:cache:doc_456            ← 文件快取
plane:queue:email_789            ← Email 通知任務
plane:cache:project_001          ← 專案資料快取
titan:health:initialized         ← 系統健康狀態
```

### 連線設定範本

```bash
# Outline（連線至 DB 0）
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# Plane（連線至 DB 1）
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
```

---

## 7. MinIO Bucket 組織

### Bucket 清單

| Bucket 名稱 | 存取策略 | 用途 | 保留期限 |
|------------|---------|------|---------|
| `outline-attachments` | Private | Outline 文件附件（圖片、PDF 等） | 永久（依文件生命週期） |
| `titan-backups` | Private | PostgreSQL 每日備份 dump | 30 天滾動保留 |
| `titan-exports` | Private | 資料匯出（CSV、ZIP） | 90 天 |
| `plane-uploads` | Private | Plane Issue 附件 | 永久（依 Issue 生命週期） |

### 目錄結構慣例

```
outline-attachments/
├── uploads/
│   ├── avatars/          ← 使用者頭像
│   └── documents/        ← 文件附件
└── .healthcheck          ← 健康檢查用（自動建立/刪除）

titan-backups/
├── postgres/
│   ├── YYYY-MM-DD/
│   │   ├── outline_db.dump
│   │   └── plane_db.dump
└── minio/
    └── YYYY-MM-DD/       ← MinIO metadata 備份

titan-exports/
└── YYYY-MM-DD/
    └── {export_name}.zip

plane-uploads/
└── attachments/
    └── {issue_id}/       ← 依 Issue 分資料夾
```

### Bucket 存取控制

所有 Bucket 均設定為 **Private（拒絕匿名存取）**，應用程式透過 MinIO IAM Policy 存取：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["arn:aws:iam:::user/outline-svc"]},
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::outline-attachments/*"]
    }
  ]
}
```

---

## 8. 資料保留政策

### 各類資料保留期限

| 資料類型 | 存放位置 | 保留期限 | 刪除方式 |
|---------|---------|---------|---------|
| PostgreSQL WAL | postgres-data | 7 天（`wal_keep_size`） | 自動清理 |
| PostgreSQL 每日備份 | `titan-backups` | 30 天 | MinIO 生命週期規則 |
| Redis Session | DB 0 | TTL 24 小時（Outline 預設） | 自動過期 |
| Redis 任務佇列 | DB 1 | 完成後 7 天 | Celery 自動清理 |
| MinIO 附件 | `outline-attachments`、`plane-uploads` | 永久（跟隨文件/Issue） | 手動或軟刪除 |
| MinIO 匯出 | `titan-exports` | 90 天 | MinIO 生命週期規則 |
| 應用程式日誌 | Docker stdout | 7 天（Docker log rotation） | Docker daemon 自動輪轉 |

### Docker Log Rotation 建議設定

在 `docker-compose.yml` 各服務加入：

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "7"
```

### 備份排程建議

```cron
# 每日凌晨 2:00 備份 PostgreSQL
0 2 * * * /opt/titan/scripts/backup-postgres.sh

# 每週日凌晨 3:00 清理過期備份
0 3 * * 0 /opt/titan/scripts/cleanup-backups.sh
```

> 詳細備份腳本規劃見後續 T10（維運與備份）任務。

---

*文件版本：v1.0 | 維護者：DevOps + Backend 團隊*
