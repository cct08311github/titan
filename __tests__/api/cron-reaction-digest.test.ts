/**
 * @jest-environment node
 */
/**
 * API: POST /api/cron/reaction-digest — Issue #1520.
 *
 * Covers:
 *  - 24h reaction window aggregation per recipient
 *  - Self-reactions are filtered
 *  - Per-day idempotency (skip recipients who already got today's digest)
 *  - NotificationPreference opt-out is honored
 *  - Empty input → no notifications, no errors
 *  - Redis lock is acquired + released
 */

jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

const verifyCronSecret = jest.fn();
jest.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: () => verifyCronSecret(),
}));

const redisInstance = {
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
};
jest.mock("@/lib/redis", () => ({
  getRedisClient: () => redisInstance,
}));

jest.mock("@/lib/notification-publisher", () => ({
  publishNotifications: jest.fn(),
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    reaction: { findMany: jest.fn() },
    taskComment: { findMany: jest.fn() },
    documentComment: { findMany: jest.fn() },
    taskActivity: { findMany: jest.fn() },
    notification: { findMany: jest.fn(), create: jest.fn() },
    notificationPreference: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };
  return { prisma: mock };
});

import { POST } from "@/app/api/cron/reaction-digest/route";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as {
  reaction: { findMany: jest.Mock };
  taskComment: { findMany: jest.Mock };
  documentComment: { findMany: jest.Mock };
  taskActivity: { findMany: jest.Mock };
  notification: { findMany: jest.Mock; create: jest.Mock };
  notificationPreference: { findMany: jest.Mock };
  user: { findMany: jest.Mock };
};

function call() {
  // Minimal NextRequest stub for verifyCronSecret + apiHandler signature.
  const req = {
    url: "http://localhost/api/cron/reaction-digest",
    method: "POST",
    headers: new Headers(),
    json: async () => ({}),
  } as unknown as import("next/server").NextRequest;
  return POST(req, { params: Promise.resolve({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  verifyCronSecret.mockReturnValue(null); // null = auth ok
  redisInstance.set.mockResolvedValue("OK");
  prismaMock.reaction.findMany.mockResolvedValue([]);
  prismaMock.taskComment.findMany.mockResolvedValue([]);
  prismaMock.documentComment.findMany.mockResolvedValue([]);
  prismaMock.taskActivity.findMany.mockResolvedValue([]);
  prismaMock.notification.findMany.mockResolvedValue([]);
  prismaMock.notificationPreference.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: `n-${data.userId as string}`,
      isRead: false,
      createdAt: new Date(),
      ...data,
    })
  );
});

describe("POST /api/cron/reaction-digest", () => {
  it("returns 0 inserted when no reactions in window", async () => {
    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("groups by recipient + emoji and creates one Notification per recipient", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "tc1", emoji: "👍" },
      { userId: "bob", targetType: "TASK_COMMENT", targetId: "tc1", emoji: "👍" },
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "tc2", emoji: "❤️" },
    ]);
    prismaMock.taskComment.findMany.mockResolvedValue([
      { id: "tc1", userId: "owner1" },
      { id: "tc2", userId: "owner2" },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ]);

    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(2);
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    const calls = prismaMock.notification.create.mock.calls.map(
      ([arg]: [{ data: { userId: string; body: string } }]) => arg.data
    );
    const owner1 = calls.find((c: { userId: string }) => c.userId === "owner1");
    expect(owner1).toBeDefined();
    expect(owner1.body).toContain("👍");
    expect(owner1.body).toContain("Alice");
    expect(owner1.body).toContain("Bob");
  });

  it("filters self-reactions", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      // alice reacts to her own comment — should be ignored
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "tc1", emoji: "👍" },
    ]);
    prismaMock.taskComment.findMany.mockResolvedValue([
      { id: "tc1", userId: "alice" },
    ]);

    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(0);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("skips recipients who already received today's digest", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "tc1", emoji: "👍" },
    ]);
    prismaMock.taskComment.findMany.mockResolvedValue([
      { id: "tc1", userId: "owner1" },
    ]);
    prismaMock.notification.findMany.mockResolvedValue([{ userId: "owner1" }]);
    prismaMock.user.findMany.mockResolvedValue([{ id: "alice", name: "Alice" }]);

    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(0);
    expect(body.data.skipped_already_sent).toBe(1);
  });

  it("respects NotificationPreference opt-out", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "tc1", emoji: "👍" },
      { userId: "bob", targetType: "TASK_COMMENT", targetId: "tc2", emoji: "👍" },
    ]);
    prismaMock.taskComment.findMany.mockResolvedValue([
      { id: "tc1", userId: "owner1" },
      { id: "tc2", userId: "owner2" },
    ]);
    prismaMock.notificationPreference.findMany.mockResolvedValue([{ userId: "owner1" }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ]);

    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "owner2" }) })
    );
  });

  it("acquires + releases the redis lock", async () => {
    await call();
    expect(redisInstance.set).toHaveBeenCalledWith(
      "cron:reaction-digest:lock",
      "1",
      "EX",
      300,
      "NX"
    );
    expect(redisInstance.del).toHaveBeenCalledWith("cron:reaction-digest:lock");
  });

  it("skips entire run when redis lock is already held", async () => {
    redisInstance.set.mockResolvedValueOnce(null); // SET NX fails
    const res = await call();
    const body = await res.json();
    expect(body.data.skipped).toBe(true);
    expect(prismaMock.reaction.findMany).not.toHaveBeenCalled();
  });

  it("drops reactions whose target row has been deleted", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      { userId: "alice", targetType: "TASK_COMMENT", targetId: "ghost", emoji: "👍" },
    ]);
    // taskComment.findMany returns no row for "ghost"
    prismaMock.taskComment.findMany.mockResolvedValue([]);

    const res = await call();
    const body = await res.json();
    expect(body.data.inserted).toBe(0);
  });
});
