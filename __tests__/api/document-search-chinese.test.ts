/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #830: Chinese search in knowledge base
 *
 * Verifies that the document search API handles Chinese keywords
 * by falling back to ILIKE when full-text search returns no results.
 */
import { createMockRequest } from "../utils/test-utils";

// Mock prisma
const mockQueryRaw = jest.fn();
const mockFindMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    document: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// Mock auth
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" },
  expires: "2099",
};

describe("GET /api/documents/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns results for Chinese query when FTS returns empty but ILIKE matches", async () => {
    // Full-text search returns nothing for Chinese
    mockQueryRaw.mockResolvedValue([]);
    // ILIKE fallback finds the document
    mockFindMany.mockResolvedValue([
      { id: "doc-1", title: "資安政策", slug: "security-policy", parentId: null, content: "資安政策內容..." },
    ]);

    const { GET } = await import("@/app/api/documents/search/route");
    const req = createMockRequest("/api/documents/search", {
      searchParams: { q: "資安" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].title).toBe("資安政策");
  });

  it("returns empty array for empty query", async () => {
    const { GET } = await import("@/app/api/documents/search/route");
    const req = createMockRequest("/api/documents/search", {
      searchParams: { q: "" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("returns FTS results for English query when available", async () => {
    mockQueryRaw.mockResolvedValue([
      { id: "doc-2", title: "QA Automation", slug: "qa-auto", parentId: null, snippet: "QA test doc" },
    ]);

    const { GET } = await import("@/app/api/documents/search/route");
    const req = createMockRequest("/api/documents/search", {
      searchParams: { q: "QA" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
