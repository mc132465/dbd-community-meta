# scripts

## import/ — game-data importer (built, Phase 1)

Idempotent importer that validates `data/game/*.json` with the shared zod
schemas (`src/lib/validations/game.ts`) and upserts into local Postgres **by slug**
(patches by version). Re-running updates existing rows instead of duplicating.

```bash
pnpm import:game
```

Requires `.env.local` with `DATABASE_URL` (local Postgres). Images are written
to `public/assets/<pack>/...` by the filesystem storage adapter.
RLS). Dependency order: patches → characters → items → perks → add-ons → maps.

Images are **not** uploaded. Phase 1 data sets `image_url`/`icon_url` to null and
the UI renders a neutral fallback. Real-image ingestion is added when real
datasets land.

## scrape/ — reserved, empty

A future, dev-only stage that could generate the JSON. Not built.
