"use client";

import { useState } from "react";
import Link from "next/link";

import type { CommentView } from "@/lib/services/engagement.service";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

type Props = {
  buildId: string;
  isLoggedIn: boolean;
  loginHref: string;
  initialComments: CommentView[];
};

export function CommentSection({
  buildId,
  isLoggedIn,
  loginHref,
  initialComments,
}: Props) {
  const [comments, setComments] = useState<CommentView[]>(initialComments);

  return (
    <section id="comments" className="mt-12">
      <h2 className="mb-4 font-display text-xl font-semibold uppercase tracking-wide">
        Comments <span className="text-muted-foreground">({comments.length})</span>
      </h2>

      {isLoggedIn ? (
        <CommentForm
          buildId={buildId}
          onCreated={(c) => setComments((prev) => [...prev, c])}
        />
      ) : (
        <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
          <Link
            href={loginHref}
            className="font-medium text-foreground hover:text-link-hover"
          >
            Log in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts.
          </li>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onDeleted={(id) =>
                setComments((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))
        )}
      </ul>
    </section>
  );
}
