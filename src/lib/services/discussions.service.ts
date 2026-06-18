import "server-only";

import { sql } from "kysely";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { slugify } from "@/lib/builds/constants";
import {
  createThreadSchema,
  replyBodySchema,
  updateThreadSchema,
} from "@/lib/validations/discussion";
import type {
  DiscussionCategoryRow,
  DiscussionThreadRow,
} from "@/types/database";

/**
 * Community discussions. Threads + flat replies, separate from build comments.
 * Logged-in users create threads/replies; authors edit/delete their own;
 * moderation lives in discussion-moderation.service.ts.
 */

export type DiscussionResult = { ok: true } | { ok: false; error: string };
export type CreateThreadResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type ThreadSort = "newest" | "active" | "unanswered";

export type ThreadListItem = {
  id: string;
  slug: string;
  title: string;
  status: DiscussionThreadRow["status"];
  authorId: string;
  authorName: string;
  categoryName: string | null;
  categorySlug: string | null;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
};

function mapError(err: unknown): string {
  if ((err as { code?: string })?.code === "23505") {
    return "That already exists.";
  }
  return (err as Error)?.message ?? "Something went wrong.";
}

function emptyToNull(v: string | null | undefined): string | null {
  return v ? v : null;
}

// ---------- categories ----------

export async function listDiscussionCategories(): Promise<
  DiscussionCategoryRow[]
> {
  return db
    .selectFrom("discussion_categories")
    .selectAll()
    .orderBy("sort_order")
    .execute() as Promise<DiscussionCategoryRow[]>;
}

export async function listActiveDiscussionCategories(): Promise<
  DiscussionCategoryRow[]
> {
  return db
    .selectFrom("discussion_categories")
    .selectAll()
    .where("is_active", "=", true)
    .orderBy("sort_order")
    .execute() as Promise<DiscussionCategoryRow[]>;
}

export async function getDiscussionCategoryBySlug(
  slug: string,
): Promise<DiscussionCategoryRow | null> {
  const row = await db
    .selectFrom("discussion_categories")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  return (row as DiscussionCategoryRow) ?? null;
}

// ---------- slug generation ----------

async function uniqueThreadSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 80) || "thread";
  // Probe a handful of candidates; fall back to a random suffix.
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db
      .selectFrom("discussion_threads")
      .select("id")
      .where("slug", "=", candidate)
      .executeTakeFirst();
    if (!existing) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- threads ----------

