import "server-only";

import { db } from "@/lib/db/kysely";
import { getViewer } from "@/lib/auth/authz";
import {
  buildIdsWithAllTags,
  communityTagsByBuildIds,
  getActiveTagsBySlugs,
  getCommunityTags,
  getOfficialTags,
  type TagLite,
} from "@/lib/services/tags.service";
import type {
  AddOnRow,
  BuildEditorialRow,
  BuildRow,
  CharacterRow,
  GameRole,
  ItemRow,
  PerkRow,
} from "@/types/database";

type EditorialPick = { is_featured: boolean; published_at: string | null };

export type BuildCard = BuildRow & {
  characters: Pick<CharacterRow, "name" | "slug" | "role" | "image_url"> | null;
  build_editorials: EditorialPick | EditorialPick[] | null;
  tags: TagLite[];
};

export type BuildLoadout = {
  perks: { slot: number; perk: PerkRow }[];
  addOns: { slot: number; addOn: AddOnRow }[];
  item: ItemRow | null;
};

export type BuildDetail = {
  build: BuildRow;
  character: CharacterRow | null;
  authorUsername: string | null;
  loadout: BuildLoadout;
  editorial: BuildEditorialRow | null;
  perkReasons: Record<number, string>;
  communityTags: TagLite[];
  officialTags: TagLite[];
  isOfficial: boolean;
};

// ---------- Card query + shaping ----------
function buildCardSelect() {
  return db
    .selectFrom("builds")
    .leftJoin("characters", "characters.id", "builds.character_id")
    .leftJoin("build_editorials", "build_editorials.build_id", "builds.id")
    .selectAll("builds")
    .select([
      "characters.name as character_name",
      "characters.slug as character_slug",
      "characters.role as character_role",
      "characters.image_url as character_image_url",
      "build_editorials.build_id as ed_build_id",
      "build_editorials.is_featured as ed_is_featured",
      "build_editorials.published_at as ed_published_at",
    ]);
}

type CardRow = BuildRow & {
  character_name: string | null;
  character_slug: string | null;
  character_role: GameRole | null;
  character_image_url: string | null;
  ed_build_id: string | null;
  ed_is_featured: boolean | null;
  ed_published_at: string | null;
};

function toCard(r: CardRow): Omit<BuildCard, "tags"> {
  const {
    character_name,
    character_slug,
    character_role,
    character_image_url,
    ed_build_id,
    ed_is_featured,
    ed_published_at,
    ...build
  } = r;
  return {
    ...(build as BuildRow),
    characters: character_slug
      ? {
          name: character_name as string,
          slug: character_slug,
          role: character_role as GameRole,
          image_url: character_image_url,
        }
      : null,
    build_editorials: ed_build_id
      ? { is_featured: Boolean(ed_is_featured), published_at: ed_published_at }
      : null,
  };
}

/** Attach community tags to a list of build cards in one query. */
async function withTags(rows: Omit<BuildCard, "tags">[]): Promise<BuildCard[]> {
  const tagMap = await communityTagsByBuildIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, tags: tagMap[r.id] ?? [] }));
}

// ---------- Public browse ----------

/**
 * Approved builds carrying ALL of the given tags (AND semantics). Empty/blank
 * slugs are ignored; an empty set returns all approved builds. If any slug is
 * unknown or inactive, the AND can't be satisfied → returns []. Bounded query
 * count regardless of tag count (resolve tags, find ids, fetch cards, attach
 * tags) — no N+1.
 */
