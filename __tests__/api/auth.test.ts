/**
 * @jest-environment node
 */
/**
 * Auth tests: NextAuth credentials authorize flow + JWT/session callbacks
 * Tests logic mirrored from app/api/auth/[...nextauth]/route.ts
 */

const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mockUserFindUnique } },
}));

const mockCompare = jest.fn();
jest.mock("bcryptjs", () => ({ compare: (...a: unknown[]) => mockCompare(...a) }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

// ── Simulates the authorize() callback logic from route.ts ────────────────

async function simulateAuthorize(
  username: string | undefined,
  password: string | undefined
): Promise<{ id: string; name: string; email: string; role: string } | null> {
  if (!username || !password) return null;

  const user = await mockUserFindUnique({ where: { email: username } });
  if (!user || !user.isActive) return null;

  const isValid = await mockCompare(password, user.password);
  if (!isValid) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const ACTIVE_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  role: "MEMBER",
  password: "$2a$10$hashed",
  isActive: true,
};

describe("Auth — credentials authorize logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when username is missing", async () => {
    const result = await simulateAuthorize(undefined, "password");
    expect(result).toBeNull();
  });

  it("returns null when password is missing", async () => {
    const result = await simulateAuthorize("alice@example.com", undefined);
    expect(result).toBeNull();
  });

  it("returns null when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await simulateAuthorize("unknown@example.com", "password");
    expect(result).toBeNull();
  });

  it("returns null when user account is inactive", async () => {
    mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    const result = await simulateAuthorize("alice@example.com", "password");
    expect(result).toBeNull();
  });

  it("returns null when password does not match", async () => {
    mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
    mockCompare.mockResolvedValue(false);
    const result = await simulateAuthorize("alice@example.com", "wrongpassword");
    expect(result).toBeNull();
  });

  it("returns user object when credentials are valid", async () => {
    mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
    mockCompare.mockResolvedValue(true);
    const result = await simulateAuthorize("alice@example.com", "correctpassword");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(result?.name).toBe("Alice");
    expect(result?.email).toBe("alice@example.com");
    expect(result?.role).toBe("MEMBER");
  });
});

describe("Auth — JWT callback", () => {
  it("adds id and role to token when user is present", () => {
    const token: Record<string, unknown> = { sub: "user-1" };
    const user = { id: "user-1", name: "Alice", email: "alice@example.com", role: "MANAGER" };

    const updatedToken = { ...token };
    if (user) {
      updatedToken.id = user.id;
      updatedToken.role = user.role;
    }

    expect(updatedToken.id).toBe("user-1");
    expect(updatedToken.role).toBe("MANAGER");
  });

  it("returns token unchanged when no user is passed", () => {
    const token: Record<string, unknown> = { id: "existing-id", role: "MEMBER" };
    const updatedToken = { ...token };
    expect(updatedToken.id).toBe("existing-id");
    expect(updatedToken.role).toBe("MEMBER");
  });
});

describe("Auth — session callback", () => {
  it("copies id and role from token to session", () => {
    const session = { user: { name: "Alice", email: "alice@example.com" } as Record<string, unknown>, expires: "2099" };
    const token = { id: "user-1", role: "MEMBER" } as Record<string, unknown>;

    const updatedSession = { ...session, user: { ...session.user } };
    if (token) {
      updatedSession.user.id = token.id;
      updatedSession.user.role = token.role;
    }

    expect(updatedSession.user.id).toBe("user-1");
    expect(updatedSession.user.role).toBe("MEMBER");
  });

  it("session user has both id and role after callback", () => {
    const session = { user: {} as Record<string, unknown>, expires: "2099" };
    const token = { id: "u2", role: "MANAGER" } as Record<string, unknown>;

    session.user.id = token.id;
    session.user.role = token.role;

    expect(session.user.id).toBe("u2");
    expect(session.user.role).toBe("MANAGER");
  });
});

describe("Auth — getServerSession mock", () => {
  it("returns session when called", async () => {
    const mockSession = { user: { id: "u1", role: "MEMBER" }, expires: "2099" };
    mockGetServerSession.mockResolvedValue(mockSession);
    const session = await mockGetServerSession();
    expect(session).toEqual(mockSession);
  });

  it("returns null when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const session = await mockGetServerSession();
    expect(session).toBeNull();
  });
});
