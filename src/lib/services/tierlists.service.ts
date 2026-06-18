import "server-only";

import { db } from "@/lib/db/kysely";
import type { TierRank } from "@/types/database";

/** Public read model for tier lists. Only published lists are exposed. */

export type TierListSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  authorName: string | null;
  isOfficial: boolean;
  publishedAt: string | null;
  entryCount: number;
};

export type TierListPerk = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  origin: { name: string; slug: string } | null;
};

export type TierGroup = { tier: TierRank; perks: TierListPerk[] };

export type TierListDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isOfficial: boolean;
  tiers: TierGroup[];
};

const TIER_ORDER: TierRank[] = ["S", "A", "B", "C", "D", "F"];

export type TierListTierCounts = {
  id: string;
  title: string;
  status: string;
  tiers: { tier: TierRank; count: number }[];
};

/** All tier lists that have entries, with per-tier perk counts (admin tools). */
export async function listTierListsWithTierCounts(): Promise<
  TierListTierCounts[]
> {
  const rows = await db
    .selectFrom("tier_lists")
    .innerJoin(
      "tier_list_entries",
      "tier_list_entries.tier_list_id",
      "tier_lists.id",
    )
    .select((eb) => [
      "tier_lists.id as id",
      "tier_lists.title as title",
      "tier_lists.status as status",
      "tier_list_entries.tier as tier",
      eb.fn.count("tier_list_entries.perk_id").as("count"),
    ])
    .groupBy([
      "tier_lists.id",
      "tier_lists.title",
      "tier_lists.status",
      "tier_list_entries.tier",
    ])
    .execute();

  const map = new Map<string, TierListTierCounts>();
  for (const r of rows) {
    let e = map.get(r.id);
    if (!e) {
      e = { id: r.id, title: r.title, status: r.status, tiers: [] };
      map.set(r.id, e);
    }
    e.tiers.push({ tier: r.tier as TierRank, count: Number(r.count) });
  }
  for (const e of map.values()) {
    e.tiers.sort(
      (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
    );
  }
  return [...map.values()];
}

export async function listPublishedTierLists(): Promise<TierListSummary[]> {
  const rows = await db
    .selectFrom("tier_lists")
    .leftJoin(
      "tier_list_entries",
      "tier_list_entries.tier_list_id",
      "tier_lists.id",
    )
    .leftJoin("profiles", "profiles.id", "tier_lists.author_id")
    .select((eb) => [
      "tier_lists.id as id",
      "tier_lists.title as title",
      "tier_lists.slug as slug",
      "tier_lists.description as description",
      "tier_lists.category as category",
      "tier_lists.is_official as is_official",
      "tier_lists.published_at as published_at",
      eb.ref("profiles.username").as("author_name"),
      eb.fn.count("tier_list_entries.id").as("entry_count"),
    ])
    .where("tier_lists.status", "=", "published")
    .groupBy([
      "tier_lists.id",
      "tier_lists.title",
      "tier_lists.slug",
      "tier_lists.description",
      "tier_lists.category",
      "tier_lists.is_official",
      "tier_lists.published_at",
      "profiles.username",
    ])
    .orderBy("tier_lists.is_official", "desc")
    .orderBy("tier_lists.published_at", "desc")
    .execute();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    category: r.category,
    authorName: (r.author_name as string | null) ?? null,
    isOfficial: r.is_official,
    publishedAt: r.published_at,
    entryCount: Number(r.entry_count),
  }));
}

export type PerkTierPlacement = {
  title: string;
  slug: string;
  tier: TierRank;
  isOfficial: boolean;
};

/**
 * Published tier lists that contain a given perk, with the perk's tier in each.
 * Backs the "Tier Lists" section on the perk detail page. Works for universal
 * perks too — placement is keyed on perk_id, independent of origin.
 */
export async function tierListsContainingPerk(
  perkId: string,
): Promise<PerkTierPlacement[]> {
  const rows = await db
    .selectFrom("tier_list_entries")
    .innerJoin("tier_lists", "tier_lists.id", "tier_list_entries.tier_list_id")
    .select([
      "tier_lists.title as title",
      "tier_lists.slug as slug",
      "tier_lists.is_official as is_official",
      "tier_list_entries.tier as tier",
    ])
    .where("tier_list_entries.perk_id", "=", perkId)
    .where("tier_lists.status", "=", "published")
    .orderBy("tier_lists.is_official", "desc")
    .orderBy("tier_lists.title", "asc")
    .execute();

  return rows.map((r) => ({
    title: r.title,
    slug: r.slug,
    tier: r.tier as TierRank,
    isOfficial: r.is_official,
  }));
}