export async function listApprovedBuildsByTags(
  tagSlugs: string[],
): Promise<BuildCard[]> {
  const slugs = [...new Set(tagSlugs.map((s) => s.trim()).filter(Boolean))];

  let allowedIds: string[] | null = null;
  if (slugs.length > 0) {
    const tags = await getActiveTagsBySlugs(slugs);
    // Every requested slug must resolve to an active tag for an AND match.
    if (tags.length !== slugs.length) return [];
    allowedIds = await buildIdsWithAllTags(tags.map((t) => t.id));
    if (allowedIds.length === 0) return [];
  }

  let q = buildCardSelect()
    .where("builds.status", "=", "approved")
    .where("builds.deleted_at", "is", null)
    .orderBy("builds.created_at", "desc");
  if (allowedIds) q = q.where("builds.id", "in", allowedIds);

  const rows = (await q.execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

/** Back-compat single-tag browse; delegates to the multi-tag AND path. */
export async function listApprovedBuilds(tagSlug?: string): Promise<BuildCard[]> {
  return listApprovedBuildsByTags(tagSlug ? [tagSlug] : []);
}

/** Approved builds for a specific character (used on character pages). */
export async function listApprovedBuildsByCharacter(
  characterId: string,
): Promise<BuildCard[]> {
  const rows = (await buildCardSelect()
    .where("builds.status", "=", "approved")
    .where("builds.character_id", "=", characterId)
    .where("builds.deleted_at", "is", null)
    .orderBy("builds.created_at", "desc")
    .execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

/** Approved build cards for a set of ids, preserving the given id order. */
export async function listBuildCardsByIds(ids: string[]): Promise<BuildCard[]> {
  if (ids.length === 0) return [];
  const rows = (await buildCardSelect()
    .where("builds.id", "in", ids)
    .where("builds.status", "=", "approved")
    .where("builds.deleted_at", "is", null)
    .execute()) as unknown as CardRow[];
  const cards = await withTags(rows.map(toCard));
  const order = new Map(ids.map((id, i) => [id, i] as const));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Filter/search options for the Builds page (all schema-free, optional). */
export type BuildBrowseOptions = {
  q?: string; // free text: build title / character / perk / item / add-on names
  role?: GameRole; // 'killer' | 'survivor'
  character?: string; // character slug
  tags?: string[]; // tag slugs (AND semantics)
};

/** Escape ILIKE wildcards so user text is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Unified approved-build browse: optional text search across the build title,
 * character name, and the names of perks / item / add-ons in the loadout, plus
 * optional role, specific-character, and tag (AND) filters. One bounded query
 * (+ tag attach); no schema change.
 */
export async function searchApprovedBuilds(
  opts: BuildBrowseOptions,
): Promise<BuildCard[]> {
  const slugs = [...new Set((opts.tags ?? []).map((s) => s.trim()).filter(Boolean))];

  let allowedIds: string[] | null = null;
  if (slugs.length > 0) {
    const tags = await getActiveTagsBySlugs(slugs);
    if (tags.length !== slugs.length) return [];
    allowedIds = await buildIdsWithAllTags(tags.map((t) => t.id));
    if (allowedIds.length === 0) return [];
  }

  let qb = buildCardSelect()
    .where("builds.status", "=", "approved")
    .where("builds.deleted_at", "is", null);

  if (allowedIds) qb = qb.where("builds.id", "in", allowedIds);
  if (opts.role) qb = qb.where("characters.role", "=", opts.role);
  if (opts.character) qb = qb.where("characters.slug", "=", opts.character);

  const text = (opts.q ?? "").trim();
  if (text) {
    const like = `%${escapeLike(text)}%`;
    qb = qb.where((eb) =>
      eb.or([
        eb("builds.title", "ilike", like),
        eb("characters.name", "ilike", like),
        eb.exists(
          eb
            .selectFrom("build_perks")
            .innerJoin("perks", "perks.id", "build_perks.perk_id")
            .select("build_perks.build_id")
            .whereRef("build_perks.build_id", "=", "builds.id")
            .where("perks.name", "ilike", like),
        ),
        eb.exists(
          eb
            .selectFrom("build_item")
            .innerJoin("items", "items.id", "build_item.item_id")
            .select("build_item.build_id")
            .whereRef("build_item.build_id", "=", "builds.id")
            .where("items.name", "ilike", like),
        ),
        eb.exists(
          eb
            .selectFrom("build_add_ons")
            .innerJoin("add_ons", "add_ons.id", "build_add_ons.add_on_id")
            .select("build_add_ons.build_id")
            .whereRef("build_add_ons.build_id", "=", "builds.id")
            .where("add_ons.name", "ilike", like),
        ),
      ]),
    );
  }

  const rows = (await qb
    .orderBy("builds.created_at", "desc")
    .execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

// ---------- Loadout ----------
export async function getBuildLoadout(buildId: string): Promise<BuildLoadout> {
  const [perkRows, addOnRows, itemRow] = await Promise.all([
    db
      .selectFrom("build_perks")
      .innerJoin("perks", "perks.id", "build_perks.perk_id")
      .select("build_perks.slot as slot")
      .selectAll("perks")
      .where("build_perks.build_id", "=", buildId)
      .orderBy("build_perks.slot")
      .execute(),
    db
      .selectFrom("build_add_ons")
      .innerJoin("add_ons", "add_ons.id", "build_add_ons.add_on_id")
      .select("build_add_ons.slot as slot")
      .selectAll("add_ons")
      .where("build_add_ons.build_id", "=", buildId)
      .orderBy("build_add_ons.slot")
      .execute(),
    db
      .selectFrom("build_item")
      .innerJoin("items", "items.id", "build_item.item_id")
      .selectAll("items")
      .where("build_item.build_id", "=", buildId)
      .executeTakeFirst(),
  ]);

  const perks = perkRows.map((r) => {
    const { slot, ...perk } = r;
    return { slot: slot as number, perk: perk as unknown as PerkRow };
  });
  const addOns = addOnRows.map((r) => {
    const { slot, ...addOn } = r;
    return { slot: slot as number, addOn: addOn as unknown as AddOnRow };
  });
  const item = (itemRow as unknown as ItemRow | undefined) ?? null;

  return { perks, addOns, item };
}

// ---------- Detail (viewer-aware visibility, replaces RLS) ----------
export async function getBuildDetailBySlug(
  slug: string,
): Promise<BuildDetail | null> {
  const build = (await db
    .selectFrom("builds")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst()) as BuildRow | undefined;

  if (!build) return null;

  // Visibility: approved/archived & not deleted are public; authors see their
  // own; staff see everything.
  const isPublic =
    (build.status === "approved" || build.status === "archived") &&
    build.deleted_at === null;
  if (!isPublic) {
    const viewer = await getViewer();
    const isAuthor = viewer.userId !== null && viewer.userId === build.author_id;
    if (!isAuthor && !viewer.isStaff) return null;
  }

  const [character, author, loadout, editorial, explanations, communityTags, officialTags] =
    await Promise.all([
      build.character_id
        ? (db
            .selectFrom("characters")
            .selectAll()
            .where("id", "=", build.character_id)
            .executeTakeFirst() as Promise<CharacterRow | undefined>)
        : Promise.resolve(undefined),
      db
        .selectFrom("profiles")
        .select("username")
        .where("id", "=", build.author_id)
        .executeTakeFirst(),
      getBuildLoadout(build.id),
      db
        .selectFrom("build_editorials")
        .selectAll()
        .where("build_id", "=", build.id)
        .executeTakeFirst() as Promise<BuildEditorialRow | undefined>,
      db
        .selectFrom("build_perk_explanations")
        .select(["slot", "reason"])
        .where("build_id", "=", build.id)
        .execute(),
      getCommunityTags(build.id),
      getOfficialTags(build.id),
    ]);

  const perkReasons: Record<number, string> = {};
  for (const row of explanations) perkReasons[row.slot] = row.reason;

  return {
    build,
    character: (character as CharacterRow | undefined) ?? null,
    authorUsername: author?.username ?? null,
    loadout,
    editorial: (editorial as BuildEditorialRow | undefined) ?? null,
    perkReasons,
    communityTags,
    officialTags,
    isOfficial: Boolean(editorial?.published_at),
  };
}

// ---------- Author dashboard ----------
export async function listBuildsByAuthor(authorId: string): Promise<BuildCard[]> {
  const rows = (await buildCardSelect()
    .where("builds.author_id", "=", authorId)
    .orderBy("builds.created_at", "desc")
    .execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

// ---------- Staff: review queue (callers are admin-gated) ----------
export async function listPendingReview(): Promise<BuildCard[]> {
  const rows = (await buildCardSelect()
    .where("builds.status", "=", "pending_review")
    .orderBy("builds.created_at", "asc")
    .execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

export async function listAllBuilds(): Promise<BuildCard[]> {
  const rows = (await buildCardSelect()
    .orderBy("builds.created_at", "desc")
    .execute()) as unknown as CardRow[];
  return withTags(rows.map(toCard));
}

/** Result shape for staff moderation mutations. */
export type BuildModResult = { ok: true } | { ok: false; error: string };

/**
 * Staff soft-delete of a build (sets deleted_at). Non-destructive and
 * reversible: public reads already filter `deleted_at is null`, while staff and
 * the author can still see it (see getBuildDetailBySlug). Idempotent.
 */
export async function deleteBuildAsStaff(
  buildId: string,
): Promise<BuildModResult> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { ok: false, error: "Not authorized." };
  try {
    await db
      .updateTable("builds")
      .set({ deleted_at: new Date().toISOString() })
      .where("id", "=", buildId)
      .where("deleted_at", "is", null)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

/** Staff restore of a soft-deleted build (clears deleted_at). */
export async function restoreBuildAsStaff(
  buildId: string,
): Promise<BuildModResult> {
  const viewer = await getViewer();
  if (!viewer.isStaff) return { ok: false, error: "Not authorized." };
  try {
    await db
      .updateTable("builds")
      .set({ deleted_at: null, updated_at: new Date().toISOString() })
      .where("id", "=", buildId)
      .execute();
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Failed." };
  }
  return { ok: true };
}

export async function countPendingReview(): Promise<number> {
  const row = await db
    .selectFrom("builds")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("status", "=", "pending_review")
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function getAuthorUsernames(
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await db
    .selectFrom("profiles")
    .select(["id", "username"])
    .where("id", "in", ids)
    .execute();
  return Object.fromEntries(rows.map((p) => [p.id, p.username]));
}

/** Resolve a build's slug from its id (admin edit entry point). */
export async function getBuildSlugById(id: string): Promise<string | null> {
  const row = await db
    .selectFrom("builds")
    .select("slug")
    .where("id", "=", id)
    .executeTakeFirst();
  return row?.slug ?? null;
}
