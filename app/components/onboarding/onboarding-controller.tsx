"use client";

/**
 * OnboardingController — Issue #1315
 *
 * Client component that checks whether the current user has completed
 * onboarding and conditionally renders the OnboardingGuide overlay.
 *
 * Reads `hasCompletedOnboarding` from the Next-Auth session extended field.
 * Calls POST /api/users/me/onboarding when the user completes or dismisses.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { OnboardingGuide } from "./onboarding-guide";

export function OnboardingController() {
  const { data: session, status, update } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const user = session?.user as
      | { hasCompletedOnboarding?: boolean; mustChangePassword?: boolean }
      | undefined;

    // Do not show onboarding if the user must change their password first
    if (user?.mustChangePassword) return;

    if (user?.hasCompletedOnboarding === false) {
      setVisible(true);
    }
  }, [session, status]);

  const handleComplete = async () => {
    setVisible(false);
    try {
      await fetch("/api/users/me/onboarding", { method: "POST" });
      // Refresh session so hasCompletedOnboarding reflects the new state
      await update({ hasCompletedOnboarding: true });
    } catch {
      // Non-fatal: guide is already hidden
    }
  };

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await fetch("/api/users/me/onboarding", { method: "POST" });
      await update({ hasCompletedOnboarding: true });
    } catch {
      // Non-fatal
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <OnboardingGuide onComplete={handleComplete} onDismiss={handleDismiss} />
    </div>
  );
}
