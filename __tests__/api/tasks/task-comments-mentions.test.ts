/**
 * @jest-environment node
 */
/**
 * API: POST /api/tasks/[id]/comments — @mention notification wiring (Issue #1506).
 *
 * Verifies:
 *  - Comment create still succeeds when no mentions supplied
 *  - Mentioned active users receive Notification rows (type = MENTION)
 *  - Self-mentions are dropped
 *  - Duplicate userIds are deduplicated
 *  - Deactivated users are silently dropped (no Notification row)
 *  - Users who opted out of MENTION NotificationPreference are skipped
 *  - Redis publish failure does not rollback the comment (SSE best-effort)
 */
import { createMockRequest } from "../../utils/test-utils";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => new Map()),
  cookies: jest.fn(() => ({ get: jest.fn() })),
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/rbac", () => ({
  requireAuth: () => mockRequireAuth(),
  requireRole: jest.fn(),
  requireManagerOrAbove: jest.fn(),
  enforcePasswordChange: jest.fn(),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

// jest.mock() is hoisted above top-level `const` declarations. Build the
// mocks lazily inside the factory so we can still reference them later
// via a shared registry.
jest.mock("@/lib/prisma", () => {
  const mock = {
    task: { findUnique: jest.fn() },
    taskComment: { create: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    notificationPreference: { findMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mock)),
  };
  return { prisma: mock };
});

jest.mock("@/lib/notification-publisher", () => ({
  publishNotifications: jest.fn(),
}));

jest.mock("@/services/activity-logger", () => ({
  logActivity: jest.fn(),
  ActivityAction: { CREATE: "CREATE", UPDATE: "UPDATE", DELETE: "DELETE" },
  ActivityModule: { KANBAN: "KANBAN" },
}));

jest.mock("@/lib/security/sanitize", () => ({
  sanitizeMarkdown: (s: string) => s,
}));

jest.mock("@/lib/auth-middleware", () => ({
  withAuth: (fn: unknown) => fn,
}));

// Import under test AFTER mocks are registered.
import { POST } from "@/app/api/tasks/[id]/comments/route";
import { prisma } from "@/lib/prisma";
import { publishNotifications } from "@/lib/notification-publisher";

// Typed handles onto the factory-created mocks.
const prismaMock = prisma as unknown as {
  task: { findUnique: jest.Mock };
  taskComment: { create: jest.Mock; findMany: jest.Mock };
  user: { findMany: jest.Mock };
  notificationPreference: { findMany: jest.Mock };
  notification: { create: jest.Mock };
  $transaction: jest.Mock;
};
const mockPublishNotifications = publishNotifications as unknown as jest.Mock;

const AUTHOR_ID = "cku123456789abcdefghij01";
const TASK_ID = "ckt123456789abcdefghij01";

function callPost(body: Record<string, unknown>) {
  const req = createMockRequest(`/api/tasks/${TASK_ID}/comments`, {
    method: "POST",
    body,
  });
  return POST(req, { params: Promise.resolve({ id: TASK_ID }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mockReturnValue explicitly (global memory: clearAllMocks does not).
  mockRequireAuth.mockResolvedValue({ user: { id: AUTHOR_ID, name: "Author" } });
  prismaMock.task.findUnique.mockResolvedValue({ id: TASK_ID, title: "Test Task" });
  prismaMock.taskComment.create.mockResolvedValue({
    id: "comment-1",
    user: { id: AUTHOR_ID, name: "Author", avatar: null },
  });
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.notificationPreference.findMany.mockResolvedValue([]);
  // Issue #1523: thread-subscriber lookup defaults to none — tests opt
  // in by overriding when they need to exercise the subscribe path.
  prismaMock.taskComment.findMany.mockResolvedValue([]);
  prismaMock.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: `notif-${data.userId as string}`,
      isRead: false,
      createdAt: new Date("2026-04-24T00:00:00Z"),
      ...data,
    })
  );
});

