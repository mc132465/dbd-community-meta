import "server-only";

import { db } from "@/lib/db/kysely";
import { listBuildCardsByIds, type BuildCard } from "@/lib/services/builds.service";

/**
 * Popular & trending builds, computed entirely from existing engagement tables
 * (build_likes / build_favorites / build_comments). No schema, no writes. A
 * build's score is its total engagement; trending uses a recent time window.
 */

type CountMap = Map<string, number>;

function add(into: CountMap, from: CountMap, weight: number) {
  for (const [id, n] of from) into.set(id, (into.get(id) ?? 0) + n * weight);
}

async function likeCounts(since?: string): Promise<CountMap> {
  let q = db
    .selectFrom("build_likes")
    .select("build_id")
    .select((eb) => eb.fn.countAll<string>().as("c"))
    .groupBy("build_id");
  if (since) q = q.where("created_at", ">=", since);
  const rows = await q.execute();
  return new Map(rows.map((r) => [r.build_id as string, Number(r.c)]));
}

async function favoriteCounts(since?: string): Promise<CountMap> {
  let q = db
    .selectFrom("build_favorites")
    .select("build_id")
    .select((eb) => eb.fn.countAll<string>().as("c"))
    .groupBy("build_id");
  if (since) q = q.where("created_at", ">=", since);
  const rows = await q.execute();
  return new Map(rows.map((r) => [r.build_id as string, Number(r.c)]));
}

async function commentCounts(since?: string): Promise<CountMap> {
  let q = db
    .selectFrom("build_comments")
    .select("build_id")
    .select((eb) => eb.fn.countAll<string>().as("c"))
    .where("deleted_at", "is", null)
    .groupBy("build_id");
  if (since) q = q.where("created_at", ">=", since);
  const rows = await q.execute();
  return new Map(rows.map((r) => [r.build_id as string, Number(r.c)]));
}

/** Approved, non-deleted build ids with their created_at (for tiebreaks). */
async function approvedBuilds(): Promise<{ id: string; created_at: string }[]> {
  return db
    .selectFrom("builds")
    .select(["id", "created_at"])
    .where("status", "=", "approved")
    .where("deleted_at", "is", null)
    .execute();
}

function rankIds(
  builds: { id: string; created_at: string }[],
  score: CountMap,
  limit: number,
): string[] {
  return builds
    .filter((b) => (score.get(b.id) ?? 0) > 0)
    .sort((a, b) => {
      const diff = (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, limit)
    .map((b) => b.id);
}

/** All-time most-engaged approved builds. */
export async function listPopularBuilds(limit = 8): Promise<BuildCard[]> {
  const [builds, likes, favorites, comments] = await Promise.all([
    approvedBuilds(),
    likeCounts(),
    favoriteCounts(),
    commentCounts(),
  ]);
  const score: CountMap = new Map();
  add(score, likes, 1);
  add(score, favorites, 1);
  add(score, comments, 1);
  const ids = rankIds(builds, score, limit);
  return listBuildCardsByIds(ids);
}

/** Builds with the most engagement in the recent window (default 7 days). */
export async function listTrendingBuilds(
  limit = 8,
  days = 7,
): Promise<BuildCard[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [builds, likes, favorites, comments] = await Promise.all([
    approvedBuilds(),
    likeCounts(since),
    favoriteCounts(since),
    commentCounts(since),
  ]);
  const score: CountMap = new Map();
  add(score, likes, 2); // recent likes/saves weigh a bit more than comments
  add(score, favorites, 2);
  add(score, comments, 1);
  const ids = rankIds(builds, score, limit);
  return listBuildCardsByIds(ids);
}
