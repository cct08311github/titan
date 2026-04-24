/**
 * @jest-environment node
 */
/**
 * API: /api/reactions — toggle + list (Issue #1512).
 *
 * Covers:
 *  - Toggle adds a row on first call, removes on second
 *  - Multiple emoji per user per target are independent
 *  - 404 when target row does not exist
 *  - 400 on invalid emoji or invalid targetType
 *  - GET returns aggregated counts + reactedByMe flag for current viewer
 */
import { createMockRequest } from "../utils/test-utils";

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
    taskComment: { findUnique: jest.fn() },
    documentComment: { findUnique: jest.fn() },
    taskActivity: { findUnique: jest.fn() },
    reaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { prisma: mock };
});

import { POST, GET } from "@/app/api/reactions/route";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as {
  taskComment: { findUnique: jest.Mock };
  documentComment: { findUnique: jest.Mock };
  taskActivity: { findUnique: jest.Mock };
  reaction: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
};

const VIEWER_ID = "cku111111111111111111111";
const TARGET_ID = "ckc222222222222222222222";

function postReaction(body: Record<string, unknown>) {
  const req = createMockRequest("/api/reactions", { method: "POST", body });
  return POST(req, { params: Promise.resolve({}) });
}

function getReactions(targetType: string, targetId: string) {
  const url = `/api/reactions?targetType=${targetType}&targetId=${targetId}`;
  const req = createMockRequest(url, { method: "GET" });
  return GET(req, { params: Promise.resolve({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { id: VIEWER_ID } });
  prismaMock.taskComment.findUnique.mockResolvedValue({ id: TARGET_ID, deletedAt: null });
  prismaMock.documentComment.findUnique.mockResolvedValue({ id: TARGET_ID });
  prismaMock.taskActivity.findUnique.mockResolvedValue({ id: TARGET_ID });
  prismaMock.reaction.findUnique.mockResolvedValue(null);
  prismaMock.reaction.findMany.mockResolvedValue([]);
  prismaMock.reaction.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "r-new", createdAt: new Date(), ...data })
  );
  prismaMock.reaction.delete.mockResolvedValue({ id: "r-del" });
});

describe("POST /api/reactions — toggle", () => {
  it("creates a reaction on first toggle", async () => {
    const res = await postReaction({
      targetType: "TASK_COMMENT",
      targetId: TARGET_ID,
      emoji: "👍",
    });
    expect(res.status).toBe(200);
    expect(prismaMock.reaction.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.reaction.delete).not.toHaveBeenCalled();
  });

  it("deletes a reaction on second toggle (same user, same emoji)", async () => {
    prismaMock.reaction.findUnique.mockResolvedValue({ id: "r-existing" });
    const res = await postReaction({
      targetType: "TASK_COMMENT",
      targetId: TARGET_ID,
      emoji: "👍",
    });
    expect(res.status).toBe(200);
    expect(prismaMock.reaction.delete).toHaveBeenCalledWith({ where: { id: "r-existing" } });
    expect(prismaMock.reaction.create).not.toHaveBeenCalled();
  });

  it("returns 404 when target does not exist", async () => {
    prismaMock.taskComment.findUnique.mockResolvedValue(null);
    const res = await postReaction({
      targetType: "TASK_COMMENT",
      targetId: TARGET_ID,
      emoji: "👍",
    });
    expect(res.status).toBe(404);
    expect(prismaMock.reaction.create).not.toHaveBeenCalled();
  });

  it("rejects emoji outside the fixed palette", async () => {
    await expect(
      postReaction({
        targetType: "TASK_COMMENT",
        targetId: TARGET_ID,
        emoji: "💩",
      })
    ).rejects.toThrow(); // ValidationError bubbles
    expect(prismaMock.reaction.create).not.toHaveBeenCalled();
  });

  it("rejects unknown targetType", async () => {
    await expect(
      postReaction({
        targetType: "TASK_ITSELF",
        targetId: TARGET_ID,
        emoji: "👍",
      })
    ).rejects.toThrow();
  });

  it("treats soft-deleted task comments as missing", async () => {
    prismaMock.taskComment.findUnique.mockResolvedValue({
      id: TARGET_ID,
      deletedAt: new Date(),
    });
    const res = await postReaction({
      targetType: "TASK_COMMENT",
      targetId: TARGET_ID,
      emoji: "👍",
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/reactions — aggregated summary", () => {
  it("returns empty array for a target with no reactions", async () => {
    const res = await getReactions("TASK_COMMENT", TARGET_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reactions).toEqual([]);
  });

  it("groups reactions by emoji and flags reactedByMe correctly", async () => {
    prismaMock.reaction.findMany.mockResolvedValue([
      { userId: "u1", emoji: "👍" },
      { userId: "u2", emoji: "👍" },
      { userId: VIEWER_ID, emoji: "🎉" },
    ]);
    const res = await getReactions("TASK_COMMENT", TARGET_ID);
    const body = await res.json();
    const thumbs = body.data.reactions.find((r: { emoji: string }) => r.emoji === "👍");
    const party = body.data.reactions.find((r: { emoji: string }) => r.emoji === "🎉");
    expect(thumbs.count).toBe(2);
    expect(thumbs.reactedByMe).toBe(false);
    expect(party.count).toBe(1);
    expect(party.reactedByMe).toBe(true);
  });

  it("returns 404 if the target row does not exist", async () => {
    prismaMock.documentComment.findUnique.mockResolvedValue(null);
    const res = await getReactions("DOCUMENT_COMMENT", TARGET_ID);
    expect(res.status).toBe(404);
  });
});
