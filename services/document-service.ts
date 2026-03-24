import { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListDocumentsFilter {
  parentId?: string | null;
  search?: string;
}

export interface CreateDocumentInput {
  parentId?: string | null;
  title: string;
  content: string;
  slug: string;
  createdBy: string;
  updatedBy: string;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  slug?: string;
  updatedBy: string;
}

export class DocumentService {
  constructor(private readonly prisma: PrismaClient) {}

  async listDocuments(filter: ListDocumentsFilter) {
    return this.prisma.document.findMany({
      where: {
        ...(filter.parentId !== undefined && { parentId: filter.parentId }),
        ...(filter.search && {
          OR: [
            { title: { contains: filter.search, mode: "insensitive" } },
            { content: { contains: filter.search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        _count: { select: { children: true, versions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getDocument(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        parent: { select: { id: true, title: true, slug: true } },
        children: { select: { id: true, title: true, slug: true } },
        versions: { orderBy: { version: "desc" }, take: 10 },
      },
    });

    if (!doc) throw new NotFoundError(`Document not found: ${id}`);
    return doc;
  }

  async createDocument(input: CreateDocumentInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }
    if (!input.slug?.trim()) {
      throw new ValidationError("Slug 為必填");
    }

    return this.prisma.document.create({
      data: {
        parentId: input.parentId ?? null,
        title: input.title,
        content: input.content,
        slug: input.slug,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });
  }

  async updateDocument(id: string, input: UpdateDocumentInput) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Document not found: ${id}`);

    return this.prisma.$transaction(
      async (tx) => {
        // Save current version as snapshot before updating
        if (input.content !== undefined && input.content !== existing.content) {
          await tx.documentVersion.create({
            data: {
              documentId: id,
              content: existing.content,
              version: existing.version,
              createdBy: input.updatedBy,
            },
          });
        }

        const updates: Record<string, unknown> = {
          updatedBy: input.updatedBy,
        };
        if (input.title !== undefined) updates.title = input.title;
        if (input.content !== undefined) {
          updates.content = input.content;
          updates.version = existing.version + 1;
        }
        if (input.slug !== undefined) updates.slug = input.slug;

        return tx.document.update({
          where: { id },
          data: updates,
          include: {
            creator: { select: { id: true, name: true } },
            updater: { select: { id: true, name: true } },
          },
        });
      },
      { timeout: 10000 }
    );
  }

  async deleteDocument(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError(`Document not found: ${id}`);

    return this.prisma.document.delete({ where: { id } });
  }
}
