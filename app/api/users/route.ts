import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

export const GET = withAuth(async (req: NextRequest) => {

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  return success(users);
});
