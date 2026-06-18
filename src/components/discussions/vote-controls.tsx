"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import {
  voteThreadAction,
  clearThreadVoteAction,
  voteReplyAction,
  clearReplyVoteAction,
} from "@/app/(main)/discussions/actions";
import type { VoteResult } from "@/lib/services/discussion-votes.service";

type Props = {
  targetType: "thread" | "reply";
  targetId: string;
  initialScore: number;
  /** 1, -1, or 0 (no vote). */
  initialMyVote: number;
  isLoggedIn: boolean;
  loginNext?: string;
};

/**
 * Reddit-style vote control. Guests see the score and a friendly prompt to
 * sign in; logged-in users can toggle +1 / -1. The server returns the
 * authoritative score + user value, which we reconcile after each click.
 */
export function VoteControls({
  targetType,
  targetId,
  initialScore,
  initialMyVote,
  isLoggedIn,
  loginNext,
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [pending, startTransition] = useTransition();

  function cast(direction: 1 | -1) {
    if (!isLoggedIn) {
      toast("Sign in to vote", {
        description: "Create a free account to upvote and join the discussion.",
      });
      return;
    }
    const isUndo = myVote === direction;
    // Optimistic update.
    const prevScore = score;
    const prevVote = myVote;
    const nextVote = isUndo ? 0 : direction;
    setMyVote(nextVote);
    setScore(prevScore + (nextVote - prevVote));

    startTransition(async () => {
      let res: VoteResult;
      if (targetType === "thread") {
        res = isUndo
          ? await clearThreadVoteAction(targetId)
          : await voteThreadAction(targetId, direction);
      } else {
        res = isUndo
          ? await clearReplyVoteAction(targetId)
          : await voteReplyAction(targetId, direction);
      }
      if (res.ok) {
        setScore(res.score);
        setMyVote(res.userValue);
      } else {
        // Roll back.
        setScore(prevScore);
        setMyVote(prevVote);
        toast.error(res.error);
      }
    });
  }

  const up = myVote === 1;
  const down = myVote === -1;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={up}
        disabled={pending}
        onClick={() => cast(1)}
        className={`rounded p-0.5 transition-colors hover:text-link disabled:opacity-50 ${
          up ? "text-link" : "text-muted-foreground"
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span
        className={`min-w-[2ch] text-center text-sm font-medium tabular-nums ${
          up ? "text-link" : down ? "text-destructive" : "text-foreground"
        }`}
      >
        {score}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={down}
        disabled={pending}
        onClick={() => cast(-1)}
        className={`rounded p-0.5 transition-colors hover:text-destructive disabled:opacity-50 ${
          down ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
      {!isLoggedIn ? (
        <Link
          href={loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : "/login"}
          className="sr-only"
        >
          Sign in to vote
        </Link>
      ) : null}
    </div>
  );
}
