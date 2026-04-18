/**
 * AlertService 測試
 * 驗證告警等級、逾期任務偵測、KPI 低落偵測、以及 isSample/deletedAt 過濾
 */
import { AlertService } from "../alert-service";
import { createMockPrisma } from "../../lib/test-utils";

describe("AlertService", () => {
  let service: AlertService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AlertService(prisma as never);
    jest.clearAllMocks();

    // 預設所有 findMany 回傳空陣列，避免未設定的測試影響結果
    (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.kPI.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe("getActiveAlerts — 告警等級", () => {
    test("KPI 達成率低於 60% 應產生 CRITICAL 告警", async () => {
      // 目標 100，實際 50 → 50% < 60%
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: "kpi-1", title: "系統可用率", target: 100, actual: 50 },
      ]);

      const alerts = await service.getActiveAlerts();

      const kpiAlert = alerts.find((a) => a.category === "kpi_critical");
      expect(kpiAlert).toBeDefined();
      expect(kpiAlert?.level).toBe("CRITICAL");
    });

    test("計畫進度落後應產生 WARNING 告警", async () => {
      const now = new Date();
      const year = now.getFullYear();
      // 月份進度期望值約為 (month+1)/12*100；給 progressPct=0 確保落後
      (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue([
        { id: "plan-1", title: "2026 年度計畫", progressPct: 0, createdAt: new Date() },
      ]);

      const alerts = await service.getActiveAlerts();

      // 在 1 月以後才會觸發（monthProgress > 0）；若當前月份 > 0 就會出現
      if (now.getMonth() > 0) {
        const planAlert = alerts.find((a) => a.category === "plan_behind");
        expect(planAlert?.level).toBe("WARNING");
      }
    });

    test("逾期超過 3 天的任務應產生 CRITICAL 告警", async () => {
      // 模擬有 2 個逾期任務
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: "task-1" },
        { id: "task-2" },
      ]);

      const alerts = await service.getActiveAlerts();

      const overdueAlert = alerts.find((a) => a.category === "overdue");
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.level).toBe("CRITICAL");
      expect(overdueAlert?.message).toContain("2");
    });

    test("CRITICAL 告警應排在 WARNING 告警之前", async () => {
      // 同時有 KPI critical + 計畫落後 warning
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: "kpi-1", title: "KPI A", target: 100, actual: 10 }, // 10% → CRITICAL
      ]);
      (prisma.annualPlan.findMany as jest.Mock).mockResolvedValue([
        { id: "plan-1", title: "計畫 A", progressPct: 0, createdAt: new Date() },
      ]);

      const alerts = await service.getActiveAlerts();

      // CRITICAL 應在最前面
      const firstCritical = alerts.findIndex((a) => a.level === "CRITICAL");
      const firstWarning = alerts.findIndex((a) => a.level === "WARNING");
      if (firstCritical !== -1 && firstWarning !== -1) {
        expect(firstCritical).toBeLessThan(firstWarning);
      }
    });

    test("isSample 過濾：任務查詢不含 sample 資料", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.getActiveAlerts();

      // 確認查詢條件含 isSample: false
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSample: false }),
        })
      );
    });

    test("KPI deletedAt 過濾：只查 deletedAt: null 的 KPI", async () => {
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([]);

      await service.getActiveAlerts();

      expect(prisma.kPI.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        })
      );
    });

    // Issue #1481: document query used to cascade into dashboard polling storms
    test("文件查詢失敗時，其他告警仍正常產生（不連鎖崩潰）", async () => {
      // Simulate the Prisma 7 DocumentStatus driver adapter failure
      (prisma.document.findMany as jest.Mock).mockRejectedValue(
        new Error('operator does not exist: text = "DocumentStatus"'),
      );
      (prisma.kPI.findMany as jest.Mock).mockResolvedValue([
        { id: "kpi-1", title: "可用率", target: 100, actual: 30 },
      ]);

      const alerts = await service.getActiveAlerts();

      // KPI alert should still fire even though document query threw
      const kpiAlert = alerts.find((a) => a.category === "kpi_critical");
      expect(kpiAlert).toBeDefined();
      // No verification-expired alerts (query failed silently — degraded)
      expect(alerts.some((a) => a.category === "verification_expired")).toBe(false);
    });
  });
});
