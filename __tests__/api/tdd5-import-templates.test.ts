/**
 * @jest-environment node
 */
/**
 * TDD-5: Import + Template routes
 *
 * Tests for:
 * - POST /api/tasks/import: Excel parsing mock, batch create, validation errors
 * - POST /api/tasks/import-template: JSON template, offsetDays, max 50 limit
 * - GET/POST/DELETE /api/task-templates: CRUD, Manager-only for delete
 * - POST /api/task-templates/[id]/apply: template apply, task creation
 *
 * Fixes #559
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockTask = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  count: jest.fn(),
};

const mockTaskTemplate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    taskTemplate: mockTaskTemplate,
    $transaction: jest.fn((fns: unknown[]) => {
      if (Array.isArray(fns)) return Promise.all(fns);
      if (typeof fns === "function") return (fns as Function)();
      return Promise.resolve(fns);
    }),
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const MEMBER = {
  user: { id: "u1", name: "Member", email: "m@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MANAGER = {
  user: { id: "mgr", name: "Manager", email: "mgr@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ── Suppress infrastructure noise ────────────────────────────────────────────

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/lib/request-logger", () => ({
  requestLogger: (_req: unknown, fn: Function) => fn(),
}));

jest.mock("@/lib/csrf", () => ({
  validateCsrf: jest.fn(),
  CsrfError: class CsrfError extends Error {},
}));

jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 60;
  },
}));

jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TASKS IMPORT: POST /api/tasks/import
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/tasks/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when non-Manager tries to import", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/tasks/import/route");
    const req = {
      url: "http://localhost/api/tasks/import",
      method: "POST",
      headers: new Headers({ "content-type": "multipart/form-data" }),
      json: jest.fn(),
      formData: jest.fn(),
      nextUrl: new URL("http://localhost/api/tasks/import"),
    } as unknown as import("next/server").NextRequest;

    const res = await (POST as Function)(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when Content-Type is not multipart/form-data", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/tasks/import/route");
    const req = {
      url: "http://localhost/api/tasks/import",
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      json: jest.fn(),
      nextUrl: new URL("http://localhost/api/tasks/import"),
    } as unknown as import("next/server").NextRequest;

    const res = await (POST as Function)(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("multipart/form-data");
  });

  it("returns 400 when file field is missing", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const formData = new FormData();
    const { POST } = await import("@/app/api/tasks/import/route");
    const req = {
      url: "http://localhost/api/tasks/import",
      method: "POST",
      headers: new Headers({ "content-type": "multipart/form-data" }),
      formData: jest.fn().mockResolvedValue(formData),
      nextUrl: new URL("http://localhost/api/tasks/import"),
    } as unknown as import("next/server").NextRequest;

    const res = await (POST as Function)(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("file");
  });

  it("returns 400 when file is not .xlsx", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const file = new File(["data"], "test.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);

    const { POST } = await import("@/app/api/tasks/import/route");
    const req = {
      url: "http://localhost/api/tasks/import",
      method: "POST",
      headers: new Headers({ "content-type": "multipart/form-data" }),
      formData: jest.fn().mockResolvedValue(formData),
      nextUrl: new URL("http://localhost/api/tasks/import"),
    } as unknown as import("next/server").NextRequest;

    const res = await (POST as Function)(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain(".xlsx");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS IMPORT TEMPLATE: POST /api/tasks/import-template
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/tasks/import-template", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when non-Manager tries to import template", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: {
          templateName: "Test",
          tasks: [{ title: "Task 1" }],
        },
      })
    );

    expect(res.status).toBe(403);
  });

  it("creates tasks from template JSON", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockTask.create.mockResolvedValue({ id: "t-new", title: "Task 1" });

    // Mock TaskService - it's instantiated internally, so we mock the module
    jest.mock("@/services/task-service", () => ({
      TaskService: jest.fn().mockImplementation(() => ({
        createTask: jest.fn().mockResolvedValue({ id: "t-new", title: "Task 1" }),
      })),
    }));

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: {
          templateName: "Quarterly Review",
          tasks: [
            { title: "Collect metrics", priority: "P1", estimatedHours: 4 },
            { title: "Write report", priority: "P2", estimatedHours: 8, offsetDays: 7 },
          ],
        },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.templateName).toBe("Quarterly Review");
    expect(body.data.created).toBe(2);
  });

  it("returns 400 when tasks array is empty", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: { tasks: [] },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when tasks exceed 50 limit", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const tasks = Array.from({ length: 51 }, (_, i) => ({ title: `Task ${i}` }));

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: { tasks },
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("50");
  });

  it("returns 400 when body has no tasks field", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: { templateName: "No tasks" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("reports errors for tasks with empty titles", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);

    jest.mock("@/services/task-service", () => ({
      TaskService: jest.fn().mockImplementation(() => ({
        createTask: jest.fn().mockResolvedValue({ id: "t1", title: "Valid" }),
      })),
    }));

    const { POST } = await import("@/app/api/tasks/import-template/route");
    const res = await (POST as Function)(
      createMockRequest("/api/tasks/import-template", {
        method: "POST",
        body: {
          tasks: [
            { title: "" },
            { title: "Valid Task" },
          ],
        },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.failed).toBeGreaterThanOrEqual(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].index).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK TEMPLATES: GET /api/task-templates
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/task-templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns paginated template list", async () => {
    const templates = [
      { id: "tpl-1", title: "Deploy Template", creator: { id: "u1", name: "User" } },
    ];
    mockTaskTemplate.findMany.mockResolvedValue(templates);
    mockTaskTemplate.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/task-templates/route");
    const res = await (GET as Function)(
      createMockRequest("/api/task-templates")
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.total).toBe(1);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/task-templates/route");
    const res = await (GET as Function)(
      createMockRequest("/api/task-templates")
    );

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK TEMPLATES: POST /api/task-templates
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/task-templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a template as authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    const created = {
      id: "tpl-new",
      title: "Review Template",
      priority: "P2",
      category: "PLANNED",
      creator: { id: "u1", name: "Member" },
    };
    mockTaskTemplate.create.mockResolvedValue(created);

    const { POST } = await import("@/app/api/task-templates/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates", {
        method: "POST",
        body: { title: "Review Template" },
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Review Template");
  });

  it("returns 400 when title is missing (Zod)", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/task-templates/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates", {
        method: "POST",
        body: { description: "No title" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid priority enum", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);

    const { POST } = await import("@/app/api/task-templates/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates", {
        method: "POST",
        body: { title: "Test", priority: "CRITICAL" },
      })
    );

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK TEMPLATES: GET /api/task-templates/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe("GET /api/task-templates/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  it("returns a template by id", async () => {
    const template = {
      id: "tpl-1",
      title: "Deploy",
      creator: { id: "u1", name: "User" },
    };
    mockTaskTemplate.findUnique.mockResolvedValue(template);

    const { GET } = await import("@/app/api/task-templates/[id]/route");
    const res = await (GET as Function)(
      createMockRequest("/api/task-templates/tpl-1"),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("tpl-1");
  });

  it("returns 404 when template not found", async () => {
    mockTaskTemplate.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/task-templates/[id]/route");
    const res = await (GET as Function)(
      createMockRequest("/api/task-templates/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK TEMPLATES: DELETE /api/task-templates/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe("DELETE /api/task-templates/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows Manager to delete any template", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockTaskTemplate.findUnique.mockResolvedValue({ creatorId: "someone-else" });
    mockTaskTemplate.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/task-templates/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/task-templates/tpl-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(200);
  });

  it("allows creator to delete own template", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    mockTaskTemplate.findUnique.mockResolvedValue({ creatorId: "u1" });
    mockTaskTemplate.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/task-templates/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/task-templates/tpl-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(200);
  });

  it("returns 403 when non-creator non-Manager tries to delete", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER);
    mockTaskTemplate.findUnique.mockResolvedValue({ creatorId: "someone-else" });

    const { DELETE } = await import("@/app/api/task-templates/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/task-templates/tpl-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 when template not found", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER);
    mockTaskTemplate.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/task-templates/[id]/route");
    const res = await (DELETE as Function)(
      createMockRequest("/api/task-templates/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK TEMPLATES APPLY: POST /api/task-templates/[id]/apply
// ═══════════════════════════════════════════════════════════════════════════

describe("POST /api/task-templates/[id]/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER);
  });

  const mockTemplate = {
    id: "tpl-1",
    title: "Deploy Checklist",
    description: "Standard deploy steps",
    priority: "P1",
    category: "PLANNED",
    estimatedHours: 4,
  };

  it("creates a task from template with defaults", async () => {
    mockTaskTemplate.findUnique.mockResolvedValue(mockTemplate);
    const createdTask = {
      id: "task-new",
      title: "Deploy Checklist",
      status: "BACKLOG",
      primaryAssignee: null,
      backupAssignee: null,
      creator: { id: "u1", name: "Member" },
    };
    mockTask.create.mockResolvedValue(createdTask);

    const { POST } = await import("@/app/api/task-templates/[id]/apply/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates/tpl-1/apply", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe("Deploy Checklist");
    expect(body.data.status).toBe("BACKLOG");
  });

  it("applies overrides (assignee, dueDate)", async () => {
    mockTaskTemplate.findUnique.mockResolvedValue(mockTemplate);
    const createdTask = {
      id: "task-new",
      title: "Deploy Checklist",
      status: "BACKLOG",
      primaryAssignee: { id: "u2", name: "Alice" },
      backupAssignee: null,
      creator: { id: "u1", name: "Member" },
    };
    mockTask.create.mockResolvedValue(createdTask);

    const { POST } = await import("@/app/api/task-templates/[id]/apply/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates/tpl-1/apply", {
        method: "POST",
        body: {
          primaryAssigneeId: "u2",
          dueDate: "2026-06-30T00:00:00.000Z",
        },
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(201);

    // Verify task.create was called with override values
    expect(mockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Deploy Checklist",
          status: "BACKLOG",
          primaryAssigneeId: "u2",
        }),
      })
    );
  });

  it("returns 404 when template not found", async () => {
    mockTaskTemplate.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/task-templates/[id]/apply/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates/nonexistent/apply", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/task-templates/[id]/apply/route");
    const res = await (POST as Function)(
      createMockRequest("/api/task-templates/tpl-1/apply", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id: "tpl-1" }) }
    );

    expect(res.status).toBe(401);
  });
});
