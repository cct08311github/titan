import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 500);

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // Use explicit pg.Pool for controlled connection management
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  client.$on("query", (e) => {
    if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        {
          event: "slow_query",
          durationMs: e.duration,
          query: e.query.slice(0, 500),
          params: e.params,
        },
        `Slow query detected: ${e.duration}ms`
      );
    }
  });

  client.$on("error", (e) => {
    logger.error({ event: "prisma_error", message: e.message }, "Prisma error");
  });

  return client;
}

function ensureClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Lazy initialization — the client is created on first access.
// This prevents crashes at import time when DATABASE_URL is not set
// (e.g., in test environments where @/lib/prisma is mocked).
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(ensureClient(), prop, receiver);
  },
  has(_target, prop) {
    return prop in ensureClient();
  },
});
