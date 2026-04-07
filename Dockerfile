# ── Offline-capable Dockerfile for air-gapped/restricted DNS environments ──
# All dependencies pre-installed on host, COPY into image (no network needed during build)

# ── Stage 1: runner ──────────────────────────────────────────────────
# Uses pre-built .next/standalone from host (npm run build already executed)
FROM node:20 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy pre-built standalone output from host
# upgrade.sh flattens nested standalone path to .next/standalone/
COPY --chown=nextjs:nodejs public ./public
COPY --chown=nextjs:nodejs .next/standalone/ ./
COPY --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs

EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
