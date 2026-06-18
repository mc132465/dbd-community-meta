import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";

/**
 * Admin asset management (Step 2). Reads the per-pack image inventory, detects
 * missing / unmapped images, and performs category-validated manual assignment
 * and reset-to-auto. The denormalized icon_url/image_url on each catalog row is
 * (re)computed by precedence: manual override → default pack → newest matching
 * → null (placeholder).
 *
 * Category safety: a perk image can only map to a perk, a killer image only to
 * a killer character, etc. Cross-category assignment is rejected.
 */

export type AssetCategory =
  | "perks"
  | "killers"
  | "survivors"
  | "characters"
  | "items"
  | "add_ons"
  | "maps"
  | "offerings"
  | "powers"
  | "other";

export type TargetTable =
  | "perks"
  | "characters"
  | "items"
  | "add_ons"
  | "maps"
  | "offerings"
  | "powers";

export type AssetResult = { ok: true } | { ok: false; error: string };

/** Category → catalog target table, denormalized column, role filter. */
const CATEGORY_TARGET: Record<
  AssetCategory,
  { table: TargetTable | null; role: "killer" | "survivor" | null }
> = {
  perks: { table: "perks", role: null },
  killers: { table: "characters", role: "killer" },
  survivors: { table: "characters", role: "survivor" },
  characters: { table: "characters", role: null },
  items: { table: "items", role: null },
  add_ons: { table: "add_ons", role: null },
  maps: { table: "maps", role: null },
  offerings: { table: "offerings", role: null },
  powers: { table: "powers", role: null },
  other: { table: null, role: null },
};

/** Denormalized image column per target table. */
const TABLE_COLUMN: Record<TargetTable, "icon_url" | "image_url"> = {
  perks: "icon_url",
  characters: "image_url",
  items: "icon_url",
  add_ons: "icon_url",
  maps: "image_url",
  offerings: "image_url",
  powers: "icon_url",
};

/** asset_types whose images can feed a given target table (precedence scan). */
const TABLE_FEEDING_TYPES: Record<TargetTable, AssetCategory[]> = {
  perks: ["perks"],
  characters: ["killers", "survivors", "characters"],
  items: ["items"],
  add_ons: ["add_ons"],
  maps: ["maps"],
  offerings: ["offerings"],
  powers: ["powers"],
};

/** asset_types relevant to a category when detecting MISSING images. */
const CATEGORY_FEEDING_TYPES: Record<AssetCategory, AssetCategory[]> = {
  perks: ["perks"],
  killers: ["killers", "characters"],
  survivors: ["survivors", "characters"],
  characters: ["killers", "survivors", "characters"],
  items: ["items"],
  add_ons: ["add_ons"],
  maps: ["maps"],
  offerings: ["offerings"],
  powers: ["powers"],
  other: ["other"],
};

/** Which catalog table an asset_type's mapped asset_id points at. */
export function targetTableForType(assetType: string): TargetTable | null {
  return CATEGORY_TARGET[assetType as AssetCategory]?.table ?? null;
}

async function requireStaff(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true, id: profile.id };
}

// ---------- packs ----------

export type AssetPackSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sourceFolder: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  imageCount: number;
};

export async function listAssetPacks(): Promise<AssetPackSummary[]> {
  const rows = await db
    .selectFrom("asset_packs")
    .leftJoin(
      "asset_pack_images",
      "asset_pack_images.pack_id",
      "asset_packs.id",
    )
    .select((eb) => [
      "asset_packs.id as id",
      "asset_packs.name as name",
      "asset_packs.slug as slug",
      "asset_packs.description as description",
      "asset_packs.source_folder as source_folder",
      "asset_packs.is_default as is_default",
      "asset_packs.is_active as is_active",
      "asset_packs.created_at as created_at",
      eb.fn.count("asset_pack_images.id").as("image_count"),
    ])
    .groupBy([
      "asset_packs.id",
      "asset_packs.name",
      "asset_packs.slug",
      "asset_packs.description",
      "asset_packs.source_folder",
      "asset_packs.is_default",
      "asset_packs.is_active",
      "asset_packs.created_at",
    ])
    .orderBy("asset_packs.is_default", "desc")
    .orderBy("asset_packs.created_at", "asc")
    .execute();

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    sourceFolder: r.source_folder,
    isDefault: r.is_default,
    isActive: r.is_active,
    createdAt: r.created_at,
    imageCount: Number(r.image_count),
  }));
}

// ---------- images ----------

export type PackImage = {
  id: string;
  packId: string;
  category: string;
  assetId: string | null;
  sourceFile: string;
  derivedSlug: string | null;
  mappingMode: string;
  imageUrl: string;
  assignedName: string | null;
  assignedSlug: string | null;
};

/**
 * List images in a pack, optionally filtered by category and assignment state.
 * `assigned`: true → only mapped, false → only unmapped, undefined → all.
 */
