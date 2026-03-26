/**
 * GET /api/time-entries/monthly?month=2026-03
 *
 * Returns all team members' time entries for the specified month.
 * MANAGER only — Issue #851 (Phase 2).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";

const monthParamSchema = z.string().regex(/^\d{4}-\d{2}$/, "格式須為 YYYY-MM");

export const GET = withManager(async (req: NextRequest) => {
  await requireRole("MANAGER");

  const { searchParams } = new URL(req.url);
  const monthRaw = searchParams.get("month");

  // Validate month param
  const monthResult = monthParamSchema.safeParse(monthRaw);
  if (!monthResult.success) {
    return success({ error: "month 參數格式須為 YYYY-MM" }, 400) as never;
  }
  const month = monthResult.data;

  // Calculate date range for the month
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0); // last day of month

  // Get active engineers only — managers' time is auto-approved (#928)
  const users = await prisma.user.findMany({
    where: { isActive: true, role: "ENGINEER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // Get all time entries for the month (all users)
  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Group entries by userId → date
  const members = users.map((user) => {
    const userEntries = entries.filter((e) => e.userId === user.id);
    const days: Record<string, {
      totalHours: number;
      entries: typeof entries;
      approvalStatus: string;
    }> = {};

    for (const entry of userEntries) {
      // Use local date string from the Date object
      const dateKey = entry.date.toISOString().split("T")[0];
      if (!days[dateKey]) {
        days[dateKey] = { totalHours: 0, entries: [], approvalStatus: "PENDING" };
      }
      days[dateKey].totalHours += entry.hours;
      days[dateKey].entries.push(entry);
    }

    // Determine day-level approval status:
    // ALL approved → APPROVED, ANY rejected → REJECTED, otherwise PENDING
    for (const [, day] of Object.entries(days)) {
      const statuses = day.entries.map((e) => (e as Record<string, unknown>).approvalStatus as string);
      if (statuses.length > 0 && statuses.every((s) => s === "APPROVED")) {
        day.approvalStatus = "APPROVED";
      } else if (statuses.some((s) => s === "REJECTED")) {
        day.approvalStatus = "REJECTED";
      } else {
        day.approvalStatus = "PENDING";
      }
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      days,
    };
  });

  return success({
    month,
    daysInMonth: endDate.getDate(),
    members,
  });
});
