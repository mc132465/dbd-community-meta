# Asset architecture

## Convention-based assets (primary)

The single rule: **an image lives at `public/assets/<category>/<slug>.png`** and is served
at `/assets/<category>/<slug>.png`. If the file exists, it appears on the site automatically —
no packs, mapping, review, or import step required. If it's absent, the UI shows a clean
initials placeholder (`AssetThumb` handles this, including files that 404 at load time).

Categories (folder names): `perks`, `killers`, `survivors`, `items`, `addons`, `maps`,
`offerings`, `powers`. Characters are split by role into `killers/` and `survivors/`.

Resolution order (see `src/lib/assets/resolve.ts`):

1. The DB `icon_url` / `image_url` column, **if set** — an optional override for custom or
   remote images.
2. Otherwise the convention path `/assets/<category>/<slug>.png`.

The catalog read layer (`src/lib/services/assets.service.ts`) applies this default, so every
surface that renders a catalog image benefits automatically.

To see what's still missing: **`pnpm assets:missing`** lists, per category, the catalog slugs
with no file on disk.

## Legacy import/mapping workflow (optional)

The pack-based importer, asset mapping, review queue, and classifier described below still
exist but are **no longer required** for images to appear — they are optional tooling for bulk
ingest. New deployments can ignore them and just drop PNGs into `public/assets/`.

---


Grounded in the actual code (schema.sql, asset-admin.service.ts, asset-mapping.service.ts,
storage/local.ts, scripts/convert-old-assets, scripts/import-assets, scripts/import-powers,
admin pages + import actions + upload route, docker-compose). No assumptions.

---

## 1. The data model — three layers

**Layer A — Catalog entities (what the site renders).**
`perks`, `characters` (role killer/survivor), `items`, `add_ons`, `maps`, `offerings`,
`powers`. Each carries ONE denormalized image column that the UI reads:
- perks → `icon_url`
- characters → `image_url`
- items → `icon_url`
- add_ons → `icon_url`
- maps → `image_url`
- offerings → `image_url`
- powers → `icon_url`

