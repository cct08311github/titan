/**
 * KnowledgeSpaceService 測試
 * 驗證 listSpaces、createSpace 輸入驗證、deleteSpace 刪除限制
 */
import { KnowledgeSpaceService } from "../knowledge-space-service";
import { NotFoundError, ValidationError } from "../errors";
import { createMockPrisma } from "../../lib/test-utils";

// 建立含有 knowledgeSpace 的擴充 mock prisma
function createExtendedMockPrisma() {
  const prisma = createMockPrisma() as ReturnType<typeof createMockPrisma> & {
    knowledgeSpace: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  (prisma as Record<string, unknown>).knowledgeSpace = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  return prisma;
}

const mockSpace = {
  id: "space-1",
  name: "技術文件",
  description: "系統技術文件空間",
  createdBy: "user-1",
  creator: { id: "user-1", name: "Alice" },
  _count: { documents: 0 },
};

describe("KnowledgeSpaceService", () => {
  let service: KnowledgeSpaceService;
  let prisma: ReturnType<typeof createExtendedMockPrisma>;

  beforeEach(() => {
    prisma = createExtendedMockPrisma();
    service = new KnowledgeSpaceService(prisma as never);
    jest.clearAllMocks();
  });

  describe("listSpaces()", () => {
    test("應回傳所有 space 清單", async () => {
      (prisma.knowledgeSpace.findMany as jest.Mock).mockResolvedValue([mockSpace]);

      const result = await service.listSpaces();

      expect(prisma.knowledgeSpace.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("技術文件");
    });
  });

  describe("createSpace()", () => {
    test("有效輸入應建立新 space", async () => {
      (prisma.knowledgeSpace.create as jest.Mock).mockResolvedValue(mockSpace);

      const result = await service.createSpace({
        name: "技術文件",
        description: "系統技術文件空間",
        createdBy: "user-1",
      });

      expect(prisma.knowledgeSpace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "技術文件", createdBy: "user-1" }),
        })
      );
      expect(result.name).toBe("技術文件");
    });

    test("名稱為空字串應拋出 ValidationError", async () => {
      await expect(
        service.createSpace({ name: "", createdBy: "user-1" })
      ).rejects.toThrow(ValidationError);

      expect(prisma.knowledgeSpace.create).not.toHaveBeenCalled();
    });

    test("名稱只含空白應拋出 ValidationError", async () => {
      await expect(
        service.createSpace({ name: "   ", createdBy: "user-1" })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("deleteSpace()", () => {
    test("不含文件的 space 應成功刪除", async () => {
      (prisma.knowledgeSpace.findUnique as jest.Mock).mockResolvedValue({
        ...mockSpace,
        _count: { documents: 0 },
      });
      (prisma.knowledgeSpace.delete as jest.Mock).mockResolvedValue(mockSpace);

      const result = await service.deleteSpace("space-1");

      expect(prisma.knowledgeSpace.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "space-1" } })
      );
      expect(result).toBeDefined();
    });

    test("含有文件的 space 不可刪除，應拋出 ValidationError", async () => {
      (prisma.knowledgeSpace.findUnique as jest.Mock).mockResolvedValue({
        ...mockSpace,
        _count: { documents: 3 }, // 有 3 份文件
      });

      await expect(service.deleteSpace("space-1")).rejects.toThrow(ValidationError);
      expect(prisma.knowledgeSpace.delete).not.toHaveBeenCalled();
    });

    test("space 不存在應拋出 NotFoundError", async () => {
      (prisma.knowledgeSpace.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteSpace("non-existent")).rejects.toThrow(NotFoundError);
      expect(prisma.knowledgeSpace.delete).not.toHaveBeenCalled();
    });
  });
});
