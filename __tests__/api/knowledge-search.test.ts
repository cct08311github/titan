/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #859: Enhanced Knowledge Search
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn() };
const mockDocument = { findMany: jest.fn() };
const mockTaskComment = { findMany: jest.fn() };
const mockKPI = { findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    document: mockDocument,
    taskComment: mockTaskComment,
    kPI: mockKPI,
    user: mockUser,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" },
  expires: "2099",
};

describe("GET /api/search — enhanced (Issue #859)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTask.findMany.mockResolvedValue([]);
    mockDocument.findMany.mockResolvedValue([]);
    mockTaskComment.findMany.mockResolvedValue([]);
    mockKPI.findMany.mockResolvedValue([]);
    mockUser.findMany.mockResolvedValue([]);
  });

  it("returns empty arrays when q is empty", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "" } }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toEqual([]);
    expect(body.data.documents).toEqual([]);
    expect(body.data.comments).toEqual([]);
  });

  it("returns 422 when q is less than 2 chars", async () => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "a" } }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toContain("至少 2 個字元");
  });

  it("searches across tasks, documents, and comments with scope=all", async () => {
    mockTask.findMany.mockResolvedValue([
      { id: "t1", title: "ORA-04031 修復", description: "修復 ORA-04031 shared pool 不足", status: "DONE", priority: "P0", dueDate: null, updatedAt: new Date() },
    ]);
    mockDocument.findMany.mockResolvedValue([
      { id: "d1", title: "Oracle 常見錯誤", slug: "oracle-errors", content: "ORA-04031 是常見的 shared pool 錯誤", updatedAt: new Date() },
    ]);
    mockTaskComment.findMany.mockResolvedValue([
      { id: "c1", content: "上次 ORA-04031 是增加 shared_pool_size 解決的", taskId: "t2", createdAt: new Date(), task: { id: "t2", title: "DB 維護" }, user: { name: "陳大哥" } },
    ]);

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "ORA-04031", scope: "all" } }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks).toHaveLength(1);
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0].authorName).toBe("陳大哥");
    expect(body.data.comments[0].taskId).toBe("t2");
  });

  it("scope=documents only searches documents", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "d1", title: "Test doc", slug: "test", content: "test content", updatedAt: new Date() },
    ]);

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "test", scope: "documents" } }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.documents).toHaveLength(1);
    // tasks and comments should not be called
    expect(mockTask.findMany).not.toHaveBeenCalled();
    expect(mockTaskComment.findMany).not.toHaveBeenCalled();
  });

  it("scope=comments only searches comments", async () => {
    mockTaskComment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "test", scope: "comments" } }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(mockTask.findMany).not.toHaveBeenCalled();
    expect(mockDocument.findMany).not.toHaveBeenCalled();
  });

  it("snippet contains <mark> tags around matched keyword", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "d1", title: "Guide", slug: "guide", content: "Before ORA-04031 error After text here", updatedAt: new Date() },
    ]);

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "ORA-04031", scope: "documents" } }),
      { params: Promise.resolve({}) }
    );

    const body = await res.json();
    expect(body.data.documents[0].snippet).toContain("<mark>");
    expect(body.data.documents[0].snippet).toContain("ORA-04031");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/search/route");
    const res = await GET(
      createMockRequest("/api/search", { searchParams: { q: "test" } }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/documents/tags — Issue #859", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns distinct tags from documents", async () => {
    mockDocument.findMany.mockResolvedValue([
      { tags: ["Oracle", "batch"] },
      { tags: ["Oracle", "DR"] },
      { tags: ["EOD"] },
    ]);

    const { GET } = await import("@/app/api/documents/tags/route");
    const res = await GET(
      createMockRequest("/api/documents/tags"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const tags = body.data;
    expect(tags).toContain("Oracle");
    expect(tags).toContain("batch");
    expect(tags).toContain("DR");
    expect(tags).toContain("EOD");
    // Should be sorted and deduplicated
    expect(tags).toHaveLength(4);
    expect(tags).toEqual(["DR", "EOD", "Oracle", "batch"]);
  });

  it("returns empty array when no tags", async () => {
    mockDocument.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/documents/tags/route");
    const res = await GET(
      createMockRequest("/api/documents/tags"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
