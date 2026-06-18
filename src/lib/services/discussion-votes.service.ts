import "server-only";

import { db } from "@/lib/db/kysely";
import { getCurrentProfile } from "@/lib/services/profile.service";

/**
 * Up/down votes for threads and replies. One row per user per target; voting
 * the same value again clears it (toggle); voting the opposite flips it.
 */

export type VoteValue = 1 | -1;
export type UserVoteValue = VoteValue | 0;

export type VoteResult =
  | { ok: true; score: number; userValue: UserVoteValue }
  | { ok: false; error: string };

function normalizeValue(value: number): VoteValue | null {
  if (value === 1) return 1;
  if (value === -1) return -1;
  return null;
}

async function score(
  table: "discussion_thread_votes" | "discussion_reply_votes",
  column: "thread_id" | "reply_id",
  targetId: string,
): Promise<number> {
  const row = await db
    .selectFrom(table)
    .select((eb) => eb.fn.sum<number>("value").as("score"))
    .where(column, "=", targetId)
    .executeTakeFirst();
  return Number(row?.score ?? 0);
}

async function castVote(
  table: "discussion_thread_votes" | "discussion_reply_votes",
  column: "thread_id" | "reply_id",
  targetId: string,
  value: number,
): Promise<VoteResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to vote." };

  const v = normalizeValue(value);
  if (v === null) return { ok: false, error: "Vote must be +1 or -1." };

  try {
    const existing = await db
      .selectFrom(table)
      .select("value")
      .where(column, "=", targetId)
      .where("user_id", "=", profile.id)
      .executeTakeFirst();

    let userValue: UserVoteValue = v;
    if (existing && existing.value === v) {
      // Same vote again → clear it (toggle off).
      await db
        .deleteFrom(table)
        .where(column, "=", targetId)
        .where("user_id", "=", profile.id)
        .execute();
      userValue = 0;
    } else {
      // New vote or flip → upsert.
      await db
        .insertInto(table)
        .values({ [column]: targetId, user_id: profile.id, value: v })
        .onConflict((oc) =>
          oc.columns([column, "user_id"]).doUpdateSet({ value: v }),
        )
        .execute();
    }
    return { ok: true, score: await score(table, column, targetId), userValue };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Vote failed." };
  }
}

async function clearVote(
  table: "discussion_thread_votes" | "discussion_reply_votes",
  column: "thread_id" | "reply_id",
  targetId: string,
): Promise<VoteResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in to vote." };
  try {
    await db
      .deleteFrom(table)
      .where(column, "=", targetId)
      .where("user_id", "=", profile.id)
      .execute();
    return {
      ok: true,
      score: await score(table, column, targetId),
      userValue: 0,
    };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "Vote failed." };
  }
}

export function voteThread(threadId: string, value: number): Promise<VoteResult> {
  return castVote("discussion_thread_votes", "thread_id", threadId, value);
}

export function voteReply(replyId: string, value: number): Promise<VoteResult> {
  return castVote("discussion_reply_votes", "reply_id", replyId, value);
}

export function clearThreadVote(threadId: string): Promise<VoteResult> {
  return clearVote("discussion_thread_votes", "thread_id", threadId);
}

export function clearReplyVote(replyId: string): Promise<VoteResult> {
  return clearVote("discussion_reply_votes", "reply_id", replyId);
}

export function getThreadScore(threadId: string): Promise<number> {
  return score("discussion_thread_votes", "thread_id", threadId);
}

export function getReplyScore(replyId: string): Promise<number> {
  return score("discussion_reply_votes", "reply_id", replyId);
}

/** A user's current vote values for a set of threads (for UI highlight). */
export async function threadVotesByUser(
  threadIds: string[],
): Promise<Record<string, number>> {
  const profile = await getCurrentProfile();
  if (!profile || threadIds.length === 0) return {};
  const rows = await db
    .selectFrom("discussion_thread_votes")
    .select(["thread_id", "value"])
    .where("thread_id", "in", threadIds)
    .where("user_id", "=", profile.id)
    .execute();
  const map: Record<string, number> = {};
  for (const r of rows) map[r.thread_id] = r.value;
  return map;
}

/** A user's current vote values for a set of replies (for UI highlight). */
export async function replyVotesByUser(
  replyIds: string[],
): Promise<Record<string, number>> {
  const profile = await getCurrentProfile();
  if (!profile || replyIds.length === 0) return {};
  const rows = await db
    .selectFrom("discussion_reply_votes")
    .select(["reply_id", "value"])
    .where("reply_id", "in", replyIds)
    .where("user_id", "=", profile.id)
    .execute();
  const map: Record<string, number> = {};
  for (const r of rows) map[r.reply_id] = r.value;
  return map;
}

/** Scores for a set of threads in one query: thread_id -> score. */
export async function threadScores(
  threadIds: string[],
): Promise<Record<string, number>> {
  if (threadIds.length === 0) return {};
  const rows = await db
    .selectFrom("discussion_thread_votes")
    .select((eb) => ["thread_id", eb.fn.sum<number>("value").as("score")])
    .where("thread_id", "in", threadIds)
    .groupBy("thread_id")
    .execute();
  const map: Record<string, number> = {};
  for (const r of rows) map[r.thread_id] = Number(r.score ?? 0);
  return map;
}

/** Scores for a set of replies in one query: reply_id -> score. */
export async function replyScores(
  replyIds: string[],
): Promise<Record<string, number>> {
  if (replyIds.length === 0) return {};
  const rows = await db
    .selectFrom("discussion_reply_votes")
    .select((eb) => ["reply_id", eb.fn.sum<number>("value").as("score")])
    .where("reply_id", "in", replyIds)
    .groupBy("reply_id")
    .execute();
  const map: Record<string, number> = {};
  for (const r of rows) map[r.reply_id] = Number(r.score ?? 0);
  return map;
}
