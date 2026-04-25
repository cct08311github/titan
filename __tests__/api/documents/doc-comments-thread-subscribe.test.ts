/**
 * @jest-environment node
 */
/**
 * API: POST /api/documents/[id]/comments — thread-subscribe (Issue #1525).
 *
 * Mirrors the task-comments thread-subscribe tests for the document
 * surface. Verifies prior commenters are notified, self/dup filters,
 * opt-out, and the 20-cap.
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

jest.mock("@/lib/auth-middleware", () => ({
  withAuth: (fn: unknown) => fn,
}));

jest.mock("@/lib/prisma", () => {
  const mock = {
    document: { findUnique: jest.fn() },
    documentComment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
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

import { POST } from "@/app/api/documents/[id]/comments/route";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as {
  document: { findUnique: jest.Mock };
  documentComment: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  user: { findMany: jest.Mock };
  notificationPreference: { findMany: jest.Mock };
  notification: { create: jest.Mock };
  $transaction: jest.Mock;
};

const AUTHOR_ID = "cku000000000000000000000";
const DOC_ID = "ckd000000000000000000000";

function callPost(body: Record<string, unknown>) {
  const req = createMockRequest(`/api/documents/${DOC_ID}/comments`, {
    method: "POST",
    body,
  });
  return POST(req, { params: Promise.resolve({ id: DOC_ID }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { id: AUTHOR_ID, name: "Author" } });
  prismaMock.document.findUnique.mockResolvedValue({ id: DOC_ID, title: "Test Doc" });
  prismaMock.documentComment.create.mockResolvedValue({
    id: "dc-1",
    author: { id: AUTHOR_ID, name: "Author", avatar: null },
  });
  prismaMock.documentComment.findMany.mockResolvedValue([]);
  prismaMock.documentComment.findFirst.mockResolvedValue(null);
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.notificationPreference.findMany.mockResolvedValue([]);
  prismaMock.notification.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: `n-${data.userId as string}`,
      isRead: false,
      createdAt: new Date(),
      ...data,
    })
  );
});

describe("POST /api/documents/[id]/comments — thread-subscribe", () => {
  it("notifies prior commenters with TASK_COMMENTED type", async () => {
    const u1 = "cku111111111111111111111";
    const u2 = "cku222222222222222222222";
    prismaMock.documentComment.findMany.mockResolvedValue([
      { authorId: u1 },
      { authorId: u2 },
    ]);

    await callPost({ content: "follow up reply" });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    const calls = prismaMock.notification.create.mock.calls.map(
      ([arg]: [{ data: { userId: string; type: string; relatedType: string } }]) => arg.data
    );
    for (const c of calls) {
      expect(c.type).toBe("TASK_COMMENTED");
      expect(c.relatedType).toBe("Document");
    }
  });

  it("does not self-notify the comment author", async () => {
    prismaMock.documentComment.findMany.mockResolvedValue([{ authorId: AUTHOR_ID }]);
    await callPost({ content: "I reply to my own thread" });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("avoids dup when prior commenter is also @mentioned", async () => {
    const dual = "cku333333333333333333333";
    prismaMock.user.findMany.mockResolvedValue([{ id: dual }]);
    prismaMock.documentComment.findMany.mockResolvedValue([{ authorId: dual }]);

    await callPost({
      content: "@dual context",
      mentionedUserIds: [dual],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: dual, type: "MENTION" }),
      })
    );
  });

  it("respects TASK_COMMENTED opt-out", async () => {
    const u1 = "cku111111111111111111111";
    const u2 = "cku222222222222222222222";
    prismaMock.documentComment.findMany.mockResolvedValue([
      { authorId: u1 },
      { authorId: u2 },
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

  it("caps subscriber notifications at 20", async () => {
    const many = Array.from(
      { length: 25 },
      (_, i) => `cku${String(i).padStart(21, "0")}`
    );
    prismaMock.documentComment.findMany.mockResolvedValue(
      many.map((id) => ({ authorId: id }))
    );

    await callPost({ content: "hot doc thread" });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(20);
  });
});
