"use client";

/**
 * PasswordChangeGuard — Issue #182
 *
 * Client-side guard that checks the session for mustChangePassword flag.
 * Redirects to /change-password if the user needs to change their password
 * (first login or expired password).
 *
 * Works with both JWS and JWE tokens since it reads the resolved session.
 */

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname === "/change-password") return;

    const user = session?.user as { mustChangePassword?: boolean } | undefined;
    if (user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [session, status, router, pathname]);

  return <>{children}</>;
}
