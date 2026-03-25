# TITAN 行信 API 推播通知設計文件

> Issue #221 — P0 任務指派即時推播 + 每日摘要

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 設計階段（P5，待行方提供行信 API 規格）
**前置文件**: `docs/architecture-v3.md`

---

## 1. 概述

TITAN 目前僅有站內通知鈴（Notification Bell）。Phase 2 規劃整合銀行「行信 API」，
將緊急通知推播至行動裝置。

---

## 2. 推播場景

### 2.1 即時推播

| 觸發事件 | 接收者 | 優先級 | 範例訊息 |
|---------|--------|--------|---------|
| P0 任務指派 | 被指派者 | 緊急 | `[TITAN] P0 任務「系統異常排查」已指派給您` |
| B 角啟用通知 | B 角成員 | 緊急 | `[TITAN] 您已被啟用為「專案 A」的 B 角負責人` |
| 任務逾期 | 負責人 + 主管 | 高 | `[TITAN] 任務「伺服器更新」已逾期 2 天` |

### 2.2 每日摘要

| 時間 | 接收者 | 內容 |
|------|--------|------|
| 每日 08:00 | 所有活躍使用者 | 今日待辦數 + 逾期任務數 + 本週里程碑 |

---

## 3. 架構設計

```
Notification 建立
       │
       ▼
NotificationService.create()
       │
       ├── 寫入 DB（站內通知）
       │
       └── 判斷是否推播
               │
               ├── 使用者偏好：enabled?（NotificationPreference）
               ├── 推播條件：priority === 'P0' || type === 'BACKUP_ACTIVATED'
               │
               ▼
       PushNotificationService.send()
               │
               ▼
       行信 API（HTTP POST）
```

### 3.1 核心模組

```
lib/
├── push-notification.ts     # 行信 API 封裝
├── push-notification.test.ts # 單元測試（mock HTTP）
services/
├── notification-service.ts  # 擴充：推播判斷邏輯
```

---

## 4. 技術方案

### 4.1 行信 API 封裝

```typescript
// lib/push-notification.ts
interface PushPayload {
  recipientId: string;    // 行員編號
  title: string;
  body: string;
  priority: 'high' | 'normal';
}

export class PushNotificationService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor() {
    this.apiUrl = process.env.PUSH_API_URL || '';
    this.apiKey = process.env.PUSH_API_KEY || '';
    this.enabled = process.env.PUSH_ENABLED === 'true';
  }

  async send(payload: PushPayload): Promise<boolean> {
    if (!this.enabled) {
      logger.info('Push notification disabled, skipping');
      return false;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error({ status: response.status }, 'Push notification failed');
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, 'Push notification error');
      return false;  // 推播失敗不應影響主流程
    }
  }
}
```

### 4.2 每日摘要排程

```typescript
// lib/daily-digest.ts
// 由 cron job 或 Node.js scheduler 觸發

async function sendDailyDigest() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
  });

  for (const user of users) {
    const todayTasks = await countTodayTasks(user.id);
    const overdueTasks = await countOverdueTasks(user.id);

    if (todayTasks > 0 || overdueTasks > 0) {
      await pushService.send({
        recipientId: user.employeeId, // 需新增欄位
        title: '[TITAN] 每日摘要',
        body: `今日待辦 ${todayTasks} 項，逾期 ${overdueTasks} 項`,
        priority: overdueTasks > 0 ? 'high' : 'normal',
      });
    }
  }
}
```

---

## 5. 設定項

```env
# .env — 推播通知
PUSH_API_URL=https://push-api.bank.local/v1/notify
PUSH_API_KEY=<行信 API key>
PUSH_ENABLED=false              # 預設關閉，Go-Live 後啟用
PUSH_DAILY_DIGEST_CRON=0 8 * * *  # 每日 08:00
```

---

## 6. 安全考量

| 項目 | 處理方式 |
|------|---------|
| API Key 保護 | 存放於 .env，不進 Git |
| 推播失敗處理 | 不影響主流程（graceful degradation） |
| 頻率限制 | 每位使用者每小時最多 10 則推播 |
| 隱私 | 推播內容不含敏感資料（僅任務標題、數量） |

---

## 7. 前置條件

- [ ] 行方提供行信 API 規格與測試環境
- [ ] 確認 TITAN 主機可連線至行信 API（網路/防火牆）
- [ ] User model 新增 `employeeId` 欄位（行員編號）
- [ ] 通知偏好機制完成（Issue #267）

## 8. 預估工時

12 小時

---

*Fixes #221*
