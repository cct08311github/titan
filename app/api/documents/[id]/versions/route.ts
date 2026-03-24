import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context.params;
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { version: "desc" },
  });

  return success(versions);
});
