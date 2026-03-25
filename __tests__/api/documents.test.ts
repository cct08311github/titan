/**
 * @jest-environment node
 */
/**
 * API route tests: /api/documents
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocument = { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { document: mockDocument } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

const MOCK_DOC = {
  id: "doc-1",
  title: "Test Document",
  slug: "test-document-1234567890",
  content: "# Hello",
  version: 1,
  parentId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  creator: { id: "u1", name: "Test" },
  updater: { id: "u1", name: "Test" },
  _count: { children: 0 },
};

describe("GET /api/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockDocument.findMany.mockResolvedValue([MOCK_DOC]);
  });

  it("returns document list when authenticated", async () => {
    mockDocument.count.mockResolvedValue(1);
    const { GET } = await import("@/app/api/documents/route");
    const res = await (GET as Function)(createMockRequest("/api/documents"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0].id).toBe("doc-1");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/documents/route");
    const res = await (GET as Function)(createMockRequest("/api/documents"));
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockDocument.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/documents/route");
    const res = await (GET as Function)(createMockRequest("/api/documents"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockDocument.create.mockResolvedValue(MOCK_DOC);
  });

  it("creates document with valid data", async () => {
    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(createMockRequest("/api/documents", { method: "POST", body: { title: "Test Document" } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("doc-1");
  });

  it("returns 400 when title missing", async () => {
    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(createMockRequest("/api/documents", { method: "POST", body: { content: "Hello" } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(createMockRequest("/api/documents", { method: "POST", body: { title: "Doc" } }));
    expect(res.status).toBe(401);
  });

  it("creates document with parent", async () => {
    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(createMockRequest("/api/documents", {
      method: "POST",
      body: { title: "Child Doc", parentId: "doc-parent" },
    }));
    expect(res.status).toBe(201);
  });
});
