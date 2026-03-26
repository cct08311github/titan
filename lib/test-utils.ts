import { jest } from "@jest/globals";
import { MockPrismaClient } from "../__mocks__/prisma";

/**
 * Creates a fresh mock prisma instance for each test.
 * Each model method is reset to a new jest.fn().
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

  return {
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
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  } as unknown as MockPrismaClient;
}
