import "server-only";

import { db } from "@/lib/db/kysely";

/** asset_type -> catalog table whose row id `asset_id` points at (null = none). */
const TABLE_FOR_TYPE: Record<
  string,
  "perks" | "characters" | "items" | "add_ons" | "maps" | "offerings" | null
> = {
  perks: "perks",
  killers: "characters",
  survivors: "characters",
  characters: "characters",
  items: "items",
  add_ons: "add_ons",
  maps: "maps",
  offerings: "offerings",
  other: null,
};

export const ASSET_TYPES = [
  "perks",
  "killers",
  "survivors",
  "items",
  "add_ons",
  "maps",
  "offerings",
  "other",
] as const;

export type CoverageRow = {
  key: string;
  dbEntries: number;
  dbWithImage: number;
  imported: number;
  mapped: number;
  unmapped: number;
};

type CovCat = {
  key: string;
  table: "perks" | "characters" | "items" | "add_ons" | "maps";
  imageCol: "icon_url" | "image_url";
  role: "killer" | "survivor" | null;
  assetTypes: string[];
};

const COV_CATS: CovCat[] = [
  { key: "Perks", table: "perks", imageCol: "icon_url", role: null, assetTypes: ["perks"] },
  { key: "Killers", table: "characters", imageCol: "image_url", role: "killer", assetTypes: ["killers"] },
  { key: "Survivors", table: "characters", imageCol: "image_url", role: "survivor", assetTypes: ["survivors"] },
  { key: "Items", table: "items", imageCol: "icon_url", role: null, assetTypes: ["items"] },
  { key: "Add-ons", table: "add_ons", imageCol: "icon_url", role: null, assetTypes: ["add_ons"] },
  { key: "Maps", table: "maps", imageCol: "image_url", role: null, assetTypes: ["maps"] },
];

async function catalogCount(
  cat: CovCat,
  onlyWithImage: boolean,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table/column
  let q = (db.selectFrom(cat.table as any) as any).select((eb: any) =>
    eb.fn.countAll().as("c"),
  );
  if (cat.role) q = q.where("role", "=", cat.role);
  if (onlyWithImage) q = q.where(cat.imageCol, "is not", null);
  const r = await q.executeTakeFirst();
  return Number(r?.c ?? 0);
}

async function imageCount(
  assetTypes: string[],
  onlyMapped: boolean,
): Promise<number> {
  let q = db
    .selectFrom("asset_pack_images")
    .select((eb) => eb.fn.countAll<string>().as("c"))
    .where("asset_type", "in", assetTypes);
  if (onlyMapped) q = q.where("asset_id", "is not", null);
  const r = await q.executeTakeFirst();
  return Number(r?.c ?? 0);
}

/** Live per-category coverage summary for the admin overview header. */
export async function assetCoverageSummary(): Promise<CoverageRow[]> {
  const out: CoverageRow[] = [];
  for (const cat of COV_CATS) {
    const [dbEntries, dbWithImage, imported, mapped] = await Promise.all([
      catalogCount(cat, false),
      catalogCount(cat, true),
      imageCount(cat.assetTypes, false),
      imageCount(cat.assetTypes, true),
    ]);
    out.push({
      key: cat.key,
      dbEntries,
      dbWithImage,
      imported,
      mapped,
      unmapped: imported - mapped,
    });
  }
  return out;
}

export type AssetMappingRow = {
  id: string;
  sourceFile: string;
  derivedSlug: string | null;
  packName: string;
  assetType: string;
  mappingMode: string;
  imageUrl: string;
  mapped: boolean;
  targetName: string | null;
};

export type MappingFilter = {
  assetType?: string;
  status?: "all" | "mapped" | "unmapped" | "manual";
  limit?: number;
};

/** A page of asset-image rows with their resolved target entity name. */
export async function listAssetMappings(
  filter: MappingFilter = {},
): Promise<AssetMappingRow[]> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);

  let q = db
    .selectFrom("asset_pack_images as i")
    .innerJoin("asset_packs as p", "p.id", "i.pack_id")
    .select([
      "i.id as id",
      "i.source_file as sourceFile",
      "i.derived_slug as derivedSlug",
      "p.name as packName",
      "i.asset_type as assetType",
      "i.mapping_mode as mappingMode",
      "i.image_url as imageUrl",
      "i.asset_id as assetId",
    ])
    .orderBy("i.asset_type")
    .orderBy("i.source_file")
    .limit(limit);

  if (filter.assetType) q = q.where("i.asset_type", "=", filter.assetType);
  if (filter.status === "mapped") q = q.where("i.asset_id", "is not", null);
  if (filter.status === "unmapped") q = q.where("i.asset_id", "is", null);
  if (filter.status === "manual") q = q.where("i.mapping_mode", "=", "manual");

  const rows = (await q.execute()) as Array<{
    id: string;
    sourceFile: string;
    derivedSlug: string | null;
    packName: string;
    assetType: string;
    mappingMode: string;
    imageUrl: string;
    assetId: string | null;
  }>;

  // Resolve target names: group mapped asset_ids by their catalog table.
  const idsByTable = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.assetId) continue;
    const table = TABLE_FOR_TYPE[r.assetType];
    if (!table) continue;
    if (!idsByTable.has(table)) idsByTable.set(table, new Set());
    idsByTable.get(table)!.add(r.assetId);
  }

  const nameById = new Map<string, string>();
  for (const [table, ids] of idsByTable) {
    if (ids.size === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table
    const found = (await (db.selectFrom(table as any) as any)
      .select(["id", "name"])
      .where("id", "in", [...ids])
      .execute()) as Array<{ id: string; name: string }>;
    for (const f of found) nameById.set(`${table}:${f.id}`, f.name);
  }

  return rows.map((r) => {
    const table = TABLE_FOR_TYPE[r.assetType];
    const targetName =
      r.assetId && table ? nameById.get(`${table}:${r.assetId}`) ?? null : null;
    return {
      id: r.id,
      sourceFile: r.sourceFile,
      derivedSlug: r.derivedSlug,
      packName: r.packName,
      assetType: r.assetType,
      mappingMode: r.mappingMode,
      imageUrl: r.imageUrl,
      mapped: !!r.assetId,
      targetName,
    };
  });
}
