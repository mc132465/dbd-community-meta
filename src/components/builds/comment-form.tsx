"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCommentAction } from "@/app/(main)/builds/[slug]/actions";
import type { CommentView } from "@/lib/services/engagement.service";

const MAX = 2000;

type Props = {
  buildId: string;
  onCreated: (comment: CommentView) => void;
};

export function CommentForm({ buildId, onCreated }: Props) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const trimmed = body.trim();

  function submit() {
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const res = await createCommentAction({ build_id: buildId, body: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onCreated(res.comment);
      setBody("");
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder="Share your thoughts on this build…"
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={pending}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums text-muted-foreground">
          {body.length}/{MAX}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={pending || trimmed.length === 0}
        >
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </div>
  );
}
