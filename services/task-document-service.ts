/**
 * TaskDocumentService — Issue #842 (KB-3)
 *
 * Manages task-to-document links. A task can link to multiple
 * Outline documents. Duplicate links are rejected.
 */

import { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "./errors";

export interface CreateTaskDocumentInput {
  taskId: string;
  outlineDocumentId: string;
  title: string;
  addedBy: string;
}

export class TaskDocumentService {
  constructor(private readonly prisma: PrismaClient) {}

  async listByTask(taskId: string) {
    return this.prisma.taskDocument.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });
  }

  async addDocument(input: CreateTaskDocumentInput) {
    if (!input.taskId?.trim()) {
      throw new ValidationError("taskId 為必填");
    }
    if (!input.outlineDocumentId?.trim()) {
      throw new ValidationError("outlineDocumentId 為必填");
    }
    if (!input.title?.trim()) {
      throw new ValidationError("title 為必填");
    }

    // Verify task exists
    const task = await this.prisma.task.findUnique({
      where: { id: input.taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundError(`Task not found: ${input.taskId}`);

    // Check for duplicate
    const existing = await this.prisma.taskDocument.findUnique({
      where: {
        taskId_outlineDocumentId: {
          taskId: input.taskId,
          outlineDocumentId: input.outlineDocumentId,
        },
      },
    });
    if (existing) {
      throw new ConflictError("此文件已連結至該任務");
    }

    return this.prisma.taskDocument.create({
      data: {
        taskId: input.taskId,
        outlineDocumentId: input.outlineDocumentId,
        title: input.title,
        addedBy: input.addedBy,
      },
    });
  }

  async removeDocument(taskId: string, docId: string) {
    const link = await this.prisma.taskDocument.findFirst({
      where: { taskId, id: docId },
    });
    if (!link) throw new NotFoundError("關聯文件不存在");

    return this.prisma.taskDocument.delete({
      where: { id: docId },
    });
  }
}
