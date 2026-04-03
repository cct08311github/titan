import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { withManager } from "@/lib/auth-middleware";
import { error as apiError } from "@/lib/api-response";
import { generateProjectReport } from "@/lib/excel/project-templates";

const projectService = new ProjectService(prisma);

export const GET = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const project = await projectService.getProject(id);

  if (!project) {
    return apiError("NotFound", "項目不存在", 404);
  }

  const buffer = await generateProjectReport({
    code: project.code,
    name: project.name,
    year: project.year,
    category: project.category,
    requestDept: project.requestDept,
    status: project.status,
    priority: project.priority,
    owner: project.owner,
    plannedStart: project.plannedStart,
    plannedEnd: project.plannedEnd,
    actualStart: project.actualStart,
    actualEnd: project.actualEnd,
    progressPct: project.progressPct,
    riskLevel: project.riskLevel,
    progressNote: project.progressNote,
    mdProjectMgmt: project.mdProjectMgmt,
    mdRequirements: project.mdRequirements,
    mdDesign: project.mdDesign,
    mdDevelopment: project.mdDevelopment,
    mdTesting: project.mdTesting,
    mdDeployment: project.mdDeployment,
    mdDocumentation: project.mdDocumentation,
    mdTraining: project.mdTraining,
    mdMaintenance: project.mdMaintenance,
    mdOther: project.mdOther,
    mdTotalEstimated: project.mdTotalEstimated,
    mdActualTotal: project.mdActualTotal,
    budgetInternal: project.budgetInternal,
    budgetExternal: project.budgetExternal,
    budgetHardware: project.budgetHardware,
    budgetLicense: project.budgetLicense,
    budgetOther: project.budgetOther,
    budgetTotal: project.budgetTotal,
    budgetActual: project.budgetActual,
    vendor: project.vendor,
    vendorAmount: project.vendorAmount,
    benefitScore: project.benefitScore,
    postReviewSchedule: project.postReviewSchedule,
    postReviewQuality: project.postReviewQuality,
    postReviewBudget: project.postReviewBudget,
    postReviewSatisfy: project.postReviewSatisfy,
    postReviewScore: project.postReviewScore,
    lessonsLearned: project.lessonsLearned,
    improvements: project.improvements,
    risks: project.risks.map((r) => ({
      code: r.code,
      title: r.title,
      probability: r.probability,
      impact: r.impact,
      status: r.status,
      mitigation: r.mitigation,
    })),
    issues: project.issues.map((i) => ({
      code: i.code,
      title: i.title,
      severity: i.severity,
      status: i.status,
      resolution: i.resolution,
    })),
  });

  const filename = `project-${project.code}-${new Date().toISOString().split("T")[0]}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
