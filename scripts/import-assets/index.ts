import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";
import { normalize, toSlug } from "./normalize";
import { ImportReport, newCategoryReport } from "./report";
import {
  assetPublicUrl,
  assetStorageKey,
  saveAssetFile,
} from "../../src/lib/storage/local";

/**
 * Multi-pack asset importer (Step 1).
 *
 * Folder contract:
 *   data/assets/packs/<pack-slug>/<category>/*.png
 * with category ∈ perks, killers, survivors, characters, items, addons, maps,
 * offerings, powers, other.
 *
 * Behaviour:
 *  - Each pack is a row in asset_packs; images live under
 *    public/assets/<pack>/<category>/<slug>.png (pack-scoped, never merged).
 *  - Every PNG is recorded in asset_pack_images, mapped (asset_id set) or
 *    unmapped (asset_id null). asset_type is the category, so a perk image can
 *    only ever carry asset_type='perks', etc.
 *  - Auto-mapping is category-safe and match-only: it looks up an EXISTING
 *    catalog row by slug within the category's target table (and role, for
 *    killers/survivors). It never creates catalog rows and never crosses
 *    categories.
 *  - The denormalized icon_url/image_url on each catalog row is then resolved
 *    by precedence: (1) manual override, (2) default pack, (3) most recent,
 *    (4) null → placeholder.
 *
 * Usage:
 *   pnpm import:assets --pack=dbd-icons-pack-1
 *   IMPORT_PACK=dbd-icons-pack-1 pnpm import:assets
 *   IMPORT_PACK_DIR=/abs/path pnpm import:assets   (override source dir)
 */

type Db = ReturnType<typeof createDb>;

const argPack = process.argv
  .find((a) => a.startsWith("--pack="))
  ?.slice("--pack=".length);
const PACK_SLUG = argPack ?? process.env.IMPORT_PACK ?? "default";
const PACKS_ROOT = resolve(process.cwd(), "data/assets/packs");
const PACK_DIR =
  process.env.IMPORT_PACK_DIR ?? resolve(PACKS_ROOT, PACK_SLUG);

/** Catalog target table + denormalized image column for a target table. */
type TargetTable =
  | "perks"
  | "characters"
  | "items"
  | "add_ons"
  | "maps"
  | "offerings"
  | "powers";

/**
 * Folder (lowercase) → asset_type (category label stored on the image),
 * target catalog table, denormalized column, and optional role filter.
 * `target: null` means inventory-only (no catalog mapping), e.g. "other".
 */
const CATEGORIES: {
  folder: string;
  assetType: string;
  target: TargetTable | null;
  column: "icon_url" | "image_url" | null;
  role: "killer" | "survivor" | null;
}[] = [
  { folder: "perks", assetType: "perks", target: "perks", column: "icon_url", role: null },
  { folder: "killers", assetType: "killers", target: "characters", column: "image_url", role: "killer" },
  { folder: "survivors", assetType: "survivors", target: "characters", column: "image_url", role: "survivor" },
  { folder: "characters", assetType: "characters", target: "characters", column: "image_url", role: null },
  { folder: "items", assetType: "items", target: "items", column: "icon_url", role: null },
  { folder: "addons", assetType: "add_ons", target: "add_ons", column: "icon_url", role: null },
  { folder: "maps", assetType: "maps", target: "maps", column: "image_url", role: null },
  { folder: "offerings", assetType: "offerings", target: "offerings", column: "icon_url", role: null },
  { folder: "powers", assetType: "powers", target: "powers", column: "icon_url", role: null },
  { folder: "other", assetType: "other", target: null, column: null, role: null },
];

/** Which asset_types feed a given target table (for precedence resolution). */
const TARGET_TYPES: Record<TargetTable, string[]> = {
  perks: ["perks"],
  characters: ["killers", "survivors", "characters"],
  items: ["items"],
  add_ons: ["add_ons"],
  maps: ["maps"],
  offerings: ["offerings"],
  powers: ["powers"],
};

