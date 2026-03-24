import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
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
const loginRateLimiter = createLoginRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
});
const accountLockService = new AccountLockService({
  maxFailures: 10,
  lockDurationSeconds: 900,
  redisClient: redis,
});
const auditService = new AuditService(prisma);

const handler = NextAuth({
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "帳號", type: "text" },
        password: { label: "密碼", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        const ip =
          (req?.headers as Record<string, string | undefined> | undefined)?.["x-forwarded-for"]?.split(",")[0]?.trim() ??
          "unknown";
        const rateLimitKey = `${ip}_${credentials.username}`;
        const lockKey = credentials.username;

        // 1. Check account lockout first (cheaper than DB lookup)
        const locked = await accountLockService.isLocked(lockKey);
        if (locked) {
          const remaining = await accountLockService.getRemainingLockSeconds(lockKey);
          logger.warn(
            { username: credentials.username, ip, remaining },
            "[auth] Login blocked — account locked"
          );
          return null;
        }

        // 2. Enforce IP+username rate limit (5 attempts/min)
        try {
          await checkRateLimit(loginRateLimiter, rateLimitKey);
        } catch {
          logger.warn(
            { username: credentials.username, ip },
            "[auth] Login rate limit exceeded"
          );
          return null;
        }

        // 3. Look up user
        const user = await prisma.user.findUnique({
          where: { email: credentials.username },
        });

        if (!user || !user.isActive) {
          await accountLockService.recordFailure(lockKey);
          // Issue #187: persist login failure to AuditLog DB
          auditService.log({
            userId: null,
            action: "LOGIN_FAILURE",
            resourceType: "Auth",
            resourceId: null,
            detail: JSON.stringify({ username: credentials.username, reason: !user ? "user_not_found" : "account_inactive" }),
            ipAddress: ip,
          }).catch(() => {}); // fire-and-forget, never block auth
          return null;
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          await accountLockService.recordFailure(lockKey);
          logger.warn(
            { username: credentials.username, ip },
            "[auth] Failed login attempt"
          );
          // Issue #187: persist login failure to AuditLog DB
          auditService.log({
            userId: user.id,
            action: "LOGIN_FAILURE",
            resourceType: "Auth",
            resourceId: user.id,
            detail: JSON.stringify({ username: credentials.username, reason: "invalid_password" }),
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
          detail: JSON.stringify({ username: credentials.username }),
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
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours (bank workday)
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: string }).role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        // Issue #184: generate session ID and register (invalidates previous session)
        const sessionId = crypto.randomUUID();
        token.sessionId = sessionId;
        registerSession(user.id!, sessionId).catch(() => {});
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

export { handler as GET, handler as POST };
