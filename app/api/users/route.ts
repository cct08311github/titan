import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { validateBody } from "@/lib/validate";
import { createUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

const userService = new UserService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeSuspended = searchParams.get("includeSuspended") === "true";

  const users = await userService.listUsers({ includeSuspended });
  return success(users);
});

export const POST = withManager(async (req: NextRequest) => {
  const raw = await req.json();
  const body = validateBody(createUserSchema, raw);
  const user = await userService.createUser(body);
  return success(user, 201);
});
