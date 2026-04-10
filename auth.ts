/**
 * Auth.js v5 configuration — Issue #200
 *
 * Central auth configuration file. Exports:
 *   - handlers: { GET, POST } for the API route
 *   - auth: server-side session getter (replaces getServerSession)
 *   - signIn / signOut: server-side sign in/out helpers
 *
 * Migration from next-auth v4:
 *   - Config moved from app/api/auth/[...nextauth]/route.ts to here
 *   - getServerSession() replaced by auth()
 *   - Provider import path: next-auth/providers/credentials
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

/**
 * Pre-computed bcrypt hash (of a random string, cost=12).
 * Used for constant-time compare against non-existent users so that
 * the auth flow takes the same wall time whether or not the username
 * exists. Prevents username enumeration via response-time side channel.
 */
const DUMMY_PASSWORD_HASH =
  "$2a$12$J1e8N9mJcHMXxQmYaqnZg.R9TxR5xU.LzjxGjjqoV5kVkvTJQB80C";
import { prisma } from "@/lib/prisma";
import { createLoginRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { AccountLockService } from "@/lib/account-lock";
import { logger } from "@/lib/logger";
import { isPasswordExpired } from "@/lib/password-expiry";
import { getRedisClient } from "@/lib/redis";
import { AuditService } from "@/services/audit-service";
import { registerSession } from "@/lib/session-limiter";

/**
 * Singletons — created once at module load.
 * Issue #178: Use Redis when available, fallback to in-memory.
 */
const redis = getRedisClient();
const isTestEnv = process.env.NODE_ENV === "test" || process.env.E2E_TESTING === "true";
const loginRateLimiter = createLoginRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
  points: isTestEnv ? 10000 : undefined,
});
const accountLockService = new AccountLockService({
  maxFailures: 5,           // Issue #797: 5 consecutive failures
  lockDurationSeconds: 1800, // Issue #797: 30 minutes
  redisClient: redis,
});
const auditService = new AuditService(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "帳號", type: "text" },
        password: { label: "密碼", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const rawUsername = credentials.username as string;
        const username = rawUsername.includes("@") ? rawUsername : `${rawUsername}@titan.local`;
        const password = credentials.password as string;

        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const rateLimitKey = `${ip}_${username}`;
        const lockKey = username;

        // 1. Check account lockout first (cheaper than DB lookup)
        const locked = await accountLockService.isLocked(lockKey);
        if (locked) {
          const remaining = await accountLockService.getRemainingLockSeconds(lockKey);
          logger.warn(
            { username, ip, remaining },
            "[auth] Login blocked — account locked"
          );
          return null;
        }

        // 2. Enforce IP+username rate limit (5 attempts/min)
        // Skip rate limiting in development to avoid lockout during testing
        if (process.env.NODE_ENV !== "test") {
          try {
            await checkRateLimit(loginRateLimiter, rateLimitKey);
          } catch {
            logger.warn(
              { username, ip },
              "[auth] Login rate limit exceeded"
            );
            return null;
          }
        }

        // 3. Look up user
        const user = await prisma.user.findUnique({
          where: { email: username },
        });

        if (!user || !user.isActive) {
          // Constant-time defense against username enumeration: run a
          // throwaway bcrypt compare so non-existent users take the
          // same wall time as existing users with wrong passwords.
          await compare(password, DUMMY_PASSWORD_HASH);

          await accountLockService.recordFailure(lockKey);
          // Issue #187: persist login failure to AuditLog DB
          auditService.log({
            userId: null,
            action: "LOGIN_FAILURE",
            resourceType: "Auth",
            resourceId: null,
            detail: JSON.stringify({ username, reason: !user ? "user_not_found" : "account_inactive" }),
            ipAddress: ip,
          }).catch(() => {}); // fire-and-forget, never block auth
          return null;
        }

        const isValid = await compare(password, user.password);
        if (!isValid) {
          await accountLockService.recordFailure(lockKey);
          logger.warn(
            { username, ip },
            "[auth] Failed login attempt"
          );
          // Issue #187: persist login failure to AuditLog DB
          auditService.log({
            userId: user.id,
            action: "LOGIN_FAILURE",
            resourceType: "Auth",
            resourceId: user.id,
            detail: JSON.stringify({ username, reason: "invalid_password" }),
            ipAddress: ip,
          }).catch(() => {});
          return null;
        }

        // 4. Successful login — clear failure counter
        await accountLockService.resetFailures(lockKey);
        logger.info({ userId: user.id, ip }, "[auth] Successful login");

        // Issue #187: persist login success to AuditLog DB
        auditService.log({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          resourceType: "Auth",
          resourceId: user.id,
          detail: JSON.stringify({ username }),
          ipAddress: ip,
        }).catch(() => {});

        // Issue #182: check if password change is required
        const needsPasswordChange =
          user.mustChangePassword || isPasswordExpired(user.passwordChangedAt);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: needsPasswordChange,
          passwordChangedAt: user.passwordChangedAt?.toISOString(),
          hasCompletedOnboarding: user.hasCompletedOnboarding, // Issue #1315
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes (Issue #795: short-lived access token)
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: string }).role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.passwordChangedAt = (user as { passwordChangedAt?: string | null }).passwordChangedAt ?? null;
        token.hasCompletedOnboarding = (user as { hasCompletedOnboarding?: boolean }).hasCompletedOnboarding ?? false; // Issue #1315
        // Issue #184: generate session ID and register (invalidates previous session)
        const sessionId = crypto.randomUUID();
        token.sessionId = sessionId;
        registerSession(user.id!, sessionId).catch(() => {});
      }
      // Issue #1315: persist update() call so hasCompletedOnboarding survives token rotation
      if (trigger === "update" && session && "hasCompletedOnboarding" in session) {
        token.hasCompletedOnboarding = session.hasCompletedOnboarding as boolean;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.passwordChangedAt = (token.passwordChangedAt as string) ?? null;
        session.user.hasCompletedOnboarding = (token.hasCompletedOnboarding as boolean) ?? false; // Issue #1315
        // Propagate sessionId so requireAuth() can enforce JWT blacklist on web path
        (session as { sessionId?: string }).sessionId = (token as { sessionId?: string }).sessionId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
