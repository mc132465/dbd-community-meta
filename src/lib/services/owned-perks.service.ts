import "server-only";

import { z } from "zod";

import { db } from "@/lib/db/kysely";

/**
 * Per-user owned-perk collection. Every function is user-scoped: a caller may
 * only read or modify the ownership of the user id it passes (the action layer
 * supplies the authenticated user's id — never another user's). Reads never
 * expose whose perks they are beyond the requested user.
 */

const uuid = z.string().uuid();

export type OwnedPerksResult = { ok: true } | { ok: false; error: string };

function validIds(...ids: string[]): boolean {
  return ids.every((id) => uuid.safeParse(id).success);
}

// ---------- reads ----------

/** Perk ids the user owns. */
export async function listOwnedPerkIds(userId: string): Promise<string[]> {
  if (!validIds(userId)) return [];
  const rows = await db
    .selectFrom("user_owned_perks")
    .select("perk_id")
    .where("user_id", "=", userId)
    .execute();
  return rows.map((r) => r.perk_id);
}

/** Same as listOwnedPerkIds but as a Set for fast membership checks/filtering. */
export async function ownedPerkIdSet(userId: string): Promise<Set<string>> {
  return new Set(await listOwnedPerkIds(userId));
}

/** Whether the user owns a specific perk. */
export async function ownsPerk(
  userId: string,
  perkId: string,
): Promise<boolean> {
  if (!validIds(userId, perkId)) return false;
  const row = await db
    .selectFrom("user_owned_perks")
    .select("perk_id")
    .where("user_id", "=", userId)
    .where("perk_id", "=", perkId)
    .executeTakeFirst();
  return Boolean(row);
}

// ---------- writes (user-scoped; no admin) ----------

/** Mark or unmark a single perk as owned. Insert is idempotent. */
export async function setPerkOwned(
  userId: string,
  perkId: string,
  owned: boolean,
): Promise<OwnedPerksResult> {
  if (!validIds(userId, perkId)) {
    return { ok: false, error: "Invalid id." };
  }
  try {
    if (owned) {
      await db
        .insertInto("user_owned_perks")
        .values({ user_id: userId, perk_id: perkId })
        .onConflict((oc) => oc.columns(["user_id", "perk_id"]).doNothing())
        .execute();
    } else {
      await db
        .deleteFrom("user_owned_perks")
        .where("user_id", "=", userId)
        .where("perk_id", "=", perkId)
        .execute();
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/**
 * Bulk mark/unmark (e.g. select-all / clear-within-filter). One statement per
 * call regardless of count: a single multi-row insert (on conflict do nothing)
 * or a single delete with `perk_id in (...)`. Invalid/duplicate ids are dropped.
 */
export async function setManyOwned(
  userId: string,
  perkIds: string[],
  owned: boolean,
): Promise<OwnedPerksResult> {
  if (!validIds(userId)) return { ok: false, error: "Invalid id." };
  const ids = [...new Set(perkIds)].filter((id) => uuid.safeParse(id).success);
  if (ids.length === 0) return { ok: true };

  try {
    if (owned) {
      await db
        .insertInto("user_owned_perks")
        .values(ids.map((perk_id) => ({ user_id: userId, perk_id })))
        .onConflict((oc) => oc.columns(["user_id", "perk_id"]).doNothing())
        .execute();
    } else {
      await db
        .deleteFrom("user_owned_perks")
        .where("user_id", "=", userId)
        .where("perk_id", "in", ids)
        .execute();
    }
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Remove all of a user's owned-perk records. */
export async function clearOwnedPerks(
  userId: string,
): Promise<OwnedPerksResult> {
  if (!validIds(userId)) return { ok: false, error: "Invalid id." };
  try {
    await db
      .deleteFrom("user_owned_perks")
      .where("user_id", "=", userId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}
