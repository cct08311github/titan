/**
 * Tests for time distribution aggregation logic — R-2 (#837)
 */
import {
  aggregateTimeDistribution,
  ALL_CATEGORIES,
} from "../time-distribution";

describe("aggregateTimeDistribution", () => {
  it("returns empty arrays when no entries", () => {
    const result = aggregateTimeDistribution([]);
    expect(result.users).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.series).toEqual({});
  });

  it("aggregates hours by user and category", () => {
    const entries = [
      { userId: "u1", hours: 4, category: "PLANNED_TASK", user: { name: "Alice" } },
      { userId: "u1", hours: 2, category: "INCIDENT", user: { name: "Alice" } },
      { userId: "u2", hours: 6, category: "PLANNED_TASK", user: { name: "Bob" } },
      { userId: "u2", hours: 1, category: "SUPPORT", user: { name: "Bob" } },
    ];

    const result = aggregateTimeDistribution(entries);

    expect(result.users).toEqual(["Alice", "Bob"]);
    expect(result.categories).toContain("PLANNED_TASK");
    expect(result.categories).toContain("INCIDENT");
    expect(result.categories).toContain("SUPPORT");
    // Alice index=0, Bob index=1
    expect(result.series["PLANNED_TASK"]).toEqual([4, 6]);
    expect(result.series["INCIDENT"]).toEqual([2, 0]);
    expect(result.series["SUPPORT"]).toEqual([0, 1]);
  });

  it("sorts users alphabetically by name", () => {
    const entries = [
      { userId: "u2", hours: 1, category: "PLANNED_TASK", user: { name: "Zara" } },
      { userId: "u1", hours: 1, category: "PLANNED_TASK", user: { name: "Alice" } },
    ];

    const result = aggregateTimeDistribution(entries);
    expect(result.users).toEqual(["Alice", "Zara"]);
  });

  it("excludes categories with zero total hours", () => {
    const entries = [
      { userId: "u1", hours: 5, category: "PLANNED_TASK", user: { name: "Alice" } },
    ];

    const result = aggregateTimeDistribution(entries);
    expect(result.categories).toEqual(["PLANNED_TASK"]);
    expect(result.series["INCIDENT"]).toBeUndefined();
  });

  it("rounds hours to 1 decimal", () => {
    const entries = [
      { userId: "u1", hours: 1.333, category: "ADMIN", user: { name: "Alice" } },
      { userId: "u1", hours: 2.666, category: "ADMIN", user: { name: "Alice" } },
    ];

    const result = aggregateTimeDistribution(entries);
    // 1.333 + 2.666 = 3.999 → rounded to 4.0
    expect(result.series["ADMIN"]![0]).toBe(4);
  });

  it("shows 0 for users with no hours in a category", () => {
    const entries = [
      { userId: "u1", hours: 3, category: "PLANNED_TASK", user: { name: "Alice" } },
      { userId: "u2", hours: 2, category: "INCIDENT", user: { name: "Bob" } },
    ];

    const result = aggregateTimeDistribution(entries);
    // Alice has 0 INCIDENT, Bob has 0 PLANNED_TASK
    expect(result.series["PLANNED_TASK"]).toEqual([3, 0]);
    expect(result.series["INCIDENT"]).toEqual([0, 2]);
  });
});
