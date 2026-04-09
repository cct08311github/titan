/**
 * POST /api/users/me/onboarding — Issue #1315
 *
 * Marks the current user's onboarding as completed and seeds sample data.
 * Called when the user clicks "開始使用" in the OnboardingGuide.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { seedSampleDataForUser } from "@/lib/seed-sample-data";
import { NotFoundError } from "@/services/errors";
import { logger } from "@/lib/logger";

export const POST = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  // Wrap in transaction so the guard read and the mark-complete update are atomic.
  // Prevents double-seeding if the user clicks "開始使用" concurrently.
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { hasCompletedOnboarding: true },
      });

      if (!user) {
        throw new NotFoundError("使用者不存在");
      }

      if (!user.hasCompletedOnboarding) {
        // Seed sample data then mark onboarding complete — both inside the transaction
        await seedSampleDataForUser(tx, userId);

        await tx.user.update({
          where: { id: userId },
          data: { hasCompletedOnboarding: true },
        });

        logger.info({ userId }, "[onboarding] Onboarding completed and sample data seeded");
      }
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return error("NotFoundError", "使用者不存在", 404);
    }
    throw err;
  }

  return success({ completed: true });
});
