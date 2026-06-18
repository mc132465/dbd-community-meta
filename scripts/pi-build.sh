#!/bin/sh
# Low-memory build helper for Raspberry Pi (and other constrained hosts).
#
# Builds the app image with the strict in-build type-check/lint disabled and a
# raised V8 heap so `next build` can finish (using swap if needed), then starts
# the stack. Normal/default builds are unaffected — use plain
# `docker-compose up -d --build` for those.
#
# Usage:
#   scripts/pi-build.sh                 # heap defaults to 4096 MB
#   NODE_BUILD_MEMORY=6144 scripts/pi-build.sh
#
# Honors the COMPOSE env var if you use a different command (e.g. "docker compose").
set -e

COMPOSE="${COMPOSE:-docker-compose}"
MEM="${NODE_BUILD_MEMORY:-4096}"

echo "[pi-build] Using: $COMPOSE"
echo "[pi-build] NEXT_STRICT_BUILD=false  NODE_BUILD_MEMORY=$MEM"
echo "[pi-build] Tip: ensure the host has swap (2-4 GB) if RAM is under ~4 GB."

$COMPOSE build \
  --build-arg NEXT_STRICT_BUILD=false \
  --build-arg "NODE_BUILD_MEMORY=$MEM" \
  app

$COMPOSE up -d

echo "[pi-build] Done. Run '$COMPOSE logs -f app' to watch startup/bootstrap."
