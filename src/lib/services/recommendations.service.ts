import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";

export type RecItem = {
  id: string;
  perkId: string;
  perkName: string;
  perkSlug: string;
  perkIcon: string | null;
  note: string | null;
};

export type RecAdminItem = RecItem & {
  sortOrder: number;
  isActive: boolean;
};

export type RecResult = { ok: true } | { ok: false; error: string };

async function requireStaffId(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true, id: profile.id };
}

/** Active recommendations for one character (ordered). */
export async function getActiveRecommendations(
  characterId: string,
): Promise<RecItem[]> {
  const rows = await db
    .selectFrom("perk_recommendations as r")
    .innerJoin("perks as p", "p.id", "r.perk_id")
    .select([
      "r.id as id",
      "p.id as perkId",
      "p.name as perkName",
      "p.slug as perkSlug",
      "p.icon_url as perkIcon",
      "r.note as note",
    ])
    .where("r.character_id", "=", characterId)
    .where("r.is_active", "=", true)
    .orderBy("r.sort_order")
    .orderBy("r.created_at")
    .execute();
  return rows as RecItem[];
}

/**
 * Active recommendations for every killer, grouped by character id. Used to feed
 * the build form (small payload, client-serializable).
 */
export async function activeRecommendationsByKiller(): Promise<
  Record<string, RecItem[]>
> {
  const rows = await db
    .selectFrom("perk_recommendations as r")
    .innerJoin("perks as p", "p.id", "r.perk_id")
    .innerJoin("characters as c", "c.id", "r.character_id")
    .select([
      "r.id as id",
      "r.character_id as characterId",
      "p.id as perkId",
      "p.name as perkName",
      "p.slug as perkSlug",
      "p.icon_url as perkIcon",
      "r.note as note",
    ])
    .where("r.is_active", "=", true)
    .where("c.role", "=", "killer")
    .orderBy("r.character_id")
    .orderBy("r.sort_order")
    .orderBy("r.created_at")
    .execute();

  const map: Record<string, RecItem[]> = {};
  for (const row of rows) {
    const item: RecItem = {
      id: row.id as string,
      perkId: row.perkId as string,
      perkName: row.perkName as string,
      perkSlug: row.perkSlug as string,
      perkIcon: (row.perkIcon as string | null) ?? null,
      note: (row.note as string | null) ?? null,
    };
    const key = row.characterId as string;
    (map[key] ??= []).push(item);
  }
  return map;
}

/** All recommendations (active + inactive) for a character, for the admin UI. */
export async function listRecommendationsAdmin(
  characterId: string,
): Promise<RecAdminItem[]> {
  const rows = await db
    .selectFrom("perk_recommendations as r")
    .innerJoin("perks as p", "p.id", "r.perk_id")
    .select([
      "r.id as id",
      "p.id as perkId",
      "p.name as perkName",
      "p.slug as perkSlug",
      "p.icon_url as perkIcon",
      "r.note as note",
      "r.sort_order as sortOrder",
      "r.is_active as isActive",
    ])
    .where("r.character_id", "=", characterId)
    .orderBy("r.sort_order")
    .orderBy("r.created_at")
    .execute();
  return rows as RecAdminItem[];
}

/** Add a recommendation (staff). Enforces killer character + killer/none perk. */
export async function addRecommendation(input: {
  characterId: string;
  perkId: string;
  note: string;
  sortOrder: number;
}): Promise<RecResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;

  const character = await db
    .selectFrom("characters")
    .select("role")
    .where("id", "=", input.characterId)
    .executeTakeFirst();
  if (!character) return { ok: false, error: "Character not found." };
  if (character.role !== "killer") {
    return { ok: false, error: "Recommendations are killer-only for now." };
  }

  const perk = await db
    .selectFrom("perks")
    .select("role")
    .where("id", "=", input.perkId)
    .executeTakeFirst();
  if (!perk) return { ok: false, error: "Perk not found." };
  if (perk.role === "survivor") {
    return { ok: false, error: "Pick a killer perk for a killer." };
  }

  try {
    await db
      .insertInto("perk_recommendations")
      .values({
        character_id: input.characterId,
        perk_id: input.perkId,
        note: input.note.trim() || null,
        sort_order: input.sortOrder,
        created_by: auth.id,
      })
      .execute();
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (msg.includes("perk_recommendations_character_id_perk_id_key") || msg.includes("unique")) {
      return { ok: false, error: "That perk is already recommended for this killer." };
    }
    return { ok: false, error: msg || "Failed to add." };
  }
  return { ok: true };
}

export async function updateRecommendation(
  id: string,
  patch: { note?: string; sortOrder?: number; isActive?: boolean },
): Promise<RecResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;

  const patch_set: {
    updated_at: string;
    note?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } = { updated_at: new Date().toISOString() };
  if (patch.note !== undefined) patch_set.note = patch.note.trim() || null;
  if (patch.sortOrder !== undefined) patch_set.sort_order = patch.sortOrder;
  if (patch.isActive !== undefined) patch_set.is_active = patch.isActive;

  try {
    await db
      .updateTable("perk_recommendations")
      .set(patch_set)
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export async function deleteRecommendation(id: string): Promise<RecResult> {
  const auth = await requireStaffId();
  if (!auth.ok) return auth;
  try {
    await db
      .deleteFrom("perk_recommendations")
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}
