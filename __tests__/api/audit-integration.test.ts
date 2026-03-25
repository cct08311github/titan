/**
 * @jest-environment node
 */
/**
 * Tests: AuditService integration in route handlers — Issue #275
 *
 * Verifies that P0 security events produce audit log entries
 * with correct fields (userId, action, resourceType, resourceId, ipAddress).
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mocks ────────────────────────────────────────────────────────────────
const mockAuditLog = { create: jest.fn() };
const mockUser = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
  createMany: jest.fn(),
};
const mockTask = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
  createMany: jest.fn(),
};
const mockDocument = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
  createMany: jest.fn(),
};
const mockPermission = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  updateMany: jest.fn(),
  createMany: jest.fn(),
};
const mockTaskChange = { create: jest.fn() };
const mockTaskActivity = { create: jest.fn() };
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockUser,
    task: mockTask,
    document: mockDocument,
    permission: mockPermission,
    auditLog: mockAuditLog,
    taskChange: mockTaskChange,
    taskActivity: mockTaskActivity,
    $transaction: mockTransaction,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Session fixtures ─────────────────────────────────────────────────────
const MANAGER_SESSION = {
  user: { id: "manager-1", name: "Manager", email: "mgr@test.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ── Helpers ──────────────────────────────────────────────────────────────
function createRequestWithIp(
  url: string,
  options?: { method?: string; body?: unknown; searchParams?: Record<string, string> }
) {
  const req = createMockRequest(url, options);
  // Add x-forwarded-for header
  (req.headers as Headers).set("x-forwarded-for", "203.0.113.50");
  return req;
}

// ── POST /api/users (CREATE_USER) ────────────────────────────────────────
describe("POST /api/users — audit CREATE_USER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates audit log entry after creating a user", async () => {
    const newUser = { id: "user-new", name: "New User", email: "new@test.com", role: "ENGINEER" };
    mockUser.findUnique.mockResolvedValue(null); // for duplicate check
    mockUser.create.mockResolvedValue(newUser);

    const { POST } = await import("@/app/api/users/route");
    const req = createRequestWithIp("/api/users", {
      method: "POST",
      body: { name: "New User", email: "new@test.com", password: "SecureP@ss1!", role: "ENGINEER" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "CREATE_USER",
          resourceType: "User",
          resourceId: "user-new",
          ipAddress: "203.0.113.50",
        }),
      })
    );
  });

  it("does NOT log password in audit detail", async () => {
    const newUser = { id: "user-new", name: "New User", email: "new@test.com", role: "ENGINEER" };
    mockUser.findUnique.mockResolvedValue(null);
    mockUser.create.mockResolvedValue(newUser);

    const { POST } = await import("@/app/api/users/route");
    const req = createRequestWithIp("/api/users", {
      method: "POST",
      body: { name: "New User", email: "new@test.com", password: "SecureP@ss1!", role: "ENGINEER" },
    });
    await POST(req);

    const auditDetail = (mockAuditLog.create as jest.Mock).mock.calls[0]?.[0]?.data?.detail;
    expect(auditDetail).not.toContain("SecureP@ss1!");
    // The field name "password" may appear in change tracking with redacted values
    // but the actual password value must never be logged
    expect(auditDetail).not.toContain("NewSecret123!");
  });
});

// ── PUT /api/users/[id] (UPDATE_USER) ────────────────────────────────────
describe("PUT /api/users/[id] — audit UPDATE_USER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-2" });
  });

  it("creates audit log entry after updating a user", async () => {
    const updated = { id: "user-1", name: "Updated", email: "u@test.com", role: "ENGINEER" };
    mockUser.findUnique.mockResolvedValue(updated);
    mockUser.update.mockResolvedValue(updated);

    const { PUT } = await import("@/app/api/users/[id]/route");
    const req = createRequestWithIp("/api/users/user-1", {
      method: "PUT",
      body: { name: "Updated" },
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "user-1" }) });

    expect(res.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "UPDATE_USER",
          resourceType: "User",
          resourceId: "user-1",
          ipAddress: "203.0.113.50",
        }),
      })
    );
  });

  it("excludes password from audit detail on user update", async () => {
    const updated = { id: "user-1", name: "U", email: "u@test.com", role: "ENGINEER" };
    mockUser.findUnique.mockResolvedValue(updated);
    mockUser.update.mockResolvedValue(updated);

    const { PUT } = await import("@/app/api/users/[id]/route");
    const req = createRequestWithIp("/api/users/user-1", {
      method: "PUT",
      body: { name: "U", password: "NewSecret123!" },
    });
    await PUT(req, { params: Promise.resolve({ id: "user-1" }) });

    const auditDetail = (mockAuditLog.create as jest.Mock).mock.calls[0]?.[0]?.data?.detail;
    expect(auditDetail).not.toContain("NewSecret123!");
    // The field name "password" may appear in change tracking with redacted values
    // but the actual password value must never be logged
    expect(auditDetail).not.toContain("NewSecret123!");
  });
});

// ── DELETE /api/users/[id] (SUSPEND_USER) ────────────────────────────────
describe("DELETE /api/users/[id] — audit SUSPEND_USER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-3" });
  });

  it("creates audit log for suspend", async () => {
    mockUser.findUnique.mockResolvedValue({ id: "user-1", isSuspended: false });
    mockUser.update.mockResolvedValue({ id: "user-1", isSuspended: true });

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = createRequestWithIp("/api/users/user-1", { method: "DELETE" });
    await DELETE(req, { params: Promise.resolve({ id: "user-1" }) });

    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SUSPEND_USER",
          resourceType: "User",
          resourceId: "user-1",
        }),
      })
    );
  });

  it("creates audit log for unsuspend", async () => {
    mockUser.findUnique.mockResolvedValue({ id: "user-1", isSuspended: true });
    mockUser.update.mockResolvedValue({ id: "user-1", isSuspended: false });

    const { DELETE } = await import("@/app/api/users/[id]/route");
    const req = createRequestWithIp("/api/users/user-1?action=unsuspend", {
      method: "DELETE",
      searchParams: { action: "unsuspend" },
    });
    await DELETE(req, { params: Promise.resolve({ id: "user-1" }) });

    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UNSUSPEND_USER",
          resourceType: "User",
          resourceId: "user-1",
        }),
      })
    );
  });
});

// ── POST /api/permissions (GRANT_PERMISSION) ─────────────────────────────
describe("POST /api/permissions — audit GRANT_PERMISSION", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-4" });
  });

  it("creates audit log after granting permission", async () => {
    const perm = { id: "perm-1", granteeId: "user-2", permType: "VIEW_TEAM" };
    mockPermission.create.mockResolvedValue(perm);

    const { POST } = await import("@/app/api/permissions/route");
    const req = createRequestWithIp("/api/permissions", {
      method: "POST",
      body: { granteeId: "user-2", permType: "VIEW_TEAM" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "GRANT_PERMISSION",
          resourceType: "Permission",
          resourceId: "perm-1",
          ipAddress: "203.0.113.50",
        }),
      })
    );
  });
});

// ── DELETE /api/permissions (REVOKE_PERMISSION) ──────────────────────────
describe("DELETE /api/permissions — audit REVOKE_PERMISSION", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-5" });
  });

  it("creates audit log after revoking permission", async () => {
    mockPermission.updateMany.mockResolvedValue({ count: 1 });

    const { DELETE } = await import("@/app/api/permissions/route");
    const req = createRequestWithIp("/api/permissions", {
      method: "DELETE",
      body: { granteeId: "user-2", permType: "VIEW_TEAM" },
    });
    await DELETE(req);

    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "REVOKE_PERMISSION",
          resourceType: "Permission",
        }),
      })
    );
  });
});

// ── DELETE /api/tasks/[id] (DELETE_TASK) ─────────────────────────────────
describe("DELETE /api/tasks/[id] — audit DELETE_TASK", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-6" });
  });

  it("creates audit log after deleting a task", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1", title: "Test" });
    mockTask.delete.mockResolvedValue({ id: "task-1" });

    const { DELETE } = await import("@/app/api/tasks/[id]/route");
    const req = createRequestWithIp("/api/tasks/task-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "task-1" }) });

    expect(res.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "DELETE_TASK",
          resourceType: "Task",
          resourceId: "task-1",
          ipAddress: "203.0.113.50",
        }),
      })
    );
  });
});

// ── DELETE /api/documents/[id] (DELETE_DOCUMENT) ─────────────────────────
describe("DELETE /api/documents/[id] — audit DELETE_DOCUMENT", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockAuditLog.create.mockResolvedValue({ id: "audit-7" });
  });

  it("creates audit log after deleting a document", async () => {
    mockDocument.findUnique.mockResolvedValue({ id: "doc-1", title: "Test" });
    mockDocument.delete.mockResolvedValue({ id: "doc-1" });

    const { DELETE } = await import("@/app/api/documents/[id]/route");
    const req = createRequestWithIp("/api/documents/doc-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(200);
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "manager-1",
          action: "DELETE_DOCUMENT",
          resourceType: "Document",
          resourceId: "doc-1",
          ipAddress: "203.0.113.50",
        }),
      })
    );
  });
});
