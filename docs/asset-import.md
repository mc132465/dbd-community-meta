# Asset Import Guide

How to get killer/survivor/perk/item icons into the catalog. For the internal design,
see [`asset-architecture.md`](asset-architecture.md).

## Concepts (short version)

- Catalog entities (perks, characters, items, …) each store one image URL. If it's empty,
  the UI shows a placeholder.
- An **asset pack** is an imported set of image files; each file becomes a row that is
  **mapped** to a catalog entity. Mapping can be automatic or manual.
- The app serves icons from `public/assets/...`; source packs live under `data/assets/`.

## The reliable path — a manifest (recommended)

A manifest pins each file to an exact catalog target, so mapping is deterministic.

1. **Export the catalog targets** to build the manifest against real slugs:
   ```bash
   pnpm slugs:export        # writes data/catalog-slugs.csv and .json
   # in Docker: docker compose exec app node_modules/.bin/tsx scripts/slugs-export/index.ts
   ```
2. **Create `manifest.csv`** (or `manifest.json`) at the **pack root** mapping each file
   to a `category` and a catalog `slug`:
   ```csv
   file,category,slug
   Perks/iconPerks_sprintBurst.png,perks,sprint-burst
   Portraits/K01_Trapper.png,killers,the-trapper
   KillerPowers/trapper_power.png,powers,the-trapper
   ItemAddons/medkit_gauze.png,add_ons,gauze
   ```
   - `category` ∈ `perks, killers, survivors, items, add_ons, maps, offerings, powers`.
   - `slug` = a catalog slug from the export. `file` = path inside the ZIP (or basename).
   - JSON form: an array of `{ "file": "...", "category": "...", "slug": "..." }`.
3. **Zip it** (manifest at the same level as the category folders) and import (below).

## Without a manifest (folder + classifier)

If there's no manifest, the converter classifies by **folder name** and the importer
auto-maps by slug, scoring each match:

- exact slug or unique name-slug → auto-confirmed;
- a single fuzzy candidate → stored as a **suggestion** for review;
- otherwise → left unmapped, pending review.

Recognized top-level folder names include: `Perks, Items, ItemAddons/Addons, Offerings,
Killers, Survivors, Characters/CharPortraits/Portraits, Maps/Realms, KillerPowers/Powers`.
Anything else is classified as `other` and not imported into a category.

## Importing

**Admin UI:** Admin → Import → upload the ZIP (stored under `data/assets/`), then run the
convert + import for the pack. Uncertain matches appear in **Admin → Assets → Review**.

**CLI / Docker:**
```bash
# Convert an old/flat pack into the normalized layout
pnpm convert-old-assets --in=<folder-or-zip> --pack=<slug>
# Import the converted pack (writes to public/assets, maps to catalog)
pnpm import:assets --pack=<slug>
# In Docker:
docker compose exec app node_modules/.bin/tsx scripts/import-assets/index.ts --pack=<slug>
```

## Reviewing and fixing mappings

- **Admin → Assets → Review** — the queue of uncertain/unmapped images. Per image:
  **Confirm** (use the suggested target), **Manual map** (pick the target yourself),
  **Reject** (don't use it), **Reset to auto** (re-run automatic matching).
- **Admin → Assets → Mapping** — read-only coverage overview and a filterable list of
  every imported image.

## Verifying coverage

```bash
pnpm diagnose:assets     # writes data/asset-coverage-report.md
```
Per category it reports DB entries, imported, mapped, unmapped, duplicates, ambiguous, and
catalog rows still missing an image. Treat mapping as "done" only when Perks/Killers/
Survivors are near-100%.

## Note on rights

Only import asset packs you have the right to use and distribute. Game icons are owned by
their respective rights holders and are not covered by this project's code license.
