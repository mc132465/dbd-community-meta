"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteCommentAction } from "@/app/(main)/builds/[slug]/actions";
import type { CommentView } from "@/lib/services/engagement.service";

type Props = {
  comment: CommentView;
  onDeleted: (id: string) => void;
};

export function CommentItem({ comment, onDeleted }: Props) {
  const [pending, startTransition] = useTransition();
  const author =
    comment.authorDisplayName ||
    (comment.authorUsername ? `@${comment.authorUsername}` : "Unknown");

  function onDelete() {
    startTransition(async () => {
      const res = await deleteCommentAction(comment.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onDeleted(comment.id);
    });
  }

  return (
    <li className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{author}</span>
        <div className="flex items-center gap-3">
          <time className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </time>
          {comment.canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={pending}
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
            >
              {pending ? "Removing…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
        {comment.body}
      </p>
    </li>
  );
}
