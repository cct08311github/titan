import { DocumentService } from "../document-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("DocumentService", () => {
  let service: DocumentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DocumentService(prisma as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  test("listDocuments returns documents", async () => {
    const mockDocs = [{ id: "doc-1", title: "Doc 1", slug: "doc-1" }];
    (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocs);

    const result = await service.listDocuments({});

    expect(prisma.document.findMany).toHaveBeenCalled();
    expect(result).toEqual(mockDocs);
  });

  test("getDocument throws NotFoundError", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getDocument("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("createDocument validates title and slug", async () => {
    await expect(
      service.createDocument({ title: "", slug: "slug", content: "", createdBy: "u1", updatedBy: "u1" })
    ).rejects.toThrow(ValidationError);
  });

  test("updateDocument creates version snapshot", async () => {
    const existing = { id: "doc-1", version: 1, content: "old content" };
    const updated = { id: "doc-1", version: 2, content: "new content" };
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.documentVersion.create as jest.Mock).mockResolvedValue({});
    (prisma.document.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateDocument("doc-1", { content: "new content", updatedBy: "u1" });

    expect(prisma.documentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentId: "doc-1" }),
      })
    );
    expect(result).toEqual(updated);
  });

  test("updateDocument skips version snapshot when only title changes", async () => {
    const existing = { id: "doc-1", version: 1, content: "same content" };
    const updated = { id: "doc-1", version: 1, title: "New Title", content: "same content" };
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.document.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateDocument("doc-1", { title: "New Title", updatedBy: "u1" });

    expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  test("updateDocument skips version snapshot when content is identical", async () => {
    const existing = { id: "doc-1", version: 1, content: "same content" };
    const updated = { id: "doc-1", version: 1, content: "same content" };
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.document.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateDocument("doc-1", { content: "same content", updatedBy: "u1" });

    expect(prisma.documentVersion.create).not.toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  test("deleteDocument removes document", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue({ id: "doc-1" });
    (prisma.document.delete as jest.Mock).mockResolvedValue({ id: "doc-1" });

    await service.deleteDocument("doc-1");

    expect(prisma.document.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-1" } })
    );
  });
});
