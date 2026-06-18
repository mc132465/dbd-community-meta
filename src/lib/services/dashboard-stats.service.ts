import "server-only";

import { db } from "@/lib/db/kysely";
import {
  detectMissingImages,
  type AssetCategory,
} from "@/lib/services/asset-admin.service";

/**
 * Read-only aggregates for the admin dashboard. No schema dependency beyond
 * existing tables; counts use COUNT(*) and missing/unmapped reuse the
 * asset-admin definitions.
 */

export type DashboardStats = {
  users: number;
  builds: number;
  tierLists: number;
  comments: number;
  missingAssets: number;
  unmappedAssets: number;
};

export type ActivityItem = {
  type: string;
  title: string;
  href: string;
  createdAt: string;
};

function num(row: { c: string | number | bigint } | undefined): number {
  return Number(row?.c ?? 0);
}

// Representative target categories (characters covers killers + survivors, so
// they aren't summed separately — avoids double counting).
const MISSING_CATEGORIES: AssetCategory[] = [
  "perks",
  "characters",
  "items",
  "add_ons",
  "maps",
  "offerings",
];

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    users,
    builds,
    tierLists,
    buildComments,
    tierListComments,
    discussionReplies,
    unmapped,
  ] = await Promise.all([
    db
      .selectFrom("profiles")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("builds")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("tier_lists")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("build_comments")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("tier_list_comments")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("discussion_replies")
      .select((eb) => eb.fn.countAll().as("c"))
      .executeTakeFirst(),
    db
      .selectFrom("asset_pack_images")
      .select((eb) => eb.fn.countAll().as("c"))
      .where("asset_id", "is", null)
      .executeTakeFirst(),
  ]);

  const missingArrays = await Promise.all(
    MISSING_CATEGORIES.map((c) => detectMissingImages(c)),
  );
  const missingAssets = missingArrays.reduce((sum, a) => sum + a.length, 0);

  return {
    users: num(users),
    builds: num(builds),
    tierLists: num(tierLists),
    comments: num(buildComments) + num(tierListComments) + num(discussionReplies),
    missingAssets,
    unmappedAssets: num(unmapped),
  };
}

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const [builds, tierLists, threads] = await Promise.all([
    db
      .selectFrom("builds")
      .select(["title", "slug", "created_at"])
      .orderBy("created_at", "desc")
      .limit(5)
      .execute(),
    db
      .selectFrom("tier_lists")
      .select(["title", "slug", "created_at"])
      .orderBy("created_at", "desc")
      .limit(5)
      .execute(),
    db
      .selectFrom("discussion_threads")
      .select(["title", "slug", "created_at"])
      .orderBy("created_at", "desc")
      .limit(5)
      .execute(),
  ]);

  const items: ActivityItem[] = [
    ...builds.map((b) => ({
      type: "Build",
      title: b.title ?? "Untitled build",
      href: `/builds/${b.slug}`,
      createdAt: b.created_at,
    })),
    ...tierLists.map((t) => ({
      type: "Tier list",
      title: t.title,
      href: `/tier-lists/${t.slug}`,
      createdAt: t.created_at,
    })),
    ...threads.map((d) => ({
      type: "Discussion",
      title: d.title,
      href: `/discussions/${d.slug}`,
      createdAt: d.created_at,
    })),
  ];

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items.slice(0, limit);
}
