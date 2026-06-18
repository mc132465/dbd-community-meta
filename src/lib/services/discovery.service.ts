import "server-only";

import { db } from "@/lib/db/kysely";
import {
  listBuildCardsByIds,
  type BuildCard,
} from "@/lib/services/builds.service";
import type { GameRole } from "@/types/database";

/**
 * Discovery Layer — the site's unified, type-agnostic entry point.
 *
 * A single query is matched against characters, perks, builds, and tier lists,
 * and the relationships are expanded automatically so the user never has to know
 * what "kind" of thing they're looking for:
 *   - a character hit pulls in their unique perks, related builds, and the tier
 *     lists those perks appear in;
 *   - a perk hit pulls in its origin character, builds using it, and the tier
 *     lists containing it;
 *   - a tier-list hit pulls in its top perks.
 *
 * It reuses the existing relationships (perks.origin_character_id,
 * build_perks.perk_id, builds.character_id, tier_list_entries.perk_id) and the
 * existing build-card shaping. No new relationship tables.
 */

export type DiscoveryCharacter = {
  id: string;
  name: string;
  slug: string;
  role: GameRole;
  imageUrl: string | null;
  perkCount: number;
};

export type DiscoveryPerk = {
  id: string;
  name: string;
  slug: string;
  role: GameRole | null;
  iconUrl: string | null;
  origin: { name: string; slug: string } | null;
};

export type DiscoveryTierList = {
  id: string;
  title: string;
  slug: string;
  isOfficial: boolean;
  /** A few top perks for context (populated for directly-matched lists). */
  topPerks: DiscoveryPerk[];
};

export type DiscoveryResult = {
  query: string;
  characters: DiscoveryCharacter[];
  perks: DiscoveryPerk[];
  builds: BuildCard[];
  tierLists: DiscoveryTierList[];
};

// Result caps keep the response bounded on broad queries.
const CAP = { characters: 12, perks: 60, builds: 24, tierLists: 12 } as const;

/** Lower is better: exact name (0) > exact slug (1) > prefix (2) > contains (3). */
export function rankScore(q: string, name: string, slug: string): number {
  const ql = q.toLowerCase();
  if (name.toLowerCase() === ql) return 0;
  if (slug.toLowerCase() === ql) return 1;
  if (name.toLowerCase().startsWith(ql)) return 2;
  return 3;
}

// ---------- internal expansion queries (each guards empty id lists) ----------

/** Perks whose origin is one of the given characters (a char's unique perks). */
async function perksByCharacterIds(
  charIds: string[],
  originById: Map<string, { name: string; slug: string }>,
): Promise<DiscoveryPerk[]> {
  if (charIds.length === 0) return [];
  const rows = await db
    .selectFrom("perks")
    .select(["id", "name", "slug", "role", "icon_url", "origin_character_id"])
    .where("origin_character_id", "in", charIds)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    iconUrl: r.icon_url,
    origin: r.origin_character_id
      ? originById.get(r.origin_character_id) ?? null
      : null,
  }));
}

/** Approved build ids for the given characters. */
async function buildIdsByCharacterIds(charIds: string[]): Promise<string[]> {
  if (charIds.length === 0) return [];
  const rows = await db
    .selectFrom("builds")
    .select("id")
    .where("character_id", "in", charIds)
    .where("status", "=", "approved")
    .where("deleted_at", "is", null)
    .orderBy("created_at", "desc")
    .execute();
  return rows.map((r) => r.id);
}

/** Distinct build ids that use any of the given perks (approval filtered later). */
async function buildIdsByPerkIds(perkIds: string[]): Promise<string[]> {
  if (perkIds.length === 0) return [];
  const rows = await db
    .selectFrom("build_perks")
    .select("build_id")
    .where("perk_id", "in", perkIds)
    .execute();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.build_id)) {
      seen.add(r.build_id);
      ids.push(r.build_id);
    }
  }
  return ids;
}

