import { UserService } from "../user-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

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
