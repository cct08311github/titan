# TITAN 通知類型參考文件

> 統一參考文件 — 集中定義所有通知類型的語義、觸發條件與 UI 表現

---

## 通知類型總覽

| 類型代碼 | 中文名稱 | 觸發條件 | 對象 |
|----------|----------|----------|------|
| `TASK_ASSIGNED` | 任務指派 | 任務的 primaryAssignee 或 backupAssignee 被設定/變更 | 被指派者 |
| `TASK_DUE_SOON` | 任務即將到期 | 任務截止日在 3 天內 | primaryAssignee |
| `TASK_OVERDUE` | 任務逾期 | 任務超過截止日且未完成 | primaryAssignee |
| `TASK_COMMENTED` | 任務留言 | 任務收到新留言 | 任務相關人員 |
| `MILESTONE_DUE` | 里程碑到期 | 里程碑截止日在 7 天內 | 計畫相關人員 |
| `BACKUP_ACTIVATED` | B 角啟動 | 備援人員被啟動（主要負責人不可用） | backupAssignee |
| `TASK_CHANGED` | 任務變更 | 任務的狀態、優先級或指派人被修改 | 任務相關人員 |
| `TIMESHEET_REMINDER` | 工時填報提醒 | 每週定期提醒（可由 cron 觸發） | 所有活躍用戶 |

---

## 通知生命週期

```
觸發條件滿足
    ↓
POST /api/notifications/generate（cron 或管理員手動）
    ↓
NotificationService.generateAll() 檢查：
    - 即將到期的任務 → TASK_DUE_SOON
    - 已逾期的任務 → TASK_OVERDUE
    - 即將到期的里程碑 → MILESTONE_DUE
    ↓
去重：同一 user + type + relatedId 已有未讀通知 → 跳過
    ↓
寫入 Notification 資料表
    ↓
前端透過 GET /api/notifications 取得通知列表
    ↓
用戶點擊 → PATCH /api/notifications/{id}/read 標記已讀
```

---

## UI 呈現對應

### 通知鈴鐺（notification-bell.tsx）

| 類型代碼 | 標籤文字 | 指示色 |
|----------|----------|--------|
| `TASK_ASSIGNED` | 任務指派 | `bg-blue-500` |
| `TASK_DUE_SOON` | 即將到期 | `bg-yellow-500` |
| `TASK_OVERDUE` | 已逾期 | `bg-red-500` |
| `TASK_COMMENTED` | 新留言 | `bg-green-500` |
| `MILESTONE_DUE` | 里程碑提醒 | `bg-purple-500` |
| `BACKUP_ACTIVATED` | B 角啟動 | `bg-orange-500` |
| `TASK_CHANGED` | 任務變更 | `bg-gray-500` |
| `TIMESHEET_REMINDER` | 工時提醒 | `bg-teal-500` |

### 個人設定（settings/page.tsx — 通知偏好分頁）

每種類型可獨立開/關，預設全部啟用。

### 管理員通知設定（admin/notifications/page.tsx）

管理員可為全系統設定各類型通知的啟用/停用狀態。

---

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/notifications` | GET | 取得當前用戶的通知列表（含分頁） |
| `/api/notifications/{id}/read` | PATCH | 標記單則通知為已讀 |
| `/api/notifications/read-all` | PATCH | 標記所有通知為已讀 |
| `/api/notifications/generate` | POST | 觸發通知生成（需 MANAGER 角色） |
| `/api/notifications/push` | POST | 推送通知（WebSocket / 未來擴充） |
| `/api/users/{id}/notification-preferences` | GET/PUT | 取得/更新用戶通知偏好 |

---

## 程式碼位置

| 檔案 | 用途 |
|------|------|
| `app/components/notification-bell.tsx` | 通知鈴鐺 UI + 類型標籤/顏色對應 |
| `app/(app)/settings/page.tsx` | 用戶通知偏好開關 |
| `app/(app)/admin/notifications/page.tsx` | 管理員全域通知設定 |
| `app/api/notifications/generate/route.ts` | 通知生成 API |
| `services/notification-service.ts` | 通知業務邏輯 |

---

## 擴充新通知類型

1. 在 Prisma schema 的 `NotificationType` enum 新增類型
2. 在 `NotificationService` 的 `generateAll()` 新增檢查邏輯
3. 更新以下 UI 映射（保持一致）：
   - `notification-bell.tsx` — `TYPE_LABELS` + `TYPE_COLORS`
   - `settings/page.tsx` — `NOTIFICATION_TYPE_LABELS`
   - `admin/notifications/page.tsx` — `NOTIFICATION_TYPE_LABELS`
   - `messages/zh-TW.json` — 若需 i18n 支援
4. 更新本文件
