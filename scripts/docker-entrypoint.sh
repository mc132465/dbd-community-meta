#!/bin/sh
# Bootstraps the app into a usable demo state, then starts the server.
# All steps are idempotent (upsert by slug / ensure-admin), so restarts do NOT
# duplicate data. Set BOOTSTRAP_DEMO=false to skip seed/import on boot.

set -e

TSX="node_modules/.bin/tsx"
PACKS_ROOT="${IMPORT_PACKS_ROOT:-data/assets/packs}"

echo "[bootstrap] Applying database schema (db:migrate)..."
$TSX scripts/db/migrate.ts

# Schema is required; the rest is demo content and must never block startup.
set +e

if [ "${BOOTSTRAP_DEMO:-true}" = "true" ]; then
  echo "[bootstrap] Ensuring admin account (db:seed)..."
  $TSX scripts/seed/index.ts        || echo "[bootstrap] WARN: db:seed failed (continuing)"

  echo "[bootstrap] Importing game data — maps + patches (import:game)..."
  $TSX scripts/import/index.ts      || echo "[bootstrap] WARN: import:game failed (continuing)"

  echo "[bootstrap] Importing character catalog — killers, survivors, perks (import:characters)..."
  $TSX scripts/import-characters/index.ts || echo "[bootstrap] WARN: import:characters failed (continuing)"

  echo "[bootstrap] Deriving Killer Powers (import:powers)..."
  $TSX scripts/import-powers/index.ts || echo "[bootstrap] WARN: import:powers failed (continuing)"

  echo "[bootstrap] Seeding canonical universal perks (import:perks)..."
  $TSX scripts/import-perks/index.ts || echo "[bootstrap] WARN: import:perks failed (continuing)"

  if [ -d "$PACKS_ROOT" ] && [ -n "$(ls -A "$PACKS_ROOT" 2>/dev/null)" ]; then
    for packdir in "$PACKS_ROOT"/*/ ; do
      [ -d "$packdir" ] || continue
      slug=$(basename "$packdir")
      if [ -n "$(ls -A "$packdir" 2>/dev/null)" ]; then
        echo "[bootstrap] Icon pack '$slug' found — importing assets (import:assets --pack=$slug)..."
        $TSX scripts/import-assets/index.ts --pack="$slug" \
          || echo "[bootstrap] WARN: import:assets for '$slug' failed (continuing)"
      fi
    done
  else
    echo "[bootstrap] -------------------------------------------------------------"
    echo "[bootstrap] No asset packs found under '$PACKS_ROOT' — skipping import:assets."
    echo "[bootstrap] Characters, perks, and builds work fine without icons."
    echo "[bootstrap] To add icons: put a pack at '$PACKS_ROOT/<slug>/<category>/*.png'"
    echo "[bootstrap] (categories: perks, killers, survivors, characters, items,"
    echo "[bootstrap]  addons, maps, offerings, other). For an old/flat pack, first run"
    echo "[bootstrap]   pnpm convert-old-assets --in=<old-folder> --pack=<slug>"
    echo "[bootstrap] In Docker, bind-mount the host folder by uncommenting the"
    echo "[bootstrap] './data/assets:/app/data/assets' volume in docker-compose.yml,"
    echo "[bootstrap] then re-run or:  docker compose exec app \\"
    echo "[bootstrap]     node_modules/.bin/tsx scripts/import-assets/index.ts --pack=<slug>"
    echo "[bootstrap] -------------------------------------------------------------"
  fi

  echo "[bootstrap] Importing official tier lists (import:tierlists)..."
  $TSX scripts/import-tierlists/index.ts || echo "[bootstrap] WARN: import:tierlists failed (continuing)"
else
  echo "[bootstrap] BOOTSTRAP_DEMO=false — skipping seed/import (schema only)."
fi

echo "[bootstrap] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
