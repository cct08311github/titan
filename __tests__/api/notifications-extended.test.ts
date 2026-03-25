/**
 * @jest-environment node
 */
/**
 * Extended API route tests for notification endpoints — Issue #560 (TDD-6)
 *
 * Covers:
 *   - PATCH /api/notifications/[id]/read — single read, ownership check
 *   - POST  /api/notifications/generate  — Manager-only, notification creation
 *   - PATCH /api/notifications/read-all  — batch update, count reset
 *   - POST  /api/notifications/push      — stub returns disabled message
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockNotification = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  createMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: { notification: mockNotification },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// ── Service mocks ────────────────────────────────────────────────────────────
const mockGenerateAll = jest.fn();
jest.mock("@/services/notification-service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    generateAll: mockGenerateAll,
  })),
}));

const mockPushSend = jest.fn();
const mockPushIsAvailable = jest.fn();
jest.mock("@/lib/push-notification", () => ({
  getPushProvider: () => ({
    send: mockPushSend,
    isAvailable: mockPushIsAvailable,
  }),
}));

// ── Logger / infra mocks (prevent side effects) ─────────────────────────────
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/request-logger", () => ({
  requestLogger: (_req: unknown, fn: () => unknown) => fn(),
}));
jest.mock("@/lib/csrf", () => ({
  validateCsrf: jest.fn(),
  CsrfError: class CsrfError extends Error {},
}));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}),
  checkRateLimit: jest.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({ log: jest.fn() })),
}));

// ── Session fixtures ─────────────────────────────────────────────────────────
const MEMBER_SESSION = {
  user: { id: "user-1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};
const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

const MOCK_NOTIF = {
  id: "notif-1",
  userId: "user-1",
  type: "TASK_ASSIGNED",
  message: "You have a new task",
  isRead: false,
  createdAt: new Date("2024-01-01"),
};

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/[id]/read
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/notifications/[id]/read — extended", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockNotification.findUnique.mockResolvedValue(MOCK_NOTIF);
    mockNotification.update.mockResolvedValue({ ...MOCK_NOTIF, isRead: true });
  });

  it("marks own notification as read and returns updated record", async () => {
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(
      createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "notif-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRead).toBe(true);
  });

  it("rejects with 404 when notification belongs to another user (ownership check)", async () => {
    mockNotification.findUnique.mockResolvedValue({ ...MOCK_NOTIF, userId: "other-user" });
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(
      createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "notif-1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("rejects with 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(
      createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "notif-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when notification does not exist", async () => {
    mockNotification.findUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(
      createMockRequest("/api/notifications/notif-x/read", { method: "PATCH" }),
      { params: Promise.resolve({ id: "notif-x" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/notifications/generate
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/notifications/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGenerateAll.mockResolvedValue({ created: 3, skipped: 1 });
  });

  it("generates notifications when called by MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { POST } = await import("@/app/api/notifications/generate/route");
    const res = await POST(createMockRequest("/api/notifications/generate", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.created).toBe(3);
    expect(mockGenerateAll).toHaveBeenCalledTimes(1);
  });

  it("rejects non-MANAGER users with 403", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { POST } = await import("@/app/api/notifications/generate/route");
    const res = await POST(createMockRequest("/api/notifications/generate", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/notifications/generate/route");
    const res = await POST(createMockRequest("/api/notifications/generate", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/notifications/read-all", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockNotification.updateMany.mockResolvedValue({ count: 5 });
  });

  it("marks all unread notifications as read for the current user", async () => {
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.updatedCount).toBe(5);
    expect(mockNotification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: { isRead: true },
    });
  });

  it("returns 0 updated when no unread notifications exist", async () => {
    mockNotification.updateMany.mockResolvedValue({ count: 0 });
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updatedCount).toBe(0);
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/notifications/push
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/notifications/push", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockPushSend.mockResolvedValue({ success: true, messageId: "stub-123" });
    mockPushIsAvailable.mockReturnValue(false);
  });

  it("returns stub response with providerAvailable=false", async () => {
    const { POST } = await import("@/app/api/notifications/push/route");
    const res = await POST(
      createMockRequest("/api/notifications/push", {
        method: "POST",
        body: {
          recipients: [{ userId: "user-1" }],
          message: { title: "Test", body: "Hello" },
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.providerAvailable).toBe(false);
    expect(body.data.success).toBe(true);
  });

  it("rejects non-MANAGER users with 403", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { POST } = await import("@/app/api/notifications/push/route");
    const res = await POST(
      createMockRequest("/api/notifications/push", {
        method: "POST",
        body: {
          recipients: [{ userId: "user-1" }],
          message: { title: "Test", body: "Hello" },
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects requests with missing recipients (400)", async () => {
    const { POST } = await import("@/app/api/notifications/push/route");
    const res = await POST(
      createMockRequest("/api/notifications/push", {
        method: "POST",
        body: { recipients: [], message: { title: "Test", body: "Hello" } },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects requests with missing message fields (400)", async () => {
    const { POST } = await import("@/app/api/notifications/push/route");
    const res = await POST(
      createMockRequest("/api/notifications/push", {
        method: "POST",
        body: { recipients: [{ userId: "u1" }], message: { title: "" } },
      }),
    );
    expect(res.status).toBe(400);
  });
});
