import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import {
  assignImageManually,
  recomputeTargetImage,
  resetImageToAuto,
  targetTableForType,
  type AssetResult,
} from "@/lib/services/asset-admin.service";

async function requireStaff(): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentProfile();
  if (!me || !isModerator(me.role)) return { ok: false, error: "Not authorized." };
  return { ok: true };
}

export type ReviewItem = {
  id: string;
  sourceFile: string;
  derivedSlug: string | null;
  packName: string;
  assetType: string;
  imageUrl: string;
  confidence: number | null;
  suggestedId: string | null;
  suggestedName: string | null;
  currentId: string | null;
  currentName: string | null;
};

/** Pending (uncertain/unmapped) asset images for the review queue. */
export async function listReviewQueue(limit = 200): Promise<ReviewItem[]> {
  const rows = (await db
    .selectFrom("asset_pack_images as i")
    .innerJoin("asset_packs as p", "p.id", "i.pack_id")
    .select([
      "i.id as id",
      "i.source_file as sourceFile",
      "i.derived_slug as derivedSlug",
      "p.name as packName",
      "i.asset_type as assetType",
      "i.image_url as imageUrl",
      "i.confidence as confidence",
      "i.suggested_asset_id as suggestedId",
      "i.asset_id as currentId",
    ])
    .where("i.review_status", "=", "pending")
    .orderBy("i.confidence", "desc")
    .orderBy("i.asset_type")
    .orderBy("i.source_file")
    .limit(Math.min(Math.max(limit, 1), 500))
    .execute()) as Array<{
    id: string;
    sourceFile: string;
    derivedSlug: string | null;
    packName: string;
    assetType: string;
    imageUrl: string;
    confidence: number | null;
    suggestedId: string | null;
    currentId: string | null;
  }>;

  // Resolve suggested/current ids to names, grouped by catalog table.
  const idsByTable = new Map<string, Set<string>>();
  for (const r of rows) {
    const table = targetTableForType(r.assetType);
    if (!table) continue;
    for (const id of [r.suggestedId, r.currentId]) {
      if (!id) continue;
      if (!idsByTable.has(table)) idsByTable.set(table, new Set());
      idsByTable.get(table)!.add(id);
    }
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
    const table = targetTableForType(r.assetType);
    const nm = (id: string | null) =>
      id && table ? (nameById.get(`${table}:${id}`) ?? null) : null;
    return {
      id: r.id,
      sourceFile: r.sourceFile,
      derivedSlug: r.derivedSlug,
      packName: r.packName,
      assetType: r.assetType,
      imageUrl: r.imageUrl,
      confidence: r.confidence,
      suggestedId: r.suggestedId,
      suggestedName: nm(r.suggestedId),
      currentId: r.currentId,
      currentName: nm(r.currentId),
    };
  });
}

export async function countReviewQueue(): Promise<number> {
  const row = await db
    .selectFrom("asset_pack_images")
    .select((eb) => eb.fn.countAll<string>().as("c"))
    .where("review_status", "=", "pending")
    .executeTakeFirst();
  return Number(row?.c ?? 0);
}

/** Confirm: map the image to a chosen target (human decision → manual + confirmed). */
export async function reviewAssign(
  imageId: string,
  assetId: string,
): Promise<AssetResult> {
  const assigned = await assignImageManually({ imageId, assetId });
  if (!assigned.ok) return assigned;
  try {
    await db
      .updateTable("asset_pack_images")
      .set({ review_status: "confirmed", confidence: 1, suggested_asset_id: null })
      .where("id", "=", imageId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Confirm the system's suggestion (or the current auto match) for an image. */
export async function reviewConfirm(imageId: string): Promise<AssetResult> {
  const img = await db
    .selectFrom("asset_pack_images")
    .select(["suggested_asset_id", "asset_id"])
    .where("id", "=", imageId)
    .executeTakeFirst();
  if (!img) return { ok: false, error: "Image not found." };
  const target = img.suggested_asset_id ?? img.asset_id;
  if (!target) {
    return { ok: false, error: "No suggested match — choose a target manually." };
  }
  return reviewAssign(imageId, target);
}

/** Reject: do not use this image. Clears the mapping and recomputes the target. */
export async function reviewReject(imageId: string): Promise<AssetResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  const img = await db
    .selectFrom("asset_pack_images")
    .select(["asset_type", "asset_id"])
    .where("id", "=", imageId)
    .executeTakeFirst();
  if (!img) return { ok: false, error: "Image not found." };
  try {
    await db
      .updateTable("asset_pack_images")
      .set({ review_status: "rejected", asset_id: null, suggested_asset_id: null })
      .where("id", "=", imageId)
      .execute();
    const table = targetTableForType(img.asset_type);
    if (table && img.asset_id) await recomputeTargetImage(table, img.asset_id);
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Reset to automatic mapping, then re-derive the review status from the result. */
export async function reviewResetAuto(imageId: string): Promise<AssetResult> {
  const reset = await resetImageToAuto(imageId);
  if (!reset.ok) return reset;
  const img = await db
    .selectFrom("asset_pack_images")
    .select(["asset_id"])
    .where("id", "=", imageId)
    .executeTakeFirst();
  try {
    await db
      .updateTable("asset_pack_images")
      .set({ review_status: img?.asset_id ? "confirmed" : "pending" })
      .where("id", "=", imageId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export type TargetOption = { id: string; name: string };

/** Candidate catalog targets for the manual picker, for an asset_type. */
export async function listTargetOptions(
  assetType: string,
): Promise<TargetOption[]> {
  const table = targetTableForType(assetType);
  if (!table) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table
  let q = (db.selectFrom(table as any) as any).select(["id", "name"]);
  if (table === "characters") {
    if (assetType === "killers") q = q.where("role", "=", "killer");
    else if (assetType === "survivors") q = q.where("role", "=", "survivor");
  }
  const rows = (await q.orderBy("name").execute()) as TargetOption[];
  return rows;
}
