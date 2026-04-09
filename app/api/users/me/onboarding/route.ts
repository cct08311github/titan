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
import { logger } from "@/lib/logger";

export const POST = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  // Guard: do not re-seed if already completed
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasCompletedOnboarding: true },
  });

  if (!user) {
    return error("NotFoundError", "使用者不存在", 404);
  }

  if (!user.hasCompletedOnboarding) {
    // Seed sample data first, then mark onboarding complete
    try {
      await seedSampleDataForUser(prisma, userId);
    } catch (err) {
      logger.error({ err, userId }, "[onboarding] Failed to seed sample data");
      // Non-fatal: continue to mark onboarding complete even if seeding fails
    }

    await prisma.user.update({
      where: { id: userId },
      data: { hasCompletedOnboarding: true },
    });

    logger.info({ userId }, "[onboarding] Onboarding completed and sample data seeded");
  }

  return success({ completed: true });
});