export async function createThread(
  input: unknown,
): Promise<CreateThreadResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to start a thread." };

  const parsed = createThreadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid thread.",
    };
  }
  const d = parsed.data;

  // Category must exist and be active.
  const category = await db
    .selectFrom("discussion_categories")
    .select(["id", "is_active"])
    .where("id", "=", d.category_id)
    .executeTakeFirst();
  if (!category || !category.is_active) {
    return { ok: false, error: "Choose a valid category." };
  }

  const slug = await uniqueThreadSlug(d.title);

  try {
    await db.transaction().execute(async (trx) => {
      const thread = await trx
        .insertInto("discussion_threads")
        .values({
          slug,
          category_id: d.category_id,
          author_id: profile.id,
          title: d.title,
          body: d.body,
          perk_id: emptyToNull(d.perk_id),
          character_id: emptyToNull(d.character_id),
          build_id: emptyToNull(d.build_id),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const tagIds = [...new Set(d.tag_ids ?? [])];
      if (tagIds.length > 0) {
        await trx
          .insertInto("discussion_thread_tags")
          .values(tagIds.map((tag_id) => ({ thread_id: thread.id, tag_id })))
          .onConflict((oc) => oc.columns(["thread_id", "tag_id"]).doNothing())
          .execute();
      }
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true, slug };
}

export async function updateThread(
  threadId: string,
  input: unknown,
): Promise<DiscussionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to edit." };

  const parsed = updateThreadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid thread.",
    };
  }
  const d = parsed.data;

  const thread = await db
    .selectFrom("discussion_threads")
    .select(["author_id", "status", "deleted_at"])
    .where("id", "=", threadId)
    .executeTakeFirst();
  if (!thread || thread.deleted_at) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.author_id !== profile.id) {
    return { ok: false, error: "You can only edit your own thread." };
  }
  if (thread.status !== "open") {
    return { ok: false, error: "This thread is locked or archived." };
  }

  try {
    await db
      .updateTable("discussion_threads")
      .set({
        title: d.title,
        body: d.body,
        category_id: d.category_id,
        perk_id: emptyToNull(d.perk_id),
        character_id: emptyToNull(d.character_id),
        build_id: emptyToNull(d.build_id),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", threadId)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function deleteOwnThread(
  threadId: string,
): Promise<DiscussionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to delete." };

  const thread = await db
    .selectFrom("discussion_threads")
    .select(["author_id", "deleted_at"])
    .where("id", "=", threadId)
    .executeTakeFirst();
  if (!thread || thread.deleted_at) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.author_id !== profile.id) {
    return { ok: false, error: "You can only delete your own thread." };
  }

  try {
    await db
      .updateTable("discussion_threads")
      .set({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
      .where("id", "=", threadId)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export type ThreadDetail = {
  thread: DiscussionThreadRow;
  authorName: string;
  categoryName: string | null;
  categorySlug: string | null;
};

export async function getThreadBySlug(
  slug: string,
  opts?: { includeHidden?: boolean },
): Promise<ThreadDetail | null> {
  let q = db
    .selectFrom("discussion_threads")
    .leftJoin("profiles", "profiles.id", "discussion_threads.author_id")
    .leftJoin(
      "discussion_categories",
      "discussion_categories.id",
      "discussion_threads.category_id",
    )
    .select((eb) => [
      "discussion_threads.id as id",
      "discussion_threads.slug as slug",
      "discussion_threads.category_id as category_id",
      "discussion_threads.author_id as author_id",
      "discussion_threads.title as title",
      "discussion_threads.body as body",
      "discussion_threads.status as status",
      "discussion_threads.perk_id as perk_id",
      "discussion_threads.character_id as character_id",
      "discussion_threads.build_id as build_id",
      "discussion_threads.reply_count as reply_count",
      "discussion_threads.last_activity_at as last_activity_at",
      "discussion_threads.deleted_at as deleted_at",
      "discussion_threads.deleted_by as deleted_by",
      "discussion_threads.created_at as created_at",
      "discussion_threads.updated_at as updated_at",
      eb.ref("profiles.username").as("author_name"),
      eb.ref("discussion_categories.name").as("category_name"),
      eb.ref("discussion_categories.slug").as("category_slug"),
    ])
    .where("discussion_threads.slug", "=", slug);

  // Public callers never see hidden (soft-deleted) threads; staff may, in order
  // to review and restore them.
  if (!opts?.includeHidden) {
    q = q.where("discussion_threads.deleted_at", "is", null);
  }

  const row = await q.executeTakeFirst();

  if (!row) return null;
  const { author_name, category_name, category_slug, ...thread } = row as Record<
    string,
    unknown
  >;
  return {
    thread: thread as unknown as DiscussionThreadRow,
    authorName: (author_name as string) ?? "unknown",
    categoryName: (category_name as string) ?? null,
    categorySlug: (category_slug as string) ?? null,
  };
}

export type ListThreadsOptions = {
  sort?: ThreadSort;
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listThreads(
  options: ListThreadsOptions = {},
): Promise<{ items: ThreadListItem[]; page: number; pageSize: number }> {
  const sort = options.sort ?? "newest";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

  let q = db
    .selectFrom("discussion_threads")
    .leftJoin("profiles", "profiles.id", "discussion_threads.author_id")
    .leftJoin(
      "discussion_categories",
      "discussion_categories.id",
      "discussion_threads.category_id",
    )
    .select((eb) => [
      "discussion_threads.id as id",
      "discussion_threads.slug as slug",
      "discussion_threads.title as title",
      "discussion_threads.status as status",
      "discussion_threads.author_id as author_id",
      "discussion_threads.reply_count as reply_count",
      "discussion_threads.last_activity_at as last_activity_at",
      "discussion_threads.created_at as created_at",
      eb.ref("profiles.username").as("author_name"),
      eb.ref("discussion_categories.name").as("category_name"),
      eb.ref("discussion_categories.slug").as("category_slug"),
    ])
    .where("discussion_threads.deleted_at", "is", null);

  if (options.categorySlug) {
    q = q.where("discussion_categories.slug", "=", options.categorySlug);
  }
  if (options.search && options.search.trim().length >= 2) {
    const term = `%${options.search.trim().replace(/[%_]/g, "")}%`;
    q = q.where((eb) =>
      eb.or([
        eb("discussion_threads.title", "ilike", term),
        eb("discussion_threads.body", "ilike", term),
      ]),
    );
  }
  if (sort === "unanswered") {
    q = q.where("discussion_threads.reply_count", "=", 0);
  }

  q =
    sort === "active"
      ? q.orderBy("discussion_threads.last_activity_at", "desc")
      : q.orderBy("discussion_threads.created_at", "desc");

  const rows = await q
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  const items: ThreadListItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    authorId: r.author_id,
    authorName: (r.author_name as string) ?? "unknown",
    categoryName: (r.category_name as string) ?? null,
    categorySlug: (r.category_slug as string) ?? null,
    replyCount: r.reply_count,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
  }));
  return { items, page, pageSize };
}

// ---------- replies ----------

export type ReplyListItem = {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** True only for soft-deleted replies surfaced to staff for restoring. */
  hidden: boolean;
};

export async function listReplies(
  threadId: string,
  page = 1,
  pageSize = 20,
  opts?: { includeHidden?: boolean },
): Promise<{ items: ReplyListItem[]; page: number; pageSize: number }> {
  const p = Math.max(1, page);
  const size = Math.min(100, Math.max(1, pageSize));
  let q = db
    .selectFrom("discussion_replies")
    .leftJoin("profiles", "profiles.id", "discussion_replies.author_id")
    .select((eb) => [
      "discussion_replies.id as id",
      "discussion_replies.thread_id as thread_id",
      "discussion_replies.author_id as author_id",
      "discussion_replies.body as body",
      "discussion_replies.created_at as created_at",
      "discussion_replies.updated_at as updated_at",
      "discussion_replies.deleted_at as deleted_at",
      eb.ref("profiles.username").as("author_name"),
    ])
    .where("discussion_replies.thread_id", "=", threadId);

  // Public callers never see hidden (soft-deleted) replies; staff may, in order
  // to review and restore them.
  if (!opts?.includeHidden) {
    q = q.where("discussion_replies.deleted_at", "is", null);
  }

  const rows = await q
    .orderBy("discussion_replies.created_at", "asc")
    .limit(size)
    .offset((p - 1) * size)
    .execute();

  const items: ReplyListItem[] = rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    authorId: r.author_id,
    authorName: (r.author_name as string) ?? "unknown",
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hidden: Boolean(r.deleted_at),
  }));
  return { items, page: p, pageSize: size };
}

