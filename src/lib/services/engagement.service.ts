import "server-only";

import { db } from "@/lib/db/kysely";
import {
  AuthorizationError,
  getViewer,
  requireUser,
} from "@/lib/auth/authz";
import {
  listBuildCardsByIds,
  type BuildCard,
} from "@/lib/services/builds.service";

/**
 * Community engagement (Phase 3): likes, favorites (saved builds), and comments.
 *
 * Security model (Path B — no RLS, authz enforced here):
 *  - Reads (counts, comment lists) are public.
 *  - Every mutation calls requireUser() (throws for guests).
 *  - Likes / favorites / new comments are only allowed on APPROVED, non-deleted
 *    builds — enforced server-side via assertEngageable(), never trusting the client.
 *  - A comment may be deleted only by its author or a moderator/admin.
 *  - Comments are soft-deleted; all public reads filter deleted_at is null.
 */

// ---------- internal helpers ----------

/** The build id if it is publicly engageable (approved + not deleted), else null. */
async function getEngageableBuildId(buildId: string): Promise<string | null> {
  const row = await db
    .selectFrom("builds")
    .select("id")
    .where("id", "=", buildId)
    .where("status", "=", "approved")
    .where("deleted_at", "is", null)
    .executeTakeFirst();
  return row?.id ?? null;
}

async function assertEngageable(buildId: string): Promise<void> {
  if (!(await getEngageableBuildId(buildId))) {
    throw new AuthorizationError("This build isn't available for engagement.");
  }
}

// =====================================================================
// Likes
// =====================================================================

export async function countLikes(buildId: string): Promise<number> {
  const row = await db
    .selectFrom("build_likes")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("build_id", "=", buildId)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function hasLiked(
  buildId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const row = await db
    .selectFrom("build_likes")
    .select("user_id")
    .where("build_id", "=", buildId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Boolean(row);
}

/** Batched like counts for a list of builds (defaults missing ids to 0). */
export async function likeCountsByBuildIds(
  buildIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (buildIds.length === 0) return map;
  const rows = await db
    .selectFrom("build_likes")
    .select("build_id")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("build_id", "in", buildIds)
    .groupBy("build_id")
    .execute();
  for (const r of rows as Array<{ build_id: string; count: string }>) {
    map.set(r.build_id, Number(r.count));
  }
  for (const id of buildIds) if (!map.has(id)) map.set(id, 0);
  return map;
}

/** Batched "did this user like it" for a list of builds. */
export async function likedStateByBuildIds(
  buildIds: string[],
  userId: string | null,
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for (const id of buildIds) map.set(id, false);
  if (!userId || buildIds.length === 0) return map;
  const rows = await db
    .selectFrom("build_likes")
    .select("build_id")
    .where("user_id", "=", userId)
    .where("build_id", "in", buildIds)
    .execute();
  for (const r of rows) map.set(r.build_id, true);
  return map;
}

/** Toggle the current user's like on an approved build. Idempotent. */
export async function toggleLike(
  buildId: string,
): Promise<{ liked: boolean; count: number }> {
  const viewer = await requireUser();
  const userId = viewer.userId as string;
  await assertEngageable(buildId);

  const existing = await db
    .selectFrom("build_likes")
    .select("user_id")
    .where("build_id", "=", buildId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom("build_likes")
      .where("build_id", "=", buildId)
      .where("user_id", "=", userId)
      .execute();
  } else {
    await db
      .insertInto("build_likes")
      .values({ build_id: buildId, user_id: userId })
      .onConflict((oc) => oc.columns(["build_id", "user_id"]).doNothing())
      .execute();
  }

  return { liked: !existing, count: await countLikes(buildId) };
}

// =====================================================================
// Favorites (saved builds)
// =====================================================================

export async function hasFavorited(
  buildId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const row = await db
    .selectFrom("build_favorites")
    .select("user_id")
    .where("build_id", "=", buildId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Boolean(row);
}

/** Batched "did this user save it" for a list of builds. */
export async function favoriteStateByBuildIds(
  buildIds: string[],
  userId: string | null,
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  for (const id of buildIds) map.set(id, false);
  if (!userId || buildIds.length === 0) return map;
  const rows = await db
    .selectFrom("build_favorites")
    .select("build_id")
    .where("user_id", "=", userId)
    .where("build_id", "in", buildIds)
    .execute();
  for (const r of rows) map.set(r.build_id, true);
  return map;
}

/** Toggle the current user's saved/favorite state on an approved build. */
export async function toggleFavorite(
  buildId: string,
): Promise<{ saved: boolean }> {
  const viewer = await requireUser();
  const userId = viewer.userId as string;
  await assertEngageable(buildId);

  const existing = await db
    .selectFrom("build_favorites")
    .select("user_id")
    .where("build_id", "=", buildId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (existing) {
    await db
      .deleteFrom("build_favorites")
      .where("build_id", "=", buildId)
      .where("user_id", "=", userId)
      .execute();
    return { saved: false };
  }

  await db
    .insertInto("build_favorites")
    .values({ build_id: buildId, user_id: userId })
    .onConflict((oc) => oc.columns(["build_id", "user_id"]).doNothing())
    .execute();
  return { saved: true };
}

/** The given user's saved builds (most-recently-saved first, approved only). */
export async function listSavedBuilds(userId: string): Promise<BuildCard[]> {
  const rows = await db
    .selectFrom("build_favorites")
    .select("build_id")
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();
  return listBuildCardsByIds(rows.map((r) => r.build_id));
}

// =====================================================================
// Comments
// =====================================================================

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  /** Whether the current viewer may delete this comment (author or staff). */
  canDelete: boolean;
};

/** Public comments for a build (excludes soft-deleted), oldest first. */
export async function listComments(buildId: string): Promise<CommentView[]> {
  const viewer = await getViewer();
  const rows = await db
    .selectFrom("build_comments")
    .innerJoin("profiles", "profiles.id", "build_comments.author_id")
    .select([
      "build_comments.id as id",
      "build_comments.body as body",
      "build_comments.created_at as created_at",
      "build_comments.author_id as author_id",
      "profiles.username as username",
      "profiles.display_name as display_name",
    ])
    .where("build_comments.build_id", "=", buildId)
    .where("build_comments.deleted_at", "is", null)
    .orderBy("build_comments.created_at", "asc")
    .execute();

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    authorId: r.author_id,
    authorUsername: r.username ?? null,
    authorDisplayName: r.display_name ?? null,
    canDelete:
      Boolean(viewer.userId) &&
      (viewer.userId === r.author_id || viewer.isStaff),
  }));
}

