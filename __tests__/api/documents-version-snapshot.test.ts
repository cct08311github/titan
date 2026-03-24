/**
 * @jest-environment node
 */
/**
 * Tests for PUT /api/documents/[id] -- conditional version snapshot (Issue #280)
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocument = {
  findUnique: jest.fn(),
  update: jest.fn(),
};
const mockDocumentVersion = {
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: mockDocument,
    documentVersion: mockDocumentVersion,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099",
};

const EXISTING_DOC = {
  id: "doc-1",
  title: "Original Title",
  content: "# Original Content",
  version: 3,
  parentId: null,
  createdBy: "u1",
  updatedBy: "u1",
};

const UPDATED_DOC = {
  ...EXISTING_DOC,
  creator: { id: "u1", name: "Test" },
  updater: { id: "u1", name: "Test" },
};

const CONTEXT = { params: Promise.resolve({ id: "doc-1" }) };

describe("PUT /api/documents/[id] -- version snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockDocument.findUnique.mockResolvedValue(EXISTING_DOC);
    mockDocument.update.mockResolvedValue(UPDATED_DOC);
    mockDocumentVersion.create.mockResolvedValue({});
  });

  it("creates a version snapshot when content changes", async () => {
    const { PUT } = await import("@/app/api/documents/[id]/route");
    const req = createMockRequest("/api/documents/doc-1", {
      method: "PUT",
      body: { content: "# New Content" },
    });

    const res = await PUT(req, CONTEXT);
    expect(res.status).toBe(200);
    expect(mockDocumentVersion.create).toHaveBeenCalledTimes(1);
    expect(mockDocumentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          content: "# Original Content",
          version: 3,
        }),
      })
    );
  });

  it("does NOT create a version snapshot when only title changes", async () => {
    const { PUT } = await import("@/app/api/documents/[id]/route");
    const req = createMockRequest("/api/documents/doc-1", {
      method: "PUT",
      body: { title: "Updated Title" },
    });

    const res = await PUT(req, CONTEXT);
    expect(res.status).toBe(200);
    expect(mockDocumentVersion.create).not.toHaveBeenCalled();
  });

  it("does NOT create a version snapshot when content is identical", async () => {
    const { PUT } = await import("@/app/api/documents/[id]/route");
    const req = createMockRequest("/api/documents/doc-1", {
      method: "PUT",
      body: { content: "# Original Content" },
    });

    const res = await PUT(req, CONTEXT);
    expect(res.status).toBe(200);
    expect(mockDocumentVersion.create).not.toHaveBeenCalled();
  });
});
