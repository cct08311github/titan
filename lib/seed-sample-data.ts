/**
 * seedSampleDataForUser — Issue #1317
 *
 * Creates tutorial/sample records for a newly onboarded user so they see
 * a non-empty interface instead of blank pages.
 *
 * All records are tagged with isSample: true so they can be bulk-deleted
 * via DELETE /api/users/me/sample-data once the user is ready.
 */
import type { PrismaClient } from "@prisma/client";

/**
 * Seeds sample tasks and an annual plan for the given user.
 * Idempotent: checks for existing sample data before inserting.
 *
 * @param prisma - PrismaClient instance
 * @param userId - The ID of the user to seed data for
 */
export async function seedSampleDataForUser(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  const currentYear = new Date().getFullYear();

  // Guard: skip if sample tasks already exist for this user
  const existingSampleCount = await prisma.task.count({
    where: { isSample: true, creatorId: userId },
  });
  if (existingSampleCount > 0) {
    return;
  }

  // Create a sample annual plan
  const samplePlan = await prisma.annualPlan.create({
    data: {
      year: currentYear,
      title: `${currentYear} 年度計畫（範例）`,
      description:
        "這是一份範例年度計畫，幫助您了解 TITAN 的年度計畫功能。您可以刪除此範例或直接編輯使用。",
      isSample: true,
      createdBy: userId,
    },
  });

  // Create 3 sample tasks in different statuses
  const sampleTasks = [
    {
      title: "熟悉 TITAN — 建立第一個任務",
      description:
        "探索看板（Kanban）功能：建立任務、設定優先級、指派負責人。完成後將此任務拖曳到「完成」欄位。",
      status: "TODO" as const,
      priority: "P2" as const,
    },
    {
      title: "熟悉 TITAN — 記錄第一筆工時",
      description:
        "前往工時表頁面，點選今天的儲存格並輸入工時。支援鍵盤快速操作：Tab 切換儲存格、Enter 儲存。",
      status: "IN_PROGRESS" as const,
      priority: "P2" as const,
    },
    {
      title: "熟悉 TITAN — 瀏覽年度計畫",
      description:
        "查看年度計畫頁面，了解如何建立月度目標、追蹤里程碑與交付物。",
      status: "DONE" as const,
      priority: "P3" as const,
    },
  ];

  await prisma.task.createMany({
    data: sampleTasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      category: "PLANNED" as const,
      creatorId: userId,
      primaryAssigneeId: userId,
      annualPlanId: samplePlan.id,
      isSample: true,
      progressPct: t.status === "DONE" ? 100 : t.status === "IN_PROGRESS" ? 50 : 0,
    })),
  });
}
