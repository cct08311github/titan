/**
 * Tests for activity-logger service (Issue #802 AF-1)
 */
import { createMockPrisma } from "../../lib/test-utils";

// Mock prisma singleton before importing the module
jest.mock("@/lib/prisma", () => ({
  prisma: createMockPrisma(),
}));

// Mock logger to suppress output in tests
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { logActivity, queryActivityLogs, ActivityAction, ActivityModule } from "../activity-logger";
import { prisma } from "@/lib/prisma";

describe("activity-logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logActivity", () => {
    it("creates an audit log entry with correct fields", async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: "log-1" });

      await logActivity({
        userId: "user-1",
        action: ActivityAction.CREATE,
        module: ActivityModule.KANBAN,
        targetType: "Task",
        targetId: "task-1",
        metadata: { title: "新任務" },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            action: "CREATE",
            module: "KANBAN",
            resourceType: "Task",
            resourceId: "task-1",
          }),
        })
      );
    });

    it("does not throw when prisma.auditLog.create fails", async () => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error("DB error"));

      // Should not throw — fire-and-forget pattern
      await expect(
        logActivity({
          userId: "user-1",
          action: ActivityAction.LOGIN,
          module: ActivityModule.AUTH,
        })
      ).resolves.toBeUndefined();
    });

    it("handles null userId gracefully", async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: "log-2" });

      await logActivity({
        userId: null,
        action: ActivityAction.LOGIN_FAILURE,
        module: ActivityModule.AUTH,
        ipAddress: "192.168.1.1",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            action: "LOGIN_FAILURE",
          }),
        })
      );
    });
  });

  describe("queryActivityLogs", () => {
    it("returns paginated results with correct structure", async () => {
      const mockLogs = [{ id: "log-1", action: "CREATE", module: "KANBAN" }];
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await queryActivityLogs({ page: 1, limit: 10 });

      expect(result.items).toEqual(mockLogs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("filters by userId and module when provided", async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await queryActivityLogs({ userId: "user-1", module: "AUTH" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1", module: "AUTH" }),
        })
      );
    });

    it("caps limit at 100 and enforces minimum page of 1", async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      const result = await queryActivityLogs({ page: -5, limit: 9999 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
    });
  });
});