/** Published tier lists containing any of the given perks. */
async function tierListsByPerkIds(
  perkIds: string[],
): Promise<DiscoveryTierList[]> {
  if (perkIds.length === 0) return [];
  const rows = await db
    .selectFrom("tier_list_entries")
    .innerJoin("tier_lists", "tier_lists.id", "tier_list_entries.tier_list_id")
    .select([
      "tier_lists.id as id",
      "tier_lists.title as title",
      "tier_lists.slug as slug",
      "tier_lists.is_official as is_official",
    ])
    .where("tier_lists.status", "=", "published")
    .where("tier_list_entries.perk_id", "in", perkIds)
    .execute();
  const byId = new Map<string, DiscoveryTierList>();
  for (const r of rows) {
    if (!byId.has(r.id)) {
      byId.set(r.id, {
        id: r.id,
        title: r.title,
        slug: r.slug,
        isOfficial: r.is_official,
        topPerks: [],
      });
    }
  }
  return [...byId.values()];
}

/** Top N perks (by position) for each of the given tier lists. */
async function topPerksByTierListIds(
  tierListIds: string[],
  perN = 6,
): Promise<Map<string, DiscoveryPerk[]>> {
  const map = new Map<string, DiscoveryPerk[]>();
  if (tierListIds.length === 0) return map;
  const rows = await db
    .selectFrom("tier_list_entries")
    .innerJoin("perks", "perks.id", "tier_list_entries.perk_id")
    .leftJoin("characters", "characters.id", "perks.origin_character_id")
    .select([
      "tier_list_entries.tier_list_id as tl_id",
      "perks.id as id",
      "perks.name as name",
      "perks.slug as slug",
      "perks.role as role",
      "perks.icon_url as icon_url",
      "characters.name as origin_name",
      "characters.slug as origin_slug",
    ])
    .where("tier_list_entries.tier_list_id", "in", tierListIds)
    .orderBy("tier_list_entries.tier", "asc")
    .orderBy("tier_list_entries.position", "asc")
    .execute();
  for (const r of rows) {
    const list = map.get(r.tl_id) ?? [];
    if (list.length < perN) {
      list.push({
        id: r.id,
        name: r.name,
        slug: r.slug,
        role: r.role,
        iconUrl: r.icon_url,
        origin: r.origin_slug
          ? { name: r.origin_name as string, slug: r.origin_slug }
          : null,
      });
      map.set(r.tl_id, list);
    }
  }
  return map;
}

/** Origin characters for a set of perk origin ids (for perk→character expansion). */
async function charactersByIds(ids: string[]): Promise<DiscoveryCharacter[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .selectFrom("characters")
    .select(["id", "name", "slug", "role", "image_url"])
    .where("id", "in", ids)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    imageUrl: r.image_url,
    perkCount: 0,
  }));
}

/** How many unique perks each character owns (origin_character_id). */
async function perkCountsByCharacterIds(
  ids: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await db
    .selectFrom("perks")
    .select("origin_character_id")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("origin_character_id", "in", ids)
    .groupBy("origin_character_id")
    .execute();
  for (const r of rows as Array<{
    origin_character_id: string | null;
    count: string;
  }>) {
    if (r.origin_character_id) map.set(r.origin_character_id, Number(r.count));
  }
  for (const id of ids) if (!map.has(id)) map.set(id, 0);
  return map;
}

// ---------- the resolver ----------

