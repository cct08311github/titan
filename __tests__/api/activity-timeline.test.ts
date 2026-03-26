/**
 * @jest-environment node
 */
/**
 * Activity Timeline — Issue #810 (AF-2)
 *
 * Tests the activity formatter and date grouping utilities.
 */

import {
  formatActivityDescription,
  getDateGroupLabel,
} from "@/lib/utils/activity-formatter";

describe("formatActivityDescription (AF-2)", () => {
  it("formats a CREATE action with resource name", () => {
    const result = formatActivityDescription({
      action: "CREATE",
      userName: "王小明",
      resourceType: "Task",
      resourceName: "修復登入 bug",
      detail: null,
      metadata: null,
    });
    expect(result).toBe("王小明 建立了任務『修復登入 bug』");
  });

  it("formats a STATUS_CHANGE with from/to details", () => {
    const result = formatActivityDescription({
      action: "STATUS_CHANGE",
      userName: "王小明",
      resourceType: "Task",
      resourceName: "修復登入 bug",
      detail: { from: "IN_PROGRESS", to: "REVIEW" },
      metadata: null,
    });
    expect(result).toBe("王小明 將任務『修復登入 bug』狀態從 進行中 改為 待審核");
  });

  it("formats a STATUS_CHANGED with status-only detail", () => {
    const result = formatActivityDescription({
      action: "STATUS_CHANGED",
      userName: "李大華",
      resourceType: "Task",
      resourceName: "部署 v2",
      detail: { status: "DONE" },
      metadata: null,
    });
    expect(result).toBe("李大華 將任務『部署 v2』狀態改為 已完成");
  });

  it("handles null userName gracefully", () => {
    const result = formatActivityDescription({
      action: "DELETE",
      userName: null,
      resourceType: "Document",
      resourceName: "舊文件",
      detail: null,
      metadata: null,
    });
    expect(result).toBe("系統 刪除了文件『舊文件』");
  });

  it("handles unknown action labels", () => {
    const result = formatActivityDescription({
      action: "CUSTOM_ACTION",
      userName: "張三",
      resourceType: "Task",
      resourceName: null,
      detail: null,
      metadata: null,
    });
    expect(result).toBe("張三 CUSTOM_ACTION任務");
  });

  it("handles unknown resource types", () => {
    const result = formatActivityDescription({
      action: "UPDATE",
      userName: "張三",
      resourceType: "CustomResource",
      resourceName: "test",
      detail: null,
      metadata: null,
    });
    expect(result).toBe("張三 更新了CustomResource『test』");
  });
});

describe("getDateGroupLabel (AF-2)", () => {
  const realDate = Date;

  function mockDate(isoDate: string) {
    const fixed = new realDate(isoDate);
    jest.spyOn(globalThis, "Date").mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return fixed;
      // @ts-expect-error spread constructor
      return new realDate(...args);
    });
    (globalThis.Date as unknown as typeof realDate).now = () => fixed.getTime();
    (globalThis.Date as unknown as typeof realDate).parse = realDate.parse;
    (globalThis.Date as unknown as typeof realDate).UTC = realDate.UTC;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns '今天' for today's date", () => {
    // Now = 2026-03-26 14:00 Taipei
    mockDate("2026-03-26T06:00:00.000Z");
    expect(getDateGroupLabel("2026-03-26T04:00:00.000Z")).toBe("今天");
  });

  it("returns '昨天' for yesterday's date", () => {
    mockDate("2026-03-26T06:00:00.000Z");
    expect(getDateGroupLabel("2026-03-25T04:00:00.000Z")).toBe("昨天");
  });

  it("returns 'N 天前' for dates within a week", () => {
    mockDate("2026-03-26T06:00:00.000Z");
    expect(getDateGroupLabel("2026-03-23T04:00:00.000Z")).toBe("3 天前");
  });

  it("returns formatted date for dates older than a week", () => {
    mockDate("2026-03-26T06:00:00.000Z");
    const result = getDateGroupLabel("2026-03-10T04:00:00.000Z");
    // Should contain month and day in Chinese locale
    expect(result).toMatch(/3月10日/);
  });
});
