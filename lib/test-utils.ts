import { jest } from "@jest/globals";
import { MockPrismaClient } from "../__mocks__/prisma";

/**
 * Creates a fresh mock prisma instance for each test.
 * Each model method is reset to a new jest.fn().
 *
 * $transaction default behavior: invokes the callback with the same mock instance,
 * so service code that wraps logic in `tx.model.update(...)` works transparently
 * in tests. Tests can override with `.mockImplementation(...)` if needed.
 */
export function createMockPrisma(): MockPrismaClient {
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

  const mock: Record<string, unknown> = {
    task: createMockModel(),
    annualPlan: createMockModel(),
    monthlyGoal: createMockModel(),
    kPI: createMockModel(),
    document: createMockModel(),
    documentVersion: createMockModel(),
    timeEntry: createMockModel(),
    user: createMockModel(),
    taskActivity: createMockModel(),
    taskChange: createMockModel(),
    kPITaskLink: createMockModel(),
    milestone: createMockModel(),
    subTask: createMockModel(),
    taskComment: createMockModel(),
    taskDocument: createMockModel(),
    permission: createMockModel(),
    notification: createMockModel(),
    notificationPreference: createMockModel(),
    deliverable: createMockModel(),
    auditLog: createMockModel(),
    systemSetting: createMockModel(),
    monitoringAlert: createMockModel(),
    pushToken: createMockModel(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  // $transaction passes `mock` itself to the callback so tx.model.method() === prisma.model.method()
  mock.$transaction = jest.fn().mockImplementation((arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)(mock);
    }
    // Array form: $transaction([promise1, promise2])
    return Promise.all(arg as unknown[]);
  });

  return mock as unknown as MockPrismaClient;
}
