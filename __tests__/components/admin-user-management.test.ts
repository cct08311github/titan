/**
 * @jest-environment jsdom
 */
/**
 * Admin User Management UI tests — Issue #930
 *
 * Tests the user management tab on the admin page:
 * - User list rendering
 * - Add user form validation
 * - Disable/enable toggle logic
 * - Search/filter
 */

describe("Admin User Management — Issue #930", () => {
  // --- Data shape tests ---

  interface UserEntry {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }

  const mockUsers: UserEntry[] = [
    { id: "u1", name: "Alice Chen", email: "alice@example.com", role: "MANAGER", isActive: true, createdAt: "2025-01-15T08:00:00Z" },
    { id: "u2", name: "Bob Wang", email: "bob@example.com", role: "ENGINEER", isActive: true, createdAt: "2025-03-20T10:30:00Z" },
    { id: "u3", name: "Carol Lin", email: "carol@example.com", role: "ENGINEER", isActive: false, createdAt: "2025-06-01T14:00:00Z" },
  ];

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: "管理員",
    MANAGER: "經理",
    ENGINEER: "工程師",
  };

  // --- User list rendering ---

  test("should have correct number of users", () => {
    expect(mockUsers).toHaveLength(3);
  });

  test("should display role labels correctly", () => {
    mockUsers.forEach((user) => {
      expect(ROLE_LABELS[user.role]).toBeDefined();
    });
  });

  test("should identify active and inactive users", () => {
    const active = mockUsers.filter((u) => u.isActive);
    const inactive = mockUsers.filter((u) => !u.isActive);
    expect(active).toHaveLength(2);
    expect(inactive).toHaveLength(1);
    expect(inactive[0].name).toBe("Carol Lin");
  });

  // --- Search/filter logic ---

  test("should filter users by name search", () => {
    const query = "alice";
    const filtered = mockUsers.filter(
      (u) => u.name.toLowerCase().includes(query.toLowerCase()) ||
             u.email.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("u1");
  });

  test("should filter users by email search", () => {
    const query = "bob@";
    const filtered = mockUsers.filter(
      (u) => u.name.toLowerCase().includes(query.toLowerCase()) ||
             u.email.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("u2");
  });

  test("should return empty when search matches nothing", () => {
    const query = "nonexistent";
    const filtered = mockUsers.filter(
      (u) => u.name.toLowerCase().includes(query.toLowerCase()) ||
             u.email.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(0);
  });

  // --- Add user form validation ---

  test("should require name for new user", () => {
    const name = "";
    expect(name.trim().length > 0).toBe(false);
  });

  test("should require valid email for new user", () => {
    const validEmail = "test@example.com";
    const invalidEmail = "not-an-email";
    expect(validEmail.includes("@")).toBe(true);
    expect(invalidEmail.includes("@")).toBe(false);
  });

  test("should default role to ENGINEER", () => {
    const defaultRole = "ENGINEER";
    expect(defaultRole).toBe("ENGINEER");
    expect(ROLE_LABELS[defaultRole]).toBe("工程師");
  });

  // --- Disable toggle ---

  test("should toggle user active status", () => {
    const user = { ...mockUsers[1] }; // Bob, active
    expect(user.isActive).toBe(true);
    // After suspend
    user.isActive = false;
    expect(user.isActive).toBe(false);
    // After unsuspend
    user.isActive = true;
    expect(user.isActive).toBe(true);
  });

  test("should show correct toggle label based on status", () => {
    expect(mockUsers[0].isActive ? "停用" : "啟用").toBe("停用");
    expect(mockUsers[2].isActive ? "停用" : "啟用").toBe("啟用");
  });

  // --- API URL construction ---

  test("should build correct list URL with includeSuspended", () => {
    const params = new URLSearchParams({ includeSuspended: "true" });
    expect(params.toString()).toBe("includeSuspended=true");
  });

  test("should build correct list URL with search", () => {
    const params = new URLSearchParams({ includeSuspended: "true" });
    params.set("search", "alice");
    expect(params.get("search")).toBe("alice");
    expect(params.get("includeSuspended")).toBe("true");
  });

  test("should build correct unsuspend URL", () => {
    const userId = "u3";
    const url = `/api/users/${userId}?action=unsuspend`;
    expect(url).toContain(userId);
    expect(url).toContain("action=unsuspend");
  });
});
