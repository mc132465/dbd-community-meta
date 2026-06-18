import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import type { TagCategoryRow, TagRow } from "@/types/database";

export type TagLite = { id: string; name: string; slug: string };

export type TagWithCategory = TagRow & {
  category: Pick<TagCategoryRow, "name" | "slug"> | null;
};

async function selectTagsWithCategory(
  activeOnly: boolean,
): Promise<TagWithCategory[]> {
  let q = db
    .selectFrom("tags")
    .leftJoin("tag_categories", "tag_categories.id", "tags.category_id")
    .select([
      "tags.id as id",
      "tags.name as name",
      "tags.slug as slug",
      "tags.category_id as category_id",
      "tags.is_active as is_active",
      "tags.created_at as created_at",
      "tags.updated_at as updated_at",
      "tag_categories.name as category_name",
      "tag_categories.slug as category_slug",
    ])
    .orderBy("tags.name");
  if (activeOnly) q = q.where("tags.is_active", "=", true);

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

/** Active tags only — used by forms and the public build filter. */
export async function listActiveTags(): Promise<TagWithCategory[]> {
  return selectTagsWithCategory(true);
}

/** All tags incl. disabled — admin only views. */
export async function listAllTags(): Promise<TagWithCategory[]> {
  return selectTagsWithCategory(false);
}

export async function listTagCategories(): Promise<TagCategoryRow[]> {
  return db
    .selectFrom("tag_categories")
    .selectAll()
    .orderBy("sort_order")
    .execute() as Promise<TagCategoryRow[]>;
}

export async function getActiveTagBySlug(slug: string): Promise<TagLite | null> {
  const row = await db
    .selectFrom("tags")
    .select(["id", "name", "slug"])
    .where("slug", "=", slug)
    .where("is_active", "=", true)
    .executeTakeFirst();
  return row ?? null;
}

// ---------- Per-build tag reads ----------
export async function getCommunityTags(buildId: string): Promise<TagLite[]> {
  return db
    .selectFrom("build_tags")
    .innerJoin("tags", "tags.id", "build_tags.tag_id")
    .select(["tags.id as id", "tags.name as name", "tags.slug as slug"])
    .where("build_tags.build_id", "=", buildId)
    .execute();
}

export async function getOfficialTags(buildId: string): Promise<TagLite[]> {
  return db
    .selectFrom("build_editorial_tags")
    .innerJoin("tags", "tags.id", "build_editorial_tags.tag_id")
    .select(["tags.id as id", "tags.name as name", "tags.slug as slug"])
    .where("build_editorial_tags.build_id", "=", buildId)
    .execute();
}

/** Community tags for many builds at once (browse/queue lists). */
export async function communityTagsByBuildIds(
  buildIds: string[],
): Promise<Record<string, TagLite[]>> {
  if (buildIds.length === 0) return {};
  const rows = await db
    .selectFrom("build_tags")
    .innerJoin("tags", "tags.id", "build_tags.tag_id")
    .select([
      "build_tags.build_id as build_id",
      "tags.id as id",
      "tags.name as name",
      "tags.slug as slug",
    ])
    .where("build_tags.build_id", "in", buildIds)
    .execute();

  const map: Record<string, TagLite[]> = {};
  for (const r of rows) {
    (map[r.build_id] ??= []).push({ id: r.id, name: r.name, slug: r.slug });
  }
  return map;
}

/** Build ids carrying a given tag — used to filter the browse list. */
export async function buildIdsWithTag(tagId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("build_tags")
    .select("build_id")
    .where("tag_id", "=", tagId)
    .execute();
  return rows.map((r) => r.build_id);
}

/** Resolve several slugs to active tags in one query (order not guaranteed). */
export async function getActiveTagsBySlugs(
  slugs: string[],
): Promise<TagLite[]> {
  if (slugs.length === 0) return [];
  return db
    .selectFrom("tags")
    .select(["id", "name", "slug"])
    .where("slug", "in", slugs)
    .where("is_active", "=", true)
    .execute();
}

/**
 * Build ids that carry ALL of the given tags (AND semantics). One query:
 * group build_tags by build and require the distinct matched-tag count to
 * equal the number of requested tags.
 */
export async function buildIdsWithAllTags(
  tagIds: string[],
): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const rows = await db
    .selectFrom("build_tags")
    .select("build_id")
    .where("tag_id", "in", tagIds)
    .groupBy("build_id")
    .having(sql<boolean>`count(distinct tag_id) = ${tagIds.length}`)
    .execute();
  return rows.map((r) => r.build_id);
}
