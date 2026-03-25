/**
 * GET /api/reports/timesheet-compliance — Compliance export (TS-28)
 *
 * Returns structured compliance report with per-user daily hours,
 * overtime flags, and locked status. Designed for bank audit exports.
 * Only MANAGER role may access.
 *
 * Query params:
 *   startDate — ISO date string (required)
 *   endDate   — ISO date string (required)
 *   format    — "json" (default) or "excel"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";

interface DailyEntry {
  date: string;
  hours: number;
  overtime: boolean;
  locked: boolean;
  category: string;
}

interface UserComplianceRow {
  userId: string;
  userName: string;
  totalHours: number;
  dailyEntries: DailyEntry[];
  hasOvertime: boolean;
  hasUnlocked: boolean;
}

export const GET = withManager(async (req: NextRequest) => {
  await requireRole("MANAGER");

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const format = searchParams.get("format") ?? "json";

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Get all time entries in the range
  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ userId: "asc" }, { date: "asc" }],
  });

  // Group by user
  const byUser = new Map<string, { userName: string; entries: typeof entries }>();

  for (const entry of entries) {
    const userId = entry.userId;
    const userName = (entry as unknown as { user: { name: string } }).user?.name ?? "Unknown";
    if (!byUser.has(userId)) {
      byUser.set(userId, { userName, entries: [] });
    }
    byUser.get(userId)!.entries.push(entry);
  }

  // Build compliance rows
  const users: UserComplianceRow[] = [];

  for (const [userId, { userName, entries: userEntries }] of byUser) {
    const dailyEntries: DailyEntry[] = userEntries.map((e) => ({
      date: new Date(e.date).toISOString().slice(0, 10),
      hours: e.hours,
      overtime: Boolean((e as Record<string, unknown>).overtime),
      locked: Boolean((e as Record<string, unknown>).locked),
      category: e.category,
    }));

    const totalHours = userEntries.reduce((sum, e) => sum + e.hours, 0);
    const hasOvertime = dailyEntries.some((d) => d.overtime);
    const hasUnlocked = dailyEntries.some((d) => !d.locked);

    users.push({
      userId,
      userName,
      totalHours,
      dailyEntries,
      hasOvertime,
      hasUnlocked,
    });
  }

  // Excel export
  if (format === "excel") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("工時合規報表");

    // Headers
    sheet.columns = [
      { header: "員工ID", key: "userId", width: 20 },
      { header: "員工姓名", key: "userName", width: 15 },
      { header: "日期", key: "date", width: 12 },
      { header: "工時", key: "hours", width: 10 },
      { header: "加班", key: "overtime", width: 8 },
      { header: "已鎖定", key: "locked", width: 8 },
      { header: "分類", key: "category", width: 15 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };

    // Data rows
    for (const user of users) {
      for (const de of user.dailyEntries) {
        sheet.addRow({
          userId: user.userId,
          userName: user.userName,
          date: de.date,
          hours: de.hours,
          overtime: de.overtime ? "是" : "否",
          locked: de.locked ? "是" : "否",
          category: de.category,
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="compliance-${startDate}-${endDate}.xlsx"`,
      },
    });
  }

  return success({
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    users,
  });
});
