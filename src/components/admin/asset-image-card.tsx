"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AssetThumb, initialsFrom } from "@/components/assets/asset-thumb";
import {
  assignImageAction,
  resetImageAction,
} from "@/app/admin/assets/packs/actions";

export type Target = { id: string; name: string; slug: string };

export type ImageCardData = {
  id: string;
  category: string;
  sourceFile: string;
  imageUrl: string;
  mappingMode: string;
  assetId: string | null;
  assignedName: string | null;
};

/**
 * One pack image: preview, current assignment, and category-scoped controls.
 * `targets` are already limited to the image's category, so the picker can
 * never assign across categories.
 */
export function AssetImageCard({
  image,
  targets,
  assignable,
}: {
  image: ImageCardData;
  targets: Target[];
  assignable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? targets.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.slug.toLowerCase().includes(q),
        )
      : targets;
    return list.slice(0, 50);
  }, [targets, query]);

  async function assign(assetId: string) {
    setBusy(true);
    const r = await assignImageAction(image.id, assetId);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Assignment failed");
      return;
    }
    toast.success("Assigned");
    setOpen(false);
    setQuery("");
    router.refresh();
  }

  async function reset() {
    setBusy(true);
    const r = await resetImageAction(image.id);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Reset failed");
      return;
    }
    toast.success("Reset to automatic");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-border/60">
          <AssetThumb
            src={image.imageUrl}
            alt={image.sourceFile}
            fallbackLabel={initialsFrom(image.sourceFile)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground" title={image.sourceFile}>
            {image.sourceFile}
          </p>
          <p className="mt-1 text-sm">
            {image.assignedName ? (
              <span className="font-medium">{image.assignedName}</span>
            ) : (
              <span className="text-amber-500">Unmapped</span>
            )}
          </p>
          <span
            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              image.mappingMode === "manual"
                ? "border-primary/40 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {image.mappingMode}
          </span>
        </div>
      </div>

      {assignable ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={busy}
            className="rounded-md border border-border px-2 py-1 text-xs hover:border-foreground/40 disabled:opacity-50"
          >
            {image.assetId ? "Reassign" : "Assign"}
          </button>
          {image.mappingMode === "manual" ? (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-foreground/40 disabled:opacity-50"
            >
              Reset to auto
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          This category has no catalog target.
        </p>
      )}

      {open && assignable ? (
        <div className="rounded-md border border-border bg-popover p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search targets…"
            className="mb-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search assignment targets"
          />
          <ul className="max-h-52 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No targets match.
              </li>
            ) : (
              filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => assign(t.id)}
                    disabled={busy}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50 ${
                      t.id === image.assetId ? "bg-muted" : ""
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    {t.id === image.assetId ? (
                      <span className="text-[10px] text-primary">current</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
