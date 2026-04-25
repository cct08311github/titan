/**
 * @jest-environment node
 */
/**
 * API: /api/comment-threads/mute — Issue #1527.
 *
 *  - POST toggles mute (creates row if absent, deletes if present)
 *  - GET returns current mute status
 *  - 404 when target row does not exist
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
    task: { findUnique: jest.fn() },
    document: { findUnique: jest.fn() },
    commentThreadMute: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { prisma: mock };
});

import { POST, GET } from "@/app/api/comment-threads/mute/route";
import { prisma } from "@/lib/prisma";

const prismaMock = prisma as unknown as {
  task: { findUnique: jest.Mock };
  document: { findUnique: jest.Mock };
  commentThreadMute: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
};

const VIEWER_ID = "cku111111111111111111111";
const TASK_ID = "ckt222222222222222222222";

function callPost(body: Record<string, unknown>) {
  const req = createMockRequest("/api/comment-threads/mute", {
    method: "POST",
    body,
  });
  return POST(req, { params: Promise.resolve({}) });
}

function callGet(targetType: string, targetId: string) {
  const req = createMockRequest(
    `/api/comment-threads/mute?targetType=${targetType}&targetId=${targetId}`,
    { method: "GET" }
  );
  return GET(req, { params: Promise.resolve({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ user: { id: VIEWER_ID } });
  prismaMock.task.findUnique.mockResolvedValue({ id: TASK_ID });
  prismaMock.document.findUnique.mockResolvedValue({ id: TASK_ID });
  prismaMock.commentThreadMute.findUnique.mockResolvedValue(null);
  prismaMock.commentThreadMute.create.mockResolvedValue({ id: "mute-1" });
  prismaMock.commentThreadMute.delete.mockResolvedValue({ id: "mute-1" });
});

describe("POST /api/comment-threads/mute — toggle", () => {
  it("creates a mute row on first toggle and returns muted=true", async () => {
    const res = await callPost({ targetType: "TASK", targetId: TASK_ID });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.muted).toBe(true);
    expect(prismaMock.commentThreadMute.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.commentThreadMute.delete).not.toHaveBeenCalled();
  });

  it("deletes the mute row on second toggle and returns muted=false", async () => {
    prismaMock.commentThreadMute.findUnique.mockResolvedValue({ id: "existing" });
    const res = await callPost({ targetType: "TASK", targetId: TASK_ID });
    const body = await res.json();
    expect(body.data.muted).toBe(false);
    expect(prismaMock.commentThreadMute.delete).toHaveBeenCalledWith({ where: { id: "existing" } });
  });

  it("returns 404 when task does not exist", async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);
    const res = await callPost({ targetType: "TASK", targetId: TASK_ID });
    expect(res.status).toBe(404);
  });

  it("rejects unknown targetType via zod", async () => {
    await expect(
      callPost({ targetType: "RANDOM", targetId: TASK_ID })
    ).rejects.toThrow();
  });

  it("works for DOCUMENT target type", async () => {
    const res = await callPost({ targetType: "DOCUMENT", targetId: TASK_ID });
    expect(res.status).toBe(200);
    expect(prismaMock.document.findUnique).toHaveBeenCalled();
  });
});

describe("GET /api/comment-threads/mute — status check", () => {
  it("returns muted=false when no row exists", async () => {
    const res = await callGet("TASK", TASK_ID);
    const body = await res.json();
    expect(body.data.muted).toBe(false);
  });

  it("returns muted=true when row exists", async () => {
    prismaMock.commentThreadMute.findUnique.mockResolvedValue({ id: "existing" });
    const res = await callGet("TASK", TASK_ID);
    const body = await res.json();
    expect(body.data.muted).toBe(true);
  });
});
