"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteOwnReplyAction,
  deleteOwnThreadAction,
} from "@/app/(main)/discussions/actions";

export function DeleteThreadButton({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Delete this discussion? This can't be undone.")) return;
    setBusy(true);
    const result = await deleteOwnThreadAction(threadId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't delete");
      return;
    }
    toast.success("Discussion deleted");
    router.push("/discussions");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs text-destructive hover:underline disabled:opacity-50"
    >
      Delete
    </button>
  );
}

export function DeleteReplyButton({
  replyId,
  threadSlug,
}: {
  replyId: string;
  threadSlug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Delete this reply?")) return;
    setBusy(true);
    const result = await deleteOwnReplyAction(replyId, threadSlug);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't delete");
      return;
    }
    toast.success("Reply deleted");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-xs text-destructive hover:underline disabled:opacity-50"
    >
      Delete
    </button>
  );
}
