import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { withManager } from "@/lib/auth-middleware";
import { generateProjectExcel, generateQuarterlyReport } from "@/lib/excel/project-templates";
import type { ProjectStatus } from "@prisma/client";
import { parseYearOptional, parseQuarter } from "@/lib/query-params";

const projectService = new ProjectService(prisma);

export const GET = withManager(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "full" | "summary" | "quarterly" | null;

  const filter = {
    year: parseYearOptional(searchParams.get("year")),
    status: searchParams.get("status") as ProjectStatus | undefined,
    requestDept: searchParams.get("requestDept") ?? undefined,
  };

  // Quarterly report (type=quarterly&quarter=1&year=2026)
  if (type === "quarterly") {
    const quarter = parseQuarter(searchParams.get("quarter"));
    const year = filter.year ?? new Date().getFullYear();
    const projects = await projectService.getProjectsForExport({ ...filter, year });
    const buffer = await generateQuarterlyReport(projects, quarter, year);
    const filename = `quarterly-report-${year}-Q${quarter}.xlsx`;
    const safeName = filename.replace(/[^\w\-\.]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  }

  // Excel export (type=full or type=summary)
  if (type === "full" || type === "summary") {
    const projects = await projectService.getProjectsForExport(filter);
    const buffer = await generateProjectExcel(projects, type);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = type === "full"
      ? `projects-full-${dateStr}.xlsx`
      : `projects-summary-${dateStr}.xlsx`;
    const safeName = filename.replace(/[^\w\-\.]/g, "_");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  }

  // Fallback: CSV export (original behavior)
  const csv = await projectService.exportCsv(filter);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${new Date().toISOString().split("T")[0].replace(/[^\w\-\.]/g, "_")}.csv"`,
    },
  });
});
