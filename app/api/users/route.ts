import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  return success(users);
});
