/**
 * Tests for Outline API client — KB-1 (#840)
 */
import { OutlineClient, OutlineApiError } from "../outline-client";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createClient(overrides = {}) {
  return new OutlineClient({
    baseUrl: "https://outline.example.com",
    apiToken: "test-token-123",
    timeoutMs: 5000,
    maxRetries: 1,
    enabled: true,
    ...overrides,
  });
}

function mockJsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
  });
}

describe("OutlineClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("isEnabled", () => {
    it("returns true when baseUrl and apiToken are set", () => {
      const client = createClient();
      expect(client.isEnabled).toBe(true);
    });

    it("returns false when disabled", () => {
      const client = createClient({ enabled: false });
      expect(client.isEnabled).toBe(false);
    });
  });

  describe("listDocuments", () => {
    it("fetches documents from Outline API", async () => {
      const docs = [
        { id: "doc1", title: "Test Doc", parentDocumentId: null, collectionId: "c1", updatedAt: "2026-01-01" },
      ];
      mockFetch.mockReturnValueOnce(mockJsonResponse({ data: docs }));

      const client = createClient();
      const result = await client.listDocuments();

      expect(result).toEqual(docs);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://outline.example.com/api/documents.list",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        }),
      );
    });

    it("returns empty array when data is empty", async () => {
      mockFetch.mockReturnValueOnce(mockJsonResponse({ data: [] }));

      const client = createClient();
      const result = await client.listDocuments();
      expect(result).toEqual([]);
    });
  });

  describe("getDocument", () => {
    it("fetches a single document by ID", async () => {
      const doc = {
        id: "doc1",
        title: "Test",
        text: "# Hello",
        parentDocumentId: null,
        collectionId: "c1",
        publishedAt: null,
        updatedAt: "2026-01-01",
        createdBy: { id: "u1", name: "Alice" },
        updatedBy: { id: "u1", name: "Alice" },
      };
      mockFetch.mockReturnValueOnce(mockJsonResponse({ data: doc }));

      const client = createClient();
      const result = await client.getDocument("doc1");

      expect(result.title).toBe("Test");
      expect(result.text).toBe("# Hello");
    });
  });

  describe("searchDocuments", () => {
    it("searches documents by query", async () => {
      const results = [
        {
          document: { id: "doc1", title: "Test", parentDocumentId: null, collectionId: "c1", updatedAt: "2026-01-01" },
          context: "matched text",
          ranking: 0.9,
        },
      ];
      mockFetch.mockReturnValueOnce(mockJsonResponse({ data: results }));

      const client = createClient();
      const result = await client.searchDocuments("test");

      expect(result.length).toBe(1);
      expect(result[0].document.title).toBe("Test");
      expect(result[0].context).toBe("matched text");
    });
  });

  describe("error handling", () => {
    it("throws OutlineApiError on HTTP error", async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({}),
        }),
      );

      const client = createClient({ maxRetries: 0 });
      await expect(client.listDocuments()).rejects.toThrow(OutlineApiError);
    });

    it("does not retry on 4xx errors", async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: () => Promise.resolve({}),
        }),
      );

      const client = createClient({ maxRetries: 2 });
      await expect(client.getDocument("nonexistent")).rejects.toThrow(OutlineApiError);
      // Should only be called once (no retry on 4xx)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on 5xx errors", async () => {
      mockFetch
        .mockReturnValueOnce(
          Promise.resolve({ ok: false, status: 503, statusText: "Unavailable", json: () => Promise.resolve({}) }),
        )
        .mockReturnValueOnce(mockJsonResponse({ data: [] }));

      const client = createClient({ maxRetries: 1 });
      const result = await client.listDocuments();
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws timeout error on AbortError", async () => {
      mockFetch.mockImplementation(() => {
        const err = new DOMException("signal is aborted", "AbortError");
        return Promise.reject(err);
      });

      const client = createClient({ maxRetries: 0 });
      try {
        await client.listDocuments();
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OutlineApiError);
        expect((err as OutlineApiError).isTimeout).toBe(true);
      }
    });
  });

  describe("API token security", () => {
    it("sends API token in Authorization header, not in body", async () => {
      mockFetch.mockReturnValueOnce(mockJsonResponse({ data: [] }));

      const client = createClient();
      await client.listDocuments();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer test-token-123");
      // Token should not appear in the body
      const body = options.body ? JSON.parse(options.body) : {};
      expect(JSON.stringify(body)).not.toContain("test-token-123");
    });
  });
});
