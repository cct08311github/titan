/**
 * RecurringService 測試
 * 驗證 generateTasks() 建立任務、maxBackfillDays 截止、跳過停用規則、以及 nextDueAt 更新
 */
import { RecurringService } from "../recurring-service";
import { createMockPrisma } from "../../lib/test-utils";

// Mock 工具函式避免依賴日期計算邏輯
jest.mock("@/lib/recurring-utils", () => ({
  calculateNextDueAt: jest.fn().mockReturnValue(new Date("2026-04-14T10:00:00Z")),
  resolveTitle: jest.fn().mockImplementation((title: string) => title),
  shouldGenerate: jest.fn().mockReturnValue(true),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { calculateNextDueAt, shouldGenerate } from "@/lib/recurring-utils";

// 建立含有 recurringRule 的擴充 mock prisma
function createExtendedMockPrisma() {
  const prisma = createMockPrisma() as ReturnType<typeof createMockPrisma> & {
    recurringRule: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  (prisma as Record<string, unknown>).recurringRule = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  return prisma;
}

const baseRule = {
  id: "rule-1",
  title: "每週例行備份",
  description: "自動備份資料庫",
  category: "ADMIN",
  priority: "P2",
  frequency: "WEEKLY",
  isActive: true,
  assigneeId: "user-1",
  creatorId: "user-admin",
  estimatedHours: 1,
  dayOfWeek: 1,
  dayOfMonth: null,
  monthOfYear: null,
  timeOfDay: "09:00",
  nextDueAt: new Date("2026-04-07T09:00:00Z"),
  lastGeneratedAt: null,
  templateId: null,
};

describe("RecurringService", () => {
  let service: RecurringService;
  let prisma: ReturnType<typeof createExtendedMockPrisma>;

  beforeEach(() => {
    prisma = createExtendedMockPrisma();
    service = new RecurringService(prisma as never);
    jest.clearAllMocks();

    // $transaction 預設透傳 callback
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );

    // 預設沒有超過 maxBackfillDays 的舊規則
    (prisma.recurringRule.count as jest.Mock).mockResolvedValue(0);
  });

  describe("generateTasks()", () => {
    test("到期的規則應建立任務並回傳生成數量", async () => {
      const now = new Date("2026-04-07T10:00:00Z");

      (prisma.recurringRule.findMany as jest.Mock).mockResolvedValue([baseRule]);
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: "task-new-1",
        title: "每週例行備份",
      });
      (prisma.recurringRule.update as jest.Mock).mockResolvedValue({
        ...baseRule,
        lastGeneratedAt: now,
        nextDueAt: new Date("2026-04-14T10:00:00Z"),
      });

      const result = await service.generateTasks(now);

      expect(result.generated).toBe(1);
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].ruleId).toBe("rule-1");
    });

    test("maxBackfillDays 截止：超過期限的規則不應被查詢", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const maxBackfillDays = 7;
      const expectedCutoff = new Date(
        now.getTime() - maxBackfillDays * 24 * 60 * 60 * 1000
      );

      (prisma.recurringRule.findMany as jest.Mock).mockResolvedValue([]);

      await service.generateTasks(now, maxBackfillDays);

      // 確認 findMany 的 where 條件包含 gte: backfillCutoff
      expect(prisma.recurringRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nextDueAt: expect.objectContaining({
              gte: expectedCutoff,
            }),
          }),
        })
      );
    });

    test("isActive=false 的規則不應被包含在查詢結果中", async () => {
      const now = new Date("2026-04-07T10:00:00Z");

      // findMany 只回傳 active 規則（inactive 的已被 where: isActive: true 過濾掉）
      (prisma.recurringRule.findMany as jest.Mock).mockResolvedValue([]);

      await service.generateTasks(now);

      expect(prisma.recurringRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    test("shouldGenerate 回傳 false 時不建立任務", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      (shouldGenerate as jest.Mock).mockReturnValueOnce(false);

      (prisma.recurringRule.findMany as jest.Mock).mockResolvedValue([baseRule]);

      const result = await service.generateTasks(now);

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    test("生成任務後應更新 nextDueAt", async () => {
      const now = new Date("2026-04-07T10:00:00Z");
      const expectedNext = new Date("2026-04-14T10:00:00Z");
      (calculateNextDueAt as jest.Mock).mockReturnValue(expectedNext);

      (prisma.recurringRule.findMany as jest.Mock).mockResolvedValue([baseRule]);
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: "task-new-1",
        title: "每週例行備份",
      });
      (prisma.recurringRule.update as jest.Mock).mockResolvedValue({});

      await service.generateTasks(now);

      expect(prisma.recurringRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rule-1" },
          data: expect.objectContaining({
            nextDueAt: expectedNext,
            lastGeneratedAt: now,
          }),
        })
      );
    });
  });
});
