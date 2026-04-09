/**
 * GET /api/tasks/tags — Issue #804 (K-2)
 *
 * Returns the list of available task tags.
 * Includes default tags (維運/開發/資安/稽核) and any custom tags
 * found in existing tasks.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

export interface TaskTag {
  name: string;
  color: string;
  isDefault: boolean;
}

/** Default tags for banking operations — Issue #804 */
const DEFAULT_TAGS: TaskTag[] = [
  { name: "維運", color: "#3B82F6", isDefault: true },
  { name: "開發", color: "#10B981", isDefault: true },
  { name: "資安", color: "#EF4444", isDefault: true },
  { name: "稽核", color: "#F59E0B", isDefault: true },
  { name: "文件", color: "#8B5CF6", isDefault: true },
  { name: "測試", color: "#06B6D4", isDefault: true },
  { name: "會議", color: "#6B7280", isDefault: true },
  { name: "教育訓練", color: "#EC4899", isDefault: true },
];

/** Color palette for custom tags */
const CUSTOM_TAG_COLORS = [
  "#0EA5E9", "#14B8A6", "#A855F7", "#F97316",
  "#84CC16", "#E11D48", "#6366F1", "#D946EF",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return CUSTOM_TAG_COLORS[Math.abs(hash) % CUSTOM_TAG_COLORS.length];
}

export const GET = withAuth(async (_req: NextRequest) => {
  // Fetch all unique tags from existing tasks
  const tasks = await prisma.task.findMany({
    where: { isSample: false, tags: { isEmpty: false } },
    select: { tags: true },
  });

  const allTagNames = new Set<string>();
  for (const task of tasks) {
    for (const tag of task.tags) {
      allTagNames.add(tag);
    }
  }

  // Merge defaults with custom (from DB)
  const defaultNames = new Set(DEFAULT_TAGS.map((t) => t.name));
  const customTags: TaskTag[] = [];
  for (const name of allTagNames) {
    if (!defaultNames.has(name)) {
      customTags.push({ name, color: hashColor(name), isDefault: false });
    }
  }

  const allTags = [...DEFAULT_TAGS, ...customTags.sort((a, b) => a.name.localeCompare(b.name))];

  return success({ tags: allTags });
});