export async function getTierListBySlug(
  slug: string,
): Promise<TierListDetail | null> {
  const list = await db
    .selectFrom("tier_lists")
    .select(["id", "title", "slug", "description", "is_official"])
    .where("slug", "=", slug)
    .where("status", "=", "published")
    .executeTakeFirst();
  if (!list) return null;

  const rows = await db
    .selectFrom("tier_list_entries")
    .innerJoin("perks", "perks.id", "tier_list_entries.perk_id")
    .leftJoin("characters", "characters.id", "perks.origin_character_id")
    .select([
      "tier_list_entries.tier as tier",
      "tier_list_entries.position as position",
      "perks.id as id",
      "perks.name as name",
      "perks.slug as slug",
      "perks.icon_url as icon_url",
      "characters.name as origin_name",
      "characters.slug as origin_slug",
    ])
    .where("tier_list_entries.tier_list_id", "=", list.id)
    .orderBy("tier_list_entries.position", "asc")
    .execute();

  const byTier = new Map<TierRank, TierListPerk[]>();
  for (const r of rows) {
    const perk: TierListPerk = {
      id: r.id,
      name: r.name,
      slug: r.slug,
      iconUrl: r.icon_url,
      origin: r.origin_slug
        ? { name: r.origin_name as string, slug: r.origin_slug }
        : null,
    };
    const arr = byTier.get(r.tier as TierRank) ?? [];
    arr.push(perk);
    byTier.set(r.tier as TierRank, arr);
  }

  // Only include tiers that have perks, in canonical S→F order.
  const tiers: TierGroup[] = TIER_ORDER.filter((t) => byTier.has(t)).map(
    (t) => ({ tier: t, perks: byTier.get(t) as TierListPerk[] }),
  );

  return {
    id: list.id,
    title: list.title,
    slug: list.slug,
    description: list.description,
    isOfficial: list.is_official,
    tiers,
  };
}

// ---------- Community meta ----------

export type CommunityMetaEntry = {
  name: string;
  slug: string;
  count: number;
  avgScore: number;
  tier: TierRank;
};

export type CommunityMetaCategory =
  | "killers"
  | "survivors"
  | "killer_perks"
  | "survivor_perks"
  | "maps";

/** S=6 … F=1; unknown labels score 0 and are ignored. */
function tierScore(t: string): number {
  const i = TIER_ORDER.indexOf(t.toUpperCase() as TierRank);
  return i === -1 ? 0 : TIER_ORDER.length - i;
}

function scoreToTier(score: number): TierRank {
  const rounded = Math.round(score);
  const idx = Math.min(
    Math.max(TIER_ORDER.length - rounded, 0),
    TIER_ORDER.length - 1,
  );
  return TIER_ORDER[idx];
}

/**
 * Community meta placement for a category: aggregates a subject's tiers
 * across all PUBLISHED tier lists of that category, ranking by average tier
 * (then by how many lists placed it). No schema — derived from tier_list_entries.
 */
export async function communityMeta(
  category: CommunityMetaCategory,
  limit = 20,
): Promise<CommunityMetaEntry[]> {
  const isPerk = category.endsWith("perks");
  const isMap = category === "maps";
  let rows: { name: string; slug: string; tier: string }[];
  if (isPerk) {
    rows = await db
      .selectFrom("tier_list_entries as e")
      .innerJoin("tier_lists as tl", "tl.id", "e.tier_list_id")
      .innerJoin("perks as s", "s.id", "e.perk_id")
      .select(["s.name as name", "s.slug as slug", "e.tier as tier"])
      .where("tl.status", "=", "published")
      .where("tl.category", "=", category)
      .where("e.target_type", "=", "perk")
      .execute();
  } else if (isMap) {
    rows = await db
      .selectFrom("tier_list_entries as e")
      .innerJoin("tier_lists as tl", "tl.id", "e.tier_list_id")
      .innerJoin("maps as s", "s.id", "e.map_id")
      .select(["s.name as name", "s.slug as slug", "e.tier as tier"])
      .where("tl.status", "=", "published")
      .where("tl.category", "=", category)
      .where("e.target_type", "=", "map")
      .execute();
  } else {
    rows = await db
      .selectFrom("tier_list_entries as e")
      .innerJoin("tier_lists as tl", "tl.id", "e.tier_list_id")
      .innerJoin("characters as s", "s.id", "e.character_id")
      .select(["s.name as name", "s.slug as slug", "e.tier as tier"])
      .where("tl.status", "=", "published")
      .where("tl.category", "=", category)
      .where("e.target_type", "=", "character")
      .execute();
  }

  const agg = new Map<
    string,
    { name: string; slug: string; sum: number; count: number }
  >();
  for (const r of rows) {
    const sc = tierScore(r.tier);
    if (!sc) continue;
    const a = agg.get(r.slug) ?? { name: r.name, slug: r.slug, sum: 0, count: 0 };
    a.sum += sc;
    a.count += 1;
    agg.set(r.slug, a);
  }

  return [...agg.values()]
    .map((a) => ({
      name: a.name,
      slug: a.slug,
      count: a.count,
      avgScore: a.sum / a.count,
      tier: scoreToTier(a.sum / a.count),
    }))
    .sort((x, y) => y.avgScore - x.avgScore || y.count - x.count)
    .slice(0, limit);
}
