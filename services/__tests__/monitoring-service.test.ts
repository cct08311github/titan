/**
 * MonitoringService 測試
 * 驗證 webhook 建立新告警、更新既有告警、以及從告警建立任務
 */
import { MonitoringService, WebhookPayload } from "../monitoring-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("MonitoringService", () => {
  let service: MonitoringService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MonitoringService(prisma as never);
    jest.clearAllMocks();

    // $transaction 預設透傳 callback
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  describe("processWebhook()", () => {
    const basePayload: WebhookPayload = {
      alertName: "CPU 使用率過高",
      severity: "critical",
      status: "firing",
      startsAt: "2026-04-07T10:00:00Z",
      annotations: { summary: "CPU > 90%", description: "持續 5 分鐘" },
      source: "prometheus",
    };

    test("新告警應執行 upsert 建立記錄", async () => {
      const mockAlert = {
        id: "alert-1",
        alertName: "CPU 使用率過高",
        status: "FIRING",
        severity: "critical",
      };
      (prisma.monitoringAlert.upsert as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.processWebhook(basePayload);

      expect(prisma.monitoringAlert.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.monitoringAlert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            alertName: "CPU 使用率過高",
            status: "FIRING",
            severity: "critical",
          }),
        })
      );
      expect(result).toEqual(mockAlert);
    });

    test("resolved 狀態的 webhook 應將 status 設為 RESOLVED", async () => {
      const resolvedPayload: WebhookPayload = {
        ...basePayload,
        status: "resolved",
        endsAt: "2026-04-07T10:30:00Z",
      };

      (prisma.monitoringAlert.upsert as jest.Mock).mockResolvedValue({
        id: "alert-1",
        status: "RESOLVED",
      });

      await service.processWebhook(resolvedPayload);

      expect(prisma.monitoringAlert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: "RESOLVED" }),
          create: expect.objectContaining({ status: "RESOLVED" }),
        })
      );
    });

    test("相同告警再次觸發時應更新 update 欄位", async () => {
      // 第二次 webhook：同一 alertName + startsAt，upsert 會走 update 分支
      const updatedPayload: WebhookPayload = {
        ...basePayload,
        severity: "warning", // severity 降級
      };

      (prisma.monitoringAlert.upsert as jest.Mock).mockResolvedValue({
        id: "alert-1",
        status: "FIRING",
        severity: "warning",
      });

      await service.processWebhook(updatedPayload);

      expect(prisma.monitoringAlert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ severity: "warning" }),
        })
      );
    });
  });

  describe("createTaskFromAlert()", () => {
    test("從告警建立任務並連結 relatedTaskId", async () => {
      const mockAlert = {
        id: "alert-1",
        alertName: "CPU 使用率過高",
        summary: "CPU > 90%",
        description: "持續 5 分鐘",
        severity: "critical",
      };
      const mockTask = {
        id: "task-99",
        title: "[告警] CPU 使用率過高: CPU > 90%",
        category: "INCIDENT",
        priority: "P0",
      };

      (prisma.monitoringAlert.findUnique as jest.Mock).mockResolvedValue(mockAlert);
      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);
      (prisma.monitoringAlert.update as jest.Mock).mockResolvedValue({
        ...mockAlert,
        relatedTaskId: mockTask.id,
      });

      const result = await service.createTaskFromAlert("alert-1", "user-admin");

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: "INCIDENT",
            priority: "P0", // critical → P0
          }),
        })
      );
      // 應將任務 ID 更新回告警
      expect(prisma.monitoringAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "alert-1" },
          data: expect.objectContaining({ relatedTaskId: mockTask.id }),
        })
      );
      expect(result).toEqual(mockTask);
    });

    test("告警不存在時應回傳 null", async () => {
      (prisma.monitoringAlert.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.createTaskFromAlert("non-existent", "user-1");

      expect(result).toBeNull();
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });
});
