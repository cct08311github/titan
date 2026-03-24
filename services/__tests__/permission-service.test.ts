import { PermissionService } from "../permission-service";
import { createMockPrisma } from "../../lib/test-utils";
import { ValidationError } from "../errors";

describe("PermissionService", () => {
  let service: PermissionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PermissionService(prisma as never);
  });

  test("grantPermission creates permission record", async () => {
    const mockPermission = {
      id: "perm-1",
      granteeId: "user-1",
      granterId: "manager-1",
      permType: "VIEW_TEAM",
      targetId: null,
      expiresAt: null,
      isActive: true,
      createdAt: new Date(),
    };
    (prisma.permission.create as jest.Mock).mockResolvedValue(mockPermission);

    const result = await service.grantPermission({
      granteeId: "user-1",
      granterId: "manager-1",
      permType: "VIEW_TEAM",
    });

    expect(prisma.permission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          granteeId: "user-1",
          granterId: "manager-1",
          permType: "VIEW_TEAM",
          isActive: true,
        }),
      })
    );
    expect(result).toEqual(mockPermission);
  });

  test("revokePermission removes permission", async () => {
    (prisma.permission.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.revokePermission({ granteeId: "user-1", permType: "VIEW_TEAM" });

    expect(prisma.permission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          granteeId: "user-1",
          permType: "VIEW_TEAM",
        }),
        data: { isActive: false },
      })
    );
  });

  test("listPermissions returns all for a user", async () => {
    const mockPerms = [
      { id: "perm-1", granteeId: "user-1", permType: "VIEW_TEAM", isActive: true },
      { id: "perm-2", granteeId: "user-1", permType: "VIEW_TEAM", isActive: false },
    ];
    (prisma.permission.findMany as jest.Mock).mockResolvedValue(mockPerms);

    const result = await service.listPermissions({ granteeId: "user-1" });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ granteeId: "user-1" }),
      })
    );
    expect(result).toEqual(mockPerms);
  });

  test("hasPermission returns true when granted", async () => {
    const mockPerm = {
      id: "perm-1",
      granteeId: "user-1",
      permType: "VIEW_TEAM",
      isActive: true,
      expiresAt: null,
    };
    (prisma.permission.findFirst as jest.Mock).mockResolvedValue(mockPerm);

    const result = await service.hasPermission("user-1", "VIEW_TEAM");

    expect(result).toBe(true);
  });

  test("hasPermission returns false when not granted", async () => {
    (prisma.permission.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.hasPermission("user-1", "VIEW_TEAM");

    expect(result).toBe(false);
  });

  test("manager always has all permissions", async () => {
    const mockUser = { id: "manager-1", role: "MANAGER" };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.hasPermissionForUser("manager-1", "VIEW_TEAM");

    expect(prisma.permission.findFirst).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test("grantPermission rejects invalid scope", async () => {
    await expect(
      service.grantPermission({
        granteeId: "user-1",
        granterId: "manager-1",
        permType: "INVALID_SCOPE",
      })
    ).rejects.toThrow(ValidationError);
  });
});