const TARGET_COLUMN: Record<TargetTable, "icon_url" | "image_url"> = {
  perks: "icon_url",
  characters: "image_url",
  items: "icon_url",
  add_ons: "icon_url",
  maps: "image_url",
  offerings: "image_url",
  powers: "icon_url",
};

/** Resolve (or create) the asset pack row for this run. */
async function resolvePack(
  db: Db,
  slug: string,
): Promise<{ id: string; isDefault: boolean }> {
  const existing = await db
    .selectFrom("asset_packs")
    .select(["id", "is_default"])
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (existing) {
    await db
      .updateTable("asset_packs")
      .set({ source_folder: PACK_DIR })
      .where("id", "=", existing.id)
      .execute();
    return { id: existing.id, isDefault: existing.is_default };
  }

  const isDefault = slug === "default";
  const name = slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const created = await db
    .insertInto("asset_packs")
    .values({
      name: name || slug,
      slug,
      is_default: isDefault,
      is_active: true,
      source_folder: PACK_DIR,
      description: process.env.IMPORT_PACK_DESC ?? null,
    })
    .returning(["id", "is_default"])
    .executeTakeFirstOrThrow();
  return { id: created.id, isDefault: created.is_default };
}

/** Look up an existing catalog row id by slug within a category (match-only). */
/**
 * Auto-map index for a target table: catalog rows keyed by their stored slug AND
 * by a slug re-derived from their display name with the same `toSlug` the asset
 * filenames use. The name-derived index drops ambiguous (non-unique) keys so we
 * never guess a wrong row. Built once per (target, role) and cached for the run.
 */
type TargetIndex = {
  bySlug: Map<string, string>;
  byNameSlug: Map<string, string>;
  rows: { id: string; key: string }[];
};
const TARGET_INDEX_CACHE = new Map<string, TargetIndex>();

async function getTargetIndex(
  db: Db,
  target: TargetTable,
  role: "killer" | "survivor" | null,
): Promise<TargetIndex> {
  const key = `${target}|${role ?? ""}`;
  const cached = TARGET_INDEX_CACHE.get(key);
  if (cached) return cached;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(target as any) as any).select(["id", "slug", "name"]);
  if (role) q = q.where("role", "=", role);
  const rows = (await q.execute()) as { id: string; slug: string; name: string }[];

  const bySlug = new Map<string, string>();
  const nameCounts = new Map<string, number>();
  const nameFirst = new Map<string, string>();
  const list: { id: string; key: string }[] = [];
  for (const r of rows) {
    if (r.slug) bySlug.set(r.slug, r.id);
    const ns = toSlug(r.name ?? "");
    if (ns) {
      nameCounts.set(ns, (nameCounts.get(ns) ?? 0) + 1);
      if (!nameFirst.has(ns)) nameFirst.set(ns, r.id);
    }
    list.push({ id: r.id, key: ns || r.slug || "" });
  }
  const byNameSlug = new Map<string, string>();
  for (const [ns, id] of nameFirst) {
    if ((nameCounts.get(ns) ?? 0) === 1 && !bySlug.has(ns)) byNameSlug.set(ns, id);
  }

  const idx: TargetIndex = { bySlug, byNameSlug, rows: list };
  TARGET_INDEX_CACHE.set(key, idx);
  return idx;
}

export type Classification = {
  assetId: string | null;
  suggestedId: string | null;
  confidence: number;
};

/**
 * Smart fallback classifier (used when no manifest pins the file). Confidence:
 *   exact stored slug → 1.0   ·   unique name-derived slug → 0.9
 *   single fuzzy containment candidate → 0.5 (suggestion only, not auto-applied)
 * Anything ≥ 0.9 is auto-confirmed; lower goes to the review queue as a suggestion.
 */
