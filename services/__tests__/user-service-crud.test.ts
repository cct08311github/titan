import { UserService } from "../user-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("UserService CRUD", () => {
  let service: UserService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as never);
  });

  // ─── createUser ───────────────────────────────────────────────────────────

  test("createUser creates with hashed password", async () => {
    const mockUser = {
      id: "u1",
      name: "Alice",
      email: "alice@example.com",
      role: "ENGINEER",
      avatar: null,
      isActive: true,
      createdAt: new Date(),
    };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.createUser({
      name: "Alice",
      email: "alice@example.com",
      password: "securepassword123",
      role: "ENGINEER",
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Alice",
          email: "alice@example.com",
          // password stored as hash, not plaintext
          password: expect.not.stringContaining("securepassword123"),
        }),
      })
    );
    // returned user must not include password
    expect(result).not.toHaveProperty("password");
    expect(result).toMatchObject({ id: "u1", name: "Alice" });
  });

  test("createUser rejects duplicate email", async () => {
    const existing = { id: "u2", email: "alice@example.com" };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existing);

    await expect(
      service.createUser({
        name: "Alice Clone",
        email: "alice@example.com",
        password: "securepassword123",
      })
    ).rejects.toThrow(ValidationError);
  });

  test("createUser validates required fields", async () => {
    await expect(
      // @ts-expect-error intentionally missing required fields
      service.createUser({ email: "alice@example.com", password: "pass1234" })
    ).rejects.toThrow(ValidationError);

    await expect(
      // @ts-expect-error intentionally missing required fields
      service.createUser({ name: "Alice", password: "pass1234" })
    ).rejects.toThrow(ValidationError);
  });

  // ─── updateUser ───────────────────────────────────────────────────────────

  test("updateUser updates name and role", async () => {
    const existing = { id: "u1", email: "alice@example.com", name: "Alice" };
    const updated = { id: "u1", name: "Alice Updated", role: "MANAGER", email: "alice@example.com" };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.user.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateUser("u1", { name: "Alice Updated", role: "MANAGER" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ name: "Alice Updated", role: "MANAGER" }),
      })
    );
    expect(result).toMatchObject({ name: "Alice Updated", role: "MANAGER" });
  });

  test("updateUser can change password", async () => {
    const existing = { id: "u1", email: "alice@example.com", password: "oldhash" };
    const updated = { id: "u1", email: "alice@example.com" };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.user.update as jest.Mock).mockResolvedValue(updated);

    await service.updateUser("u1", { password: "newpassword123" });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // must store hash not plaintext
          password: expect.not.stringContaining("newpassword123"),
        }),
      })
    );
  });

  test("updateUser rejects duplicate email", async () => {
    const existing = { id: "u1", email: "alice@example.com" };
    const conflict = { id: "u2", email: "bob@example.com" };
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(conflict);

    await expect(
      service.updateUser("u1", { email: "bob@example.com" })
    ).rejects.toThrow(ValidationError);
  });

  // ─── suspendUser / unsuspendUser ──────────────────────────────────────────

  test("suspendUser sets isActive false", async () => {
    const existing = { id: "u1", email: "alice@example.com", isActive: true };
    const suspended = { id: "u1", isActive: false };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.user.update as jest.Mock).mockResolvedValue(suspended);

    const result = await service.suspendUser("u1");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ isActive: false }),
      })
    );
    expect(result).toMatchObject({ isActive: false });
  });

  test("unsuspendUser sets isActive true", async () => {
    const existing = { id: "u1", email: "alice@example.com", isActive: false };
    const restored = { id: "u1", isActive: true };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.user.update as jest.Mock).mockResolvedValue(restored);

    const result = await service.unsuspendUser("u1");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ isActive: true }),
      })
    );
    expect(result).toMatchObject({ isActive: true });
  });

  // ─── getUser ──────────────────────────────────────────────────────────────

  test("getUser returns user without password", async () => {
    const mockUser = {
      id: "u1",
      name: "Alice",
      email: "alice@example.com",
      role: "ENGINEER",
      avatar: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.getUser("u1");

    expect(result).not.toHaveProperty("password");
    expect(result).toMatchObject({ id: "u1", name: "Alice" });
  });

  // ─── listUsers ────────────────────────────────────────────────────────────

  test("listUsers excludes suspended by default", async () => {
    const activeUsers = [{ id: "u1", name: "Alice", isActive: true }];
    (prisma.user.findMany as jest.Mock).mockResolvedValue(activeUsers);

    await service.listUsers({});

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  test("listUsers includes suspended when requested", async () => {
    const allUsers = [
      { id: "u1", name: "Alice", isActive: true },
      { id: "u2", name: "Bob", isActive: false },
    ];
    (prisma.user.findMany as jest.Mock).mockResolvedValue(allUsers);

    const result = await service.listUsers({ includeSuspended: true });

    // When includeSuspended is true, isActive filter should NOT be applied
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ isActive: true }),
      })
    );
    expect(result).toHaveLength(2);
  });
});
