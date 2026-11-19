FROM node:24.20.0-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ libc6-dev && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV SHADOW_DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder_shadow
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm exec prisma generate
RUN pnpm exec next build

FROM node:24.20.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --shell /usr/sbin/nologin bizpilot
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
RUN chown -R bizpilot:nodejs /app
USER bizpilot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/ai/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