export async function listPackImages(opts: {
  packId: string;
  category?: AssetCategory;
  assigned?: boolean;
}): Promise<PackImage[]> {
  let q = db
    .selectFrom("asset_pack_images")
    .selectAll()
    .where("pack_id", "=", opts.packId);

  if (opts.category) q = q.where("asset_type", "=", opts.category);
  if (opts.assigned === true) q = q.where("asset_id", "is not", null);
  if (opts.assigned === false) q = q.where("asset_id", "is", null);

  const rows = await q
    .orderBy("asset_type")
    .orderBy("source_file")
    .execute();

  const images: PackImage[] = rows.map((r) => ({
    id: r.id,
    packId: r.pack_id,
    category: r.asset_type,
    assetId: r.asset_id,
    sourceFile: r.source_file,
    derivedSlug: r.derived_slug,
    mappingMode: r.mapping_mode,
    imageUrl: r.image_url,
    assignedName: null,
    assignedSlug: null,
  }));

  await attachAssignedNames(images);
  return images;
}

export async function listUnmappedImages(opts: {
  packId?: string;
  category?: AssetCategory;
}): Promise<PackImage[]> {
  let q = db
    .selectFrom("asset_pack_images")
    .selectAll()
    .where("asset_id", "is", null);
  if (opts.packId) q = q.where("pack_id", "=", opts.packId);
  if (opts.category) q = q.where("asset_type", "=", opts.category);

  const rows = await q.orderBy("asset_type").orderBy("source_file").execute();
  return rows.map((r) => ({
    id: r.id,
    packId: r.pack_id,
    category: r.asset_type,
    assetId: r.asset_id,
    sourceFile: r.source_file,
    derivedSlug: r.derived_slug,
    mappingMode: r.mapping_mode,
    imageUrl: r.image_url,
    assignedName: null,
    assignedSlug: null,
  }));
}

/** Resolve assigned target name/slug for mapped images (batched per table). */
async function attachAssignedNames(images: PackImage[]): Promise<void> {
  const byTable = new Map<TargetTable, Set<string>>();
  for (const img of images) {
    if (!img.assetId) continue;
    const table = targetTableForType(img.category);
    if (!table) continue;
    if (!byTable.has(table)) byTable.set(table, new Set());
    byTable.get(table)!.add(img.assetId);
  }

  const nameMaps = new Map<TargetTable, Map<string, { name: string; slug: string }>>();
  for (const [table, ids] of byTable) {
    if (ids.size === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
    const rows = (await (db.selectFrom(table as any) as any)
      .select(["id", "name", "slug"])
      .where("id", "in", [...ids])
      .execute()) as { id: string; name: string; slug: string }[];
    const m = new Map<string, { name: string; slug: string }>();
    for (const row of rows) m.set(row.id, { name: row.name, slug: row.slug });
    nameMaps.set(table, m);
  }

  for (const img of images) {
    if (!img.assetId) continue;
    const table = targetTableForType(img.category);
    if (!table) continue;
    const hit = nameMaps.get(table)?.get(img.assetId);
    if (hit) {
      img.assignedName = hit.name;
      img.assignedSlug = hit.slug;
    }
  }
}

// ---------- missing detection ----------

export type MissingTarget = { id: string; name: string; slug: string };

/** All assignable catalog targets in a category (role-filtered), for pickers. */
export async function listCategoryTargets(
  category: AssetCategory,
): Promise<MissingTarget[]> {
  const target = CATEGORY_TARGET[category];
  if (!target.table) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(target.table as any) as any).select([
    "id",
    "name",
    "slug",
  ]);
  if (target.role) q = q.where("role", "=", target.role);
  const rows = (await q.orderBy("name").execute()) as MissingTarget[];
  return rows;
}

/**
 * Catalog entries in a category that have NO image mapped to them, i.e. their
 * picture would fall back to the placeholder. Role-filtered for killers/
 * survivors.
 */
export async function detectMissingImages(
  category: AssetCategory,
): Promise<MissingTarget[]> {
  const target = CATEGORY_TARGET[category];
  if (!target.table) return [];
  const feeding = CATEGORY_FEEDING_TYPES[category];

  // asset_ids that already have at least one image in the feeding categories.
  const mapped = await db
    .selectFrom("asset_pack_images")
    .select("asset_id")
    .where("asset_type", "in", feeding)
    .where("asset_id", "is not", null)
    .distinct()
    .execute();
  const mappedIds = mapped
    .map((r) => r.asset_id)
    .filter((id): id is string => Boolean(id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(target.table as any) as any).select([
    "id",
    "name",
    "slug",
  ]);
  if (target.role) q = q.where("role", "=", target.role);
  if (mappedIds.length > 0) q = q.where("id", "not in", mappedIds);

  const rows = (await q.orderBy("name").execute()) as MissingTarget[];
  return rows;
}

// ---------- manual assignment + reset ----------

/** Look up a catalog row id by slug within a category (match-only). */
async function findTargetIdBySlug(
  table: TargetTable,
  slug: string,
  role: "killer" | "survivor" | null,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(table as any) as any)
    .select("id")
    .where("slug", "=", slug);
  if (role) q = q.where("role", "=", role);
  const row = (await q.executeTakeFirst()) as { id: string } | undefined;
  return row?.id ?? null;
}

