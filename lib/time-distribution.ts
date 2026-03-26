/**
 * Time distribution aggregation logic — R-2 (#837)
 *
 * Aggregates time entries into a chart-friendly format:
 * users × categories matrix for stacked bar chart rendering.
 */

export const ALL_CATEGORIES = [
  "PLANNED_TASK",
  "ADDED_TASK",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
];

export interface TimeDistributionResult {
  users: string[];
  categories: string[];
  series: Record<string, number[]>;
}

interface TimeEntryInput {
  userId: string;
  hours: number;
  category: string;
  user: { name: string } | null;
}

/**
 * Aggregate time entries by user and category.
 * Returns chart-ready data with users sorted alphabetically.
 * Categories with zero total across all users are excluded.
 * Hours are rounded to 1 decimal place.
 */
export function aggregateTimeDistribution(
  entries: TimeEntryInput[],
): TimeDistributionResult {
  if (entries.length === 0) {
    return { users: [], categories: [], series: {} };
  }

  // Group by user
  const userMap = new Map<string, { name: string; byCategory: Record<string, number> }>();

  for (const entry of entries) {
    const userId = entry.userId;
    const userName = entry.user?.name ?? "Unknown";

    if (!userMap.has(userId)) {
      userMap.set(userId, { name: userName, byCategory: {} });
    }

    const u = userMap.get(userId)!;
    u.byCategory[entry.category] = (u.byCategory[entry.category] ?? 0) + entry.hours;
  }

  // Sort users alphabetically
  const userEntries = Array.from(userMap.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  const users = userEntries.map(([, v]) => v.name);

  // Determine active categories (non-zero total)
  const activeCategories = ALL_CATEGORIES.filter((cat) =>
    userEntries.some(([, v]) => (v.byCategory[cat] ?? 0) > 0),
  );

  // Build series
  const series: Record<string, number[]> = {};
  for (const cat of activeCategories) {
    series[cat] = userEntries.map(([, v]) =>
      Math.round((v.byCategory[cat] ?? 0) * 10) / 10,
    );
  }

  return { users, categories: activeCategories, series };
}
