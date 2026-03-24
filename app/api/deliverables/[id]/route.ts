import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const PATCH = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const body = await req.json();

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
      ...(body.acceptedBy !== undefined && { acceptedBy: body.acceptedBy }),
      ...(body.acceptedAt !== undefined && { acceptedAt: body.acceptedAt ? new Date(body.acceptedAt) : null }),
    },
  });

  return success(deliverable);
});

export const DELETE = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  await prisma.deliverable.delete({ where: { id } });
  return success({ success: true });
});
