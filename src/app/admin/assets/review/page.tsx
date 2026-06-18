import type { Metadata } from "next";

import {
  listReviewQueue,
  listTargetOptions,
  type TargetOption,
} from "@/lib/services/asset-review.service";
import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import { assignAction, confirmAction, rejectAction, resetAction } from "./actions";

export const metadata: Metadata = { title: "Asset review · Admin" };

function pct(c: number | null): string {
  if (c === null || c === undefined) return "—";
  return `${Math.round(c * 100)}%`;
}

export default async function AssetReviewPage() {
  const queue = await listReviewQueue(200);

  const types = [...new Set(queue.map((q) => q.assetType))];
  const optionsByType: Record<string, TargetOption[]> = {};
  for (const t of types) optionsByType[t] = await listTargetOptions(t);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
          Asset review
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Images the importer wasn&apos;t sure about. Everything it was confident
          about is already live; only the uncertain ones land here.
        </p>
      </div>

      <div className="space-y-1 rounded-lg border border-border/60 bg-card p-4 text-sm">
        <p className="font-medium">What the buttons do</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Confirm</strong> — use this image
            for the suggested match (shown below the filename).
          </li>
          <li>
            <strong className="text-foreground">Manual map</strong> — pick the
            correct catalog target yourself, then Assign.
          </li>
          <li>
            <strong className="text-foreground">Reject</strong> — don&apos;t use this
            image at all.
          </li>
          <li>
            <strong className="text-foreground">Reset to auto</strong> — re-run
            automatic matching for this image.
          </li>
        </ul>
      </div>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground">
          Nothing to review. Either no pack has been imported, or every image was
          matched confidently.
        </p>
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="flex flex-wrap items-start gap-4">
                <AssetThumb
                  src={item.imageUrl}
                  alt={item.sourceFile}
                  fallbackLabel={initialsFrom(item.sourceFile)}
                  className="h-14 w-14 rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.sourceFile}</p>
                  <p className="text-xs text-muted-foreground">
                    category: {item.assetType}
                    {item.derivedSlug ? ` · slug: ${item.derivedSlug}` : ""} ·
                    confidence: {pct(item.confidence)}
                  </p>
                  <p className="mt-1 text-sm">
                    Suggested:{" "}
                    {item.suggestedName ? (
                      <span className="font-medium text-primary">
                        {item.suggestedName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">none</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-2">
                  <div className="flex gap-2">
                    <form action={confirmAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        disabled={!item.suggestedId && !item.currentId}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                      >
                        Confirm
                      </button>
                    </form>
                    <form action={rejectAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                        Reject
                      </button>
                    </form>
                    <form action={resetAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:border-border">
                        Reset to auto
                      </button>
                    </form>
                  </div>

                  <form action={assignAction} className="flex gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <select
                      name="assetId"
                      defaultValue=""
                      className="max-w-[200px] rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
                    >
                      <option value="" disabled>
                        Manual map…
                      </option>
                      {(optionsByType[item.assetType] ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:border-border">
                      Assign
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
