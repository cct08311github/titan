import { UserService } from "../user-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";
import { JwtBlacklist } from "../../lib/jwt-blacklist";

describe("UserService", () => {
  let service: UserService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as never);
  });

  test("listUsers returns active users", async () => {
    const mockUsers = [{ id: "u1", name: "Alice", isActive: true }];
    (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

    const result = await service.listUsers({});

    expect(prisma.user.findMany).toHaveBeenCalled();
    expect(result).toEqual(mockUsers);
  });

  test("getUser throws NotFoundError for unknown id", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getUser("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("unsuspendUser removes user from JWT blacklist", async () => {
    const mockUser = { id: "u1", name: "Alice", email: "alice@example.com", role: "ENGINEER", isActive: false };
    const updatedUser = { ...mockUser, isActive: true };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    // Pre-populate the blacklist as suspendUser would do
    JwtBlacklist.add("user:u1");
    await expect(JwtBlacklist.has("user:u1")).resolves.toBe(true);

    await service.unsuspendUser("u1");

    // After unsuspend, the blacklist entry must be removed
    await expect(JwtBlacklist.has("user:u1")).resolves.toBe(false);

    // Cleanup
    JwtBlacklist.clear();
  });

  test("updateUser validates email uniqueness", async () => {
    const existing = { id: "u1", email: "alice@example.com" };
    const conflict = { id: "u2", email: "bob@example.com" };
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(conflict);

    await expect(
      service.updateUser("u1", { email: "bob@example.com" })
    ).rejects.toThrow(ValidationError);
  });
});