export async function discover(rawQuery: string): Promise<DiscoveryResult> {
  const query = rawQuery.trim();
  const empty: DiscoveryResult = {
    query,
    characters: [],
    perks: [],
    builds: [],
    tierLists: [],
  };
  if (query.length < 2) return empty;

  // Sanitize the LIKE pattern (strip wildcards so user input can't inject them).
  const like = `%${query.replace(/[%_]/g, "")}%`;

  // 1) Direct matches (characters, perks w/ origin, tier lists, builds) ---------
  const [charRows, perkRows, tlRows, buildIdRows] = await Promise.all([
    db
      .selectFrom("characters")
      .select(["id", "name", "slug", "role", "image_url"])
      .where((eb) =>
        eb.or([eb("name", "ilike", like), eb("slug", "ilike", like)]),
      )
      .execute(),
    db
      .selectFrom("perks")
      .leftJoin("characters", "characters.id", "perks.origin_character_id")
      .select([
        "perks.id as id",
        "perks.name as name",
        "perks.slug as slug",
        "perks.role as role",
        "perks.icon_url as icon_url",
        "perks.origin_character_id as origin_id",
        "characters.name as origin_name",
        "characters.slug as origin_slug",
      ])
      .where((eb) =>
        eb.or([
          eb("perks.name", "ilike", like),
          eb("perks.slug", "ilike", like),
        ]),
      )
      .execute(),
    db
      .selectFrom("tier_lists")
      .select(["id", "title", "slug", "is_official"])
      .where("status", "=", "published")
      .where((eb) =>
        eb.or([eb("title", "ilike", like), eb("slug", "ilike", like)]),
      )
      .execute(),
    db
      .selectFrom("builds")
      .select("id")
      .where("status", "=", "approved")
      .where("deleted_at", "is", null)
      .where((eb) =>
        eb.or([eb("title", "ilike", like), eb("slug", "ilike", like)]),
      )
      .orderBy("created_at", "desc")
      .execute(),
  ]);

  // Index helpers ------------------------------------------------------------
  const originById = new Map<string, { name: string; slug: string }>();
  for (const c of charRows) originById.set(c.id, { name: c.name, slug: c.slug });

  const directChars: DiscoveryCharacter[] = charRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    imageUrl: r.image_url,
    perkCount: 0,
  }));

  const directPerks: DiscoveryPerk[] = perkRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    role: r.role,
    iconUrl: r.icon_url,
    origin: r.origin_slug
      ? { name: r.origin_name as string, slug: r.origin_slug }
      : null,
  }));

  const directTierLists: DiscoveryTierList[] = tlRows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    isOfficial: r.is_official,
    topPerks: [],
  }));

  // 2) Relationship expansion ------------------------------------------------
  const charIds = directChars.map((c) => c.id);

  // Origin characters of directly-matched perks (perk → character).
  const perkOriginIds = [
    ...new Set(
      perkRows
        .map((r) => r.origin_id)
        .filter((v): v is string => Boolean(v) && !originById.has(v as string)),
    ),
  ];
  const originChars = await charactersByIds(perkOriginIds);
  for (const c of originChars)
    originById.set(c.id, { name: c.name, slug: c.slug });

  // A matched character's unique perks (character → perks).
  const charPerks = await perksByCharacterIds(charIds, originById);

  // Tier lists for directly-matched lists need their top perks.
  const topPerkMap = await topPerksByTierListIds(
    directTierLists.map((t) => t.id),
  );
  for (const t of directTierLists) t.topPerks = topPerkMap.get(t.id) ?? [];

  // 3) Merge + dedupe each group --------------------------------------------
  // Characters: direct matches first, then perk-origin characters.
  const characters = dedupeById(
    [...directChars, ...originChars].sort(
      (a, b) =>
        rankScore(query, a.name, a.slug) - rankScore(query, b.name, b.slug),
    ),
  ).slice(0, CAP.characters);

  // Attach each character's unique-perk count (one batched query).
  const charPerkCounts = await perkCountsByCharacterIds(
    characters.map((c) => c.id),
  );
  for (const c of characters) c.perkCount = charPerkCounts.get(c.id) ?? 0;

  // Perks: direct matches first (ranked), then the matched characters' perks.
  const perks = dedupeById([
    ...directPerks.sort(
      (a, b) =>
        rankScore(query, a.name, a.slug) - rankScore(query, b.name, b.slug),
    ),
    ...charPerks.sort((a, b) => a.name.localeCompare(b.name)),
  ]).slice(0, CAP.perks);

  // Tier lists: direct matches + lists containing any surfaced perk.
  const perkIdsForTiers = perks.map((p) => p.id);
  const tierListsViaPerks = await tierListsByPerkIds(perkIdsForTiers);
  const tierLists = dedupeById([
    ...directTierLists,
    ...tierListsViaPerks,
  ]).slice(0, CAP.tierLists);

  // Builds: direct title/slug matches + builds for matched characters + builds
  // using surfaced perks. listBuildCardsByIds enforces approved + order.
  const perkIdsForBuilds = [
    ...directPerks.map((p) => p.id),
    ...charPerks.map((p) => p.id),
  ];
  const [charBuildIds, perkBuildIds] = await Promise.all([
    buildIdsByCharacterIds(charIds),
    buildIdsByPerkIds([...new Set(perkIdsForBuilds)]),
  ]);
  const buildIds = [
    ...new Set([
      ...buildIdRows.map((r) => r.id),
      ...charBuildIds,
      ...perkBuildIds,
    ]),
  ].slice(0, CAP.builds);
  const builds = await listBuildCardsByIds(buildIds);

  return { query, characters, perks, builds, tierLists };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
}