export async function countComments(buildId: string): Promise<number> {
  const row = await db
    .selectFrom("build_comments")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("build_id", "=", buildId)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/** Batched comment counts (excludes soft-deleted; defaults missing ids to 0). */
export async function commentCountsByBuildIds(
  buildIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (buildIds.length === 0) return map;
  const rows = await db
    .selectFrom("build_comments")
    .select("build_id")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("build_id", "in", buildIds)
    .where("deleted_at", "is", null)
    .groupBy("build_id")
    .execute();
  for (const r of rows as Array<{ build_id: string; count: string }>) {
    map.set(r.build_id, Number(r.count));
  }
  for (const id of buildIds) if (!map.has(id)) map.set(id, 0);
  return map;
}

export type EngagementCounts = { likes: number; comments: number };

/**
 * Batched like + comment counts for a list of builds — exactly two queries
 * regardless of list size (no N+1). Likes count all rows (likes only exist on
 * approved builds); comments exclude soft-deleted.
 */
export async function engagementCountsByBuildIds(
  buildIds: string[],
): Promise<Map<string, EngagementCounts>> {
  const map = new Map<string, EngagementCounts>();
  if (buildIds.length === 0) return map;
  const [likes, comments] = await Promise.all([
    likeCountsByBuildIds(buildIds),
    commentCountsByBuildIds(buildIds),
  ]);
  for (const id of buildIds) {
    map.set(id, {
      likes: likes.get(id) ?? 0,
      comments: comments.get(id) ?? 0,
    });
  }
  return map;
}

/** Create a comment on an approved build (logged-in users only). */
export async function createComment(
  buildId: string,
  body: string,
): Promise<CommentView> {
  const viewer = await requireUser();
  const userId = viewer.userId as string;
  await assertEngageable(buildId);

  const text = body.trim();
  if (text.length < 1 || text.length > 2000) {
    throw new Error("Comment must be between 1 and 2000 characters.");
  }

  const inserted = await db
    .insertInto("build_comments")
    .values({ build_id: buildId, author_id: userId, body: text })
    .returning(["id", "created_at"])
    .executeTakeFirstOrThrow();

  const author = await db
    .selectFrom("profiles")
    .select(["username", "display_name"])
    .where("id", "=", userId)
    .executeTakeFirst();

  return {
    id: inserted.id,
    body: text,
    createdAt: inserted.created_at,
    authorId: userId,
    authorUsername: author?.username ?? null,
    authorDisplayName: author?.display_name ?? null,
    canDelete: true,
  };
}

/**
 * Soft-delete a comment. Allowed only for the comment's author or a
 * moderator/admin. Idempotent if the comment is already deleted/missing.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const viewer = await requireUser();

  const comment = await db
    .selectFrom("build_comments")
    .select(["id", "author_id", "deleted_at"])
    .where("id", "=", commentId)
    .executeTakeFirst();

  if (!comment || comment.deleted_at) return; // already gone — idempotent

  const isAuthor = comment.author_id === viewer.userId;
  if (!isAuthor && !viewer.isStaff) {
    throw new AuthorizationError("You can't delete this comment.");
  }

  await db
    .updateTable("build_comments")
    .set({
      deleted_at: new Date().toISOString(),
      deleted_by: viewer.userId as string,
    })
    .where("id", "=", commentId)
    .execute();
}
