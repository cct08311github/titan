"use client";

/**
 * PasswordChangeGuard — Issue #182, enhanced Issue #834 (AU-5)
 *
 * Client-side guard that checks:
 *   1. mustChangePassword flag (first login)
 *   2. passwordChangedAt expiry (90 days, Issue #834)
 * Redirects to /change-password if either condition is true.
 *
 * Works with both JWS and JWE tokens since it reads the resolved session.
 */

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const PASSWORD_MAX_AGE_DAYS = 90;

function isExpiredClient(passwordChangedAt?: string | null): boolean {
  if (!passwordChangedAt) return true;
  const changedMs = new Date(passwordChangedAt).getTime();
  const maxAgeMs = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - changedMs > maxAgeMs;
}

export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname === "/change-password") return;

    const user = session?.user as {
      mustChangePassword?: boolean;
      passwordChangedAt?: string | null;
    } | undefined;

    if (user?.mustChangePassword || isExpiredClient(user?.passwordChangedAt)) {
      router.replace("/change-password");
    }
  }, [session, status, router, pathname]);

  return <>{children}</>;
}
