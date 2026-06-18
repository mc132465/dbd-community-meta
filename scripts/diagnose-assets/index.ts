/**
 * Asset Coverage Report.
 *
 * Run on the live system (DB + imported pack required):
 *   pnpm diagnose:assets
 *   # or in Docker:  docker compose exec web pnpm diagnose:assets
 *
 * Prints a per-category report and writes data/asset-coverage-report.md.
 * It NEVER writes to the database — read-only diagnostics.
 *
 * For each category it shows: total DB entries, total imported assets,
 * successfully mapped, unmapped, duplicate matches, ambiguous matches, the
 * number of catalog rows still missing their icon_url/image_url, and example
 * names for the unmapped / missing records so you can see exactly what's wrong.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDb } from "../db/client";
import { toSlug } from "../import-assets/normalize";

type Db = ReturnType<typeof createDb>;

type Category = {
  key: string;
  table: "perks" | "characters" | "items" | "add_ons" | "maps";
  imageCol: "icon_url" | "image_url";
  role: "killer" | "survivor" | null;
  assetTypes: string[];
};

const CATEGORIES: Category[] = [
  { key: "Perks", table: "perks", imageCol: "icon_url", role: null, assetTypes: ["perks"] },
  { key: "Killers", table: "characters", imageCol: "image_url", role: "killer", assetTypes: ["killers"] },
  { key: "Survivors", table: "characters", imageCol: "image_url", role: "survivor", assetTypes: ["survivors"] },
  { key: "Items", table: "items", imageCol: "icon_url", role: null, assetTypes: ["items"] },
  { key: "Add-ons", table: "add_ons", imageCol: "icon_url", role: null, assetTypes: ["add_ons"] },
  { key: "Maps", table: "maps", imageCol: "image_url", role: null, assetTypes: ["maps"] },
];

type CatalogRow = { id: string; slug: string; name: string; image: string | null };
type ImageRow = {
  source_file: string;
  derived_slug: string | null;
  asset_id: string | null;
  mapping_mode: string;
};

type Stats = {
  key: string;
  dbEntries: number;
  dbWithImage: number;
  dbMissingImage: number;
  imported: number;
  mapped: number;
  mappedAuto: number;
  mappedManual: number;
  unmapped: number;
  duplicateTargets: number;
  ambiguous: number;
  wouldMapByName: number; // unmapped whose derived slug uniquely matches a catalog name
  noMatch: number; // unmapped with no slug/name match at all
  missingExamples: string[];
  unmappedExamples: string[];
  ambiguousExamples: string[];
};

async function loadCatalog(db: Db, cat: Category): Promise<CatalogRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table/column
  let q = (db.selectFrom(cat.table as any) as any).select([
    "id",
    "slug",
    "name",
    `${cat.imageCol} as image`,
  ]);
  if (cat.role) q = q.where("role", "=", cat.role);
  return (await q.execute()) as CatalogRow[];
}

async function loadImages(db: Db, cat: Category): Promise<ImageRow[]> {
  return (await db
    .selectFrom("asset_pack_images")
    .select(["source_file", "derived_slug", "asset_id", "mapping_mode"])
    .where("asset_type", "in", cat.assetTypes)
    .execute()) as ImageRow[];
}

async function analyse(db: Db, cat: Category): Promise<Stats> {
  const [catalog, images] = await Promise.all([
    loadCatalog(db, cat),
    loadImages(db, cat),
  ]);

  const storedSlugs = new Set(catalog.map((r) => r.slug).filter(Boolean));
  const nameSlugCount = new Map<string, number>();
  for (const r of catalog) {
    const ns = toSlug(r.name ?? "");
    if (ns) nameSlugCount.set(ns, (nameSlugCount.get(ns) ?? 0) + 1);
  }

  const dbWithImage = catalog.filter((r) => r.image).length;
  const missingExamples = catalog
    .filter((r) => !r.image)
    .slice(0, 12)
    .map((r) => r.name);

  const mappedRows = images.filter((i) => i.asset_id);
  const unmappedRows = images.filter((i) => !i.asset_id);

  // duplicate targets: a catalog id receiving more than one asset image
  const targetCounts = new Map<string, number>();
  for (const i of mappedRows) {
    targetCounts.set(i.asset_id as string, (targetCounts.get(i.asset_id as string) ?? 0) + 1);
  }
  let duplicateTargets = 0;
  for (const n of targetCounts.values()) if (n > 1) duplicateTargets += 1;

  let ambiguous = 0;
  let wouldMapByName = 0;
  let noMatch = 0;
  const ambiguousExamples: string[] = [];
  for (const i of unmappedRows) {
    const slug = i.derived_slug ?? toSlug(i.source_file.replace(/\.png$/i, ""));
    const nameMatches = nameSlugCount.get(slug) ?? 0;
    if (storedSlugs.has(slug)) {
      // would map by slug (shouldn't be unmapped after a fresh import)
    } else if (nameMatches > 1) {
      ambiguous += 1;
      if (ambiguousExamples.length < 12) ambiguousExamples.push(i.source_file);
    } else if (nameMatches === 1) {
      wouldMapByName += 1;
    } else {
      noMatch += 1;
    }
  }

  return {
    key: cat.key,
    dbEntries: catalog.length,
    dbWithImage,
    dbMissingImage: catalog.length - dbWithImage,
    imported: images.length,
    mapped: mappedRows.length,
    mappedAuto: mappedRows.filter((i) => i.mapping_mode === "auto").length,
    mappedManual: mappedRows.filter((i) => i.mapping_mode === "manual").length,
    unmapped: unmappedRows.length,
    duplicateTargets,
    ambiguous,
    wouldMapByName,
    noMatch,
    missingExamples,
    unmappedExamples: unmappedRows.slice(0, 12).map((i) => i.source_file),
    ambiguousExamples,
  };
}

function pct(n: number, d: number): string {
  if (d === 0) return "n/a";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function render(all: Stats[]): string {
  const lines: string[] = [];
  lines.push("# Asset Coverage Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "Read-only diagnostic. 'Imported' counts rows in asset_pack_images for the " +
      "category; 'mapped' = those with a catalog asset_id; 'DB missing image' = " +
      "catalog rows whose icon_url/image_url is still null (the actual render gap).",
  );
  lines.push("");
  lines.push(
    "| Category | DB entries | Imported | Mapped | Unmapped | Dup targets | Ambiguous | DB w/ image | DB missing |",
  );
  lines.push(
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const s of all) {
    lines.push(
      `| ${s.key} | ${s.dbEntries} | ${s.imported} | ${s.mapped} | ${s.unmapped} | ${s.duplicateTargets} | ${s.ambiguous} | ${s.dbWithImage} (${pct(s.dbWithImage, s.dbEntries)}) | ${s.dbMissingImage} |`,
    );
  }
  lines.push("");

  for (const s of all) {
    lines.push(`## ${s.key}`);
    lines.push("");
    lines.push(`- DB entries: **${s.dbEntries}**`);
    lines.push(
      `- DB rows with image: **${s.dbWithImage}** (${pct(s.dbWithImage, s.dbEntries)}) · missing: **${s.dbMissingImage}**`,
    );
    lines.push(`- Imported assets: **${s.imported}**`);
    lines.push(
      `- Mapped: **${s.mapped}** (auto ${s.mappedAuto}, manual ${s.mappedManual}) · Unmapped: **${s.unmapped}**`,
    );
    lines.push(`- Duplicate target rows (one entity, multiple assets): **${s.duplicateTargets}**`);
    lines.push(`- Ambiguous (name matches >1 entry): **${s.ambiguous}**`);
    lines.push(
      `- Of the unmapped: would map by unique name **${s.wouldMapByName}**, no match at all **${s.noMatch}**`,
    );
    if (s.missingExamples.length) {
      lines.push(`- Example DB rows missing an image: ${s.missingExamples.join(", ")}`);
    }
    if (s.unmappedExamples.length) {
      lines.push(`- Example unmapped asset files: ${s.unmappedExamples.join(", ")}`);
    }
    if (s.ambiguousExamples.length) {
      lines.push(`- Example ambiguous asset files: ${s.ambiguousExamples.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const db = createDb();
  try {
    const all: Stats[] = [];
    for (const cat of CATEGORIES) all.push(await analyse(db, cat));

    const report = render(all);
    // Console summary
    console.log(report);
    // Persist to the bind-mounted data dir so it's reachable from the host.
    const out = resolve(process.cwd(), "data", "asset-coverage-report.md");
    try {
      writeFileSync(out, report);
      console.log(`\n[diagnose:assets] Report written to ${out}`);
    } catch (err) {
      console.warn(`[diagnose:assets] Could not write report file: ${(err as Error).message}`);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
