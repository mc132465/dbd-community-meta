"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createReplyAction } from "@/app/(main)/discussions/actions";
import { Button } from "@/components/ui/button";

const fieldClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-28";

export function ReplyForm({
  threadId,
  threadSlug,
}: {
  threadId: string;
  threadSlug: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createReplyAction(threadId, threadSlug, body);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't post the reply");
      return;
    }
    setBody("");
    toast.success("Reply posted");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        className={fieldClass}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        aria-label="Reply"
      />
      <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
        {submitting ? "Posting…" : "Post reply"}
      </Button>
    </form>
  );
}
