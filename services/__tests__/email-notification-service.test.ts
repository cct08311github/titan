/**
 * EmailNotificationService 測試
 * 驗證 trigger() 找到即將到期的任務、偏好設定跳過、同小時去重、以及 email 失敗容錯
 */
import { EmailNotificationService } from "../email-notification-service";
import { createMockPrisma } from "../../lib/test-utils";

// Mock 外部 email 模組與 logger，讓測試不依賴真實 SMTP
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/email-templates", () => ({
  dueSoonEmail: jest.fn().mockReturnValue({ subject: "即將到期通知", html: "<p>due soon</p>" }),
  overdueEmail: jest.fn().mockReturnValue({ subject: "逾期通知", html: "<p>overdue</p>" }),
  timesheetReminderEmail: jest.fn().mockReturnValue({ subject: "工時提醒", html: "<p>reminder</p>" }),
  dailyDigestEmail: jest.fn().mockReturnValue({ subject: "每日摘要", html: "<p>digest</p>" }),
  weeklyManagerEmail: jest.fn().mockReturnValue({ subject: "週報", html: "<p>weekly</p>" }),
}));

import { sendEmail } from "@/lib/email";

// 建立含有 notificationLog 的擴充 mock prisma
function createExtendedMockPrisma() {
  const prisma = createMockPrisma() as ReturnType<typeof createMockPrisma> & {
    notificationLog: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  // test-utils 不含 notificationLog，手動補上
  (prisma as Record<string, unknown>).notificationLog = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };

  return prisma;
}

describe("EmailNotificationService", () => {
  let service: EmailNotificationService;
  let prisma: ReturnType<typeof createExtendedMockPrisma>;

  beforeEach(() => {
    prisma = createExtendedMockPrisma();
    service = new EmailNotificationService(prisma as never);
    jest.clearAllMocks();

    // 預設偏好查詢回空（代表全部啟用）
    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);
    // 預設去重查詢回 null（未發送過）
    (prisma.notificationLog.findFirst as jest.Mock).mockResolvedValue(null);
    // 預設 log 建立成功
    (prisma.notificationLog.create as jest.Mock).mockResolvedValue({});
    // 預設 sendEmail 成功
    (sendEmail as jest.Mock).mockResolvedValue({ success: true });
  });

  describe("trigger()", () => {
    test("找到即將到期的任務並回傳已發送數量", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const dueDate = new Date("2026-04-07T20:00:00Z"); // 10 小時後到期

      (prisma.task.findMany as jest.Mock)
        // 第一次呼叫：due soon 任務
        .mockResolvedValueOnce([
          {
            id: "task-1",
            title: "完成部署",
            dueDate,
            primaryAssigneeId: "user-1",
            primaryAssignee: { email: "eng@example.com" },
          },
        ])
        // 第二次呼叫：overdue 任務（空）
        .mockResolvedValueOnce([]);

      const result = await service.trigger(now);

      expect(result.triggered).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    test("偏好設定 emailEnabled=false 應跳過通知", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const dueDate = new Date("2026-04-07T20:00:00Z");

      // 使用者停用 TASK_DUE_SOON 通知
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
        { userId: "user-1", type: "TASK_DUE_SOON", emailEnabled: false },
      ]);

      (prisma.task.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "task-1",
            title: "完成部署",
            dueDate,
            primaryAssigneeId: "user-1",
            primaryAssignee: { email: "eng@example.com" },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.trigger(now);

      expect(result.skipped).toBeGreaterThan(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("同小時內已發送過應跳過（去重機制）", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const dueDate = new Date("2026-04-07T20:00:00Z");

      // 去重查詢回傳「已存在記錄」
      (prisma.notificationLog.findFirst as jest.Mock).mockResolvedValue({
        id: "log-1",
        recipient: "eng@example.com",
        subject: "即將到期通知",
        status: "sent",
        sentAt: now,
      });

      (prisma.task.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "task-1",
            title: "完成部署",
            dueDate,
            primaryAssigneeId: "user-1",
            primaryAssignee: { email: "eng@example.com" },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.trigger(now);

      // triggered 已增加（任務找到），但 sent=0 因為去重跳過
      expect(result.triggered).toBe(1);
      expect(result.sent).toBe(0);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("email 發送失敗應優雅容錯並記錄 failed", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const dueDate = new Date("2026-04-07T20:00:00Z");

      // sendEmail 回傳失敗
      (sendEmail as jest.Mock).mockResolvedValue({ success: false, error: "SMTP timeout" });

      (prisma.task.findMany as jest.Mock)
        .mockResolvedValueOnce([
          {
            id: "task-1",
            title: "完成部署",
            dueDate,
            primaryAssigneeId: "user-1",
            primaryAssignee: { email: "eng@example.com" },
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.trigger(now);

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
      // 即使失敗也應記錄 log
      expect(prisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "failed" }),
        })
      );
    });
  });
});
