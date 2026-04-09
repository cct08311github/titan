/**
 * Auth.js v5 type augmentation — Issue #200
 *
 * Extends the default Session and User types with TITAN-specific fields.
 */
import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      mustChangePassword?: boolean;
      passwordChangedAt?: string | null; // Issue #834: password expiry tracking
      hasCompletedOnboarding?: boolean;  // Issue #1315: onboarding flow
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    mustChangePassword?: boolean;
    passwordChangedAt?: string; // Issue #834
    hasCompletedOnboarding?: boolean; // Issue #1315
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    mustChangePassword?: boolean;
    passwordChangedAt?: string | null; // Issue #834
    hasCompletedOnboarding?: boolean;  // Issue #1315
    sessionId?: string;
  }
}