/** Verify a candidate target id exists in the table (and matches role). */
async function targetExists(
  table: TargetTable,
  assetId: string,
  role: "killer" | "survivor" | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
  let q = (db.selectFrom(table as any) as any)
    .select("id")
    .where("id", "=", assetId);
  if (role) q = q.where("role", "=", role);
  const row = await q.executeTakeFirst();
  return Boolean(row);
}

/**
 * Manually assign an image to a catalog entry. Validates that the target is in
 * the image's category (and role). Recomputes the denormalized image for the
 * new target (and the previous one, if it changed).
 */
export async function assignImageManually(input: {
  imageId: string;
  assetId: string;
}): Promise<AssetResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const image = await db
    .selectFrom("asset_pack_images")
    .select(["id", "asset_type", "asset_id"])
    .where("id", "=", input.imageId)
    .executeTakeFirst();
  if (!image) return { ok: false, error: "Image not found." };

  const target = CATEGORY_TARGET[image.asset_type as AssetCategory];
  if (!target || !target.table) {
    return {
      ok: false,
      error: `Category "${image.asset_type}" cannot be assigned to a catalog entry.`,
    };
  }

  const exists = await targetExists(target.table, input.assetId, target.role);
  if (!exists) {
    return {
      ok: false,
      error: `That target is not a valid ${image.asset_type} entry.`,
    };
  }

  const previous = image.asset_id;

  try {
    await db
      .updateTable("asset_pack_images")
      .set({
        asset_id: input.assetId,
        mapping_mode: "manual",
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", input.imageId)
      .execute();

    await recomputeTargetImage(target.table, input.assetId);
    if (previous && previous !== input.assetId) {
      await recomputeTargetImage(target.table, previous);
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Assignment failed." };
  }
  return { ok: true };
}

/**
 * Reset an image back to automatic mapping: re-derive its target from the
 * derived slug (match-only), mark it auto, and recompute affected catalog rows.
 */
export async function resetImageToAuto(imageId: string): Promise<AssetResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const image = await db
    .selectFrom("asset_pack_images")
    .select(["id", "asset_type", "derived_slug", "asset_id"])
    .where("id", "=", imageId)
    .executeTakeFirst();
  if (!image) return { ok: false, error: "Image not found." };

  const target = CATEGORY_TARGET[image.asset_type as AssetCategory];
  const previous = image.asset_id;
  let autoId: string | null = null;
  if (target?.table && image.derived_slug) {
    autoId = await findTargetIdBySlug(
      target.table,
      image.derived_slug,
      target.role,
    );
  }

  try {
    await db
      .updateTable("asset_pack_images")
      .set({
        asset_id: autoId,
        mapping_mode: "auto",
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", imageId)
      .execute();

    if (target?.table) {
      if (autoId) await recomputeTargetImage(target.table, autoId);
      if (previous && previous !== autoId) {
        await recomputeTargetImage(target.table, previous);
      }
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Reset failed." };
  }
  return { ok: true };
}

// ---------- precedence resolver ----------

/**
 * Recompute and persist the denormalized icon_url/image_url for one catalog row
 * using the precedence rule: manual override → default pack → newest matching →
 * null (placeholder).
 */
export async function recomputeTargetImage(
  table: TargetTable,
  assetId: string,
): Promise<void> {
  const types = TABLE_FEEDING_TYPES[table];
  const column = TABLE_COLUMN[table];

  const manual = await db
    .selectFrom("asset_pack_images")
    .select("image_url")
    .where("asset_type", "in", types)
    .where("asset_id", "=", assetId)
    .where("mapping_mode", "=", "manual")
    .orderBy("updated_at", "desc")
    .executeTakeFirst();

  let winner: string | null = manual?.image_url ?? null;

  if (!winner) {
    const def = await db
      .selectFrom("asset_pack_images")
      .innerJoin("asset_packs", "asset_packs.id", "asset_pack_images.pack_id")
      .select("asset_pack_images.image_url as image_url")
      .where("asset_pack_images.asset_type", "in", types)
      .where("asset_pack_images.asset_id", "=", assetId)
      .where("asset_packs.is_default", "=", true)
      .orderBy("asset_pack_images.updated_at", "desc")
      .executeTakeFirst();
    winner = def?.image_url ?? null;
  }

  if (!winner) {
    const recent = await db
      .selectFrom("asset_pack_images")
      .select("image_url")
      .where("asset_type", "in", types)
      .where("asset_id", "=", assetId)
      .orderBy("updated_at", "desc")
      .executeTakeFirst();
    winner = recent?.image_url ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table/column
  await (db.updateTable(table as any) as any)
    .set({ [column]: winner })
    .where("id", "=", assetId)
    .execute();
}
