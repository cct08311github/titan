/**
 * GET /api/projects/risks-summary — Risk heatmap data
 * Issue #1194 — PMO Visualizations
 *
 * Returns risk counts grouped by probability x impact across all projects.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const PROB_VALUES = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
const IMPACT_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const PROB_NUM: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4 };
const IMPACT_NUM: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!)
    : new Date().getFullYear();

  // Fetch all open/mitigating risks for the year with project info
  const risks = await prisma.projectRisk.findMany({
    where: {
      project: { year, archivedAt: null },
      status: { in: ["OPEN", "MITIGATING", "ACCEPTED"] },
    },
    select: {
      id: true,
      title: true,
      probability: true,
      impact: true,
      status: true,
      project: { select: { code: true } },
    },
  });

  // Build cells for every probability x impact combination
  const cells = [];
  for (const prob of PROB_VALUES) {
    for (const impact of IMPACT_VALUES) {
      const matching = risks.filter(
        (r) => r.probability === prob && r.impact === impact
      );
      cells.push({
        probability: prob,
        impact: impact,
        score: PROB_NUM[prob] * IMPACT_NUM[impact],
        count: matching.length,
        risks: matching.map((r) => ({
          id: r.id,
          title: r.title,
          projectCode: r.project.code,
          status: r.status,
        })),
      });
    }
  }

  return success(cells);
});