If that column is NULL, the page shows the fallback placeholder. **"Images not showing"
== that column is NULL (or points at a file that isn't served).**

**Layer B — `asset_packs`.** A named/slugged grouping of one imported image set:
`(id, name, slug, source_folder, is_default, is_active)`. It exists so multiple packs can
coexist, be re-imported, and be prioritized (a `is_default` pack wins at resolve time).

**Layer C — `asset_pack_images`.** One row per imported image file:
`(id, pack_id, asset_type, asset_id, source_file, derived_slug, mapping_mode, storage_path,
image_url, …)`, unique on `(pack_id, asset_type, source_file)`.
- `asset_type` ∈ perks/killers/survivors/characters/items/add_ons/maps/offerings/other.
- `asset_id` = the catalog row this image is mapped to (**NULL = unmapped**).
- `mapping_mode` = `auto` | `manual`.
- `image_url` = `/assets/<pack>/<category>/<slug>.png`.

**How they connect.** A catalog row's image column is *resolved* from its mapped
`asset_pack_images` by precedence (see §4). So the chain is:
`file on disk → asset_pack_images row → asset_id → catalog row's image column → rendered`.

---

## 2. Storage & serving (storage/local.ts + docker-compose)

- Files are written to `public/assets/<pack>/<category>/<slug>.png`.
- Next serves them statically at `/assets/<pack>/<category>/<slug>.png` (this is the
  `image_url` stored in the DB).
- Docker: a **named volume `assets` mounts `/app/public/assets`** → imported images persist
  across `--build`. A **bind mount `./data/assets` → `/app/data/assets`** holds uploaded ZIPs
  and the converted pack folders (`data/assets/packs/<pack>/<category>/…`).
- So: source ZIPs live in `data/assets` (host-visible); served images live in the `assets`
  named volume.

---

## 3. The admin menus — every child function

### Assets  (`/admin/assets`, `/admin/assets/[type]`, `[type]/new`, `[type]/[id]/edit`)
- **Purpose:** CRUD over **catalog entities themselves** (perks, characters, items, …) — NOT
  image files. This is where you create/edit/delete a perk or character and can paste an
  `image_url` by hand.
- **Inputs:** form fields (name, slug, role, description, image_url, …).
- **Outputs / DB:** writes the relevant catalog table.
- **File changes:** none (it references a URL; it does not upload files).
- **Needs:** DB only. Functional.

### Asset Packs  (`/admin/assets/packs` + packs/actions.ts)
- **Purpose:** review imported packs and FIX mappings. Backed by `asset-admin.service`:
  - `listAssetPacks()` — packs + counts.
  - `listPackImages()` / `listUnmappedImages()` — images in a pack / the unmapped ones.
  - `listCategoryTargets()` / `detectMissingImages()` — catalog rows that still have no image.
  - `assignImageManually({imageId, assetId})` — **manual map**: sets `asset_id` +
    `mapping_mode='manual'`, then `recomputeTargetImage` updates the catalog image column.
  - `resetImageToAuto(imageId)` — re-derives the target from the slug, sets `mapping_mode='auto'`.
- **Inputs:** imageId + target assetId (manual), or imageId (reset).
- **Outputs / DB:** updates `asset_pack_images.asset_id/mapping_mode` and recomputes the
  catalog row's `icon_url/image_url`.
- **File changes:** none. **Needs:** DB only. Functional.

### Mapping  (`/admin/assets/mapping` — new in 1.5.0)
- **Purpose:** read-only verification. Live coverage summary + a filterable list of every
  `asset_pack_images` row (preview, source file, pack, type, target entity, mapped/unmapped,
  auto/manual). **No writes.** Pairs with `pnpm diagnose:assets` (writes
  `data/asset-coverage-report.md`).

### Import  (`/admin/import` + import/actions.ts + /api/admin/assets/upload)
- **Upload ZIP** (`POST /api/admin/assets/upload`): browser → server. Streams the raw body to
  `data/assets/<name>.zip`. **This is a website upload** that lands on the **server filesystem
  (bind-mounted `data/assets`)**. Needs server FS write.
- **`runImportPackAction(src, pack)`** — the full pipeline for one ZIP/folder:
  1. if `.zip`: extract to a temp dir; if folder: use it directly.
  2. `convert-old-assets --in=<dir> --pack=<pack>`: **classifies by folder name** (§5) and
     writes a normalized tree to `data/assets/packs/<pack>/<category>/<slug>.png`.
  3. `import-powers`: killer powers.
  4. `import-assets --pack=<pack>`: copies images into `public/assets/<pack>/…`, inserts
     `asset_pack_images` rows, **auto-maps** (§4), recomputes catalog image columns.
- **`runAssetImportAction(pack)`** — re-run step 4 for an already-converted pack.
- **`runImportAction(game|characters|powers|tierlists)`** — seed CATALOG rows from
  `data/game` / `data/characters` JSON (these create perks/characters/items/etc. **without**
  images). `game` is the main catalog seed.
- **Inputs:** uploaded ZIP, or a folder/zip name already under `data/assets`.
- **Outputs / DB + files:** `asset_pack_images` rows + files in `public/assets` + recomputed
  catalog image columns.
- **Needs:** server — these `execFile` the `tsx` scripts, so the runtime image must contain
  `scripts/`, `src/`, and `tsx` (the Dockerfile copies them). Functional, not placeholders.

---

## 4. Mapping — what's mapped, auto vs manual

- **What is mapped:** an imported image (`asset_pack_images` row) → a catalog entity
  (`asset_id`). The entity's rendered image is then *resolved* from its mapped images.
- **Auto (default, during import):** `findTargetId` matches the image's `derived_slug`
  against the catalog by **(a) stored slug**, then **(b) `toSlug(name)` if unique** (added
  1.4.0). On a hit: `asset_id` set, `mapping_mode='auto'`.
- **Manual:** admin picks imageId→assetId; `mapping_mode='manual'`.
- **Resolve precedence** (`recomputeTargetImage` / `resolveImageUrl`) decides the catalog
  column when several images map to one entity: **manual → image from the default pack →
  most recently updated**. So a manual mapping always wins; this is why manual fixes stick.

---

## 5. Classification (the messy-ZIP problem) — convert-old-assets

`mapFolder()` maps a **folder name** to a category. Accepted names (normalized,
case/spacing-insensitive):
- Perks: `perks`, `perk`
- Items: `items`, `item`
- Add-ons: `itemaddons`, `itemaddon`, `addons`, `addon`
- Offerings: `offerings`, `offering`, `favors`, `favor`
- Killers: `killers`, `killer`
- Survivors: `survivors`, `survivor`
- Characters (portraits): `characters`, `character`, `portraits`, `charportraits`, `charportrait`
- Maps: `maps`, `map`, `realms`, `realm`
- Powers: `killerpowers`, `killerpower`, `powers`, `power`
- everything else → `other` (NOT imported into a category)

`resolveRoot()` unwraps single-child wrapper folders (e.g. `DBD_Icons_1/DBD_Icons_1`).
Filenames are normalized to a slug via `toSlug` after stripping known prefixes/suffixes
(e.g. `iconPerks_`, `_Portrait`, leading `K35_`).

**Limitation:** classification is **purely folder-name based**. A flat ZIP, or folders with
unrecognized names, dumps everything into `other` → never imported. There is no content,
dimension, or filename-pattern fallback.

---

## 6. ROOT CAUSE of "images not displaying" — ranked

1. **Auto-map coverage (most likely).** Auto-map only succeeds when a file's derived slug
   equals a catalog slug or a *unique* name-slug. Files with internal codenames or prefixes
   (killer powers, char portraits like `K35_TheUnknown_Portrait`) or any naming that differs
   from the catalog slug stay **unmapped → catalog image column NULL → fallback shown.**
2. **Classification.** If the source ZIP's folders aren't in the §5 list, those images become
   `other` and are never imported, so there's nothing to map.
3. **Serving (least likely).** With the `assets` named volume + standalone, `/assets/*` should
   serve. Quick disambiguation below.

**One-command disambiguation** (do this first):
- Run `pnpm diagnose:assets`. If catalog "DB missing image" is high → it's #1/#2 (mapping).
- Pick any row that *does* have an `image_url` and `curl -I http://localhost:3000<image_url>`.
  - 200 → serving is fine; the problem is purely mapping/classification.
  - 404 → serving/volume problem (then we fix infra, not mapping).

This tells us definitively which layer is broken instead of guessing.

---

## 7. Current limitations (summary)
- Classification is folder-name-only; no fallback for flat/mislabeled ZIPs.
- Auto-map is exact-slug or unique-name-slug only — no fuzzy/alias matching, no confidence,
  no per-killer power disambiguation.
- No "review only the uncertain" queue; admins must hunt unmapped rows manually.
- No content-hash dedupe (dupes deduped only by `(pack, type, source_file)`).
- Import shells out to `tsx` scripts (works, but couples the runtime to scripts + tsx).

---

## 8. Recommended architecture — "Smart Import" (your §3 workflow)

Keep the 3-layer model; replace the brittle front end with a scored classifier:

1. **Upload ZIP** (existing upload route).
2. **Scan** every image recursively (ignore folder names when they're unhelpful).
3. **Classify per file** with a score combining: folder-name hint · filename-pattern hint
   (`iconPerks_`, `_Portrait`, `Power`, `addon`…) · **slug match against the live catalog**
   (a filename that slugifies to a known perk slug is almost certainly that perk) · optional
   image aspect/size. Output: `asset_type` + best-guess `asset_id` + **confidence 0–1**.
4. **Auto-import high confidence** (exact slug/name match) silently.
5. **Review queue** shows ONLY low-confidence/ambiguous items with the top suggestions; admin
   confirms or overrides.
6. **Everything else imports automatically.**

This needs a small additive schema change to `asset_pack_images`: `confidence numeric`,
`suggested_asset_id uuid`, `review_status text` (pending/confirmed/rejected). No existing
column changes. (I'll bring this as a schema proposal before building.)

---

## 9. EXACT requirements from you — pick ONE of three input contracts

Ordered from most reliable to most forgiving. Any of these gets perks/killers/survivors to
~100% without per-asset clicking.

**Option 1 — Manifest (most reliable; recommended).**
Include a `manifest.csv` (or `manifest.json`) at the ZIP root mapping each file to a target:
```
file,category,slug
perks/sprint_burst.png,perks,sprint-burst
portraits/the_trapper.png,killers,the-trapper
```
The importer treats the manifest as ground truth (highest precedence). ChatGPT can generate
this from any messy pack. I'll provide a `pnpm slugs:export` command that dumps every valid
`(category, slug, name)` so the manifest can be built/validated against real data.

**Option 2 — Folder + slug filenames (no manifest).**
Top-level folders named exactly per §5, and each filename equal to the catalog **slug**:
`Perks/sprint-burst.png`, `Killers/the-trapper.png`, `KillerPowers/the-trapper.png`,
`Items/medkit.png`, `ItemAddons/<addon-slug>.png`, `Maps/<map-slug>.png`.

**Option 3 — Messy ZIP (best-effort).**
Anything goes; the Smart Import classifier (§8) does its best and routes the uncertain ones to
the review queue. Coverage depends on how close filenames are to slugs.

**What I need from you to lock this in:**
- [ ] Which option you want as the primary contract (I recommend **Option 1 + slugs:export**).
- [ ] Confirm I may add the additive `asset_pack_images` columns for confidence/review (§8).
- [ ] A small **sample pack** (10–20 files across categories) so I can validate the importer's
      parsing against real filenames — OR just the output of `pnpm diagnose:assets` so I can
      see your actual unmapped examples.
- [ ] Whether you want a **clean master pack** long-term (Option 1 manifest) — if so, I'll
      generate the slug manifest for you to fill image files against.

Once you pick, I'll implement: `slugs:export` → manifest support in the importer (Option 1) →
the scored classifier + review queue (Option 3 fallback), with the additive schema.
