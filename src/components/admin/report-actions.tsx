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
import { resolveReportAction } from "@/app/admin/moderation/actions";

type ModResult = { ok: true } | { ok: false; error: string };
type Status = "open" | "locked" | "archived";

export type ReportActionData =
  | {
      reportId: string;
      kind: "thread";
      threadId: string;
      slug: string;
      status: Status;
      hidden: boolean;
    }
  | {
      reportId: string;
      kind: "reply";
      replyId: string;
      threadId: string;
      slug: string;
      status: Status;
      hidden: boolean;
    }
  | { reportId: string; kind: "missing" };

function Btn({
  label,
  busyLabel,
  tone = "default",
  confirmText,
  run,
}: {
  label: string;
  busyLabel: string;
  tone?: "default" | "danger" | "primary";
  confirmText?: string;
  run: () => Promise<ModResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls =
    tone === "danger"
      ? "border-destructive/40 text-destructive hover:bg-destructive/10"
      : tone === "primary"
        ? "border-primary/40 text-primary hover:bg-primary/10"
        : "border-border text-muted-foreground hover:text-foreground";
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
          router.refresh();
        } else {
          toast.error(res.error);
        }
      }}
      className={`rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${cls}`}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

/** Action row for a single report in the moderation queue. */
export function ReportActions({ data }: { data: ReportActionData }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {data.kind === "thread" ? (
        <>
          {data.hidden ? (
            <Btn
              label="Restore thread"
              busyLabel="Restoring…"
              run={() => restoreThreadAction(data.threadId, data.slug)}
            />
          ) : (
            <Btn
              label="Hide thread"
              busyLabel="Hiding…"
              tone="danger"
              confirmText="Hide this thread from public view? It can be restored."
              run={() => hideThreadAction(data.threadId, data.slug)}
            />
          )}
          {data.status === "locked" ? (
            <Btn
              label="Unlock"
              busyLabel="Unlocking…"
              run={() => unlockThreadAction(data.threadId, data.slug)}
            />
          ) : data.status === "open" ? (
            <Btn
              label="Lock"
              busyLabel="Locking…"
              run={() => lockThreadAction(data.threadId, data.slug)}
            />
          ) : null}
        </>
      ) : null}

      {data.kind === "reply" ? (
        <>
          {data.hidden ? (
            <Btn
              label="Restore reply"
              busyLabel="Restoring…"
              run={() => restoreReplyAction(data.replyId, data.slug)}
            />
          ) : (
            <Btn
              label="Hide reply"
              busyLabel="Hiding…"
              tone="danger"
              confirmText="Hide this reply from public view? It can be restored."
              run={() => hideReplyAction(data.replyId, data.slug)}
            />
          )}
          {data.status === "locked" ? (
            <Btn
              label="Unlock thread"
              busyLabel="Unlocking…"
              run={() => unlockThreadAction(data.threadId, data.slug)}
            />
          ) : data.status === "open" ? (
            <Btn
              label="Lock thread"
              busyLabel="Locking…"
              run={() => lockThreadAction(data.threadId, data.slug)}
            />
          ) : null}
        </>
      ) : null}

      <Btn
        label="Resolve"
        busyLabel="Resolving…"
        tone="primary"
        run={() => resolveReportAction(data.reportId)}
      />
    </div>
  );
}
