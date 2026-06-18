# syntax=docker/dockerfile:1

# ---------- base: node + pnpm ----------
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH" NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---------- build-base: native build tools (argon2) ----------
FROM base AS build-base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---------- deps: full install (for building) ----------
FROM build-base AS deps
COPY package.json ./
RUN pnpm install

# ---------- prod-deps: runtime install (app + scripts: next, kysely, pg, argon2, tsx, dotenv) ----------
FROM build-base AS prod-deps
COPY package.json ./
RUN pnpm install --prod

# ---------- builder: produce the Next.js standalone output ----------
FROM build-base AS builder
# --- Low-memory build controls (default build is unchanged) ---
# NEXT_STRICT_BUILD=false  -> skip the heavy in-build type-check + lint pass.
# NODE_BUILD_MEMORY=<MB>   -> cap V8's old-space heap for `next build`. Empty by
#   default (Node's normal default). In low-memory mode (NEXT_STRICT_BUILD=false)
#   this auto-defaults to 4096 so a constrained host can finish the compile using
#   swap. Both are *build-time only* and never affect the running app.
ARG NEXT_STRICT_BUILD=true
ARG NODE_BUILD_MEMORY=
ENV NEXT_STRICT_BUILD=$NEXT_STRICT_BUILD
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Run the build, raising the heap ceiling when in low-memory mode (or when an
# explicit NODE_BUILD_MEMORY is given). `next build` itself — not just type/lint —
# can exhaust the heap on a Pi, so this lever matters even with strict checks off.
RUN MEM="$NODE_BUILD_MEMORY"; \
  if [ "$NEXT_STRICT_BUILD" = "false" ] && [ -z "$MEM" ]; then MEM=4096; fi; \
  if [ -n "$MEM" ]; then export NODE_OPTIONS="--max-old-space-size=$MEM"; fi; \
  echo "[build] NEXT_STRICT_BUILD=$NEXT_STRICT_BUILD NODE_OPTIONS=${NODE_OPTIONS:-<default>}"; \
  { free -h 2>/dev/null || awk '/MemTotal|MemAvailable|SwapTotal/{print}' /proc/meminfo 2>/dev/null; } | sed 's/^/[build:mem] /'; \
  pnpm build
# Fail loudly (with the likely cause + exact retry) instead of letting a missing
# standalone dir surface later as an opaque COPY error in the runner stage.
RUN test -d .next/standalone || ( \
  echo "" >&2; \
  echo "ERROR: '.next/standalone' was not produced — 'next build' did not finish." >&2; \
  echo "'output: standalone' IS set, so the standalone check is not the cause: the" >&2; \
  echo "build crashed first — a JavaScript heap OOM on a low-memory host." >&2; \
  echo "" >&2; \
  echo "1) Build in low-memory mode (skips type/lint, disables webpack cache, 4 GB heap):" >&2; \
  echo "     scripts/pi-build.sh        # or:" >&2; \
  echo "     docker-compose build --build-arg NEXT_STRICT_BUILD=false app && docker-compose up -d" >&2; \
  echo "   Check the '[build:mem]' line above: if SwapTotal is 0, add swap first:" >&2; \
  echo "     sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile" >&2; \
  echo "     sudo mkswap /swapfile && sudo swapon /swapfile" >&2; \
  echo "2) Still OOM? Use a bigger heap: NODE_BUILD_MEMORY=6144 scripts/pi-build.sh" >&2; \
  echo "3) Very low-RAM Pi? Build on a stronger machine, then load the image:" >&2; \
  echo "     (build host) docker save dbd-community:latest | gzip > app.tar.gz" >&2; \
  echo "     (pi)         gunzip -c app.tar.gz | docker load && docker-compose up -d --no-build" >&2; \
  echo "" >&2; \
  exit 1 )

# ---------- runner: lean production runtime ----------
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

# Standalone server (server.js + traced .next) ...
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# ... then overlay the full production node_modules so BOTH `node server.js`
# and the pnpm data scripts (tsx) resolve everything.
COPY --from=prod-deps /app/node_modules ./node_modules
# Schema, importers, and seed data for db:migrate / db:seed / import:*
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/db ./db
COPY --from=builder /app/data ./data
# The data scripts (import:game, import:assets) import a few helpers from src/
# (validations/game, storage/local) at runtime via tsx, so src/ must be present.
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN mkdir -p /app/public/assets && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["sh", "scripts/docker-entrypoint.sh"]
