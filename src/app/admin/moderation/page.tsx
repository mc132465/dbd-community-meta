import Link from "next/link";
import type { Metadata } from "next";

import { listOpenReportsWithContext } from "@/lib/services/discussion-moderation.service";
import {
  ReportActions,
  type ReportActionData,
} from "@/components/admin/report-actions";

export const metadata: Metadata = { title: "Moderation queue" };
export const dynamic = "force-dynamic";

export default async function ModerationQueuePage() {
  const reports = await listOpenReportsWithContext();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
          Reports queue
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {reports.length === 0
            ? "No open reports. Nothing to review."
            : `${reports.length} open ${reports.length === 1 ? "report" : "reports"}.`}
        </p>
      </div>

      {reports.length > 0 ? (
        <ul className="space-y-3">
          {reports.map((r) => {
            const ctx = r.context;

            // Build the action payload from the report context.
            const actionData: ReportActionData =
              ctx.kind === "thread"
                ? {
                    reportId: r.id,
                    kind: "thread",
                    threadId: ctx.threadId,
                    slug: ctx.slug,
                    status: ctx.status,
                    hidden: ctx.hidden,
                  }
                : ctx.kind === "reply"
                  ? {
                      reportId: r.id,
                      kind: "reply",
                      replyId: ctx.replyId,
                      threadId: ctx.threadId,
                      slug: ctx.slug,
                      status: ctx.status,
                      hidden: ctx.hidden,
                    }
                  : { reportId: r.id, kind: "missing" };

            return (
              <li
                key={r.id}
                className="space-y-3 rounded-lg border border-border/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      r.targetType === "thread"
                        ? "border-sky-500/40 text-sky-400"
                        : "border-violet-500/40 text-violet-400"
                    }`}
                  >
                    {r.targetType === "thread" ? "Thread report" : "Reply report"}
                  </span>
                  {ctx.kind !== "missing" && ctx.hidden ? (
                    <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] uppercase text-amber-500">
                      hidden
                    </span>
                  ) : null}
                  {ctx.kind !== "missing" && ctx.status !== "open" ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {ctx.status}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    reported by {r.reporterName} ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Context */}
                {ctx.kind === "missing" ? (
                  <p className="text-sm text-muted-foreground">
                    The reported content no longer exists.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <Link
                      href={`/discussions/${ctx.slug}`}
                      className="text-sm font-medium text-link hover:text-link-hover hover:underline"
                    >
                      {ctx.title}
                    </Link>
                    {ctx.kind === "reply" ? (
                      <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-2 text-sm text-muted-foreground">
                        {ctx.excerpt}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Reason */}
                <p className="text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {r.reason}
                </p>

                <ReportActions data={actionData} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