async function classifyTarget(
  db: Db,
  target: TargetTable,
  slug: string,
  role: "killer" | "survivor" | null,
): Promise<Classification> {
  const idx = await getTargetIndex(db, target, role);
  const exact = idx.bySlug.get(slug);
  if (exact) return { assetId: exact, suggestedId: null, confidence: 1 };
  const nm = idx.byNameSlug.get(slug);
  if (nm) return { assetId: nm, suggestedId: null, confidence: 0.9 };

  if (slug.length >= 4) {
    const cands = idx.rows.filter((r) => {
      const a = r.key;
      return (
        a.length >= 4 && (a.includes(slug) || slug.includes(a))
      );
    });
    if (cands.length === 1) {
      return { assetId: null, suggestedId: cands[0].id, confidence: 0.5 };
    }
  }
  return { assetId: null, suggestedId: null, confidence: 0 };
}

/**
 * Resolve the winning image_url for a catalog row by precedence:
 * 1) manual override (any pack), 2) default pack, 3) most recent, else null.
 */
async function resolveImageUrl(
  db: Db,
  target: TargetTable,
  assetId: string,
): Promise<string | null> {
  const types = TARGET_TYPES[target];

  const manual = await db
    .selectFrom("asset_pack_images")
    .select("image_url")
    .where("asset_type", "in", types)
    .where("asset_id", "=", assetId)
    .where("mapping_mode", "=", "manual")
    .orderBy("updated_at", "desc")
    .executeTakeFirst();
  if (manual) return manual.image_url;

  const def = await db
    .selectFrom("asset_pack_images")
    .innerJoin("asset_packs", "asset_packs.id", "asset_pack_images.pack_id")
    .select("asset_pack_images.image_url as image_url")
    .where("asset_pack_images.asset_type", "in", types)
    .where("asset_pack_images.asset_id", "=", assetId)
    .where("asset_packs.is_default", "=", true)
    .orderBy("asset_pack_images.updated_at", "desc")
    .executeTakeFirst();
  if (def) return def.image_url;

  const recent = await db
    .selectFrom("asset_pack_images")
    .select("image_url")
    .where("asset_type", "in", types)
    .where("asset_id", "=", assetId)
    .orderBy("updated_at", "desc")
    .executeTakeFirst();
  return recent?.image_url ?? null;
}

