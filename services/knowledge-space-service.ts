import { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface CreateSpaceInput {
  name: string;
  description?: string;
  createdBy: string;
}

export interface UpdateSpaceInput {
  name?: string;
  description?: string | null;
  updatedBy: string;
}

export class KnowledgeSpaceService {
  constructor(private readonly prisma: PrismaClient) {}

  async listSpaces() {
    return this.prisma.knowledgeSpace.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async getSpace(id: string) {
    const space = await this.prisma.knowledgeSpace.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    });
    if (!space) throw new NotFoundError(`Space not found: ${id}`);
    return space;
  }

  async createSpace(input: CreateSpaceInput) {
    if (!input.name?.trim()) {
      throw new ValidationError("Space 名稱為必填");
    }

    return this.prisma.knowledgeSpace.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        createdBy: input.createdBy,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });
  }

  async updateSpace(id: string, input: UpdateSpaceInput) {
    const existing = await this.prisma.knowledgeSpace.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Space not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;

    return this.prisma.knowledgeSpace.update({
      where: { id },
      data: updates,
      include: {
        creator: { select: { id: true, name: true } },
      },
    });
  }

  async deleteSpace(id: string) {
    const space = await this.prisma.knowledgeSpace.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    });
    if (!space) throw new NotFoundError(`Space not found: ${id}`);
    if (space._count.documents > 0) {
      throw new ValidationError("無法刪除含有文件的 Space，請先移除或歸檔所有文件");
    }

    return this.prisma.knowledgeSpace.delete({ where: { id } });
  }
}
