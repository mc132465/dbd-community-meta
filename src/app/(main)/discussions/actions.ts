"use server";

import { revalidatePath } from "next/cache";

import {
  createReply,
  createThread,
  deleteOwnReply,
  deleteOwnThread,
  type CreateThreadResult,
  type DiscussionResult,
} from "@/lib/services/discussions.service";
import {
  voteThread,
  voteReply,
  clearThreadVote,
  clearReplyVote,
  type VoteResult,
} from "@/lib/services/discussion-votes.service";
import {
  deleteThreadAsModerator,
  restoreDeletedThread,
  deleteReplyAsModerator,
  restoreDeletedReply,
  lockThread,
  unlockThread,
  type ModResult,
} from "@/lib/services/discussion-moderation.service";

/**
 * Discussion actions. The authenticated user is resolved inside the services
 * (via getCurrentProfile); the client never passes a user id.
 */

export async function createThreadAction(
  input: unknown,
): Promise<CreateThreadResult> {
  const r = await createThread(input);
  if (r.ok) {
    revalidatePath("/discussions");
    revalidatePath(`/discussions/${r.slug}`);
  }
  return r;
}

export async function createReplyAction(
  threadId: string,
  threadSlug: string,
  body: unknown,
): Promise<DiscussionResult> {
  const r = await createReply(threadId, body);
  if (r.ok) {
    revalidatePath(`/discussions/${threadSlug}`);
    revalidatePath("/discussions");
  }
  return r;
}

export async function deleteOwnThreadAction(
  threadId: string,
): Promise<DiscussionResult> {
  const r = await deleteOwnThread(threadId);
  if (r.ok) revalidatePath("/discussions");
  return r;
}

export async function deleteOwnReplyAction(
  replyId: string,
  threadSlug: string,
): Promise<DiscussionResult> {
  const r = await deleteOwnReply(replyId);
  if (r.ok) revalidatePath(`/discussions/${threadSlug}`);
  return r;
}

// ---------- voting (auth enforced inside the service) ----------

/** Cast (or toggle) a thread vote. value must be 1 or -1. */
export async function voteThreadAction(
  threadId: string,
  value: number,
): Promise<VoteResult> {
  return voteThread(threadId, value);
}

/** Remove the current user's thread vote. */
export async function clearThreadVoteAction(
  threadId: string,
): Promise<VoteResult> {
  return clearThreadVote(threadId);
}

/** Cast (or toggle) a reply vote. value must be 1 or -1. */
export async function voteReplyAction(
  replyId: string,
  value: number,
): Promise<VoteResult> {
  return voteReply(replyId, value);
}

/** Remove the current user's reply vote. */
export async function clearReplyVoteAction(
  replyId: string,
): Promise<VoteResult> {
  return clearReplyVote(replyId);
}

// ---------- moderation (staff-only; enforced inside the service) ----------

function revalidateThread(slug: string) {
  revalidatePath("/discussions");
  revalidatePath(`/discussions/${slug}`);
}

/** Hide a thread from public view (soft delete). */
export async function hideThreadAction(
  threadId: string,
  slug: string,
): Promise<ModResult> {
  const r = await deleteThreadAsModerator(threadId);
  if (r.ok) revalidateThread(slug);
  return r;
}

/** Restore a previously hidden thread. */
export async function restoreThreadAction(
  threadId: string,
  slug: string,
): Promise<ModResult> {
  const r = await restoreDeletedThread(threadId);
  if (r.ok) revalidateThread(slug);
  return r;
}

/** Lock a thread (no new replies). */
export async function lockThreadAction(
  threadId: string,
  slug: string,
): Promise<ModResult> {
  const r = await lockThread(threadId);
  if (r.ok) revalidateThread(slug);
  return r;
}

/** Unlock a thread. */
export async function unlockThreadAction(
  threadId: string,
  slug: string,
): Promise<ModResult> {
  const r = await unlockThread(threadId);
  if (r.ok) revalidateThread(slug);
  return r;
}

/** Hide a reply from public view (soft delete). */
export async function hideReplyAction(
  replyId: string,
  slug: string,
): Promise<ModResult> {
  const r = await deleteReplyAsModerator(replyId);
  if (r.ok) revalidateThread(slug);
  return r;
}

/** Restore a previously hidden reply. */
export async function restoreReplyAction(
  replyId: string,
  slug: string,
): Promise<ModResult> {
  const r = await restoreDeletedReply(replyId);
  if (r.ok) revalidateThread(slug);
  return r;
}
