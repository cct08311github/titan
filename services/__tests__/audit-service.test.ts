import { AuditService } from "../audit-service";
import { createMockPrisma } from "../../lib/test-utils";
import { ForbiddenError } from "../errors";

describe("AuditService", () => {
  let service: AuditService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AuditService(prisma as never);
  });

  // ─── log() ───────────────────────────────────────────────────────────────

  describe("log", () => {
    test("logs DELETE operations with required fields", async () => {
      const entry = {
        id: "audit-1",
        userId: "user-1",
        action: "DELETE_TASK",
        resourceType: "Task",
        resourceId: "task-1",
        detail: "Deleted task: Fix bug",
        ipAddress: "127.0.0.1",
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
      };
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(entry);

      const result = await service.log({
        userId: "user-1",
        action: "DELETE_TASK",
        resourceType: "Task",
        resourceId: "task-1",
        detail: "Deleted task: Fix bug",
        ipAddress: "127.0.0.1",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            action: "DELETE_TASK",
            resourceType: "Task",
            resourceId: "task-1",
            detail: "Deleted task: Fix bug",
            ipAddress: "127.0.0.1",
          }),
        })
      );
      expect(result).toEqual(entry);
    });

    test("logs role changes with userId, action, timestamp, and detail", async () => {
      const now = new Date("2026-03-24T00:00:00.000Z");
      const entry = {
        id: "audit-2",
        userId: "manager-1",
        action: "ROLE_CHANGE",
        resourceType: "User",
        resourceId: "user-2",
        detail: JSON.stringify({ from: "ENGINEER", to: "MANAGER" }),
        ipAddress: null,
        createdAt: now,
      };
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(entry);

      const result = await service.log({
        userId: "manager-1",
        action: "ROLE_CHANGE",
        resourceType: "User",
        resourceId: "user-2",
        detail: JSON.stringify({ from: "ENGINEER", to: "MANAGER" }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "manager-1",
            action: "ROLE_CHANGE",
            resourceType: "User",
            resourceId: "user-2",
          }),
        })
      );
      expect(result.action).toBe("ROLE_CHANGE");
      expect(result.createdAt).toBeDefined();
    });

    test("logs password changes", async () => {
      const entry = {
        id: "audit-3",
        userId: "manager-1",
        action: "PASSWORD_CHANGE",
        resourceType: "User",
        resourceId: "user-3",
        detail: "Password changed",
        ipAddress: "10.0.0.1",
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
      };
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(entry);

      const result = await service.log({
        userId: "manager-1",
        action: "PASSWORD_CHANGE",
        resourceType: "User",
        resourceId: "user-3",
        detail: "Password changed",
        ipAddress: "10.0.0.1",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PASSWORD_CHANGE",
            resourceType: "User",
            resourceId: "user-3",
          }),
        })
      );
      expect(result.action).toBe("PASSWORD_CHANGE");
    });

    test("logs login failures", async () => {
      const entry = {
        id: "audit-4",
        userId: null,
        action: "LOGIN_FAILURE",
        resourceType: "Auth",
        resourceId: null,
        detail: "Failed login attempt for bad@example.com",
        ipAddress: "203.0.113.1",
        createdAt: new Date("2026-03-24T00:00:00.000Z"),
      };
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(entry);

      const result = await service.log({
        userId: null,
        action: "LOGIN_FAILURE",
        resourceType: "Auth",
        resourceId: null,
        detail: "Failed login attempt for bad@example.com",
        ipAddress: "203.0.113.1",
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LOGIN_FAILURE",
            resourceType: "Auth",
          }),
        })
      );
      expect(result.action).toBe("LOGIN_FAILURE");
    });

    test("audit log entry includes userId, action, timestamp, and detail", async () => {
      const timestamp = new Date("2026-03-24T12:00:00.000Z");
      const entry = {
        id: "audit-5",
        userId: "user-1",
        action: "DELETE_TASK",
        resourceType: "Task",
        resourceId: "task-5",
        detail: "Task removed",
        ipAddress: null,
        createdAt: timestamp,
      };
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(entry);

      const result = await service.log({
        userId: "user-1",
        action: "DELETE_TASK",
        resourceType: "Task",
        resourceId: "task-5",
        detail: "Task removed",
      });

      // Must have userId
      expect(result.userId).toBe("user-1");
      // Must have action
      expect(result.action).toBe("DELETE_TASK");
      // Must have timestamp (server-side UTC)
      expect(result.createdAt).toBeInstanceOf(Date);
      // Must have detail
      expect(result.detail).toBe("Task removed");
    });
  });

  // ─── queryLogs() ─────────────────────────────────────────────────────────

  describe("queryLogs (read-only enforcement)", () => {
    test("audit log service has no update method", () => {
      // Audit logs must be read-only — no update exposed
      expect(typeof (service as unknown as Record<string, unknown>)["updateLog"]).toBe("undefined");
    });

    test("audit log service has no delete method", () => {
      // Audit logs must be read-only — no delete exposed
      expect(typeof (service as unknown as Record<string, unknown>)["deleteLog"]).toBe("undefined");
    });

    test("queryLogs is callable (returns array)", async () => {
      const entries = [
        {
          id: "audit-1",
          userId: "user-1",
          action: "DELETE_TASK",
          resourceType: "Task",
          resourceId: "task-1",
          detail: "x",
          ipAddress: null,
          createdAt: new Date(),
        },
      ];
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await service.queryLogs({ callerId: "mgr-1", callerRole: "MANAGER" });

      expect(prisma.auditLog.findMany).toHaveBeenCalled();
      expect(result).toEqual(entries);
    });

    test("only MANAGER can query audit logs — ENGINEER is rejected", async () => {
      await expect(
        service.queryLogs({ callerId: "eng-1", callerRole: "ENGINEER" })
      ).rejects.toThrow(ForbiddenError);

      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    test("queryLogs accepts optional filter by action", async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.queryLogs({
        callerId: "mgr-1",
        callerRole: "MANAGER",
        action: "DELETE_TASK",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: "DELETE_TASK" }),
        })
      );
    });

    test("queryLogs accepts optional filter by userId", async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.queryLogs({
        callerId: "mgr-1",
        callerRole: "MANAGER",
        userId: "user-99",
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-99" }),
        })
      );
    });

    test("queryLogs results are ordered by createdAt descending", async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.queryLogs({ callerId: "mgr-1", callerRole: "MANAGER" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });
});
