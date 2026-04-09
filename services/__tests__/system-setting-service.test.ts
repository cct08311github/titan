/**
 * Unit tests for system-setting-service — Issue #1313
 *
 * Tests getSetting, setSetting, cache behavior, and cache invalidation.
 */

import { jest } from "@jest/globals";
import { getSetting, setSetting, clearSettingCache } from "../system-setting-service";
import { createMockPrisma } from "../../lib/test-utils";

type MockPrisma = ReturnType<typeof createMockPrisma>;

let prisma: MockPrisma;

beforeEach(() => {
  prisma = createMockPrisma();
  // Clear module-level cache before each test
  clearSettingCache();
});

afterEach(() => {
  clearSettingCache();
});

// ── getSetting ────────────────────────────────────────────────────────────────

describe("getSetting", () => {
  test("returns fallback when key does not exist in DB", async () => {
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getSetting("nonexistent.key", "fallback-value", {
      prisma: prisma as never,
    });

    expect(result).toBe("fallback-value");
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: "nonexistent.key" },
    });
  });

  test("returns value from DB when key exists", async () => {
    const storedValue = { remindDays: 5, warnDays: 10, escalateDays: 20 };
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue({
      key: "system.staleTaskThresholds",
      value: storedValue,
      updatedAt: new Date(),
      updatedBy: null,
    });

    const result = await getSetting("system.staleTaskThresholds", { remindDays: 3, warnDays: 7, escalateDays: 14 }, {
      prisma: prisma as never,
    });

    expect(result).toEqual(storedValue);
  });

  test("returns cached value on second call without hitting DB again", async () => {
    const storedValue = { foo: "bar" };
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue({
      key: "test.key",
      value: storedValue,
      updatedAt: new Date(),
      updatedBy: null,
    });

    // First call: DB hit
    await getSetting("test.key", {}, { prisma: prisma as never });
    // Second call: cached
    const result = await getSetting("test.key", {}, { prisma: prisma as never });

    expect(result).toEqual(storedValue);
    // DB should only have been called once
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
  });

  test("different keys are cached independently", async () => {
    (prisma.systemSetting.findUnique as jest.Mock)
      .mockResolvedValueOnce({ key: "key.a", value: "valueA", updatedAt: new Date(), updatedBy: null })
      .mockResolvedValueOnce({ key: "key.b", value: "valueB", updatedAt: new Date(), updatedBy: null });

    const a = await getSetting("key.a", "defaultA", { prisma: prisma as never });
    const b = await getSetting("key.b", "defaultB", { prisma: prisma as never });

    expect(a).toBe("valueA");
    expect(b).toBe("valueB");
  });
});

// ── setSetting ────────────────────────────────────────────────────────────────

describe("setSetting", () => {
  test("calls prisma upsert with correct key and value", async () => {
    (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});

    await setSetting("test.key", { foo: 42 }, "user-123", { prisma: prisma as never });

    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "test.key" },
        create: expect.objectContaining({ key: "test.key", updatedBy: "user-123" }),
        update: expect.objectContaining({ updatedBy: "user-123" }),
      })
    );
  });

  test("stores null updatedBy when not provided", async () => {
    (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});

    await setSetting("test.key", "value", undefined, { prisma: prisma as never });

    const call = (prisma.systemSetting.upsert as jest.Mock).mock.calls[0][0] as {
      create: { updatedBy: unknown };
    };
    expect(call.create.updatedBy).toBeNull();
  });

  test("invalidates cache so next getSetting hits DB", async () => {
    const oldValue = "old";
    const newValue = "new";

    // Prime the cache with oldValue
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      key: "cached.key",
      value: oldValue,
      updatedAt: new Date(),
      updatedBy: null,
    });
    await getSetting("cached.key", "default", { prisma: prisma as never });

    // Update the setting (this should clear cache)
    (prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({});
    await setSetting("cached.key", newValue, null, { prisma: prisma as never });

    // Next getSetting should hit DB again
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      key: "cached.key",
      value: newValue,
      updatedAt: new Date(),
      updatedBy: null,
    });
    const result = await getSetting("cached.key", "default", { prisma: prisma as never });

    expect(result).toBe(newValue);
    // findUnique was called twice (once before set, once after)
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ── clearSettingCache ─────────────────────────────────────────────────────────

describe("clearSettingCache", () => {
  test("clearing a specific key forces DB re-fetch", async () => {
    // Prime cache
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      key: "some.key",
      value: "v1",
      updatedAt: new Date(),
      updatedBy: null,
    });
    await getSetting("some.key", "default", { prisma: prisma as never });

    clearSettingCache("some.key");

    // Should hit DB again
    (prisma.systemSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      key: "some.key",
      value: "v2",
      updatedAt: new Date(),
      updatedBy: null,
    });
    const result = await getSetting("some.key", "default", { prisma: prisma as never });

    expect(result).toBe("v2");
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
  });

  test("clearing all keys forces DB re-fetch for all", async () => {
    (prisma.systemSetting.findUnique as jest.Mock)
      .mockResolvedValue({ key: "k", value: "cached", updatedAt: new Date(), updatedBy: null });

    await getSetting("k", "default", { prisma: prisma as never });
    clearSettingCache(); // clear all
    await getSetting("k", "default", { prisma: prisma as never });

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
  });
});
