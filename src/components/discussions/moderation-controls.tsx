"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  hideThreadAction,
  restoreThreadAction,
  lockThreadAction,
  unlockThreadAction,
  hideReplyAction,
  restoreReplyAction,
} from "@/app/(main)/discussions/actions";

type ModResult = { ok: true } | { ok: false; error: string };

function ModButton({
  label,
  busyLabel,
  confirmText,
  tone = "default",
  run,
  onDone,
}: {
  label: string;
  busyLabel: string;
  confirmText?: string;
  tone?: "default" | "danger";
  run: () => Promise<ModResult>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        const res = await run();
        setBusy(false);
        if (res.ok) {
          toast.success(`${label} done`);
          onDone?.();
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }}
      className={`rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        tone === "danger"
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

/** Thread-level moderation toolbar (staff only). */
export function ThreadModeration({
  threadId,
  slug,
  status,
  isHidden,
}: {
  threadId: string;
  slug: string;
  status: "open" | "locked" | "archived";
  isHidden: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-500">
        Staff
      </span>
      {isHidden ? (
        <ModButton
          label="Restore thread"
          busyLabel="Restoring…"
          run={() => restoreThreadAction(threadId, slug)}
        />
      ) : (
        <ModButton
          label="Hide thread"
          busyLabel="Hiding…"
          tone="danger"
          confirmText="Hide this thread from public view? It can be restored."
          run={() => hideThreadAction(threadId, slug)}
        />
      )}
      {status === "locked" ? (
        <ModButton
          label="Unlock"
          busyLabel="Unlocking…"
          run={() => unlockThreadAction(threadId, slug)}
        />
      ) : status === "open" ? (
        <ModButton
          label="Lock"
          busyLabel="Locking…"
          run={() => lockThreadAction(threadId, slug)}
        />
      ) : null}
    </div>
  );
}

/** Reply-level moderation buttons (staff only). */
export function ReplyModeration({
  replyId,
  slug,
  isHidden,
}: {
  replyId: string;
  slug: string;
  isHidden: boolean;
}) {
  return isHidden ? (
    <ModButton
      label="Restore"
      busyLabel="Restoring…"
      run={() => restoreReplyAction(replyId, slug)}
    />
  ) : (
    <ModButton
      label="Hide"
      busyLabel="Hiding…"
      tone="danger"
      confirmText="Hide this reply from public view? It can be restored."
      run={() => hideReplyAction(replyId, slug)}
    />
  );
}
