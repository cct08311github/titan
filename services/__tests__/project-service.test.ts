/**
 * ProjectService tests — Issue #1309
 *
 * Covers: listProjects, getProject, createProject (basic CRUD)
 */

import { ProjectService } from "../project-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError } from "../errors";

// Extend the mock prisma with `project` model
function createMockPrismaWithProject() {
  const base = createMockPrisma();
  const createMockModel = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  });
  return {
    ...base,
    project: createMockModel(),
  };
}

type MockPrismaWithProject = ReturnType<typeof createMockPrismaWithProject>;

describe("ProjectService", () => {
  let service: ProjectService;
  let prisma: MockPrismaWithProject;

  beforeEach(() => {
    prisma = createMockPrismaWithProject();
    // Wire $transaction to pass prisma itself as tx (same pattern as createMockPrisma)
    (prisma.$transaction as jest.Mock).mockImplementation((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Promise.all(arg as unknown[]);
    });
    service = new ProjectService(prisma as never);
  });

  test("listProjects returns paginated items", async () => {
    const mockItems = [
      { id: "p-1", code: "PRJ-2026-001", name: "Test Project", year: 2026 },
    ];
    (prisma.project.findMany as jest.Mock).mockResolvedValue(mockItems);
    (prisma.project.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listProjects({ year: 2026 });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ year: 2026, archivedAt: null }),
      })
    );
    expect(result.items).toEqual(mockItems);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  test("listProjects filters by status", async () => {
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.project.count as jest.Mock).mockResolvedValue(0);

    await service.listProjects({ status: "DEVELOPMENT" });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DEVELOPMENT" }),
      })
    );
  });

  test("getProject returns project when found", async () => {
    const mockProject = {
      id: "p-1",
      code: "PRJ-2026-001",
      name: "Test Project",
      risks: [],
      issues: [],
      stakeholders: [],
      gates: [],
      _count: { tasks: 0 },
    };
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

    const result = await service.getProject("p-1");

    expect(prisma.project.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-1" } })
    );
    expect(result).toEqual(mockProject);
  });

  test("getProject throws NotFoundError when project missing", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getProject("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("createProject creates project with auto-generated code", async () => {
    const mockCreated = {
      id: "p-1",
      code: "PRJ-2026-001",
      name: "New Project",
      gates: [],
      owner: { id: "u-1", name: "Owner" },
    };
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.project.create as jest.Mock).mockResolvedValue(mockCreated);

    const result = await service.createProject({
      name: "New Project",
      year: 2026,
      requestDept: "IT",
      ownerId: "u-1",
      createdBy: "u-1",
    });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "PRJ-2026-001",
          name: "New Project",
        }),
      })
    );
    expect(result).toEqual(mockCreated);
  });
});