describe("POST /api/tasks/[id]/comments — @mention wiring", () => {
  it("creates comment with no notifications when mentionedUserIds is omitted", async () => {
    const res = await callPost({ content: "hello world" });
    expect(res.status).toBe(201);
    expect(prismaMock.taskComment.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(mockPublishNotifications).not.toHaveBeenCalled();
  });

  it("emits Notification rows for each active mentioned user", async () => {
    const alice = "cku111111111111111111111";
    const bob = "cku222222222222222222222";
    prismaMock.user.findMany.mockResolvedValue([{ id: alice }, { id: bob }]);

    await callPost({
      content: "hey @Alice @Bob check this",
      mentionedUserIds: [alice, bob],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    const userIds = prismaMock.notification.create.mock.calls.map(
      ([arg]: [{ data: { userId: string } }]) => arg.data.userId
    );
    expect(userIds).toEqual(expect.arrayContaining([alice, bob]));
    expect(mockPublishNotifications).toHaveBeenCalledTimes(1);
  });

  it("drops self-mentions before DB lookup", async () => {
    await callPost({
      content: "note to self",
      mentionedUserIds: [AUTHOR_ID],
    });
    // user.findMany should not be called for empty candidate set.
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("dedupes duplicate userIds in the payload", async () => {
    const alice = "cku111111111111111111111";
    prismaMock.user.findMany.mockResolvedValue([{ id: alice }]);

    await callPost({
      content: "@Alice @Alice @Alice",
      mentionedUserIds: [alice, alice, alice],
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [alice] } }),
      })
    );
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it("silently drops deactivated users", async () => {
    const alive = "cku111111111111111111111";
    const dead = "cku333333333333333333333";
    // findMany only returns active ones
    prismaMock.user.findMany.mockResolvedValue([{ id: alive }]);

    await callPost({
      content: "@Alice @Ghost",
      mentionedUserIds: [alive, dead],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: alive }) })
    );
  });

  it("respects NotificationPreference opt-out", async () => {
    const alice = "cku111111111111111111111";
    const bob = "cku222222222222222222222";
    prismaMock.user.findMany.mockResolvedValue([{ id: alice }, { id: bob }]);
    prismaMock.notificationPreference.findMany.mockResolvedValue([{ userId: bob }]);

    await callPost({
      content: "@Alice @Bob",
      mentionedUserIds: [alice, bob],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: alice }) })
    );
  });

  it("does not rollback comment when Redis publish fails", async () => {
    const alice = "cku111111111111111111111";
    prismaMock.user.findMany.mockResolvedValue([{ id: alice }]);
    mockPublishNotifications.mockImplementation(() => {
      throw new Error("redis down");
    });

    const res = await callPost({
      content: "@Alice",
      mentionedUserIds: [alice],
    });

    // Comment still persists + response is 201.
    expect(res.status).toBe(201);
    expect(prismaMock.taskComment.create).toHaveBeenCalledTimes(1);
    // Publish was attempted (fire-and-forget).
    expect(mockPublishNotifications).toHaveBeenCalled();
  });
});

describe("POST /api/tasks/[id]/comments — thread-subscribe (Issue #1523)", () => {
  it("notifies prior commenters with TASK_COMMENTED type", async () => {
    const u1 = "cku111111111111111111111";
    const u2 = "cku222222222222222222222";
    prismaMock.taskComment.findMany.mockResolvedValue([
      { userId: u1 },
      { userId: u2 },
    ]);

    await callPost({ content: "follow up reply" });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    const calls = prismaMock.notification.create.mock.calls.map(
      ([arg]: [{ data: { userId: string; type: string } }]) => arg.data
    );
    const userIds = calls.map((c: { userId: string }) => c.userId);
    expect(userIds).toEqual(expect.arrayContaining([u1, u2]));
    for (const c of calls) {
      expect(c.type).toBe("TASK_COMMENTED");
    }
  });

  it("does not notify the comment author about their own reply", async () => {
    prismaMock.taskComment.findMany.mockResolvedValue([{ userId: AUTHOR_ID }]);
    await callPost({ content: "I reply to my own thread" });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("avoids duplicate notification when prior commenter is also @mentioned", async () => {
    const dual = "cku333333333333333333333";
    prismaMock.user.findMany.mockResolvedValue([{ id: dual }]);
    prismaMock.taskComment.findMany.mockResolvedValue([{ userId: dual }]);

    await callPost({
      content: "@dual recent context",
      mentionedUserIds: [dual],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: dual, type: "MENTION" }),
      })
    );
  });

  it("respects NotificationPreference opt-out for TASK_COMMENTED", async () => {
    const u1 = "cku111111111111111111111";
    const u2 = "cku222222222222222222222";
    prismaMock.taskComment.findMany.mockResolvedValue([
      { userId: u1 },
      { userId: u2 },
    ]);
    prismaMock.notificationPreference.findMany.mockImplementation(
      ({ where }: { where: { type: string } }) => {
        if (where.type === "TASK_COMMENTED") {
          return Promise.resolve([{ userId: u2 }]);
        }
        return Promise.resolve([]);
      }
    );

    await callPost({ content: "ping" });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: u1 }) })
    );
  });

  it("caps subscriber notifications at 20 even with many prior commenters", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      `cku${String(i).padStart(21, "0")}` // valid-looking cuid (24 chars total: cku + 21 zeros)
    );
    prismaMock.taskComment.findMany.mockResolvedValue(
      many.map((id) => ({ userId: id }))
    );

    await callPost({ content: "hot thread" });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(20);
  });
});
