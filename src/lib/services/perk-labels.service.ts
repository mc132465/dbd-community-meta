import "server-only";

import { sql } from "kysely";
import { z } from "zod";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { slugify } from "@/lib/builds/constants";
import {
  perkLabelCategorySchema,
  perkLabelSchema,
} from "@/lib/validations/build";
import type { PerkLabelCategoryRow } from "@/types/database";
import type { TierRank } from "@/types/database";

/**
 * Perk labels — admin-managed classification of individual perks. Separate from
 * build tags (which describe whole builds). Reads of ACTIVE labels are public;
 * all mutations require moderator/admin.
 */

export type PerkLabelLite = { id: string; name: string; slug: string };

export type PerkLabelWithCategory = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category: { name: string; slug: string } | null;
};

export type PerkLabelResult = { ok: true } | { ok: false; error: string };

// ---------- reads ----------

async function selectLabelsWithCategory(
  activeOnly: boolean,
): Promise<PerkLabelWithCategory[]> {
  let q = db
    .selectFrom("perk_labels")
    .leftJoin(
      "perk_label_categories",
      "perk_label_categories.id",
      "perk_labels.category_id",
    )
    .select([
      "perk_labels.id as id",
      "perk_labels.name as name",
      "perk_labels.slug as slug",
      "perk_labels.category_id as category_id",
      "perk_labels.is_active as is_active",
      "perk_labels.created_at as created_at",
      "perk_labels.updated_at as updated_at",
      "perk_label_categories.name as category_name",
      "perk_label_categories.slug as category_slug",
    ])
    .orderBy("perk_labels.name");
  if (activeOnly) q = q.where("perk_labels.is_active", "=", true);

  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category_id: r.category_id,
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
    category: r.category_slug
      ? { name: r.category_name as string, slug: r.category_slug }
      : null,
  }));
}

/** Active labels only — used by forms, perk pages, and the public filter. */
export async function listActivePerkLabels(): Promise<PerkLabelWithCategory[]> {
  return selectLabelsWithCategory(true);
}

/** All labels incl. disabled — admin views only. */
export async function listAllPerkLabels(): Promise<PerkLabelWithCategory[]> {
  return selectLabelsWithCategory(false);
}

export async function listPerkLabelCategories(): Promise<
  PerkLabelCategoryRow[]
> {
  return db
    .selectFrom("perk_label_categories")
    .selectAll()
    .orderBy("sort_order")
    .execute() as Promise<PerkLabelCategoryRow[]>;
}

// ---------- assignment reads (active labels) ----------

/** Active labels for many perks at once (perk lists / future filter). */
export async function labelsByPerkIds(
  perkIds: string[],
): Promise<Record<string, PerkLabelLite[]>> {
  if (perkIds.length === 0) return {};
  const rows = await db
    .selectFrom("perk_label_assignments")
    .innerJoin(
      "perk_labels",
      "perk_labels.id",
      "perk_label_assignments.label_id",
    )
    .select([
      "perk_label_assignments.perk_id as perk_id",
      "perk_labels.id as id",
      "perk_labels.name as name",
      "perk_labels.slug as slug",
    ])
    .where("perk_label_assignments.perk_id", "in", perkIds)
    .where("perk_labels.is_active", "=", true)
    .execute();

  const map: Record<string, PerkLabelLite[]> = {};
  for (const r of rows) {
    (map[r.perk_id] ??= []).push({ id: r.id, name: r.name, slug: r.slug });
  }
  return map;
}

/** Active labels assigned to a single perk. */
export async function labelsForPerk(
  perkId: string,
): Promise<PerkLabelLite[]> {
  const map = await labelsByPerkIds([perkId]);
  return map[perkId] ?? [];
}

/** Resolve several slugs to ACTIVE labels in one query (order not guaranteed). */
export async function getActiveLabelsBySlugs(
  slugs: string[],
): Promise<PerkLabelLite[]> {
  if (slugs.length === 0) return [];
  return db
    .selectFrom("perk_labels")
    .select(["id", "name", "slug"])
    .where("slug", "in", slugs)
    .where("is_active", "=", true)
    .execute();
}

/**
 * Perk ids carrying ALL of the given labels (AND semantics) in one query:
 * group assignments by perk and require the distinct matched-label count to
 * equal the number of requested labels.
 */
export async function perkIdsWithAllLabels(
  labelIds: string[],
): Promise<string[]> {
  if (labelIds.length === 0) return [];
  const rows = await db
    .selectFrom("perk_label_assignments")
    .select("perk_id")
    .where("label_id", "in", labelIds)
    .groupBy("perk_id")
    .having(sql<boolean>`count(distinct label_id) = ${labelIds.length}`)
    .execute();
  return rows.map((r) => r.perk_id);
}

// ---------- mutations (moderator/admin only) ----------

async function requireStaff(): Promise<PerkLabelResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isModerator(profile.role)) {
    return { ok: false, error: "Not authorized." };
  }
  return { ok: true };
}

function mapError(err: unknown): string {
  if ((err as { code?: string })?.code === "23505") {
    return "That slug already exists.";
  }
  return (err as Error)?.message ?? "Something went wrong.";
}

