/**
 * @jest-environment node
 */
/**
 * API route tests: DocumentTemplate CRUD + from-template — Issue #1002
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocumentTemplate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};

const mockDocument = {
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: { documentTemplate: mockDocumentTemplate, document: mockDocument },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" },
  expires: "2099",
};

const MOCK_TEMPLATE = {
  id: "tmpl-1",
  title: "SOP 標準作業程序",
  content: "# SOP\n\n## 1. 目的",
  category: "SOP",
  isSystem: true,
  createdBy: "u1",
  createdAt: new Date(),
  creator: { id: "u1", name: "Test" },
};

describe("GET /api/document-templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns all templates", async () => {
    mockDocumentTemplate.findMany.mockResolvedValue([MOCK_TEMPLATE]);

    const { GET } = await import("@/app/api/document-templates/route");
    const res = await (GET as Function)(
      createMockRequest("/api/document-templates")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("SOP 標準作業程序");
  });

  it("filters by category", async () => {
    mockDocumentTemplate.findMany.mockResolvedValue([MOCK_TEMPLATE]);

    const { GET } = await import("@/app/api/document-templates/route");
    const res = await (GET as Function)(
      createMockRequest("/api/document-templates", {
        searchParams: { category: "SOP" },
      })
    );
    expect(res.status).toBe(200);
    expect(mockDocumentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: "SOP" },
      })
    );
  });
});

describe("POST /api/document-templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates a custom template", async () => {
    const newTemplate = {
      ...MOCK_TEMPLATE,
      id: "tmpl-2",
      isSystem: false,
      title: "Custom Template",
      category: "Custom",
    };
    mockDocumentTemplate.create.mockResolvedValue(newTemplate);

    const { POST } = await import("@/app/api/document-templates/route");
    const res = await (POST as Function)(
      createMockRequest("/api/document-templates", {
        method: "POST",
        body: {
          title: "Custom Template",
          content: "# Custom",
          category: "Custom",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.isSystem).toBe(false);
  });

  it("returns 400 when missing required fields", async () => {
    const { POST } = await import("@/app/api/document-templates/route");
    const res = await (POST as Function)(
      createMockRequest("/api/document-templates", {
        method: "POST",
        body: { title: "Missing content" },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/from-template/{templateId}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates document from template", async () => {
    mockDocumentTemplate.findUnique.mockResolvedValue(MOCK_TEMPLATE);
    mockDocument.create.mockResolvedValue({
      id: "doc-new",
      title: "My SOP",
      content: MOCK_TEMPLATE.content,
      slug: "my-sop-abc123",
      status: "DRAFT",
      createdBy: "u1",
      updatedBy: "u1",
      creator: { id: "u1", name: "Test" },
      updater: { id: "u1", name: "Test" },
    });

    const { POST } = await import(
      "@/app/api/documents/from-template/[templateId]/route"
    );
    const res = await (POST as Function)(
      createMockRequest("/api/documents/from-template/tmpl-1", {
        method: "POST",
        body: { title: "My SOP" },
      }),
      { params: Promise.resolve({ templateId: "tmpl-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("My SOP");
    expect(body.data.status).toBe("DRAFT");
  });

  it("returns 404 for nonexistent template", async () => {
    mockDocumentTemplate.findUnique.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/documents/from-template/[templateId]/route"
    );
    const res = await (POST as Function)(
      createMockRequest("/api/documents/from-template/missing", {
        method: "POST",
        body: { title: "Test" },
      }),
      { params: Promise.resolve({ templateId: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when title is missing", async () => {
    mockDocumentTemplate.findUnique.mockResolvedValue(MOCK_TEMPLATE);

    const { POST } = await import(
      "@/app/api/documents/from-template/[templateId]/route"
    );
    const res = await (POST as Function)(
      createMockRequest("/api/documents/from-template/tmpl-1", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ templateId: "tmpl-1" }) }
    );
    expect(res.status).toBe(400);
  });
});
