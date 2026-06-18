import Link from "next/link";
import type { Metadata } from "next";

import { listPendingRevisions } from "@/lib/services/build-revisions.service";

export const metadata: Metadata = { title: "Build revisions · Admin" };

export default async function RevisionsQueuePage() {
  const pending = await listPendingRevisions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Build revisions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edits to public builds awaiting review. Approving applies the change to
          the live build; the public version stays unchanged until then.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          No revisions awaiting review.
        </p>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {r.buildTitle || `${r.buildSlug} loadout`}
                </p>
                <p className="text-xs text-muted-foreground">
                  by @{r.authorUsername} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/admin/builds/revisions/${r.id}`}
                className="rounded-md border border-border/60 px-3 py-1.5 text-sm hover:border-border"
              >
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
