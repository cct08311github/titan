/**
 * @jest-environment node
 */
/**
 * API route tests: /api/notifications and /api/notifications/[id]/read
 */
import { createMockRequest } from "../utils/test-utils";

const mockNotification = { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { notification: mockNotification } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "user-1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

const MOCK_NOTIF = {
  id: "notif-1",
  userId: "user-1",
  type: "TASK_ASSIGNED",
  message: "You have a new task",
  isRead: false,
  createdAt: new Date("2024-01-01"),
};

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockNotification.findMany.mockResolvedValue([MOCK_NOTIF]);
    mockNotification.count.mockResolvedValue(1);
  });

  it("returns notifications and unread count", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(createMockRequest("/api/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data.notifications).toHaveLength(1);
    expect(data.unreadCount).toBe(1);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(createMockRequest("/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("respects limit parameter", async () => {
    const { GET } = await import("@/app/api/notifications/route");
    await GET(createMockRequest("/api/notifications", { searchParams: { limit: "5" } }));
    expect(mockNotification.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it("returns empty notifications when none exist", async () => {
    mockNotification.findMany.mockResolvedValue([]);
    mockNotification.count.mockResolvedValue(0);
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(createMockRequest("/api/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data.unreadCount).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockNotification.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/notifications/route");
    const res = await GET(createMockRequest("/api/notifications"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/notifications/[id]/read", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockNotification.findUnique.mockResolvedValue(MOCK_NOTIF);
    mockNotification.update.mockResolvedValue({ ...MOCK_NOTIF, isRead: true });
  });

  it("marks notification as read", async () => {
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }), { params: { id: "notif-1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data.isRead).toBe(true);
  });

  it("returns 404 when notification not found", async () => {
    mockNotification.findUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(createMockRequest("/api/notifications/x/read", { method: "PATCH" }), { params: { id: "x" } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when notification belongs to different user", async () => {
    mockNotification.findUnique.mockResolvedValue({ ...MOCK_NOTIF, userId: "other" });
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }), { params: { id: "notif-1" } });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
    const res = await PATCH(createMockRequest("/api/notifications/notif-1/read", { method: "PATCH" }), { params: { id: "notif-1" } });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications/read-all", () => {
  const mockUpdateMany = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockUpdateMany.mockResolvedValue({ count: 3 });
    // Extend the mock to include updateMany
    (mockNotification as Record<string, jest.Mock>).updateMany = mockUpdateMany;
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read for the current user", async () => {
    mockUpdateMany.mockResolvedValue({ count: 5 });
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("updatedCount");
    expect(data.updatedCount).toBe(5);
  });

  it("only marks the authenticated user's notifications", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: SESSION.user.id }),
        data: expect.objectContaining({ isRead: true }),
      })
    );
  });

  it("returns updatedCount of 0 when no unread notifications exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data.updatedCount).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockUpdateMany.mockRejectedValue(new Error("DB error"));
    const { PATCH } = await import("@/app/api/notifications/read-all/route");
    const res = await PATCH(createMockRequest("/api/notifications/read-all", { method: "PATCH" }));
    expect(res.status).toBe(500);
  });
});