export async function createReply(
  threadId: string,
  body: unknown,
): Promise<DiscussionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to reply." };

  const parsed = replyBodySchema.safeParse({ body });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reply.",
    };
  }

  const thread = await db
    .selectFrom("discussion_threads")
    .select(["id", "status", "deleted_at"])
    .where("id", "=", threadId)
    .executeTakeFirst();
  if (!thread || thread.deleted_at) {
    return { ok: false, error: "Thread not found." };
  }
  if (thread.status !== "open") {
    return { ok: false, error: "This thread is locked or archived." };
  }

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("discussion_replies")
        .values({
          thread_id: threadId,
          author_id: profile.id,
          body: parsed.data.body,
        })
        .execute();
      await trx
        .updateTable("discussion_threads")
        .set({
          reply_count: sql`reply_count + 1`,
          last_activity_at: new Date().toISOString(),
        })
        .where("id", "=", threadId)
        .execute();
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function updateReply(
  replyId: string,
  body: unknown,
): Promise<DiscussionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to edit." };

  const parsed = replyBodySchema.safeParse({ body });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reply.",
    };
  }

  const reply = await db
    .selectFrom("discussion_replies")
    .select(["author_id", "deleted_at"])
    .where("id", "=", replyId)
    .executeTakeFirst();
  if (!reply || reply.deleted_at) {
    return { ok: false, error: "Reply not found." };
  }
  if (reply.author_id !== profile.id) {
    return { ok: false, error: "You can only edit your own reply." };
  }

  try {
    await db
      .updateTable("discussion_replies")
      .set({ body: parsed.data.body, updated_at: new Date().toISOString() })
      .where("id", "=", replyId)
      .execute();
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export async function deleteOwnReply(
  replyId: string,
): Promise<DiscussionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to delete." };

  const reply = await db
    .selectFrom("discussion_replies")
    .select(["author_id", "thread_id", "deleted_at"])
    .where("id", "=", replyId)
    .executeTakeFirst();
  if (!reply || reply.deleted_at) {
    return { ok: false, error: "Reply not found." };
  }
  if (reply.author_id !== profile.id) {
    return { ok: false, error: "You can only delete your own reply." };
  }

  try {
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("discussion_replies")
        .set({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
        .where("id", "=", replyId)
        .execute();
      await trx
        .updateTable("discussion_threads")
        .set({ reply_count: sql`greatest(reply_count - 1, 0)` })
        .where("id", "=", reply.thread_id)
        .execute();
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  return { ok: true };
}

export type RelatedThread = {
  slug: string;
  title: string;
  replyCount: number;
  lastActivityAt: string;
};

/**
 * Threads related to a catalog entity via the thread's optional FK columns
 * (perk_id / character_id / build_id). Provide exactly one target. Excludes
 * hidden (soft-deleted) and archived threads. Returns [] when no target given.
 */
export async function listRelatedThreads(
  target: { perkId?: string; characterId?: string; buildId?: string },
  limit = 5,
): Promise<RelatedThread[]> {
  let q = db
    .selectFrom("discussion_threads")
    .select(["slug", "title", "reply_count", "last_activity_at"])
    .where("deleted_at", "is", null)
    .where("status", "!=", "archived");

  if (target.perkId) q = q.where("perk_id", "=", target.perkId);
  else if (target.characterId)
    q = q.where("character_id", "=", target.characterId);
  else if (target.buildId) q = q.where("build_id", "=", target.buildId);
  else return [];

  const rows = await q
    .orderBy("last_activity_at", "desc")
    .limit(Math.min(20, Math.max(1, limit)))
    .execute();

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    replyCount: r.reply_count,
    lastActivityAt: r.last_activity_at,
  }));
}
