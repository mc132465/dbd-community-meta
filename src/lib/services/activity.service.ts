import "server-only";

import { db } from "@/lib/db/kysely";

export type ActivityType = "build" | "tier_list" | "discussion";

export type ActivityItem = {
  type: ActivityType;
  title: string;
  href: string;
  at: string;
};

/**
 * A unified, read-only feed of recent public activity: newly approved builds,
 * newly published tier lists, and new discussion threads. No schema — merges
 * existing tables by timestamp. Each source is capped, merged, and re-sorted.
 */
export async function recentActivity(limit = 30): Promise<ActivityItem[]> {
  const [builds, tiers, threads] = await Promise.all([
    db
      .selectFrom("builds")
      .select(["title", "slug", "created_at"])
      .where("status", "=", "approved")
      .where("deleted_at", "is", null)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute(),
    db
      .selectFrom("tier_lists")
      .select(["title", "slug", "published_at"])
      .where("status", "=", "published")
      .orderBy("published_at", "desc")
      .limit(limit)
      .execute(),
    db
      .selectFrom("discussion_threads")
      .select(["title", "slug", "created_at"])
      .where("deleted_at", "is", null)
      .orderBy("created_at", "desc")
      .limit(limit)
      .execute(),
  ]);

  const items: ActivityItem[] = [];
  for (const b of builds) {
    items.push({
      type: "build",
      title: b.title ?? "Untitled build",
      href: `/builds/${b.slug}`,
      at: b.created_at,
    });
  }
  for (const t of tiers) {
    items.push({
      type: "tier_list",
      title: t.title,
      href: `/tier-lists/${t.slug}`,
      at: t.published_at ?? "",
    });
  }
  for (const d of threads) {
    items.push({
      type: "discussion",
      title: d.title,
      href: `/discussions/${d.slug}`,
      at: d.created_at,
    });
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
