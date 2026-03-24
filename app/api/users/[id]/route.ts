import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { validateBody } from "@/lib/validate";
import { updateUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

const userService = new UserService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  const user = await userService.getUser(id);
  return success(user);
});

export const PUT = withManager(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  const raw = await req.json();
  const body = validateBody(updateUserSchema, raw);
  const user = await userService.updateUser(id, body);
  return success(user);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "unsuspend") {
    const user = await userService.unsuspendUser(id);
    return success(user);
  }

  // Default DELETE action = suspend
  const user = await userService.suspendUser(id);
  return success(user);
});