export async function createPerkLabel(input: unknown): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = perkLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid label.",
    };
  }
  const d = parsed.data;
  try {
    await db
      .insertInto("perk_labels")
      .values({
        name: d.name,
        slug: d.slug ? slugify(d.slug) : slugify(d.name),
        category_id: d.category_id || null,
        is_active: d.is_active,
      })
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function updatePerkLabel(
  id: string,
  input: unknown,
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = perkLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid label.",
    };
  }
  const d = parsed.data;
  try {
    await db
      .updateTable("perk_labels")
      .set({
        name: d.name,
        slug: d.slug ? slugify(d.slug) : slugify(d.name),
        category_id: d.category_id || null,
        is_active: d.is_active,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function setPerkLabelActive(
  id: string,
  isActive: boolean,
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  try {
    await db
      .updateTable("perk_labels")
      .set({ is_active: isActive, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

/** Convenience: disable a label (named per the Step 2 spec). */
export async function disablePerkLabel(id: string): Promise<PerkLabelResult> {
  return setPerkLabelActive(id, false);
}

export async function deletePerkLabel(id: string): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  try {
    await db.deleteFrom("perk_labels").where("id", "=", id).execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function createPerkLabelCategory(
  input: unknown,
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const parsed = perkLabelCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category.",
    };
  }
  const d = parsed.data;
  try {
    await db
      .insertInto("perk_label_categories")
      .values({ name: d.name, slug: slugify(d.name), sort_order: d.sort_order })
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

// ---------- perk ↔ label assignment (moderator/admin only) ----------

const uuid = z.string().uuid();

async function perkExists(perkId: string): Promise<boolean> {
  const row = await db
    .selectFrom("perks")
    .select("id")
    .where("id", "=", perkId)
    .executeTakeFirst();
  return Boolean(row);
}

async function activeLabelIds(): Promise<Set<string>> {
  const rows = await db
    .selectFrom("perk_labels")
    .select("id")
    .where("is_active", "=", true)
    .execute();
  return new Set(rows.map((r) => r.id));
}

/**
 * Replace a perk's ACTIVE-label assignments with exactly `labelIds`. Only active
 * labels are assignable; any disabled/unknown id is rejected. Assignments of
 * disabled labels (if any pre-exist) are left untouched. Atomic.
 */
export async function setLabelsForPerk(
  perkId: string,
  labelIds: string[],
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  if (!uuid.safeParse(perkId).success) {
    return { ok: false, error: "Invalid perk id." };
  }
  const ids = [...new Set(labelIds)];
  if (!ids.every((id) => uuid.safeParse(id).success)) {
    return { ok: false, error: "Invalid label id." };
  }
  if (!(await perkExists(perkId))) {
    return { ok: false, error: "Perk not found." };
  }

  const active = await activeLabelIds();
  if (!ids.every((id) => active.has(id))) {
    return { ok: false, error: "Only active labels can be assigned." };
  }

  const activeList = [...active];
  try {
    await db.transaction().execute(async (trx) => {
      // Clear only active-label assignments for this perk (preserve any
      // disabled-label rows that may already exist).
      if (activeList.length > 0) {
        await trx
          .deleteFrom("perk_label_assignments")
          .where("perk_id", "=", perkId)
          .where("label_id", "in", activeList)
          .execute();
      }
      if (ids.length > 0) {
        await trx
          .insertInto("perk_label_assignments")
          .values(ids.map((label_id) => ({ perk_id: perkId, label_id })))
          .onConflict((oc) => oc.columns(["perk_id", "label_id"]).doNothing())
          .execute();
      }
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function assignLabelToPerk(
  perkId: string,
  labelId: string,
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  if (!uuid.safeParse(perkId).success || !uuid.safeParse(labelId).success) {
    return { ok: false, error: "Invalid id." };
  }
  const active = await activeLabelIds();
  if (!active.has(labelId)) {
    return { ok: false, error: "Only active labels can be assigned." };
  }
  if (!(await perkExists(perkId))) {
    return { ok: false, error: "Perk not found." };
  }
  try {
    await db
      .insertInto("perk_label_assignments")
      .values({ perk_id: perkId, label_id: labelId })
      .onConflict((oc) => oc.columns(["perk_id", "label_id"]).doNothing())
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function removeLabelFromPerk(
  perkId: string,
  labelId: string,
): Promise<PerkLabelResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;
  if (!uuid.safeParse(perkId).success || !uuid.safeParse(labelId).success) {
    return { ok: false, error: "Invalid id." };
  }
  try {
    await db
      .deleteFrom("perk_label_assignments")
      .where("perk_id", "=", perkId)
      .where("label_id", "=", labelId)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export type ApplyTierResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

const TIER_RANKS = ["S", "A", "B", "C", "D", "F"] as const;

/**
 * Assign one active label to every perk in a given tier of a tier list.
 * Additive only: existing labels are kept, assignments are de-duplicated
 * (insert on conflict do nothing), tier-list entries are untouched, and no
 * perks are created. Moderator/admin only. Returns the number of perks in the
 * tier that were targeted.
 */
export async function applyPerkLabelFromTierList(input: {
  tierListId: string;
  tier: string;
  labelId: string;
}): Promise<ApplyTierResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const { tierListId, tier, labelId } = input;
  if (!uuid.safeParse(tierListId).success || !uuid.safeParse(labelId).success) {
    return { ok: false, error: "Invalid id." };
  }
  if (!(TIER_RANKS as readonly string[]).includes(tier)) {
    return { ok: false, error: "Invalid tier." };
  }

  const active = await activeLabelIds();
  if (!active.has(labelId)) {
    return { ok: false, error: "Only active labels can be assigned." };
  }

  const entries = await db
    .selectFrom("tier_list_entries")
    .select("perk_id")
    .where("tier_list_id", "=", tierListId)
    .where("tier", "=", tier as TierRank)
    .execute();
  const perkIds = [
    ...new Set(
      entries
        .map((e) => e.perk_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  if (perkIds.length === 0) return { ok: true, count: 0 };

  try {
    await db
      .insertInto("perk_label_assignments")
      .values(perkIds.map((perk_id) => ({ perk_id, label_id: labelId })))
      .onConflict((oc) => oc.columns(["perk_id", "label_id"]).doNothing())
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true, count: perkIds.length };
}
