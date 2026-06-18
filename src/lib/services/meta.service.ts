import "server-only";

import { db } from "@/lib/db/kysely";

export type MetaEntry = {
  name: string;
  slug: string;
  count: number;
  role?: string | null;
};

/** Most-used perks across approved (non-deleted) community builds. */
export async function topPerks(limit = 15): Promise<MetaEntry[]> {
  const rows = await db
    .selectFrom("build_perks as bp")
    .innerJoin("builds as b", "b.id", "bp.build_id")
    .innerJoin("perks as p", "p.id", "bp.perk_id")
    .select((eb) => [
      "p.name as name",
      "p.slug as slug",
      "p.role as role",
      eb.fn.count("bp.perk_id").as("count"),
    ])
    .where("b.status", "=", "approved")
    .where("b.deleted_at", "is", null)
    .groupBy(["p.id", "p.name", "p.slug", "p.role"])
    .orderBy("count", "desc")
    .orderBy("p.name")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    role: r.role,
    count: Number(r.count),
  }));
}

/** Most-built characters of a given role. */
export async function topCharacters(
  role: "killer" | "survivor",
  limit = 10,
): Promise<MetaEntry[]> {
  const rows = await db
    .selectFrom("builds as b")
    .innerJoin("characters as c", "c.id", "b.character_id")
    .select((eb) => [
      "c.name as name",
      "c.slug as slug",
      eb.fn.count("b.id").as("count"),
    ])
    .where("b.status", "=", "approved")
    .where("b.deleted_at", "is", null)
    .where("b.role", "=", role)
    .groupBy(["c.id", "c.name", "c.slug"])
    .orderBy("count", "desc")
    .orderBy("c.name")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ name: r.name, slug: r.slug, count: Number(r.count) }));
}

/** Most-used survivor items. */
export async function topItems(limit = 10): Promise<MetaEntry[]> {
  const rows = await db
    .selectFrom("build_item as bi")
    .innerJoin("builds as b", "b.id", "bi.build_id")
    .innerJoin("items as it", "it.id", "bi.item_id")
    .select((eb) => [
      "it.name as name",
      "it.slug as slug",
      eb.fn.count("bi.item_id").as("count"),
    ])
    .where("b.status", "=", "approved")
    .where("b.deleted_at", "is", null)
    .groupBy(["it.id", "it.name", "it.slug"])
    .orderBy("count", "desc")
    .orderBy("it.name")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ name: r.name, slug: r.slug, count: Number(r.count) }));
}

/** Most-used add-ons. */
export async function topAddOns(limit = 10): Promise<MetaEntry[]> {
  const rows = await db
    .selectFrom("build_add_ons as ba")
    .innerJoin("builds as b", "b.id", "ba.build_id")
    .innerJoin("add_ons as a", "a.id", "ba.add_on_id")
    .select((eb) => [
      "a.name as name",
      "a.slug as slug",
      eb.fn.count("ba.add_on_id").as("count"),
    ])
    .where("b.status", "=", "approved")
    .where("b.deleted_at", "is", null)
    .groupBy(["a.id", "a.name", "a.slug"])
    .orderBy("count", "desc")
    .orderBy("a.name")
    .limit(limit)
    .execute();
  return rows.map((r) => ({ name: r.name, slug: r.slug, count: Number(r.count) }));
}

/**
 * Perks most frequently paired with a given perk, computed from co-occurrence in
 * approved (non-deleted) community builds. Self-joins build_perks. Excludes the
 * perk itself.
 */
export async function relatedPerks(
  perkId: string,
  limit = 6,
): Promise<MetaEntry[]> {
  const rows = await db
    .selectFrom("build_perks as bp1")
    .innerJoin("build_perks as bp2", "bp2.build_id", "bp1.build_id")
    .innerJoin("builds as b", "b.id", "bp1.build_id")
    .innerJoin("perks as p", "p.id", "bp2.perk_id")
    .select((eb) => [
      "p.name as name",
      "p.slug as slug",
      "p.role as role",
      eb.fn.count("bp2.perk_id").as("count"),
    ])
    .where("bp1.perk_id", "=", perkId)
    .where("bp2.perk_id", "!=", perkId)
    .where("b.status", "=", "approved")
    .where("b.deleted_at", "is", null)
    .groupBy(["p.id", "p.name", "p.slug", "p.role"])
    .orderBy("count", "desc")
    .orderBy("p.name")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    role: r.role,
    count: Number(r.count),
  }));
}