async function run() {
  const db = createDb();
  const report = new ImportReport();

  if (!existsSync(PACK_DIR)) {
    console.error(
      `Pack directory not found: ${PACK_DIR}\n` +
        "Place the pack so category folders live at " +
        `data/assets/packs/${PACK_SLUG}/<category>/ ` +
        "(perks, killers, survivors, characters, items, addons, maps, offerings, powers, other).",
    );
    process.exit(1);
  }

  const pack = await resolvePack(db, PACK_SLUG);
  console.log(
    `Importing pack "${PACK_SLUG}" from ${PACK_DIR}` +
      (pack.isDefault ? " (default pack)" : ""),
  );

  // Catalog rows whose denormalized image must be recomputed after import.
  const touched = new Map<TargetTable, Set<string>>();
  function markTouched(target: TargetTable, assetId: string) {
    if (!touched.has(target)) touched.set(target, new Set());
    touched.get(target)!.add(assetId);
  }

  for (const cat of CATEGORIES) {
    const dir = resolve(PACK_DIR, cat.folder);
    const cReport = newCategoryReport(cat.folder);

    if (!existsSync(dir)) {
      console.log(`(skip) ${cat.folder}: folder not present`);
      report.add(cReport);
      continue;
    }

    const files = readdirSync(dir).filter((f) =>
      f.toLowerCase().endsWith(".png"),
    );
    cReport.scanned = files.length;

    const seen = new Set<string>();
    files.sort((a, b) => {
      const at = /^t_/i.test(a) ? 1 : 0;
      const bt = /^t_/i.test(b) ? 1 : 0;
      return at - bt || a.localeCompare(b);
    });

    for (const file of files) {
      const meta = normalize(cat.folder, file);
      if (!meta) {
        if (file.toLowerCase() === "empty.png") cReport.skipped += 1;
        else {
          cReport.unmatched += 1;
          report.problem(cat.folder, file, "could not derive slug/name");
        }
        continue;
      }
      if (seen.has(meta.slug)) {
        cReport.duplicates += 1;
        report.problem(cat.folder, file, `duplicate slug "${meta.slug}"`);
        continue;
      }
      seen.add(meta.slug);

      // Write the image file (pack + category scoped path).
      const key = assetStorageKey(PACK_SLUG, cat.folder, meta.slug);
      try {
        saveAssetFile(key, readFileSync(resolve(dir, file)));
      } catch (err) {
        cReport.unmatched += 1;
        report.problem(cat.folder, file, `write failed: ${(err as Error).message}`);
        continue;
      }
      const url = assetPublicUrl(key);

      // Category-safe classification against existing catalog rows.
      let assetId: string | null = null;
      let suggestedId: string | null = null;
      let confidence = 0;
      if (cat.target) {
        const c = await classifyTarget(db, cat.target, meta.slug, cat.role);
        confidence = c.confidence;
        if (c.confidence >= 0.9) {
          assetId = c.assetId; // auto-confirm high confidence
        } else {
          suggestedId = c.suggestedId; // low/medium → review queue suggestion
        }
      }

      // Record the image in the per-pack inventory. Re-import preserves a
      // manual override (never clobbers asset_id/mapping_mode when manual).
      try {
        const existingImg = await db
          .selectFrom("asset_pack_images")
          .select(["id", "mapping_mode", "asset_id"])
          .where("pack_id", "=", pack.id)
          .where("asset_type", "=", cat.assetType)
          .where("source_file", "=", file)
          .executeTakeFirst();

        if (!existingImg) {
          await db
            .insertInto("asset_pack_images")
            .values({
              pack_id: pack.id,
              asset_type: cat.assetType,
              asset_id: assetId,
              source_file: file,
              derived_slug: meta.slug,
              mapping_mode: "auto",
              storage_path: key,
              image_url: url,
              confidence,
              suggested_asset_id: suggestedId,
              review_status: assetId ? "confirmed" : "pending",
              updated_at: new Date().toISOString(),
            })
            .execute();
        } else if (existingImg.mapping_mode === "manual") {
          // Preserve the manual assignment; only refresh the file/url.
          await db
            .updateTable("asset_pack_images")
            .set({
              storage_path: key,
              image_url: url,
              derived_slug: meta.slug,
              confidence: 1,
              review_status: "confirmed",
              updated_at: new Date().toISOString(),
            })
            .where("id", "=", existingImg.id)
            .execute();
          assetId = existingImg.asset_id;
        } else {
          await db
            .updateTable("asset_pack_images")
            .set({
              asset_id: assetId,
              derived_slug: meta.slug,
              storage_path: key,
              image_url: url,
              confidence,
              suggested_asset_id: suggestedId,
              review_status: assetId ? "confirmed" : "pending",
              updated_at: new Date().toISOString(),
            })
            .where("id", "=", existingImg.id)
            .execute();
        }
      } catch (err) {
        cReport.unmatched += 1;
        report.problem(cat.folder, file, `pack image failed: ${(err as Error).message}`);
        continue;
      }

      cReport.imported += 1;
      if (assetId && cat.target) {
        cReport.mapped += 1;
        markTouched(cat.target, assetId);
      } else {
        cReport.unmapped += 1;
        if (cat.target) {
          report.problem(
            cat.folder,
            file,
            `no ${cat.target} record for slug "${meta.slug}" — tracked as unmapped`,
          );
        }
      }
    }

    report.add(cReport);
  }

  // Apply the precedence rule to every touched catalog row.
  let resolved = 0;
  for (const [target, ids] of touched) {
    const column = TARGET_COLUMN[target];
    for (const assetId of ids) {
      const winner = await resolveImageUrl(db, target, assetId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table/column
      await (db.updateTable(target as any) as any)
        .set({ [column]: winner })
        .where("id", "=", assetId)
        .execute();
      resolved += 1;
    }
  }
  console.log(
    `\nResolved denormalized image for ${resolved} catalog row(s) by precedence ` +
      `(manual → default pack → most recent).`,
  );

  report.print();
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
