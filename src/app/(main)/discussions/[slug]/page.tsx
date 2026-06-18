import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getThreadBySlug, listReplies } from "@/lib/services/discussions.service";
import {
  getThreadScore,
  threadVotesByUser,
  replyScores,
  replyVotesByUser,
} from "@/lib/services/discussion-votes.service";
import {
  getCharacterRefById,
  getPerkRefById,
} from "@/lib/services/assets.service";
import { getBuildSlugById } from "@/lib/services/builds.service";
import { getCurrentProfile } from "@/lib/services/profile.service";
import { isModerator } from "@/lib/auth/roles";
import { ReplyForm } from "@/components/discussions/reply-form";
import { VoteControls } from "@/components/discussions/vote-controls";
import {
  ThreadModeration,
  ReplyModeration,
} from "@/components/discussions/moderation-controls";
import {
  DeleteReplyButton,
  DeleteThreadButton,
} from "@/components/discussions/discussion-delete-buttons";

type SP = { page?: string };

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const detail = await getThreadBySlug(params.slug);
  return { title: detail ? detail.thread.title : "Discussion" };
}

export default async function ThreadDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SP;
}) {
  const profile = await getCurrentProfile();
  const isStaff = Boolean(profile && isModerator(profile.role));

  const detail = await getThreadBySlug(params.slug, { includeHidden: isStaff });
  if (!detail) notFound();

  const { thread, authorName, categoryName, categorySlug } = detail;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [score, replies] = await Promise.all([
    getThreadScore(thread.id),
    listReplies(thread.id, page, 20, { includeHidden: isStaff }),
  ]);

  // Resolve optional related references for display.
  const [relatedPerk, relatedCharacter, relatedBuildSlug] = await Promise.all([
    thread.perk_id ? getPerkRefById(thread.perk_id) : Promise.resolve(null),
    thread.character_id
      ? getCharacterRefById(thread.character_id)
      : Promise.resolve(null),
    thread.build_id ? getBuildSlugById(thread.build_id) : Promise.resolve(null),
  ]);

  const isAuthor = profile?.id === thread.author_id;
  const isLoggedIn = Boolean(profile);
  const isHidden = Boolean(thread.deleted_at);
  const canReply = Boolean(profile) && thread.status === "open";
  const hasMore = replies.items.length === replies.pageSize;

  // Vote state: thread (mine) + per-reply score and my vote.
  const replyIds = replies.items.map((r) => r.id);
  const [threadVotes, rScores, rVotes] = await Promise.all([
    threadVotesByUser([thread.id]),
    replyScores(replyIds),
    replyVotesByUser(replyIds),
  ]);
  const myThreadVote = threadVotes[thread.id] ?? 0;

  return (
    <div className="container max-w-3xl space-y-6 py-12">
      <Link
        href="/discussions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Discussions
      </Link>

      {isStaff ? (
        <ThreadModeration
          threadId={thread.id}
          slug={thread.slug}
          status={thread.status}
          isHidden={isHidden}
        />
      ) : null}

      {isHidden ? (
        <p className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          This thread is hidden from the public. Only staff can see it.
        </p>
      ) : null}

      {/* Thread */}
      <article className="flex gap-3">
        <VoteControls
          targetType="thread"
          targetId={thread.id}
          initialScore={score}
          initialMyVote={myThreadVote}
          isLoggedIn={isLoggedIn}
          loginNext={`/discussions/${thread.slug}`}
        />
        <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
            {thread.title}
          </h1>
          {thread.status !== "open" ? (
            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] uppercase text-amber-500">
              {thread.status}
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {categorySlug ? (
            <>
              <Link
                href={`/discussions?category=${categorySlug}`}
                className="hover:text-foreground"
              >
                {categoryName}
              </Link>
              {" · "}
            </>
          ) : null}
          by {authorName} · {new Date(thread.created_at).toLocaleDateString()} ·{" "}
          {thread.reply_count}{" "}
          {thread.reply_count === 1 ? "reply" : "replies"}
        </p>

        {/* Related references */}
        {relatedPerk || relatedCharacter || relatedBuildSlug ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {relatedPerk ? (
              <Link
                href={`/perks/${relatedPerk.slug}`}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                Perk: {relatedPerk.name}
              </Link>
            ) : null}
            {relatedCharacter ? (
              <Link
                href={`/characters/${relatedCharacter.slug}`}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                Character: {relatedCharacter.name}
              </Link>
            ) : null}
            {relatedBuildSlug ? (
              <Link
                href={`/builds/${relatedBuildSlug}`}
                className="rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                Related build
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="whitespace-pre-wrap rounded-lg border border-border/60 p-4 text-sm">
          {thread.body}
        </div>

        {isAuthor ? (
          <div className="flex justify-end">
            <DeleteThreadButton threadId={thread.id} />
          </div>
        ) : null}
        </div>
      </article>

      {/* Replies */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Replies ({thread.reply_count})
        </h2>

        {replies.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No replies yet.{thread.status === "open" ? " Be the first." : ""}
          </p>
        ) : (
          <ul className="space-y-3">
            {replies.items.map((r) => (
              <li
                key={r.id}
                className={`flex gap-3 rounded-lg border p-4 ${
                  r.hidden
                    ? "border-dashed border-amber-500/40 opacity-60"
                    : "border-border/60"
                }`}
              >
                <VoteControls
                  targetType="reply"
                  targetId={r.id}
                  initialScore={rScores[r.id] ?? 0}
                  initialMyVote={rVotes[r.id] ?? 0}
                  isLoggedIn={isLoggedIn}
                  loginNext={`/discussions/${thread.slug}`}
                />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {r.authorName} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                      {r.hidden ? (
                        <span className="ml-2 uppercase text-amber-500">
                          hidden
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      {isStaff ? (
                        <ReplyModeration
                          replyId={r.id}
                          slug={thread.slug}
                          isHidden={r.hidden}
                        />
                      ) : null}
                      {profile?.id === r.authorId && !r.hidden ? (
                        <DeleteReplyButton
                          replyId={r.id}
                          threadSlug={thread.slug}
                        />
                      ) : null}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{r.body}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {page > 1 || hasMore ? (
          <div className="flex justify-between text-sm">
            {page > 1 ? (
              <Link
                href={`/discussions/${thread.slug}?page=${page - 1}`}
                className="text-link hover:text-link-hover hover:underline"
              >
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            {hasMore ? (
              <Link
                href={`/discussions/${thread.slug}?page=${page + 1}`}
                className="text-link hover:text-link-hover hover:underline"
              >
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>

      {/* Reply box */}
      <section className="space-y-2">
        {canReply ? (
          <ReplyForm threadId={thread.id} threadSlug={thread.slug} />
        ) : thread.status !== "open" ? (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            Replies are closed on this {thread.status} thread.
          </p>
        ) : (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            <Link
              href={`/login?next=/discussions/${thread.slug}`}
              className="text-link hover:text-link-hover hover:underline"
            >
              Log in
            </Link>{" "}
            to reply.
          </p>
        )}
      </section>
    </div>
  );
}
