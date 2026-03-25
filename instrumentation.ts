/**
 * Next.js Instrumentation — Startup Validation + Graceful Shutdown
 * Issues #401 (env validation) and #428 (graceful shutdown)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate environment variables on server startup
    const { validateEnv } = await import("@/lib/env-validator");
    validateEnv();

    // Graceful shutdown handler for Docker stop
    const DRAIN_TIMEOUT_MS = 5_000;
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`[instrumentation] Received ${signal} — starting graceful shutdown...`);
      await new Promise((resolve) => setTimeout(resolve, DRAIN_TIMEOUT_MS));

      try {
        const { prisma } = await import("@/lib/prisma");
        await prisma.$disconnect();
        console.log("[instrumentation] Prisma connections closed.");
      } catch (err) {
        console.error("[instrumentation] Error closing Prisma:", err);
      }

      console.log("[instrumentation] Graceful shutdown complete.");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}
