import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { mockPrisma } from "../../__mocks__/prisma";
import {
  parseKimaiCsv,
  KimaiImportService,
  type KimaiRow,
} from "../../services/kimai-import-service";

// Mock Prisma
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe("Kimai Import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseKimaiCsv", () => {
    it("parses Kimai CSV format correctly", () => {
      const csv = [
        "Date,From,To,Duration,Rate,Project,Activity,Description",
        "2026-03-20,09:00,10:30,1.50,0,TITAN Development,Coding,Implement API",
        "2026-03-20,13:00,15:00,2.00,0,Security Review,Meeting,Weekly sync",
      ].join("\n");

      const rows = parseKimaiCsv(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          date: "2026-03-20",
          from: "09:00",
          to: "10:30",
          duration: 1.5,
          project: "TITAN Development",
          activity: "Coding",
          description: "Implement API",
        })
      );
      expect(rows[1].duration).toBe(2.0);
    });

    it("validates date format", () => {
      const csv = [
        "Date,From,To,Duration,Rate,Project,Activity,Description",
        "20/03/2026,09:00,10:30,1.50,0,TITAN,Coding,test",
      ].join("\n");

      expect(() => parseKimaiCsv(csv)).toThrow(/日期格式/);
    });

    it("rejects empty file", () => {
      expect(() => parseKimaiCsv("")).toThrow(/空檔案/);
    });

    it("rejects file with only headers", () => {
      const csv = "Date,From,To,Duration,Rate,Project,Activity,Description";
      expect(() => parseKimaiCsv(csv)).toThrow(/沒有資料/);
    });

    it("handles CSV with extra whitespace", () => {
      const csv = [
        "Date,From,To,Duration,Rate,Project,Activity,Description",
        " 2026-03-20 , 09:00 , 10:30 , 1.50 , 0 , TITAN Dev , Coding , test ",
      ].join("\n");

      const rows = parseKimaiCsv(csv);
      expect(rows[0].date).toBe("2026-03-20");
      expect(rows[0].project).toBe("TITAN Dev");
    });

    it("handles quoted fields with commas", () => {
      const csv = [
        "Date,From,To,Duration,Rate,Project,Activity,Description",
        '2026-03-20,09:00,10:30,1.50,0,TITAN,"Code, review","Fix bug, deploy"',
      ].join("\n");

      const rows = parseKimaiCsv(csv);
      expect(rows[0].activity).toBe("Code, review");
      expect(rows[0].description).toBe("Fix bug, deploy");
    });
  });

  describe("KimaiImportService", () => {
    let service: KimaiImportService;

    beforeEach(() => {
      service = new KimaiImportService(mockPrisma as any);
    });

    it("maps Kimai project to TITAN task by title", async () => {
      const rows: KimaiRow[] = [
        {
          date: "2026-03-20",
          from: "09:00",
          to: "10:30",
          duration: 1.5,
          rate: 0,
          project: "TITAN Development",
          activity: "Coding",
          description: "Implement API",
        },
      ];

      // Mock: find task by title
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue({
        id: "task-1",
        title: "TITAN Development",
      });

      (mockPrisma.timeEntry.create as jest.Mock).mockResolvedValue({
        id: "te-1",
      });

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: any) => fn(mockPrisma)
      );

      const result = await service.importRows(rows, "user-1");

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: { contains: "TITAN Development", mode: "insensitive" },
          }),
        })
      );
    });

    it("handles missing task gracefully — creates as free time", async () => {
      const rows: KimaiRow[] = [
        {
          date: "2026-03-20",
          from: "09:00",
          to: "10:30",
          duration: 1.5,
          rate: 0,
          project: "Unknown Project",
          activity: "Meeting",
          description: "External meeting",
        },
      ];

      // Mock: no matching task
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.timeEntry.create as jest.Mock).mockResolvedValue({
        id: "te-2",
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: any) => fn(mockPrisma)
      );

      const result = await service.importRows(rows, "user-1");

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Should create time entry without taskId (free time)
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: null,
            category: "ADMIN",
            description: expect.stringContaining("Unknown Project"),
          }),
        })
      );
    });

    it("imports multiple rows and reports results", async () => {
      const rows: KimaiRow[] = [
        {
          date: "2026-03-20",
          from: "09:00",
          to: "10:00",
          duration: 1.0,
          rate: 0,
          project: "Project A",
          activity: "Dev",
          description: "Work 1",
        },
        {
          date: "2026-03-20",
          from: "10:00",
          to: "12:00",
          duration: 2.0,
          rate: 0,
          project: "Project B",
          activity: "Review",
          description: "Work 2",
        },
      ];

      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue({
        id: "task-1",
        title: "Project A",
      });
      (mockPrisma.timeEntry.create as jest.Mock).mockResolvedValue({
        id: "te-new",
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (fn: any) => fn(mockPrisma)
      );

      const result = await service.importRows(rows, "user-1");

      expect(result.created).toBe(2);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledTimes(2);
    });
  });
});
