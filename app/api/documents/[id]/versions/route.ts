import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { id } = await context.params;
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { version: "desc" },
  });

  return success(versions);
});
